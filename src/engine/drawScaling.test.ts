import { describe, it, expect } from 'vitest';
import { AttackExecutor } from './actions/ActionExecutors';
import { executeDraw } from './resolutionEngine';
import { GetProgramData, ProgramRegistry } from './data/programRegistry';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import type { IBattleState, IBattleEntity, ProgramData } from './types';
import type { HookContext } from './core/Hooks';

/**
 * Ticket 71 — `CARDS_DRAWN` scaling multiplied damage by `cardsDrawnThisTurn`, which the
 * draw-phase refill increments (HANDOFF 0-DRAW-COUNTER). Measured over 1,365 real casts,
 * `ink_stream` saw a mean of 3.71 "cards drawn" and only 0.92 that any effect had caused. Ticket
 * 68 fixed exactly this for the CONSTRAINT and deliberately left the SCALING; this is the scaling.
 *
 * The compensation is a FIXED POINT, not that 4.04x ratio: `getBestAction` prices the card as it
 * resolves, so raising the payoff makes the AI sequence its draws BEFORE casting and the triggered
 * mean climbs with the power. Naive 4.04x compensation (power 48) over-delivered by 77%. Powers
 * 33 and 18 were solved by sweep to hold each card's total delivered damage across 1,365 casts.
 *
 * `CARDS_DRAWN` itself is untouched, the same additive discipline 68 used.
 */

const state = (): IBattleState =>
    buildScenarioState({ ...matchupScenario({ player: 'kraken', enemy: 'fenrir', playerOS: 'kraken_v1' }), seed: 'ds' });

const ctx = (s: IBattleState) => ({ state: s, triggerDepth: 0 } as HookContext);
const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t, e) => t + e.currentHp, 0);

/** Cast a bare ATTACK with the given scaling from player[0] into enemy[0]; return damage dealt. */
function hit(s: IBattleState, scaling: string, power: number): number {
    const before = hp(s.enemyParty);
    const next = new AttackExecutor().execute(
        s, s.playerParty[0].id, s.enemyParty[0].id,
        { type: 'ATTACK', power, scaling, target: 'TARGET' } as never,
        { element: 'Water' } as ProgramData, ctx(s));
    return before - hp(next.enemyParty);
}

describe('CARDS_DRAWN_TRIGGERED scaling', () => {
    it('a NATURAL draw contributes NOTHING — the whole point of the ticket', () => {
        const s = executeDraw(state(), 'PLAYER', 3, true);
        expect(s.cardsDrawnThisTurn).toBeGreaterThan(0);      // the old scaler would have paid
        expect(hit(s, 'CARDS_DRAWN', 48)).toBeGreaterThan(0);
        expect(hit(s, 'CARDS_DRAWN_TRIGGERED', 48)).toBe(0);
    });

    it('an EFFECT draw pays, and pays linearly in the number of them', () => {
        const one = executeDraw(state(), 'PLAYER', 1, false);
        const two = executeDraw(state(), 'PLAYER', 2, false);
        const d1 = hit(one, 'CARDS_DRAWN_TRIGGERED', 48);
        const d2 = hit(two, 'CARDS_DRAWN_TRIGGERED', 48);
        expect(d1).toBeGreaterThan(0);
        expect(d2).toBe(d1 * 2);
    });

    it('a natural refill does not inflate an effect draw that follows it', () => {
        const effectOnly = executeDraw(state(), 'PLAYER', 1, false);
        const afterRefill = executeDraw(executeDraw(state(), 'PLAYER', 3, true), 'PLAYER', 1, false);
        expect(afterRefill.cardsDrawnThisTurn).toBeGreaterThan(effectOnly.cardsDrawnThisTurn);
        expect(hit(afterRefill, 'CARDS_DRAWN_TRIGGERED', 48)).toBe(hit(effectOnly, 'CARDS_DRAWN_TRIGGERED', 48));
    });

    it('is absent-safe — a state predating the field pays zero, it does not NaN', () => {
        const s = { ...state(), nonNaturalCardsDrawnThisTurn: undefined } as unknown as IBattleState;
        expect(hit(s, 'CARDS_DRAWN_TRIGGERED', 48)).toBe(0);
    });
});

describe('the two carrier cards are wired to the triggered scaler at the compensated power', () => {
    it('ink_stream: 12 -> 33 — the fixed point, NOT the 4.04x naive ratio', () => {
        const a = (GetProgramData('ink_stream') as ProgramData).actions[0] as never as { scaling: string; power: number };
        expect(a.scaling).toBe('CARDS_DRAWN_TRIGGERED');
        expect(a.power).toBe(33);
        expect(GetProgramData('ink_stream')!.description).toContain('card, OS or daemon');
    });

    it('starfall: 10 -> 18 — likewise below its 2.57x naive ratio', () => {
        const a = (GetProgramData('starfall') as ProgramData).actions[0] as never as { scaling: string; power: number };
        expect(a.scaling).toBe('CARDS_DRAWN_TRIGGERED');
        expect(a.power).toBe(18);
        expect(GetProgramData('starfall')!.description).toContain('card, OS or daemon');
    });

    it('NO card is left on the natural-inclusive CARDS_DRAWN scaler', () => {
        // The branch stays in ActionExecutors so nothing that wants "any draw" loses it, but a
        // card arriving on it is almost certainly the ticket-71 mistake being made again.
        const offenders: string[] = [];
        for (const [id, raw] of Object.entries(ProgramRegistry as Record<string, any>))
            for (const a of raw.actions ?? [])
                if (a.scaling === 'CARDS_DRAWN') offenders.push(id);
        expect(offenders).toEqual([]);
    });
});
