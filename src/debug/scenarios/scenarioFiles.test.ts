/**
 * Every committed `.scenario.json` must load.
 *
 * WHY THIS EXISTS. Ticket 118 shipped six playtest scenarios and Henry hit
 * `[setup.player.party.0.level] Invalid input: expected number, received undefined` at the
 * launcher. The files on disk were fine - every unit carries `level: 15` - so the failing input
 * came from somewhere else, but there was no way to demonstrate that except by hand-running a
 * scratch script. A scenario file is data that the type system cannot check and that nothing
 * imports, so it can rot silently: rename a card, drop a field, hand-edit a file, and the only
 * thing that notices is a person at the controls with limited time.
 *
 * This walks EVERY scenario file under `src/debug/scenarios/` and drives it through the real load
 * path, so `npm test` answers "is this file loadable" instead of the debug panel answering it.
 *
 * Composed scenarios get the stronger check: card ids must resolve, and the setup must actually
 * build a playable battle. An unknown card id does NOT throw - `instantiateDeck` just builds a
 * shorter deck - so a typo would otherwise show up as a strange playtest rather than an error.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadScenario } from './scenarioIO';
import { buildScenarioState } from './buildScenarioState';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import type { ComposedScenario } from './scenarioSchema';

const ROOT = path.join(__dirname);

function scenarioFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...scenarioFiles(full));
        else if (entry.name.endsWith('.scenario.json')) out.push(full);
    }
    return out;
}

const files = scenarioFiles(ROOT);

describe('committed scenario files', () => {
    it('finds scenario files to check', () => {
        // A glob that silently matches nothing is a green test that checks nothing.
        expect(files.length).toBeGreaterThan(0);
    });

    it.each(files.map(f => [path.relative(ROOT, f), f]))('%s loads', (_name, file) => {
        const result = loadScenario(fs.readFileSync(file, 'utf8'));
        // The error text is included in the assertion so a failure names the offending field
        // rather than just saying `expected null to be truthy`.
        expect(result.error ?? '').toBe('');
        expect(result.scenario).toBeTruthy();
    });

    const composed = files.filter(f => {
        const r = loadScenario(fs.readFileSync(f, 'utf8'));
        return r.scenario?.kind === 'composed';
    });

    it.each(composed.map(f => [path.relative(ROOT, f), f]))('%s builds a battle', (_name, file) => {
        const scenario = loadScenario(fs.readFileSync(file, 'utf8')).scenario as ComposedScenario;

        const unknown = [...new Set([
            ...scenario.setup.player.deck,
            ...scenario.setup.enemies.flatMap(e => e.deck ?? []),
        ].filter(id => !ProgramRegistry[id]))];
        expect(unknown, `unknown card ids in ${path.basename(file)}`).toEqual([]);

        const state = buildScenarioState(scenario.setup);
        expect(state.playerParty).toHaveLength(scenario.setup.player.party.length);
        expect(state.enemyParty).toHaveLength(scenario.setup.enemies.length);
        expect(state.playerParty.every(e => e.currentHp > 0)).toBe(true);
        // An empty opening hand means the deck never reached the player - the failure mode a
        // silently-shortened deck produces.
        expect(state.playerDeck.hand.length).toBeGreaterThan(0);
    });
});
