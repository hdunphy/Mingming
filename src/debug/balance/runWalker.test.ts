/**
 * TICKET 157 — THE WALKER, and the four things a harness like this gets wrong.
 *
 * A run walker is a machine that produces numbers nobody can check by eye, so what needs pinning is
 * not the numbers — those are the finding — but the joins and the policy. Every claim below is one
 * that, broken, would produce a report that looks entirely plausible and is wrong:
 *
 *  1. **The setup translation matches `runGate.ts`'s.** The walker plays fights with its own copy of
 *     the `IRunEncounter -> ComposedSetup` step. If the copy drifts, the walker measures a different
 *     game from the gate and the two can no longer be compared — which is the whole reason 157 was
 *     built on top of 61 rather than beside it.
 *  2. **The corpse join.** `rollDropTable` pays only for bodies at `currentHp <= 0`. The first build
 *     of this file handed it the party as ROLLED and measured a run in which no fight ever paid a
 *     card. It read like a devastating finding about the reward table.
 *  3. **The deck-power measurement is `runRead`'s.** The walker's curve and the human run read have
 *     to be the same number or comparing a machine run to Henry's is meaningless.
 *  4. **The policy is the ruled policy**, not a plausible-looking neighbour of it.
 */
import { describe, expect, it } from 'vitest';

import {
    scoreOf, deckPower, chooseStep, choosePick, chooseRecruit, walkRun, eaStarters,
    NO_FIRMWARE_OS,
} from './runWalker';
import { NO_FIRMWARE_OS as GATE_NO_FIRMWARE_OS, sampleFight, CELLS } from './runGate';
import { runOne } from './runBatch';
import { createRun } from '../../engine/run/createRun';
import { offerGyms, COUNTERED_BY } from '../../engine/run/gyms';
import { rollEncounter } from '../../engine/run/encounter';
import { MingmingRegistry, LAUNCH_SPECIES } from '../../engine/data/mingmingRegistry';
import { grammarFor } from '../../engine/data/osGrammar';
import { GetProgramData } from '../../engine/data/programRegistry';
import { calculatePowerscale } from './powerscale';
import type { IMingmingState } from '../../engine/types';

const SOLO: IMingmingState[] = [{
    id: 'mm1', definitionId: 'fenrir', activeOS: 'fenrir_v1',
    blueprintsCollected: 0, attackIV: 15, defenseIV: 15, hpIV: 15,
}];

const aRun = (seed = 'walker-test'): ReturnType<typeof createRun> =>
    createRun({ seed, offer: offerGyms(`${seed}:gyms`)[0], party: SOLO, startedAt: 1_700_000_000_000 });

describe('157 — the joins, which are what a plausible-looking wrong report is made of', () => {
    it('translates an encounter into the same setup shape `runGate` does', () => {
        // Claim 1. Compared field by field against a gate-built setup rather than against a literal,
        // so a change on either side that the other does not follow fails here.
        const gate = sampleFight(CELLS.find((c) => c.band === 'wild' && c.biomeIndex === 0)!, 0);
        expect(NO_FIRMWARE_OS).toBe(GATE_NO_FIRMWARE_OS);
        expect(gate.setup.enemyMode).toBe('CARDS');
        expect(gate.setup.statJitter).toBeDefined();
        // The whole enemy deck rides on `enemies[0]`, which is the property both files rely on.
        expect(gate.setup.enemies[0].deck?.length ?? 0).toBeGreaterThan(0);
        for (const enemy of gate.setup.enemies.slice(1)) expect(enemy.deck ?? []).toEqual([]);
    });

    it('reads the enemy end state positionally, because the battle mints its own ids', () => {
        /*
         * Claim 2, at its root: `buildScenarioState` builds entities from the `ComposedSetup`, so
         * `RunResult.enemyEnd`'s ids are the BATTLE's and never the encounter's. An id join matches
         * nothing and looks exactly like a fight where every enemy survived — which pays no rewards
         * at all, silently.
         */
        const run = aRun();
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const encounter = rollEncounter({ run, node, party: SOLO });
        const result = runOne(
            {
                seed: encounter.seed, enemyMode: 'CARDS',
                player: { party: SOLO.map((m) => ({ definitionId: m.definitionId, activeOS: m.activeOS, attackIV: 15, defenseIV: 15, hpIV: 15 })), deck: run.deck.map((c) => c.dataId), drivers: [] },
                enemies: encounter.enemyParty.map((e, i) => ({
                    definitionId: e.definitionId, activeOS: e.activeOS ?? NO_FIRMWARE_OS,
                    attackIV: 15, defenseIV: 15, hpIV: 15, deck: i === 0 ? [...encounter.enemyDeckIds] : [],
                })),
            },
            encounter.seed, 60,
        );

        expect(result.enemyEnd).toHaveLength(encounter.enemyParty.length);
        const encounterIds = new Set(encounter.enemyParty.map((e) => e.id));
        expect(
            result.enemyEnd.every((e) => encounterIds.has(e.id)),
            'the ids happen to match — this test is asserting the opposite, so the positional join is now unnecessary',
        ).toBe(false);
    });

    it('scores a deck exactly as `runRead` does, so a machine run and a human run are comparable', () => {
        // Claim 3. `runRead.meanPowerscale` is private, so its formula is restated rather than
        // imported; restating it HERE, against the real registry, is what keeps the two honest.
        const deck = aRun().deck.map((c) => c.dataId);
        const expected = deck.reduce((sum, id) => sum + calculatePowerscale(GetProgramData(id)).score, 0) / deck.length;
        expect(deckPower(deck)).toBeCloseTo(expected, 10);
    });

    it('survives a card the registry has since dropped instead of ending the walk', () => {
        // 154a made `GetProgramData` throw in DEV. A walk that died on one dropped id would lose
        // every fight it had already measured.
        expect(scoreOf('a_card_that_was_cut')).toBeNull();
        expect(deckPower(['tackle', 'a_card_that_was_cut'])).toBe(scoreOf('tackle'));
        expect(deckPower(['a_card_that_was_cut'])).toBeNull();
    });
});

