/**
 * TICKET 160-e1 — a card that says "an ally" lands on an ally, from every direction.
 *
 * Three enforcement points and one data invariant, because the picker is not a rule: the UI
 * governs what a pointer may drop on, and the scenario files, the replay harness, the balance
 * corpus and the AI all reach `PLAY_PROGRAM` without going near it. Before this ticket the loosest
 * of those paths was the effective rule.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { GetProgramData, getInflatedProgramRegistry } from './data/programRegistry';
import { isValidCardTarget, describeLegalTargets, shortTargetLabel } from '../ui/utils/targeting';
import { calculatePowerscale } from '../debug/balance/powerscale';
import type { IBattleState, IBattleEntity, ProgramData } from './types';

/** The eight cards 162 §5.4 shipped on a fallback until this ticket landed. */
const ALLY_CARDS = ['soothe', 'mend', 'tend', 'bolster', 'shell_share'] as const;
const ALLY_SIDE_CARDS = ['howl', 'verdant_ward', 'tidal_battery'] as const;

const FRAME = 1000;
const unit = (id: string, name: string): IBattleEntity =>
    createSparseEntity({ id, name, currentHp: FRAME / 2, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5 });

const stacks = (e: IBattleEntity, type: string): number =>
    e.statusEffects.filter(s => s.type === type).reduce((n, s) => n + s.stacks, 0);

/** `casterId` plays `dataId` at `targetId` on a 3v3 board. */
function play(dataId: string, casterId: string, targetId: string): IBattleState {
    const casterIsEnemy = casterId.startsWith('e');
    const deck = {
        ownerId: casterIsEnemy ? 'ENEMY' : 'PLAYER',
        deck: [], drawpile: [], discard: [], exhaust: [],
        hand: [{ id: 'h1', dataId, currentCost: GetProgramData(dataId).baseCost as number, isPlayable: true }],
    };
    const empty = { ownerId: '', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] };
    const state: IBattleState = createSparseBattleState({
        activeSide: casterIsEnemy ? 'ENEMY' : 'PLAYER',
        phase: 'ACTION',
        playerParty: [unit('p1', 'Caster'), unit('p2', 'Ally'), unit('p3', 'Other')],
        enemyParty: [unit('e1', 'Foe'), unit('e2', 'Foe 2'), unit('e3', 'Foe 3')],
        playerDeck: casterIsEnemy ? { ...empty, ownerId: 'PLAYER' } : deck,
        enemyDeck: casterIsEnemy ? deck : { ...empty, ownerId: 'ENEMY' },
    });
    return battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: casterId, targetId, programId: 'h1' },
    } as never);
}

describe('160-e1 — the data', () => {
    it('flags exactly the eight cards the collection prints as ally-facing', () => {
        const flagged = Object.values(getInflatedProgramRegistry())
            .filter((p) => (p as ProgramData).allyTarget)
            .map((p) => (p as ProgramData).id)
            .sort();
        expect(flagged).toEqual([...ALLY_CARDS, ...ALLY_SIDE_CARDS].sort());
    });

    it('never combines allyTarget with Self — a Self card has no target to pick', () => {
        const contradictions = Object.values(getInflatedProgramRegistry())
            .filter((p) => (p as ProgramData).allyTarget && (p as ProgramData).target === 'Self')
            .map((p) => (p as ProgramData).id);
        expect(contradictions).toEqual([]);
    });

    it('aims every ally card\'s payload at TARGET, not SELF', () => {
        // The half that would fail silently: a flag that says "pick an ally" on a card whose
        // actions all resolve on SELF is the fallback this ticket replaced, still shipping.
        for (const id of ALLY_CARDS) {
            const nonSelf = GetProgramData(id).actions.filter((a) => a.target !== 'SELF');
            expect(nonSelf.length, `${id} resolves entirely on its caster`).toBeGreaterThan(0);
        }
    });
});

describe('160-e1 — the picker', () => {
    it.each([...ALLY_CARDS, ...ALLY_SIDE_CARDS])('%s may be dropped on an ally and not on an enemy', (id) => {
        const data = GetProgramData(id);
        expect(isValidCardTarget(data, false), `${id} on an ally`).toBe(true);
        expect(isValidCardTarget(data, true), `${id} on an enemy`).toBe(false);
    });

    it('says which, in the legend and on the card', () => {
        expect(describeLegalTargets(GetProgramData('bolster'))).toBe('ONE ALLY (OR YOURSELF)');
        expect(shortTargetLabel(GetProgramData('bolster'))).toBe('ALLY');
        expect(describeLegalTargets(GetProgramData('howl'))).toBe('YOUR SIDE');
        expect(shortTargetLabel(GetProgramData('howl'))).toBe('ALLIES');
    });

    it('a buff with no HEAL is the case the old carve-out got wrong', () => {
        // `bolster` is 3 Sharp and nothing else. Under the pre-160-e1 rule — "a card carrying a
        // HEAL or a STATUS may be pointed at an ally" — it was ALSO legal on an enemy, because
        // that rule is a widening and a widening cannot express a restriction.
        expect(GetProgramData('bolster').actions.some((a) => a.type === 'HEAL')).toBe(false);
        expect(isValidCardTarget(GetProgramData('bolster'), true)).toBe(false);
    });
});

