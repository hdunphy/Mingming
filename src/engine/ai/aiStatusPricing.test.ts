/**
 * TICKET 137 — the EVAL must agree with the ENGINE about what a status pays.
 *
 * This file exists because it didn't, twice over, and nothing caught either one.
 *
 * Ticket 136b took Regen from 3% of max HP per turn to 2%. `TacticalAI` held its own copy of that
 * number and kept it at 3% for the rest of the arc, so the search valued Regen 50% above what
 * Regen actually paid — and the decks that care are exactly the ones built on it (audhumbla's
 * whole GENESIS package is Regen-as-ammo). The eval was internally consistent and the engine was
 * correct, and no test compared the two. That is the same shape as HANDOFF's 0-BURN-PRICE-LAG,
 * whose lesson is stated there: *transcribing a corrected number fixes today and re-arms the trap;
 * deriving it disarms the trap.*
 *
 * So these assertions do NOT transcribe expected values. They RUN the status behaviour on a frame
 * large enough that nothing floors, measure what the engine actually delivers, and require the
 * eval's price to be that amount in its own HP-points currency. An edit that moves one and not the
 * other fails here, whichever side moves.
 *
 * `HP_POINTS` is the eval's HP→points conversion (2 points per HP). It is the only eval-side
 * constant these tests take on trust, because it is a unit rather than a mechanic.
 */
import { describe, it, expect } from 'vitest';
import { statusValue } from './TacticalAI';
import {
    getStatusBehavior,
    POISON_PERCENT_PER_STACK,
    REGEN_PERCENT_PER_TURN,
    BARKSHIELD_DECAY_RETAINED,
} from '../StatusBehaviors';
import type { IBattleEntity, StatusEffectInstance } from '../types';

/** Big enough that no floor() in either the engine or the eval rounds a difference away. */
const HUGE_HP = 100_000;
const HP_POINTS = 2;

const frame = (currentHp = HUGE_HP): IBattleEntity =>
    ({
        id: 't1', name: 'Target', maxHp: HUGE_HP, currentHp,
        statusEffects: [], activeOS: '',
    } as unknown as IBattleEntity);

const instance = (type: string, stacks: number): StatusEffectInstance =>
    ({ id: `s-${type}`, type, stacks } as StatusEffectInstance);

/**
 * `EndTurnResult.healing` is optional on the interface, and these tests are worthless if it
 * silently reads as 0 - that is the same "absent number scores as nothing" failure the eval
 * itself had. So the absence is an error rather than a default.
 */
function required(value: number | undefined, what: string): number {
    if (typeof value !== 'number') throw new Error(`${what} returned no number - the engine shape changed`);
    return value;
}

describe('ticket 137 — Regen: the eval prices what the engine heals', () => {
    /**
     * THE REGRESSION THIS FILE WAS WRITTEN FOR. The engine heals a flat share of max HP per turn
     * for `stacks` turns (stacks are TURNS, ticket 34), so N stacks on a full-health frame are
     * worth N ticks — and the eval has to use the engine's share, not its own.
     */
    it('values one stack at exactly one engine tick', () => {
        const behavior = getStatusBehavior('Regen');
        const engineHeal = required(behavior.endTurn(instance('Regen', 1), frame()).healing, 'Regen.endTurn().healing');

        // Priced on a frame with room to heal, so the missing-HP cap is not what is being measured.
        const evalValue = statusValue('Regen', 1, frame(1));
        expect(evalValue).toBeCloseTo(HP_POINTS * engineHeal, 6);
    });

    it('is LINEAR in stacks, at the engine rate, for every stack count', () => {
        const behavior = getStatusBehavior('Regen');
        const perTick = required(behavior.endTurn(instance('Regen', 1), frame()).healing, 'Regen.endTurn().healing');

        for (const stacks of [1, 2, 3, 5, 8]) {
            expect(statusValue('Regen', stacks, frame(1)), `${stacks} stacks`)
                .toBeCloseTo(HP_POINTS * perTick * stacks, 6);
        }
    });

    it('never prices healing the holder cannot receive', () => {
        // 10 stacks would heal far past full; the value is capped at the HP actually missing.
        const missing = 500;
        expect(statusValue('Regen', 10, frame(HUGE_HP - missing)))
            .toBeCloseTo(HP_POINTS * missing, 6);
    });

    it('reads the engine constant rather than holding its own copy', () => {
        // The arithmetic identity above stated as the thing it is really asserting: if someone
        // re-declares a percentage inside the eval, this is the line that fails.
        expect(statusValue('Regen', 1, frame(1)))
            .toBeCloseTo(HP_POINTS * REGEN_PERCENT_PER_TURN * HUGE_HP, 6);
    });
});

describe('ticket 137 — Poison and BarkShield use the engine numbers too', () => {
    /**
     * Poison was the other magic percentage: `0.01` in the eval against a bare `/ 100` in
     * `PoisonBehavior`. Both were right, which is precisely why it is worth pinning — the pair
     * that agrees today is the pair nobody checks tomorrow.
     */
    it('prices one stack of Poison at one engine tick', () => {
        const behavior = getStatusBehavior('Poison');
        const engineDamage = required(behavior.endTurn(instance('Poison', 1), frame()).damage, 'Poison.endTurn().damage');

        expect(statusValue('Poison', 1, frame())).toBeCloseTo(-HP_POINTS * engineDamage, 6);
        expect(engineDamage).toBeCloseTo(POISON_PERCENT_PER_STACK * HUGE_HP, 6);
    });

    it('prices a Poison pile over the eval horizon, not over its whole decay', () => {
        // Not a duplicate of the line above: ticket 40 capped the triangular sum, and this asserts
        // the cap is still what bounds a big pile. A pile priced at its full decay sum is how the
        // AI came to value holding `wither_feast` above cashing it in 100 games out of 100.
        const behavior = getStatusBehavior('Poison');
        const perStackTick = required(behavior.endTurn(instance('Poison', 1), frame()).damage, 'Poison.endTurn().damage');
        const stacks = 18;

        const fullDecaySum = perStackTick * (stacks * (stacks + 1)) / 2;
        expect(Math.abs(statusValue('Poison', stacks, frame()))).toBeLessThan(HP_POINTS * fullDecaySum);
    });

    it('prices BarkShield at the pool the engine retains', () => {
        const stacks = 20;                                   // 20% of max HP as an absorb pool
        const pool = HUGE_HP * (stacks / 100);
        expect(statusValue('BarkShield', stacks, frame()))
            .toBeCloseTo(HP_POINTS * pool * BARKSHIELD_DECAY_RETAINED, 6);
    });
});
