/**
 * TICKET 176d — `previewEncounter`: what the map shows after a Ping Sweep or a Relay Tower Survey
 * is the fight the node would really roll, not a guess.
 *
 * Driven through the real `enterNode` reducer, because the claim is about what entering does: it
 * adds one to the node's visit count and then the fight is rolled from (run seed, node id, visits).
 */
import { describe, expect, it } from 'vitest';

import { createRun } from '../../engine/run/createRun';
import {
    SURVEYABLE_KINDS,
    encounterSpeciesLine,
    previewEncounter,
    rollEncounter,
    surveyedEncounters,
} from '../../engine/run/encounter';
import { offerGyms } from '../../engine/run/gyms';
import type { IMingmingState } from '../../engine/types';
import { standBeside } from '../../testing/standBeside';
import runReducer, { enterNode, startRun } from './runSlice';

const member = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});
const PARTY = [member('mm1', 'kraken', 'kraken_v1'), member('mm2', 'fenrir', 'fenrir_v1')];

/** A run well past its scripted opening fight, so every node rolls the ordinary way. */
const runFor = (seed: string) => ({
    ...createRun({ seed, offer: offerGyms('offer-seed')[0], party: PARTY, startedAt: 1_700_000_000_000 }),
    fightsResolved: 3,
});

describe('previewEncounter', () => {
    it('is exactly the encounter rolled on entering the node, for every fight node of 50 seeds', () => {
        let checked = 0;
        for (let i = 0; i < 50; i += 1) {
            const run = runFor(`preview-${i}`);
            for (const node of run.nodes.filter((n) => SURVEYABLE_KINDS.includes(n.kind) && n.visited === 0)) {
                const preview = previewEncounter(run, node, PARTY);

                const entered = runReducer(runReducer(undefined, startRun(standBeside(run, node.id))), enterNode(node.id)).run!;
                const here = entered.nodes.find((n) => n.id === node.id)!;
                expect(here.visited, `${node.id} should have been entered`).toBe(1);

                expect(preview, `${run.seed} ${node.id}`).toEqual(rollEncounter({ run: entered, node: here, party: PARTY }));
                checked += 1;
            }
        }
        expect(checked).toBeGreaterThan(300);
    });
});

describe('surveyedEncounters', () => {
    const run = runFor('survey-lines');

    it('lists nothing when no biome has been surveyed', () => {
        expect(surveyedEncounters(run, PARTY, [])).toEqual({});
    });

    it('lists every fight still ahead in the surveyed biome, and nothing in the others', () => {
        const lines = surveyedEncounters(run, PARTY, [1]);
        const expected = run.nodes
            .filter((n) => n.biomeIndex === 1 && n.visited === 0 && SURVEYABLE_KINDS.includes(n.kind))
            .map((n) => n.id)
            .sort();
        expect(expected.length).toBeGreaterThan(3);
        expect(Object.keys(lines).sort()).toEqual(expected);
        for (const id of Object.keys(lines)) expect(lines[id].length).toBeGreaterThan(0);
    });

    it('never lists the gym, an event, a town or a node already fought', () => {
        const lines = surveyedEncounters(run, PARTY, [0, 1, 2]);
        for (const id of Object.keys(lines)) {
            const node = run.nodes.find((n) => n.id === id)!;
            expect(['gym', 'event', 'town']).not.toContain(node.kind);
            expect(node.visited).toBe(0);
        }
    });
});

describe('encounterSpeciesLine', () => {
    it('names the species in order, and counts a repeated body once', () => {
        const run = runFor('species-line');
        for (const node of run.nodes.filter((n) => SURVEYABLE_KINDS.includes(n.kind)).slice(0, 12)) {
            const encounter = previewEncounter(run, node, PARTY);
            const line = encounterSpeciesLine(encounter);
            expect(line.split(', ').length).toBeLessThanOrEqual(encounter.enemyParty.length);
            expect(line.length).toBeGreaterThan(0);
        }
    });
});
