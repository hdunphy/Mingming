import { describe, it, expect } from 'vitest';
import { executeDraw } from './resolutionEngine';
import { ConditionValidator } from './core/ConditionValidator';
import { GetProgramData, ProgramRegistry } from './data/programRegistry';
import CONSTRAINTS_LIB from './data/lib/constraints.json';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import type { IBattleState, ProgramAction, ProgramConstraint } from './types';

/**
 * Ticket 68 — `surge_protection`'s refund fires only on a TRIGGERED draw.
 *
 * The defect: `cardsDrawnThisTurn` counts the draw-phase refill, so "if you drew a card this
 * turn" was satisfied on ~91% of turns for every species purely by being dealt a hand
 * (HANDOFF 0-DRAW-COUNTER). Measured over ticket 65's sample the refund fired on 3,371 of
 * 3,371 casts. `nonNaturalCardsDrawnThisTurn` counts only draws an effect caused.
 */

const state = (): IBattleState =>
    buildScenarioState({ ...matchupScenario({ player: 'kraken', enemy: 'fenrir', playerOS: 'kraken_v1' }), seed: 'td' });

const CHECK: ProgramConstraint = { type: 'CARDS_DRAWN_TRIGGERED', target: 'SELF', value: 1 } as ProgramConstraint;
const LEGACY: ProgramConstraint = { type: 'CARDS_DRAWN', target: 'SELF', value: 1 } as ProgramConstraint;

const check = (s: IBattleState, c: ProgramConstraint) =>
    ConditionValidator.evaluateCardConstraint(c, s.playerParty[0], s.playerParty[0], 0, s);

describe('the triggered-draw counter', () => {
    it('a NATURAL draw does not satisfy the triggered check — but still satisfies the legacy one', () => {
        const s = executeDraw(state(), 'PLAYER', 2, true);
        expect(s.cardsDrawnThisTurn).toBeGreaterThan(0);
        expect(s.nonNaturalCardsDrawnThisTurn ?? 0).toBe(0);
        expect(check(s, CHECK)).toBe(false);
        expect(check(s, LEGACY)).toBe(true);   // the old behaviour, kept for anything that wants it
    });

    it('an EFFECT draw satisfies it', () => {
        const s = executeDraw(state(), 'PLAYER', 1, false);
        expect(s.nonNaturalCardsDrawnThisTurn).toBe(1);
        expect(check(s, CHECK)).toBe(true);
    });

    it('a natural draw followed by an effect draw satisfies it exactly once per effect card', () => {
        let s = executeDraw(state(), 'PLAYER', 3, true);
        expect(check(s, CHECK)).toBe(false);
        s = executeDraw(s, 'PLAYER', 1, false);
        expect(s.nonNaturalCardsDrawnThisTurn).toBe(1);
        expect(s.cardsDrawnThisTurn).toBeGreaterThan(1);
        expect(check(s, CHECK)).toBe(true);
    });

    it('the counter is absent-safe — a state that predates the field reads as zero', () => {
        const s = { ...state(), nonNaturalCardsDrawnThisTurn: undefined } as unknown as IBattleState;
        expect(check(s, CHECK)).toBe(false);
    });
});

