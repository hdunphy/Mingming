/**
 * THE COLLECTION BROWSER READS THE REGISTRY — ticket 162d, guarded after losing it twice.
 *
 * `collection-v2/build.py` renders the page Henry reviews cards from. Before 162d it read only
 * `collection.py`, the design draft, which was right while the collection was a proposal and wrong
 * the moment 162a shipped it: the page would keep showing the draft's numbers after a pricing pass
 * moved them, on the exact surface a pricing decision gets read off.
 *
 * **That call was removed twice in one evening**, both times by an edit to `build.py` made from a
 * copy taken before 162d landed, and both times SILENTLY — the page still built, it just described
 * a collection that is no longer in the game. No test failed, because nothing was testing a Python
 * script from a TypeScript suite.
 *
 * So this does. It is a crude test and that is deliberate: it reads the file and checks the call is
 * there. It cannot tell whether the call WORKS — `collectionExport.ts`'s own behaviour is covered
 * where that lives — but the failure mode it exists for is not subtle breakage, it is deletion.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join('docs', 'wayfinder', 'deck-archetypes', 'collection-v2');
const BUILD = path.join(DIR, 'build.py');
const SOURCE = path.join(DIR, 'registry_source.py');

describe('ticket 162d — the collection browser is built from the registry', () => {
    it('keeps the two files the wiring needs', () => {
        expect(fs.existsSync(BUILD), `${BUILD} is missing`).toBe(true);
        expect(fs.existsSync(SOURCE), `${SOURCE} is missing — 162d's registry hook`).toBe(true);
    });

    it('build.py still calls registry_source.apply', () => {
        const build = fs.readFileSync(BUILD, 'utf8');
        expect(build, 'build.py no longer imports registry_source — see the note at the top of that file')
            .toContain('import registry_source');
        expect(build, 'build.py no longer calls registry_source.apply, so the browser is back on the design draft')
            .toMatch(/registry_source\.apply\(\s*CARDS\s*,\s*OS\s*,\s*RUN_ONLY/);
    });

    it('never rewrites collection.json from a registry-sourced run', () => {
        // collection.json is the DESIGN record and the only home of 158 §2's `shape` / `cur` tags,
        // which `registry_source` reads and cannot reconstruct. Overwriting it from the registry
        // would destroy them and leave no way back to the draft.
        const build = fs.readFileSync(BUILD, 'utf8');
        const write = build.indexOf("open('collection.json', 'w'");
        expect(write, 'the collection.json write vanished — check this guard still means something')
            .toBeGreaterThan(0);
        expect(build.slice(Math.max(0, write - 200), write))
            .toContain('if not FROM_REGISTRY:');
    });

    it('the exporter npm run decks calls is still wired to it', () => {
        const runner = fs.readFileSync(path.join('src', 'debug', 'balance', 'runDeckBrowser.ts'), 'utf8');
        expect(runner, '`npm run decks` no longer refreshes registry.json')
            .toContain('writeCollectionExport');
    });
});
