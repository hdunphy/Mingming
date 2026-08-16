import { describe, it, expect, afterEach } from 'vitest';
import { AttackExecutor, DRAW_SCALING_CAP, PLAY_COUNT_SCALING_CAP } from './actions/ActionExecutors';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import { GetProgramData } from './data/programRegistry';
import type { IBattleState, IBattleEntity, ProgramData } from './types';
import type { HookContext } from './core/Hooks';

/**
 * Ticket 73 — the per-event-count scalers had NO ceiling, and that is what made a first-turn
 * kill reachable.
 *
 * All 43 FTKs in ticket 69's 480-cell census were `jormungandr_v1` on turn one and the chain
 * was always identical: two 0-cost `undertow` cantrips, OUROBOROS_LOOP's once-per-turn +1
 * Energy and +1 draw, `surge_protection`'s refund, then `ink_stream` at 33 power x 3 triggered
 * draws = **99 power from a one-energy card**. The energy accounting was correct throughout —
 * the unbounded multiplier was the defect, and it is the last scaler in the engine that had no
 * cap (`STRENGTH_STACK_CAP` 8, `MISSING_HP_PCT_CAP` 50, status percentages 25%).
 *
 * The pre-fix arm is measurably the cause and not a coincidence: reverting ONLY `ink_stream`
 * to its pre-ticket-71 footing takes the full-field count from 43 FTKs to 0.
 */

const state = (): IBattleState =>
    buildScenarioState({ ...matchupScenario({ player: 'jormungandr', enemy: 'skoll', playerOS: 'jormungandr_v1' }), seed: 'caps' });

const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t, e) => t + e.currentHp, 0);

/** Fire a bare ATTACK with `scaling` from player[0] into enemy[0] on a doctored counter. */
function hit(scaling: string, power: number, counters: Partial<IBattleState>): number {
    const s = { ...state(), ...counters } as IBattleState;
    const before = hp(s.enemyParty);
    const next = new AttackExecutor().execute(
        s, s.playerParty[0].id, s.enemyParty[0].id,
        { type: 'ATTACK', power, scaling, target: 'TARGET' } as never,
        { element: 'Water' } as ProgramData, { state: s, triggerDepth: 0 } as HookContext);
    return before - hp(next.enemyParty);
}

const LIVE = { draw: DRAW_SCALING_CAP.value, play: PLAY_COUNT_SCALING_CAP.value };
afterEach(() => { DRAW_SCALING_CAP.value = LIVE.draw; PLAY_COUNT_SCALING_CAP.value = LIVE.play; });

describe('the shipped caps', () => {
    it('are 2 for the self-accelerating draw scalers and 3 for the energy-braked ones', () => {
        expect(DRAW_SCALING_CAP.value).toBe(2);
        expect(PLAY_COUNT_SCALING_CAP.value).toBe(3);
        expect(PLAY_COUNT_SCALING_CAP.value).toBeGreaterThan(DRAW_SCALING_CAP.value);
    });
});

describe('DRAW_SCALING_CAP bounds both draw scalers', () => {
    it('CARDS_DRAWN_TRIGGERED scales to the cap and then stops', () => {
        const one = hit('CARDS_DRAWN_TRIGGERED', 28, { nonNaturalCardsDrawnThisTurn: 1 });
        const two = hit('CARDS_DRAWN_TRIGGERED', 28, { nonNaturalCardsDrawnThisTurn: 2 });
        const ten = hit('CARDS_DRAWN_TRIGGERED', 28, { nonNaturalCardsDrawnThisTurn: 10 });
        expect(one).toBeGreaterThan(0);
        expect(two).toBe(one * 2);
        expect(ten).toBe(two);
    });

    it('CARDS_DRAWN is capped too — the natural-inclusive counter reaches higher, not lower', () => {
        const two = hit('CARDS_DRAWN', 28, { cardsDrawnThisTurn: 2 });
        expect(hit('CARDS_DRAWN', 28, { cardsDrawnThisTurn: 9 })).toBe(two);
    });

    it('the FTK case specifically: 3 triggered draws no longer pays 3x', () => {
        // The exact shape of the census chain. At cap 2 this is 2x28 = 56 power, not 3x33 = 99.
        const ftkShape = hit('CARDS_DRAWN_TRIGGERED', 28, { nonNaturalCardsDrawnThisTurn: 3 });
        const capped = hit('CARDS_DRAWN_TRIGGERED', 28, { nonNaturalCardsDrawnThisTurn: 2 });
        expect(ftkShape).toBe(capped);
    });

    it('is a knob, not a constant baked into the branch', () => {
        DRAW_SCALING_CAP.value = 5;
        const five = hit('CARDS_DRAWN_TRIGGERED', 28, { nonNaturalCardsDrawnThisTurn: 5 });
        DRAW_SCALING_CAP.value = 2;
        const two = hit('CARDS_DRAWN_TRIGGERED', 28, { nonNaturalCardsDrawnThisTurn: 5 });
        expect(five).toBeGreaterThan(two);
    });
});

describe('PLAY_COUNT_SCALING_CAP is needed, and 5 was measured not to be enough', () => {
    // With the draw cap alone, five FTKs survive: `serpents_coil` (CARDS_PLAYED, jormungandr_v1)
    // finishes the runaway turn `ink_stream` starts. A looser cap of 5 was tried and the
    // full-field scan still found 3. 3 is the value that reaches zero.
    it('CARDS_PLAYED scales through a normal turn and stops at 3', () => {
        const two = hit('CARDS_PLAYED', 20, { cardsPlayedThisTurn: 2 });
        const three = hit('CARDS_PLAYED', 20, { cardsPlayedThisTurn: 3 });
        expect(three).toBeGreaterThan(two);
        expect(hit('CARDS_PLAYED', 20, { cardsPlayedThisTurn: 5 })).toBe(three);
        expect(hit('CARDS_PLAYED', 20, { cardsPlayedThisTurn: 9 })).toBe(three);
    });

    it('CARDS_DISCARDED shares the ceiling', () => {
        const three = hit('CARDS_DISCARDED', 20, { cardsDiscardedThisTurn: 3 });
        expect(hit('CARDS_DISCARDED', 20, { cardsDiscardedThisTurn: 8 })).toBe(three);
    });

    it('stays LOOSER than the draw cap - these are braked by the Energy pool', () => {
        expect(PLAY_COUNT_SCALING_CAP.value).toBeGreaterThan(DRAW_SCALING_CAP.value);
    });
});

describe('the two payoff cards carry their cap in their text', () => {
    it('a player can read the ceiling off the card', () => {
        // A cap the card does not disclose is a trap. Both say "up to 2".
        for (const id of ['ink_stream', 'starfall']) {
            expect(GetProgramData(id)!.description).toContain(`up to ${DRAW_SCALING_CAP.value}`);
        }
    });
});
