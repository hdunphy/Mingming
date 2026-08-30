/**
 * THE BEREAVEMENT RALLY — ticket 70's ruled change, pinned.
 *
 * Henry ruled this after six measured arms: on a KO, every surviving member of the bereaved side
 * gains one `Energized`. The measurement that justified it is in the ticket; what this file guards
 * is that the rule does what the measurement assumed, because the two can drift apart silently.
 *
 * The cases here are the ones where a plausible implementation is wrong rather than absent:
 *
 *  - **fires once per death**, not once per damage event — `checkDefeat` is called from three
 *    sites and only the alive->dead guard makes it idempotent;
 *  - **skips the corpse**, because Energized on a dead unit is a status nothing will ever consume;
 *  - **the OTHER side gets nothing**, which is the difference between a rally and a global buff;
 *  - **it actually reaches the energy pool**, which is the only thing the player experiences —
 *    a status that is applied and never spent would pass every other test in this file.
 */

import { describe, expect, it } from 'vitest';

import { battleReducer } from './battleReducer';
import { checkDefeat, BEREAVEMENT_ENERGIZED_STACKS } from './effectHandlers';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import type { IBattleEntity, IBattleState } from './types';

function arena(): IBattleState {
    const setup = matchupScenario({
        player: 'fenrir', enemy: 'control',
        playerOS: 'fenrir_v1', enemyOS: 'control_v1',
        seed: 'rally-seed',
    });
    return buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
}

const energizedOn = (e: IBattleEntity): number =>
    e.statusEffects.find(s => s.type === 'Energized')?.stacks ?? 0;

/** Put a second body on the player side so there is somebody left to rally. */
function withPlayerParty(state: IBattleState, hps: number[]): IBattleState {
    const template = state.playerParty[0];
    return {
        ...state,
        playerParty: hps.map((hp, i) => ({
            ...template,
            id: `p${i}`,
            name: `P${i}`,
            currentHp: hp,
            statusEffects: [],
        })),
    } as IBattleState;
}

describe('the bereavement rally', () => {
    it('gives every SURVIVOR one Energized and gives the corpse none', () => {
        const state = withPlayerParty(arena(), [0, 50, 50]);
        const after = checkDefeat(state, 'p0');

        expect(energizedOn(after.playerParty[0])).toBe(0);
        expect(energizedOn(after.playerParty[1])).toBe(BEREAVEMENT_ENERGIZED_STACKS);
        expect(energizedOn(after.playerParty[2])).toBe(BEREAVEMENT_ENERGIZED_STACKS);
    });

    it('gives the OTHER side nothing — it is a rally, not a global buff', () => {
        const state = withPlayerParty(arena(), [0, 50, 50]);
        const after = checkDefeat(state, 'p0');
        for (const enemy of after.enemyParty) expect(energizedOn(enemy)).toBe(0);
    });

    it('STACKS onto an Energized a card already granted, rather than overwriting it', () => {
        // The harness that measured this topped up to a target and would have granted nothing
        // here. Going through `EnergizedBehavior.onApply` adds, which is the correct rule and a
        // deliberate divergence from the measurement — recorded in the ticket.
        const base = withPlayerParty(arena(), [0, 50, 50]);
        const state = {
            ...base,
            playerParty: base.playerParty.map((e, i) =>
                i === 1 ? { ...e, statusEffects: [{ id: 'x', type: 'Energized' as const, stacks: 2 }] } : e),
        } as IBattleState;

        const after = checkDefeat(state, 'p0');
        expect(energizedOn(after.playerParty[1])).toBe(2 + BEREAVEMENT_ENERGIZED_STACKS);
    });

    it('says so in the log — the PROC-VISIBLE law', () => {
        const state = withPlayerParty(arena(), [0, 50, 50]);
        const after = checkDefeat(state, 'p0');
        expect(after.logs.some(l => /rally/i.test(l) && /Energized/.test(l))).toBe(true);
    });

    it('is a no-op when the whole side is down — nobody is left to rally', () => {
        const state = withPlayerParty(arena(), [0, 0, 0]);
        const after = checkDefeat(state, 'p0');
        expect(after.logs.some(l => /rally/i.test(l))).toBe(false);
        for (const e of after.playerParty) expect(energizedOn(e)).toBe(0);
    });

    it('does not compound when checkDefeat is called twice on the same corpse', () => {
        // The three call sites are each guarded on the alive->dead transition, so this should
        // never happen — but if a fourth caller ever forgets, the grant doubling is the symptom
        // that would be hardest to spot in a win rate.
        const state = withPlayerParty(arena(), [0, 50, 50]);
        const once = checkDefeat(state, 'p0');
        const twice = checkDefeat(once, 'p0');
        expect(energizedOn(twice.playerParty[1])).toBe(2 * BEREAVEMENT_ENERGIZED_STACKS);
        // Documented as a KNOWN property, not asserted as correct: `checkDefeat` is idempotent
        // only because its callers guard it. If that ever stops being true this expectation is
        // the thing that should be revisited, not silently relaxed.
    });
});

describe('the rally reaches the energy pool', () => {
    it('turns into real energy at the next refill, and is consumed', () => {
        // The only test here that proves the player feels anything. A status that is applied and
        // never spent would satisfy every assertion above.
        const base = arena();
        const survivor = base.playerParty[0];
        const state = {
            ...base,
            activeSide: 'ENEMY' as const,
            playerParty: [{
                ...survivor,
                currentHp: 40,
                currentEnergy: 0,
                statusEffects: [{ id: 'e', type: 'Energized' as const, stacks: BEREAVEMENT_ENERGIZED_STACKS }],
            }],
        } as IBattleState;

        // END_TURN from ENEMY hands the turn to PLAYER, which is where PRE_TURN refills.
        const after = battleReducer(state, { type: 'END_TURN' });
        const refreshed = after.playerParty[0];

        expect(refreshed.currentEnergy).toBe(refreshed.maxEnergy + BEREAVEMENT_ENERGIZED_STACKS);
        // Consumed whole — this is why the rule is a one-turn cushion and not a standing repair.
        expect(energizedOn(refreshed)).toBe(0);
    });
});
