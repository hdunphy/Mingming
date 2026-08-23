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