describe('160-e1 — the reducer, which is the rule', () => {
    it('lands the buff on the chosen ally, not the caster', () => {
        const state = play('bolster', 'p1', 'p2');
        expect(stacks(state.playerParty[1], 'Sharp'), 'the ally').toBe(3);
        expect(stacks(state.playerParty[0], 'Sharp'), 'the caster').toBe(0);
    });

    it('lets a caster still choose itself', () => {
        const state = play('bolster', 'p1', 'p1');
        expect(stacks(state.playerParty[0], 'Sharp')).toBe(3);
    });

    it('heals the chosen ally', () => {
        const before = FRAME / 2;
        const state = play('mend', 'p1', 'p2');
        expect(state.playerParty[1].currentHp).toBeGreaterThan(before);
        expect(state.playerParty[0].currentHp).toBe(before);
    });

    it('REFUSES the play outright when it is aimed across the line', () => {
        const state = play('bolster', 'p1', 'e1');
        expect(stacks(state.enemyParty[0], 'Sharp'), 'the enemy gains nothing').toBe(0);
        // And the card is still in hand: a refused play is a no-op, not a wasted card.
        expect(state.playerDeck.hand).toHaveLength(1);
        expect(state.playerParty[0].currentEnergy, 'no Energy spent').toBe(5);
    });

    it('a side card reaches every living ally and no enemy', () => {
        const state = play('howl', 'p1', 'p2');
        expect(state.playerParty.map((e) => stacks(e, 'Strengthened'))).toEqual([1, 1, 1]);
        expect(state.enemyParty.map((e) => stacks(e, 'Strengthened'))).toEqual([0, 0, 0]);
    });

    it('an ENEMY casting one buffs its own side — the flag is about sides, not about the player', () => {
        const state = play('howl', 'e1', 'e2');
        expect(state.enemyParty.map((e) => stacks(e, 'Strengthened'))).toEqual([1, 1, 1]);
        expect(state.playerParty.map((e) => stacks(e, 'Strengthened'))).toEqual([0, 0, 0]);
    });
});

describe('160-e1 — the scorer knows an ally card lands on your side (162b)', () => {
    /*
     * The bug this file caught by existing: every sign flip in `powerscale` asks "is this happening
     * to me or to them", and it asked it as `action.target === 'SELF'` — which was the same question
     * until this ticket, because TARGET could only ever mean an enemy.
     *
     * `soothe` is the witness. "Remove 1 stack of a debuff from an ally" is written as negative
     * stacks on TARGET, so the model read it as APPLYING two debuffs to a friend and priced the card
     * at -0.8: a card that helps you, scored as a cost, and routed to MANUAL REVIEW where a human
     * would have to notice. That is ticket 47's bug re-created from the other direction.
     */
    it('prices a debuff REMOVAL from an ally as a gain, not a cost', () => {
        const scored = calculatePowerscale(GetProgramData('soothe'));
        expect(scored.score, 'soothe helps your side').toBeGreaterThan(0);
    });

    it('prices a buff on an ally as a gain for every one of the eight', () => {
        for (const id of [...ALLY_CARDS, ...ALLY_SIDE_CARDS]) {
            expect(calculatePowerscale(GetProgramData(id)).score, `${id}`).toBeGreaterThan(0);
        }
    });

    it('still penalises a buff handed to an ENEMY — the flip it must not lose', () => {
        // The guard on the fix: `landsOnOwnSide` widens the test, so the case it was written for
        // has to keep failing. A card with an ATTACK that also buffs its target is buffing a foe.
        const enemyBuff = { ...GetProgramData('bolster'), id: 'test_enemy_buff', allyTarget: false,
            actions: [{ type: 'ATTACK', power: 10, target: 'TARGET' },
                { type: 'STATUS', status: 'Sharp', stacks: 3, target: 'TARGET' }] } as ProgramData;
        const withAlly = { ...enemyBuff, id: 'test_ally_buff', allyTarget: true } as ProgramData;
        expect(calculatePowerscale(withAlly).score).toBeGreaterThan(calculatePowerscale(enemyBuff).score);
    });
});