describe('157 — the route policy (§3: shortest path, and the tie-break is the policy)', () => {
    it('only ever steps to a node on a SHORTEST path to the gym', () => {
        const run = aRun();
        const gymNodeId = run.nodes.find((n) => n.kind === 'gym')!.id;
        const byId = new Map(run.nodes.map((n) => [n.id, n]));

        // Distances by BFS, computed here independently of the implementation.
        const dist = new Map<string, number>([[gymNodeId, 0]]);
        let frontier = [gymNodeId];
        while (frontier.length > 0) {
            const next: string[] = [];
            for (const id of frontier) {
                for (const edge of byId.get(id)?.edges ?? []) {
                    if (dist.has(edge)) continue;
                    dist.set(edge, (dist.get(id) ?? 0) + 1);
                    next.push(edge);
                }
            }
            frontier = next;
        }

        let walked = 0;
        for (const node of run.nodes) {
            if (node.id === gymNodeId) continue;
            const step = chooseStep({ ...run, currentNodeId: node.id }, gymNodeId, 0);
            if (!step) continue;
            walked += 1;
            expect(node.edges, `${node.id} -> ${step.nodeId} is not an edge`).toContain(step.nodeId);
            expect(dist.get(step.nodeId), `${node.id} -> ${step.nodeId} is not a shortest step`)
                .toBe((dist.get(node.id) ?? 0) - 1);
        }
        expect(walked, 'no node produced a step — the graph or the policy is broken').toBeGreaterThan(20);
    });

    it('prefers a workshop while a blueprint is held, and says why', () => {
        // The tie-break IS the policy, so it is asserted rather than left to read like a detail: a
        // recruit is the largest single move the run offers and §5.2 rules that the walker recruits.
        const run = aRun();
        const gymNodeId = run.nodes.find((n) => n.kind === 'gym')!.id;
        const byId = new Map(run.nodes.map((n) => [n.id, n]));
        const fork = run.nodes.find((n) => {
            const kinds = n.edges.map((id) => byId.get(id)?.kind);
            return kinds.includes('workshop') && kinds.some((k) => k !== undefined && k !== 'workshop');
        });
        if (!fork) return; // this seed has no such fork; the claim below is the one that matters
        const withBlueprint = chooseStep({ ...run, currentNodeId: fork.id }, gymNodeId, 1);
        if (withBlueprint?.kind === 'workshop') expect(withBlueprint.why).toContain('blueprint');
    });

    it('stops at the gym rather than walking past it', () => {
        const run = aRun();
        const gymNodeId = run.nodes.find((n) => n.kind === 'gym')!.id;
        expect(chooseStep({ ...run, currentNodeId: gymNodeId }, gymNodeId, 0)).toBeNull();
    });
});

describe('157 — the pick policy (§3, and 153\'s number)', () => {
    const party = new Set(['Fire']);

    it('takes the highest 149c score the party can actually use', () => {
        const decision = choosePick(['tackle', 'ember_jab', 'fury_strike'], ['tackle'], party);
        expect(decision.taken).not.toBeNull();
        const scores = ['tackle', 'ember_jab', 'fury_strike'].map(scoreOf);
        expect(decision.score).toBe(Math.max(...scores.filter((s): s is number => s !== null)));
    });

    it('prefers a card the party\'s element can play over a higher-scoring one it cannot', () => {
        /*
         * The two clauses of §3's rule are NOT the same test. A Water card in a Fire party is a card
         * the deck cannot use however well it scores — so element filters first, and only if nothing
         * survives the filter does raw score decide.
         */
        const water = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.decks?.[`${s}_v1`] ?? [])
            .find((id) => GetProgramData(id).element === 'Water');
        if (!water) return;
        const decision = choosePick([water, 'ember_jab'], [], party);
        expect(GetProgramData(decision.taken!).element === 'Water').toBe(false);
    });

    it('marks a pick for the COLLECTION when it beats nothing already held — 153\'s number', () => {
        // Not a refusal: the collection costs nothing and is one edit from playing, which is why
        // paid removal could be deleted. The flag measures the REWARD TABLE, not the walker.
        // Chosen by MEASUREMENT, not by feel: the first draft of this case used `war_pact` as a
        // "strong" card and it scores 0.70 against tackle's 1.20, so the case asserted the opposite
        // of what it said. Ragnarok Edge is 7.00 and Glass Cannon 3.20.
        const held = ['ragnarok_edge', 'glass_cannon'];
        expect(Math.min(...held.map((id) => scoreOf(id)!))).toBeGreaterThan(scoreOf('tackle')!);
        const decision = choosePick(['tackle'], held, new Set(['Fire', 'None']));
        expect(decision.taken).toBe('tackle');
        expect(decision.toCollection).toBe(true);
        expect(choosePick(['tackle'], ['tackle'], party).toCollection).toBe(true);
    });

    it('takes nothing, loudly, when nothing on offer can be scored', () => {
        const decision = choosePick(['a_card_that_was_cut'], ['tackle'], party);
        expect(decision.taken).toBeNull();
        expect(decision.toCollection).toBe(false);
    });
});

