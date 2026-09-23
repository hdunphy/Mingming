/*
 * TICKET 162a — the archive is history, not gameplay.
 *
 * The one thing that could go wrong quietly: somebody imports `programs-v1.json` to "restore a
 * card" and the v1 pool is silently live again. The archive's whole value is that it is inert, so
 * that claim is a test rather than a sentence in a README.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * Read rather than `import`: a static import would put 178 KB of dead JSON into the production
 * bundle and hand `tsc` a second giant literal type to infer, both for a file the game never
 * loads. Reading it here keeps the archive out of every build but this test.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../../..');

const archivedPrograms = JSON.parse(readFileSync(join(HERE, 'programs-v1.json'), 'utf8')) as Record<string, unknown>;
const archivedKits = JSON.parse(readFileSync(join(HERE, 'ea-kits-v1.json'), 'utf8')) as Record<
    string,
    { decks: Record<string, string[]>; startKits: Record<string, string[]> }
>;

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            if (entry === 'archive') continue;
            walk(full, out);
        } else if (/\.tsx?$/.test(entry)) {
            out.push(full);
        }
    }
    return out;
}

describe('ticket 162a — the v1 archive', () => {
    it('holds the whole v1 pool and all twelve EA kits', () => {
        expect(Object.keys(archivedPrograms).length).toBe(243);
        expect(Object.keys(archivedKits).length).toBe(6);
        const osCount = Object.values(archivedKits).reduce((n, s) => n + Object.keys(s.decks).length, 0);
        expect(osCount).toBe(12);
    });

    it('every archived start kit is five cards and a sub-multiset of its deck', () => {
        for (const [species, entry] of Object.entries(archivedKits)) {
            for (const [os, kit] of Object.entries(entry.startKits)) {
                expect(kit.length, `${species}/${os}`).toBe(5);
                const deck = [...entry.decks[os]];
                for (const card of kit) {
                    const at = deck.indexOf(card);
                    expect(at, `${os}: ${card} is not in the deck`).toBeGreaterThanOrEqual(0);
                    deck.splice(at, 1);
                }
            }
        }
    });

    it('is imported by nothing outside this folder', () => {
        const offenders = walk(SRC)
            .filter((file) => /from\s+['"][^'"]*archive\/(programs-v1|ea-kits-v1)/.test(readFileSync(file, 'utf8')));
        expect(offenders).toEqual([]);
    });
});
