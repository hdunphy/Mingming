/**
 * TICKET 200b - the generated Tabler file is complete, kept apart by set, and not stale.
 *
 * `tabler.generated.ts` is written by `scripts/tabler-icons.mjs` from `scripts/tabler-icons.names.json`.
 * Nothing in it is hand-drawn, so what needs guarding is: every name asked for is there, the outline
 * and filled sets stay separate (both have a `flame`), and nobody edited the file or the names
 * without re-running `npm run icons`.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { TABLER_FILLED, TABLER_OUTLINE } from './tabler.generated';
import type { TablerNodes } from './tablerNodes';

type Sets = Readonly<Record<string, TablerNodes | undefined>>;
const OUTLINE: Sets = TABLER_OUTLINE;
const FILLED: Sets = TABLER_FILLED;

const names = JSON.parse(readFileSync('scripts/tabler-icons.names.json', 'utf8')) as {
    outline: string[];
    filled: string[];
};

/** Henry's ruled status icons (ticket 200) and the energy bolt. */
const STATUS_AND_BOLT = [
    'flame', 'skull', 'zzz', 'arrow-big-down', 'arrow-big-up', 'spiral', 'shield-up', 'ban',
    'heart-plus', 'recharging', 'eye', 'wood', 'moon', 'sun', 'bolt',
];

describe('the generated Tabler icons (200b)', () => {
    it('holds every name the names file asks for, each with geometry', () => {
        for (const name of names.outline) {
            expect(OUTLINE[name]?.length, `outline ${name}`).toBeGreaterThan(0);
        }
        for (const name of names.filled) expect(FILLED[name]?.length, `filled ${name}`).toBeGreaterThan(0);
    });

    it('holds nothing the names file did not ask for', () => {
        expect(Object.keys(TABLER_OUTLINE).sort()).toEqual([...names.outline].sort());
        expect(Object.keys(TABLER_FILLED).sort()).toEqual([...names.filled].sort());
    });

    it('keeps outline and filled apart: the filled flame is not the outline flame', () => {
        expect(TABLER_FILLED.flame).not.toEqual(TABLER_OUTLINE.flame);
        for (const name of ['flame', 'droplet', 'leaf', 'point']) expect(names.filled).toContain(name);
    });

    it('has the fourteen ruled statuses and the energy bolt', () => {
        expect(STATUS_AND_BOLT).toHaveLength(15);
        for (const name of STATUS_AND_BOLT) expect(Object.keys(TABLER_OUTLINE), name).toContain(name);
    });

    it('is up to date: regenerating gives the same text (npm run icons -- --check)', () => {
        expect(() => execFileSync(process.execPath, ['scripts/tabler-icons.mjs', '--check'], { stdio: 'pipe' })).not.toThrow();
    });
});