describe('surge_protection is wired to the triggered check', () => {
    it('its refund INFLATES to the triggered type - not to whatever it was written inline as', () => {
        const card = GetProgramData('surge_protection');
        const refund = card.actions.find((a: ProgramAction) => a.type === 'ENERGY') as ProgramAction;
        expect(refund.conditionals?.[0]?.id).toBe('card_drawn_check');
        // This is the assertion that would have caught the original defect. The card used to
        // carry an inline `type: 'BASE'` alongside the id, and `inflateConstraint` spreads the
        // INLINE object last - so the override won and the "draw check" was really an energy
        // check against cost 0, i.e. always true. It had never been a draw condition at all.
        expect(refund.conditionals![0].type).toBe('CARDS_DRAWN_TRIGGERED');
        expect(card.description).toContain('card, OS or daemon');
    });

    it('NO card inline-overrides a library constraint type (the footgun that hid this bug)', () => {
        // `inflateConstraint` does `{ ...LIB[id], ...inline }`, so any `type` written next to an
        // `id` silently replaces the library definition. One occurrence cost us a live condition
        // for an unknown number of tickets; this fails the moment a second appears.
        const offenders: string[] = [];
        // The JSON library is keyed by constraint id; only `.type` is read here.
        const lib = CONSTRAINTS_LIB as Record<string, { type: string }>;
        for (const [cardId, raw] of Object.entries(ProgramRegistry)) {
            const lists: ReadonlyArray<readonly ['card' | 'action', ProgramConstraint]> = [
                ...(raw.constraints ?? []).map((c: ProgramConstraint) => ['card', c] as const),
                ...(raw.actions ?? []).flatMap((a: ProgramAction) =>
                    [...(a.conditionals ?? []), ...(a.constraints ?? [])].map((c: ProgramConstraint) => ['action', c] as const)),
            ];
            for (const [where, c] of lists) {
                if (c && typeof c === 'object' && c.id && lib[c.id] && c.type
                    && c.type !== lib[c.id].type) {
                    offenders.push(`${cardId} (${where}): id=${c.id} inline=${c.type} library=${lib[c.id].type}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});

/**
 * THE SCOPE — Henry, 2026-08-30: *"it should be scoped to the mingming."*
 *
 * `CARDS_DRAWN_TRIGGERED` used to read `state.nonNaturalCardsDrawnThisTurn`, a single number on the
 * battle state — not per unit, not even per side. At 3v3 with a shared hand, every ally's engine
 * draw pumped every ally's `ink_stream`.
 *
 * Measured before the fix, on Tidewrack's boss fight: **6.6 triggered draws counted per cast**
 * against the ~1.75 `jormungandr_v1` produces as a solo caster. At 33 power a draw that is ~218
 * power from a 1-energy card — 52.9 damage, twice what a 3-energy `hydro_blast` lands — and 49% of
 * the winning deck's total output.
 *
 * This is the sibling of the CARDS_PLAYED bug ticket 123 fixed, and the tests below are deliberately
 * shaped like `cardsPlayedScaling.test.ts`'s: they assert that ONE unit's draw does not reach
 * ANOTHER unit's scaler. A regression here is silent and its symptom is a win rate, so the assertion
 * has to be about the counter rather than about a battle outcome.
 */
describe('the triggered-draw counter is scoped to the Mingming', () => {
    const party = (s: IBattleState) => s.playerParty;

    /*
     * `matchupScenario` builds a 1v1, where a per-unit counter and a side-wide one are
     * INDISTINGUISHABLE — the bug being fixed here cannot exist at width 1, so a scope test run
     * against it passes whichever scope the engine uses. That is the vacuous-green shape this work
     * has now hit four separate times, so the party is widened by hand and the widening is asserted.
     */
    function withThree(base: IBattleState): IBattleState {
        const template = base.playerParty[0];
        return {
            ...base,
            playerParty: [0, 1, 2].map(i => ({ ...template, id: `p${i}`, name: `P${i}` })),
        } as IBattleState;
    }

    it('is measured at width 3, because at width 1 the bug is invisible', () => {
        // Guards every test below: if this ever reads 1, they all pass for the wrong reason.
        expect(withThree(state()).playerParty).toHaveLength(3);
    });

    it('credits ONLY the drawing unit, and leaves its allies at zero', () => {
        const base = withThree(state());
        const s = executeDraw(base, 'PLAYER', 2, false, party(base)[0].id);

        expect(party(s)[0].nonNaturalDrawsThisTurn).toBe(2);
        for (const ally of party(s).slice(1)) {
            expect(ally.nonNaturalDrawsThisTurn ?? 0, 'an ally must not be credited').toBe(0);
        }
    });

    it('does not let an ALLY’s draw pump my scaler — the whole point of the ruling', () => {
        const base = withThree(state());
        const s = executeDraw(base, 'PLAYER', 3, false, party(base)[1].id);

        // The side-wide number moved, and slot 1 was credited...
        expect(s.nonNaturalCardsDrawnThisTurn).toBe(3);
        expect(party(s)[1].nonNaturalDrawsThisTurn).toBe(3);
        // ...and slot 0 must NOT have been. This is the assertion that fails if either read site
        // goes back to the battle-wide counter.
        expect(party(s)[0].nonNaturalDrawsThisTurn ?? 0).toBe(0);
        expect(
            ConditionValidator.evaluateCardConstraint(CHECK, party(s)[0], party(s)[0], 0, s),
            'slot 0 must not be satisfied by slot 1 drawing',
        ).toBe(false);
    });

    it('does not fall back to the battle-wide number when the caster has drawn nothing', () => {
        /*
         * The trap this shape exists to avoid. `playsThisTurn` is written on every play, so
         * CARDS_PLAYED can safely read `source?.x ?? state.y`. A triggered-draw count is written
         * ONLY when a triggered draw happens, so an untouched caster holds `undefined` — and a `??`
         * chain would fall straight through to the battle-wide counter in exactly the case the
         * ruling exists to fix, restoring the bug while every test above still passed.
         */
        const base = withThree(state());
        const s = { ...executeDraw(base, 'PLAYER', 4, false, party(base)[0].id) } as IBattleState;
        const untouched = { ...party(s)[0], nonNaturalDrawsThisTurn: undefined } as unknown as IBattleState['playerParty'][number];
        const withUntouched = { ...s, playerParty: [untouched, ...party(s).slice(1)] } as IBattleState;

        expect(withUntouched.nonNaturalCardsDrawnThisTurn).toBe(4);
        expect(
            ConditionValidator.evaluateCardConstraint(CHECK, untouched, untouched, 0, withUntouched),
            'an undefined per-unit count must read as 0, never as the battle-wide number',
        ).toBe(false);
    });

    it('a NATURAL draw credits nobody', () => {
        const base = withThree(state());
        const s = executeDraw(base, 'PLAYER', 3, true, party(base)[0].id);
        for (const e of party(s)) expect(e.nonNaturalDrawsThisTurn ?? 0).toBe(0);
    });
});
