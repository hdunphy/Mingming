/**
 * TICKET 199 — the Instinct glyphs. Henry (2026-10-06): "I think we just use them" — the 12 glyphs
 * for the 1.0 release, AI-drawn and disclosed on the Steam page. These tests pin the map: the twelve
 * 1.0 Instincts each have a file, no two share a picture, and an Instinct with no file says so
 * (the glyph component falls back to the generic firmware icon).
 */
import { describe, expect, it } from 'vitest';

import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { NORSE_INSTINCT_NAMES } from './instinctNames';
import { INSTINCT_GLYPH_IDS, instinctGlyphKey, instinctGlyphMarkup } from './instinctGlyphs';

/** The first six species' Instincts: fenrir, skoll, kraken, jormungandr, ratatoskr, huldra. */
const TWELVE_FOR_1_0: ReadonlyArray<readonly [string, string]> = [
    ['fenrir_v1', 'UNBOUND_KERNEL'],
    ['fenrir_v2', 'CINDER_WALL_OS'],
    ['kraken_v1', 'ABYSSAL_INK_SYS'],
    ['kraken_v2', 'TIDAL_CRUSH_OS'],
    ['skoll_v1', 'TREACHERY_KERNEL'],
    ['skoll_v2', 'EMBER_FUSE'],
    ['jormungandr_v1', 'OUROBOROS_LOOP'],
    ['jormungandr_v2', 'TOXIN_FANG_OS'],
    ['ratatoskr_v1', 'GOSSIP_NODE'],
    ['ratatoskr_v2', 'INSTIGATOR_OS'],
    ['huldra_v1', 'ALLURE_PROXY'],
    ['huldra_v2', 'BARK_SHIELD_OS'],
];

describe('199 Instinct glyphs', () => {
    it('has a glyph file for each of the twelve Instincts of the 1.0 species, and only those', () => {
        expect([...INSTINCT_GLYPH_IDS].sort()).toEqual(TWELVE_FOR_1_0.map(([, key]) => key).sort());
    });

    it('every glyph file is named after a real Instinct (one of the 33 shown names)', () => {
        for (const key of INSTINCT_GLYPH_IDS) expect(NORSE_INSTINCT_NAMES[key], key).toBeDefined();
    });

    it('a species id and the registry name both find the same glyph', () => {
        for (const [speciesId, key] of TWELVE_FOR_1_0) {
            expect(getOSBehavior(speciesId)?.name, speciesId).toBe(key);
            expect(instinctGlyphKey(speciesId), speciesId).toBe(key);
            expect(instinctGlyphKey(key), key).toBe(key);
            expect(instinctGlyphMarkup(speciesId), speciesId).toBe(instinctGlyphMarkup(key));
        }
    });

    it('no two Instincts share a picture', () => {
        const seen = new Map<string, string>();
        for (const key of INSTINCT_GLYPH_IDS) {
            const markup = instinctGlyphMarkup(key);
            expect(markup, key).not.toBeNull();
            expect(seen.get(markup!), `${key} repeats ${seen.get(markup!)}`).toBeUndefined();
            seen.set(markup!, key);
        }
        expect(seen.size).toBe(12);
    });

    it('is one colour, so the chip can tint it by element', () => {
        for (const key of INSTINCT_GLYPH_IDS) {
            const markup = instinctGlyphMarkup(key)!;
            expect(markup, key).toContain('currentColor');
            expect(markup, key).not.toMatch(/(?:fill|stroke)="(?!none|currentColor)[^"]*"/);
            expect(markup, key).not.toContain('<svg');
        }
    });

    it('an Instinct with no file has no glyph (the other 21 wait for later)', () => {
        for (const speciesId of ['fafnir_v1', 'ymir_v2', 'hel_v1', 'nidhoggr_v2', 'not_a_species']) {
            expect(instinctGlyphMarkup(speciesId), speciesId).toBeNull();
        }
        expect(instinctGlyphMarkup(null)).toBeNull();
        expect(instinctGlyphMarkup(undefined)).toBeNull();
    });
});
