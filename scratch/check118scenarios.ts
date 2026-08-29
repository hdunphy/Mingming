/**
 * TICKET 118 — load gate for the playtest scenario files.
 *
 * Schema-validating a scenario proves the JSON is well shaped. It does NOT prove the launcher can
 * build a battle from it: card ids have to resolve in `ProgramRegistry`, species and OS ids have to
 * resolve in `MingmingRegistry`, and the opening draw has to succeed. Henry is going to load these
 * with limited time tomorrow, so every file gets driven through the real load path here rather than
 * discovered broken at the controls.
 *
 * Checks per file: parse via `loadScenario` (the launcher's own path, including the registryHash
 * banner), build via `buildScenarioState`, then assert the built state is actually playable -
 * correct party sizes, non-empty hand, every card id resolvable.
 *
 * Run: npx vite-node scratch/check118scenarios.ts
 */
import { loadScenario } from '../src/debug/scenarios/scenarioIO';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ComposedScenario } from '../src/debug/scenarios/scenarioSchema';
import fs from 'node:fs';
import path from 'node:path';
import { ENV } from './_env';

const DIR = ENV.DIR ?? 'src/debug/scenarios/playtest/ticket-118';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.scenario.json')).sort();
if (!files.length) throw new Error(`no scenario files in ${DIR}`);

let failures = 0;
for (const f of files) {
    const raw = fs.readFileSync(path.join(DIR, f), 'utf8');
    const res = loadScenario(raw);
    if (!res.scenario) {
        console.error(`FAIL  ${f}\n      ${res.error}`);
        failures++;
        continue;
    }
    const scenario = res.scenario as ComposedScenario;

    // Unknown card ids are the failure this is really hunting: a typo would build a SHORTER deck
    // rather than throwing, which is silent and would only show up as a weird playtest.
    const allCards = [
        ...scenario.setup.player.deck,
        ...scenario.setup.enemies.flatMap(e => e.deck ?? []),
    ];
    const unknown = [...new Set(allCards.filter(id => !ProgramRegistry[id]))];
    if (unknown.length) {
        console.error(`FAIL  ${f}  unknown card ids: ${unknown.join(', ')}`);
        failures++;
        continue;
    }

    let state;
    try {
        state = buildScenarioState(scenario.setup);
    } catch (e) {
        console.error(`FAIL  ${f}  build threw: ${(e as Error).message}`);
        failures++;
        continue;
    }

    const problems: string[] = [];
    if (state.playerParty.length !== scenario.setup.player.party.length) problems.push('party size');
    if (state.enemyParty.length !== scenario.setup.enemies.length) problems.push('enemy count');
    if (state.playerDeck.hand.length === 0) problems.push('empty opening hand');
    if (state.enemyDeck.drawpile.length + state.enemyDeck.hand.length === 0) problems.push('empty enemy pile');
    if (state.playerParty.some(e => e.currentHp <= 0)) problems.push('a player unit starts dead');

    if (problems.length) {
        console.error(`FAIL  ${f}  ${problems.join(', ')}`);
        failures++;
        continue;
    }

    console.log(`ok    ${f}`);
    console.log(`      ${state.playerParty.length}v${state.enemyParty.length}  `
        + `player hand ${state.playerDeck.hand.length} / pile ${state.playerDeck.drawpile.length}  `
        + `enemy pile ${state.enemyDeck.drawpile.length}  `
        + `hp ${state.playerParty.map(e => e.currentHp).join('/')} vs `
        + `${state.enemyParty.map(e => e.currentHp).join('/')}`
        + (res.registryHashMismatch ? '   [registry hash banner WILL show]' : ''));
}

console.log(failures ? `\n${failures} of ${files.length} FAILED` : `\nall ${files.length} load and build`);
if (failures) process.exitCode = 1;
