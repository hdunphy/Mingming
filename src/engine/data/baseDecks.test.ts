import { describe, it, expect } from 'vitest';
import { MingmingRegistry, getDeckForOS } from './mingmingRegistry';
import { GetProgramData } from './programRegistry';

/**
 * Per-OS starting-deck invariants (ticket 13, deck template from ticket 04):
 * every species has one deck per availableOS entry, 8-12 cards each, ids
 * resolve, element-locked to primary/'None', no tokens. Copy cap is <=3 while
 * the legacy shared decks are being ported (skoll and valkyrie run triples);
 * the template caps NEW decks at 2 copies - tighten this to 2 as each species'
 * deck pass lands.
 */
describe('per-OS starting decks', () => {
    const speciesIds = Object.keys(MingmingRegistry);

    it('registry still has exactly 16 species', () => {
        expect(speciesIds).toHaveLength(16);
    });

    it.each(speciesIds)('%s: decks keys match availableOS exactly', id => {
        const def = MingmingRegistry[id];
        expect(Object.keys(def.decks).sort()).toEqual([...def.availableOS].sort());
    });

    describe.each(speciesIds)('%s', id => {
        const def = MingmingRegistry[id];

        it.each(def.availableOS)('%s deck: 8-12 cards, <=3 copies (legacy cap)', osId => {
            const deck = getDeckForOS(id, osId);
            expect(deck.length).toBeGreaterThanOrEqual(8);
            expect(deck.length).toBeLessThanOrEqual(12);
            const counts: Record<string, number> = {};
            for (const c of deck) counts[c] = (counts[c] ?? 0) + 1;
            for (const [dataId, n] of Object.entries(counts)) {
                expect(n, `${osId}: ${dataId} has ${n} copies`).toBeLessThanOrEqual(3);
            }
        });

        it.each(def.availableOS)('%s deck: every id resolves, element-locked, no tokens', osId => {
            for (const dataId of getDeckForOS(id, osId)) {
                const program = GetProgramData(dataId);
                expect(program, `${osId}: unknown program '${dataId}'`).toBeDefined();
                expect(program.id).not.toBe('missing');
                // Ticket 36: dual-type species may run cards of their SECONDARY element too
                // (Hel is Dark/Light). Every other species has secondaryElement 'None', so the
                // allowed set collapses back to [primary, 'None'] for them - a no-op.
                expect(
                    [def.primaryElement, def.secondaryElement, 'None'],
                    `${osId}: '${dataId}' is ${program.element}, expected ${def.primaryElement}, ${def.secondaryElement} or None`,
                ).toContain(program.element);
                expect(program.isToken ?? false, `${osId}: '${dataId}' is a token`).toBe(false);
            }
        });
    });

    it('getDeckForOS defaults to the availableOS[0] slot and copies defensively', () => {
        const direct = MingmingRegistry['fenrir'].decks['fenrir_v1'];
        const resolved = getDeckForOS('fenrir');
        expect(resolved).toEqual(direct);
        expect(resolved).not.toBe(direct); // defensive copy
        expect(getDeckForOS('fenrir', 'not_a_real_os')).toEqual(direct); // unknown os -> primary
        expect(getDeckForOS('missing_species')).toEqual([]);
    });
});