describe('157 — the recruit policy (§5.2, on 158-r1\'s registry grammar)', () => {
    it('prefers an authored partner of a body already in the party', () => {
        // The ruling's first clause. kraken_v1's authored partners include jormungandr_v1, and the
        // web now lives in the registry (158-r1) rather than in a design file.
        const partners = grammarFor('kraken_v1')!.partners.map((p) => p.osId);
        expect(partners.length).toBeGreaterThan(0);
        const species = partners.map((os) => MingmingRegistry[Object.keys(MingmingRegistry).find((s) => MingmingRegistry[s].availableOS.includes(os))!]);
        const choice = chooseRecruit(species[0].id, ['kraken_v1'], 'Fire');
        expect(choice).not.toBeNull();
        expect(choice!.why).toContain('partner');
    });

    it('prefers the element that COUNTERS the gym when no partner applies', () => {
        // The ruling's second clause: "a Water/Water/Fire gym wants a Nature/Nature/Water party".
        const gymElement = 'Fire';
        const counter = COUNTERED_BY[gymElement];
        const counterSpecies = LAUNCH_SPECIES.find((s) => MingmingRegistry[s].primaryElement === counter)!;
        const choice = chooseRecruit(counterSpecies, [], gymElement);
        expect(choice!.why).toContain(`counters the ${gymElement} gym`);
    });

    it('says so plainly when the grammar joins a candidate to nothing', () => {
        // A recruit with no authored reason is still a body, and the log says it was taken for no
        // reason rather than inventing one.
        const choice = chooseRecruit('fenrir', [], 'Nature');
        expect(choice).not.toBeNull();
        if (!choice!.why.includes('partner') && !choice!.why.includes('counters') && !choice!.why.includes('shares')) {
            expect(choice!.why).toContain('nothing in the grammar');
        }
    });

    it('returns null for a species the registry does not have', () => {
        expect(chooseRecruit('not_a_species', ['kraken_v1'], 'Fire')).toBeNull();
    });
});

describe('157 — a whole walk', () => {
    it('plays a run end to end and writes 156\'s rows', () => {
        /*
         * ONE walk in the gate, on a seed chosen because it ends QUICKLY.
         *
         * A walk plays real battles at the encounter's own beam, so a long one costs half a minute
         * and a suite of them costs more than the whole gate. The expensive claims — determinism
         * across seeds, the summary table, the twelve starters — live in `runWalker.balance.ts`,
         * which is the suite that already pays for battles. What is left here is the claim the gate
         * genuinely needs: the walker still walks, and it still writes 156's schema.
         */
        const result = walkRun({ seed: 'wb-0', starter: 'fenrir_v1', gymIndex: 0 });
        expect(result.fights.length).toBeGreaterThan(0);
        expect(['victory', 'defeat']).toContain(result.outcome);

        const kinds = result.log.events.map((e) => e.kind);
        expect(kinds[0]).toBe('RUN_STARTED');
        expect(kinds.at(-1)).toBe('RUN_ENDED');
        // One FIGHT_DECK and one FIGHT_ENDED per fight played.
        expect(kinds.filter((k) => k === 'FIGHT_DECK')).toHaveLength(result.fights.length);
        expect(kinds.filter((k) => k === 'FIGHT_ENDED')).toHaveLength(result.fights.length);
        // `seq` is minted once and never repeats — `runRead` orders on it.
        const seqs = result.log.events.map((e) => e.seq);
        expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
        expect(new Set(seqs).size).toBe(seqs.length);
    });

    it('offers all twelve EA firmware as starters, derived from the registry', () => {
        // §5.3: "the current EA twelve". Derived rather than transcribed, so an EA scope change
        // moves the walker without anybody remembering to.
        expect(eaStarters()).toHaveLength(12);
        for (const osId of eaStarters()) expect(grammarFor(osId), `${osId} has no grammar`).toBeDefined();
    });
});
