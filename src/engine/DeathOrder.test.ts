import { describe, it, expect } from 'vitest';

import { battleReducer } from './battleReducer';
import { executeCostCalculated } from './resolutionEngine';
import { isUnaffordableCost, blockedCostReason } from './core/CustomFirmware';
import { GetProgramData } from './data/programRegistry';
import { registerHook } from './core/HookRegistry';
import { HookFactory } from './core/HookFactory';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import type { IBattleState } from './types';

/**
 * TICKET 105 - THE DEAD DO NOT WIN.
 *
 * From Henry's round-3 playtest, `playtest-results/round-3/snapshot-t4-77031961.scenario.json`:
 * Hel 0/80 against Control 0/87, and the game gave him the victory screen. His note: *"I could
 * play Last Rites at the end of the game, but I died first yet still got the victory."*
 *
 * The battle log names the mechanism exactly:
 *
 *     Hel takes 10 damage  DEFEATED
 *     Hel's UNDERWORLD_GATEWAY pays 10 HP in blood!
 *     Hel plays Last Rites -> Control
 *     Control takes 17 damage  DEFEATED
 *
 * UNDERWORLD_GATEWAY charges Hel's HP for Dark spells during `onActionStart` - INSIDE the card it
 * is paying for. `handlePlayProgram` checks that the caster is alive before the card starts and
 * never again, so the toll killed her and the card resolved anyway. A corpse killed Control.
 *
 * Two fixes, pinned separately here because they protect different things:
 *   1. the cost hook refuses a cast whose blood price would be lethal - the design answer Henry
 *      already recorded on the ticket, and the reason his card was greyed out at all;
 *   2. `handlePlayProgram` bails if the caster died during `onActionStart` - the general guard,
 *      so the next mechanic that can kill its own caster mid-cast does not rediscover this.
 *
 * The test builds the state rather than loading the snapshot: a unit test that reads a playtest
 * artifact breaks when someone tidies the artifacts, and the snapshot's value is the diagnosis,
 * which is recorded above.
 */

function helAt(hp: number): { state: IBattleState; helId: string; enemyId: string } {
    const setup = matchupScenario({
        player: 'hel', enemy: 'control', playerOS: 'hel_v2', enemyOS: 'control_v1', seed: 'death-order',
    });
    const base = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    const state = {
        ...base,
        activeSide: 'PLAYER',
        playerParty: base.playerParty.map((e, i) => i === 0 ? { ...e, currentHp: hp } : e),
    } as IBattleState;
    return { state, helId: state.playerParty[0].id, enemyId: state.enemyParty[0].id };
}

/** Her cheapest Dark spell, so the blood price is as small as it gets. */
const DARK_CARD = 'venom_shade';

describe('ticket 105: a lethal cost cannot be paid', () => {
    it('a Dark cast whose blood price exceeds her remaining HP is unaffordable', () => {
        const { state, helId } = helAt(3);
        const hel = state.playerParty.find(e => e.id === helId)!;
        const { cost } = executeCostCalculated(state, hel, undefined, GetProgramData(DARK_CARD), 1);
        expect(isUnaffordableCost(cost)).toBe(true);
    });

    it('the same cast is affordable at full HP', () => {
        const { state, helId } = helAt(80);
        const hel = state.playerParty.find(e => e.id === helId)!;
        const { cost } = executeCostCalculated(state, hel, undefined, GetProgramData(DARK_CARD), 1);
        expect(isUnaffordableCost(cost)).toBe(false);
    });

    it('the block carries a reason in words, not the 999 sentinel', () => {
        // Henry, at 23 HP: "Last Rites says it costs 999 energy/HP? Would it kill me and thats
        // why I can't play it?" - yes, and the UI simply failed to say so.
        const { state, helId } = helAt(3);
        const hel = state.playerParty.find(e => e.id === helId)!;
        const reason = blockedCostReason(state, hel, GetProgramData(DARK_CARD));
        expect(reason).toMatch(/more than you have left/);
    });

    it('a card with no reason to be blocked reports none', () => {
        const { state, helId } = helAt(80);
        const hel = state.playerParty.find(e => e.id === helId)!;
        expect(blockedCostReason(state, hel, GetProgramData(DARK_CARD))).toBeNull();
    });
});

describe('ticket 105: a caster that dies mid-cast does not finish the card', () => {
    it('the reducer refuses the play outright when the blood price is lethal', () => {
        const { state, helId, enemyId } = helAt(3);
        const withCard = {
            ...state,
            playerDeck: {
                ...state.playerDeck,
                hand: [{ id: 'blood_card', dataId: DARK_CARD, currentCost: 1, isPlayable: true }],
            },
        } as IBattleState;
        const enemyBefore = withCard.enemyParty.find(e => e.id === enemyId)!.currentHp;

        const after = battleReducer(withCard, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: helId, targetId: enemyId, programId: 'blood_card' },
        });

        // She is alive, the enemy is untouched, and the card is still in hand.
        expect(after.playerParty.find(e => e.id === helId)!.currentHp).toBe(3);
        expect(after.enemyParty.find(e => e.id === enemyId)!.currentHp).toBe(enemyBefore);
        expect(after.playerDeck.hand.map(c => c.id)).toContain('blood_card');
    });

    it('the general guard: ANY hook that kills the caster during onActionStart fizzles the card', () => {
        // Hel's cost hook now stops her before she ever reaches the guard, so driving the guard
        // needs a caster that dies mid-cast for some OTHER reason. A test-only hook does exactly
        // that: it is the shape of every future mechanic that can charge HP without a cost gate,
        // and it is the thing the guard exists for. Without the guard this test's enemy dies.
        // Through `HookFactory`, exactly as `firmwareRegistry` builds every data hook - a raw
        // object in the registry is inert, which cost one confused test run to learn.
        registerHook(HookFactory.createHook({
            id: 'test_105_suicide_toll',
            trigger: 'onActionStart',
            priority: 75,                       // GLOBAL - before the card's own actions resolve
            when: { source: 'SELF' },
            do: [{ type: 'HP' as never, target: 'SELF', amount: -9999 }],
        }));

        const { state, helId, enemyId } = helAt(80);
        const enemyBefore = state.enemyParty.find(e => e.id === enemyId)!.currentHp;
        const rigged = {
            ...state,
            playerParty: state.playerParty.map(e =>
                e.id === helId ? { ...e, hooks: [...(e.hooks ?? []), 'test_105_suicide_toll'] } : e),
            playerDeck: {
                ...state.playerDeck,
                // A NON-Dark card, so hel's own blood hook stays out of the way entirely.
                hand: [{ id: 'plain_card', dataId: 'dawnstrike', currentCost: 1, isPlayable: true }],
            },
        } as IBattleState;

        const after = battleReducer(rigged, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: helId, targetId: enemyId, programId: 'plain_card' },
        });

        expect(after.playerParty.find(e => e.id === helId)!.currentHp).toBeLessThanOrEqual(0);
        expect(after.enemyParty.find(e => e.id === enemyId)!.currentHp,
            'a dead caster must not land the card that killed it').toBe(enemyBefore);
    });
});
