/**
 * THE MAP-REVEAL'S RECORD — ticket 15, as 176d left it.
 *
 * Ticket 15 lifted the fog a biome at a time. There is no fog now (176d), so a survey reveals the
 * species in a biome's fights instead; that is rolled by `encounter.surveyedEncounters` and tested in
 * `RegionMap.species.test.tsx`. What is left to pin here is the record the macro writes and the reader
 * that turns it back into biome indices.
 */

import { describe, expect, it } from 'vitest';

import { biomeRevealModifier, revealedBiomesFrom } from '../../engine/data/macroRegistry';

describe('revealedBiomesFrom', () => {
    it('reads only its own namespaced entries, and ignores everything else', () => {
        // `modifiers` is shared with the ascension-shaped run modifiers `runTypes.ts` reserves it
        // for, so the reader has to be indifferent to strings it does not own.
        expect(revealedBiomesFrom(['ascension:3', biomeRevealModifier(1), 'cursed'])).toEqual([1]);
    });

    it('is total — a malformed entry is skipped, never thrown on', () => {
        // Called from a render. A save carrying a modifier from a future version must not take the
        // map down with it.
        expect(revealedBiomesFrom(['reveal:biome:', 'reveal:biome:x', 'reveal:biome:-1'])).toEqual([]);
    });

    it('deduplicates, so a repeated entry is not a second reveal', () => {
        expect(revealedBiomesFrom([biomeRevealModifier(0), biomeRevealModifier(0)])).toEqual([0]);
    });
});
