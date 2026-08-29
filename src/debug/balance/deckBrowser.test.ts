/**
 * The deck browser's whole value is that it can be trusted at a glance, so the claims worth pinning
 * are the ones a reader would silently be misled by: that the staleness stamp actually compares
 * hashes rather than dates, that borrowed telemetry lands on the card it was measured for, and that
 * the engine's five are marked payoff-first. A page that mislabels a stale number is worse than no
 * page.
 */

import { describe, expect, it } from 'vitest';

import { MAX_CURVE_COST, buildBrowserPayload, readDeckReport } from './deckBrowser';
import { computeRegistryHash } from '../scenarios/registryHash';
import { LAUNCH_SPECIES, getDeckForOS } from '../../engine/data/mingmingRegistry';

describe('deck browser payload', () => {
    it('reads the live registry, so every playable OS has a deck and the launch six are flagged', () => {
        const payload = buildBrowserPayload(null);

        expect(payload.decks.length).toBeGreaterThan(0);
        expect(payload.registryHash).toBe(computeRegistryHash());
        // No report passed in means no stats block at all - not an empty one, which would render
        // as a measured grid full of blanks.
        expect(payload.stats).toBeUndefined();

        for (const deck of payload.decks) {
            expect(deck.deckSize).toBe(getDeckForOS(deck.species, deck.id).length);
            expect(deck.curve).toHaveLength(MAX_CURVE_COST + 1);
            expect(deck.curve.reduce((a, b) => a + b, 0)).toBe(deck.deckSize);
            expect(deck.os.description.length).toBeGreaterThan(0);
        }

        const launched = payload.decks.filter((d) => d.launch);
        expect(new Set(launched.map((d) => d.species))).toEqual(new Set(LAUNCH_SPECIES));
        // Launch decks sort first, because they are the ones that ship.
        expect(payload.decks.slice(0, launched.length).every((d) => d.launch)).toBe(true);
    });

    it('marks the ratified five payoff-first, and leaves untuned species without an engine', () => {
        const payload = buildBrowserPayload(null);

        for (const deck of payload.decks) {
            if (!deck.launch) {
                expect(deck.engine).toHaveLength(0);
                expect(deck.cards.every((c) => c.engineRole === undefined)).toBe(true);
                continue;
            }
            expect(deck.engine).toHaveLength(5);
            // The first tag is the payoff the other four exist to set up (ticket 61), and the
            // rendered order has to agree with that or the badges are decoration.
            expect(deck.cards[0].engineRole).toBe('payoff');
            expect(deck.cards[0].id).toBe(deck.engine[0]);
            const tagged = deck.cards.filter((c) => c.engineRole !== undefined).map((c) => c.id);
            expect(new Set(tagged)).toEqual(new Set(deck.engine));
        }
    });

    it('stamps stats stale when the report was measured against a different registry', () => {
        const current = computeRegistryHash();

        const fresh = buildBrowserPayload({ generatedAt: 'now', registryHash: current, subjects: [], cards: [] });
        expect(fresh.stats?.stale).toBe(false);

        const old = buildBrowserPayload({ generatedAt: 'then', registryHash: '1:deadbeef', subjects: [], cards: [] });
        expect(old.stats?.stale).toBe(true);

        // A report with no hash at all is the pre-hash format, and cannot be vouched for.
        const unstamped = buildBrowserPayload({ generatedAt: 'ages ago' });
        expect(unstamped.stats?.stale).toBe(true);
        expect(unstamped.stats?.registryHash).toBe('unknown');
    });

    it('joins telemetry by OS id and card id, never by position', () => {
        const target = buildBrowserPayload(null).decks.find((d) => d.launch);
        expect(target).toBeDefined();
        const cardId = target!.cards[0].id;

        const payload = buildBrowserPayload({
            registryHash: '1:deadbeef',
            subjects: [{ id: target!.id, archetypeSummary: 'a summary' }],
            cards: [
                { subjectId: target!.id, cardId, playRate: 0.5, deadRate: 0.1, avgDirectDamagePerPlay: 7 },
                // Same card id under a different OS must not leak across.
                { subjectId: 'not_a_real_os', cardId, playRate: 0.99, deadRate: 0.99 },
                // A card the report measured that the deck no longer holds is ordinary, not an error.
                { subjectId: target!.id, cardId: 'card_that_left_the_deck', playRate: 0.4 },
            ],
        });

        const deck = payload.decks.find((d) => d.id === target!.id)!;
        expect(deck.archetypeSummary).toBe('a summary');
        expect(deck.cards.find((c) => c.id === cardId)?.playRate).toBe(0.5);
        expect(deck.cards.find((c) => c.id === cardId)?.avgDamagePerPlay).toBe(7);
        expect(deck.cards.some((c) => c.id === 'card_that_left_the_deck')).toBe(false);

        // Every other deck is untouched by a subject id that matches nothing.
        for (const other of payload.decks) {
            if (other.id === target!.id) continue;
            expect(other.cards.every((c) => c.playRate !== 0.99)).toBe(true);
        }
    });

    it('treats a missing report as a normal state rather than an error', () => {
        expect(readDeckReport('docs/balance/there-is-no-such-report.json')).toBeNull();
        expect(() => buildBrowserPayload(readDeckReport('docs/balance/nope.json'))).not.toThrow();
    });
});
