/**
 * THE ASSETS AND THE CODE AGREE — ticket 147a.
 *
 * 61 mp3s landed in `public/sfx/` on 2026-09-19 and, until 147a, were referenced by nothing in
 * `src/` at all: `grep -rn "sfx/\|manifest\|\.mp3" src/` returned zero hits. That is the exact
 * shape of the two dead-on-arrival defects ticket 155 opened over — something built, nothing
 * wiring it, and a green suite the whole time. These tests are what stop it recurring: a cue
 * Henry picked that the code cannot name, or a name the code has with no file behind it, fails
 * here rather than in a playtest.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ALL_RECIPE_NAMES, SFX_RECIPES } from './sfxRecipes';
import { isSampleCue, SAMPLE_CUES, SAMPLE_FALLBACK } from './sfxSamples';

/** 147a: *"a build check fails on anything larger"*. The same number the build gate uses. */
const MAX_SAMPLE_BYTES = 60 * 1024;

const PUBLIC_DIR = join(process.cwd(), 'public');

interface ManifestEntry { file: string; bytes: number; seconds: number }
const manifest = JSON.parse(
    readFileSync(join(PUBLIC_DIR, 'sfx', 'manifest.json'), 'utf8'),
) as { cues: Record<string, ManifestEntry> };

describe('147a — every picked cue is nameable, and every name has a file', () => {
    it('the typed union and the manifest are the same set', () => {
        expect([...SAMPLE_CUES].sort()).toEqual(Object.keys(manifest.cues).sort());
    });

    it('every cue has a file on disk, under the size the build gate enforces', () => {
        for (const cue of SAMPLE_CUES) {
            const entry = manifest.cues[cue];
            expect(entry, `${cue} is missing from the manifest`).toBeTruthy();

            const stat = statSync(join(PUBLIC_DIR, entry.file));
            expect(stat.size, `${cue} is larger than the 60 KB cap`).toBeLessThanOrEqual(MAX_SAMPLE_BYTES);
            // The manifest's `bytes` is self-reported; if it drifts from the file, one of the two
            // is stale and a reader cannot tell which.
            expect(stat.size, `${cue}: manifest bytes disagree with the file`).toBe(entry.bytes);
        }
    });

    it('stores paths relative to the base, because the base is not always /', () => {
        /*
         * The web build serves from `/Mingming/` and the desktop build from `./` over `file://`.
         * A leading slash here breaks both — the same trap ticket 42 documents in vite.config.ts,
         * where absolute asset URLs gave a blank Electron window.
         */
        for (const entry of Object.values(manifest.cues)) {
            expect(entry.file.startsWith('/')).toBe(false);
            expect(entry.file.startsWith('sfx/')).toBe(true);
        }
    });
});

describe('147a — the fallbacks', () => {
    it('names a REAL recipe, or null on purpose', () => {
        for (const cue of SAMPLE_CUES) {
            const fallback = SAMPLE_FALLBACK[cue];
            if (fallback === null) continue;
            expect(ALL_RECIPE_NAMES, `${cue} falls back to an unknown recipe`).toContain(fallback);
            expect(typeof SFX_RECIPES[fallback]).toBe('function');
        }
    });

    it('leaves only the species cries silent, and every one of them', () => {
        /*
         * 147a's rule is *"missing file → recipe fallback, never silence"*, and the cries are the
         * stated exception: there is no oscillator recipe for a wolf, and a `death` fizzle
         * standing in for one would be a worse lie than the silence. The test pins the exception
         * so it stays an exception — a NEW silent cue fails here.
         */
        const silent = SAMPLE_CUES.filter((cue) => SAMPLE_FALLBACK[cue] === null);
        expect(silent.every((cue) => cue.startsWith('cry_'))).toBe(true);
        expect(SAMPLE_CUES.filter((cue) => cue.startsWith('cry_'))).toEqual(silent);
        // Henry's ruling: sixteen species, all of them.
        expect(silent).toHaveLength(16);
    });

    it('narrows a name without lying about the recipes', () => {
        expect(isSampleCue('impactSuper')).toBe(true);
        expect(isSampleCue('uiClick')).toBe(false);
        expect(isSampleCue('nonsense')).toBe(false);
        // `cardDraw` is in BOTH namespaces on purpose: the sample plays, the recipe covers it
        // until the buffer lands.
        expect(isSampleCue('cardDraw')).toBe(true);
        expect(ALL_RECIPE_NAMES).toContain('cardDraw');
    });
});
