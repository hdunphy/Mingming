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
    scoreOf, deckPower, chooseStep, choosePick, chooseRecruit, chooseUpgrade, choosePatches,
    walkRun, walkStarter, eaStarters, NO_FIRMWARE_OS, summariseFightOne,
    memberFor, draftKitFor, chooseDraftPick, withCarriedHp,
} from './runWalker';
import type { ComposedSetup } from '../scenarios/scenarioSchema';
import { DRAFT_PICKS, draftOffer, draftPool } from '../../engine/run/modifiers/draftStart';
import { hasUpgrade } from '../../engine/data/plusRegistry';
import { upgradePrice } from '../../engine/run/marketplace';
import { PATCH_SLOTS } from '../../engine/data/patchRegistry';
import { SHOP_STOCK_PATCH, bestPatchFor } from '../../engine/data/patchRanking';
import { rawFirmwareHooks } from '../../engine/data/firmwareRegistry';
import { NO_FIRMWARE_OS as GATE_NO_FIRMWARE_OS, sampleFight, CELLS } from './runGate';
import { runOne } from './runBatch';
import { START_KIT_SIZE, createRun, startKitIdsFor } from '../../engine/run/createRun';
import { offerGyms, COUNTERED_BY } from '../../engine/run/gyms';
import { rollEncounter } from '../../engine/run/encounter';
import { MingmingRegistry, LAUNCH_SPECIES } from '../../engine/data/mingmingRegistry';
import { grammarFor } from '../../engine/data/osGrammar';
import { GetProgramData } from '../../engine/data/programRegistry';
import { calculatePowerscale } from './powerscale';
import type { IRunEvent } from '../../engine/run/runLog';
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
         * ONE walk in the gate, BOUNDED — and the bound replaced a seed, for a reason worth keeping.
         *
         * A walk plays real battles at the encounter's own beam, so a long one costs half a minute
         * and a suite of them costs more than the whole gate. This line used to read *"a seed chosen
         * because it ends QUICKLY"*, and that was true when it was written.
         *
         * **TICKET 40 CAUGHT IT NO LONGER BEING TRUE.** 157-r2 softened the opening fight — the
         * enemy now holds its start kit minus its payoff — so runs survive further, and this walk
         * quietly grew from a couple of seconds to **40**, which was most of the gap between a
         * 127-second suite and a 243-second one. Nothing failed; the premise just decayed.
         *
         * A seed chosen for speed is a premise that any balance change can retire without saying
         * so. `stopAfterFights` (157-r1's own flag) makes the cost STRUCTURAL instead: three fights
         * is three fights whatever the ladder does next. Every assertion below survives the bound —
         * `walkRun` dispatches `endRun` and records `RUN_ENDED` on the truncated path too, so the
         * log is still a complete, well-formed log of the run that was played.
         *
         * The expensive claims — determinism across seeds, the summary table, the twelve starters —
         * live in `runWalker.balance.ts`, the suite that already pays for battles.
         */
        const result = walkRun({ seed: 'wb-0', starter: 'fenrir_v1', gymIndex: 0, stopAfterFights: 3 });
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

describe('163e — the upgrade policy', () => {
    const card = (dataId: string, n = 0) => ({ instanceId: `i${n}`, dataId, ownerId: null });

    it('upgrades the HIGHEST-scoring card that has a `+`, which is the arm\'s whole character', () => {
        /*
         * Highest rather than lowest, and it is a choice. An upgrade never changes a card's SHAPE
         * (163 §1), so upgrading the best card compounds what the deck already does while upgrading
         * the worst raises a floor the deck is trying to draw around. §5's wording picks the first.
         */
        const deck = [card('tackle', 0), card('ragnarok_edge', 1), card('forage', 2)]
            .filter((c) => hasUpgrade(c.dataId));
        expect(deck.length).toBeGreaterThan(1);
        const best = [...deck].sort((a, b) => scoreOf(b.dataId)! - scoreOf(a.dataId)!)[0];
        expect(chooseUpgrade(deck, 999, false)?.from).toBe(best.dataId);
    });

    it('refuses what the purse cannot reach, and takes a cheaper card instead of nothing', () => {
        const dear = 'ragnarok_edge';
        const cheap = 'tackle';
        if (!hasUpgrade(dear) || !hasUpgrade(cheap)) return;
        const deck = [card(dear, 0), card(cheap, 1)];
        expect(chooseUpgrade(deck, 0, false)).toBeNull();
        // One scrap short of the dear one: the policy still spends, on the one it can afford.
        const short = upgradePrice(dear) - 1;
        const choice = chooseUpgrade(deck, short, false);
        if (upgradePrice(cheap) <= short) expect(choice?.from).toBe(cheap);
    });

    it('is FREE at the gate, so an empty purse still upgrades', () => {
        // 163 §3: the gym gate is free, once. The only venue where scrap is not the gate.
        const deck = [card('tackle', 0)].filter((c) => hasUpgrade(c.dataId));
        if (deck.length === 0) return;
        expect(chooseUpgrade(deck, 0, true)).not.toBeNull();
        expect(chooseUpgrade(deck, 0, true)!.price).toBe(0);
    });

    it('takes nothing when the deck holds no `+`, rather than inventing one', () => {
        const deck = [card('a_card_that_was_cut', 0)];
        expect(chooseUpgrade(deck, 999, false)).toBeNull();
    });

    it('names the `+` it is buying, so the log says what the run got', () => {
        const deck = [card('venom_fang', 0)].filter((c) => hasUpgrade(c.dataId));
        if (deck.length === 0) return;
        const choice = chooseUpgrade(deck, 999, false)!;
        expect(choice.to).toBe(`${choice.from}+`);
        expect(choice.price).toBe(upgradePrice(choice.from));
    });
});

describe('163e — the patch policy', () => {
    const member = (id: string, osId: string) => ({
        id, definitionId: 'kraken', activeOS: osId,
        blueprintsCollected: 0, attackIV: 15, defenseIV: 15, hpIV: 15,
    });

    it('at the GATE takes the rider that fits THIS firmware, which is what makes it a choice', () => {
        // `gatePatchChoices` leads with `bestPatchFor`, so the policy is "take the first" and what
        // is being measured is the distribution that produces — not a preference of the walker's.
        const fits = choosePatches([member('mm1', 'kraken_v1')], {}, 'gate');
        expect(fits).toHaveLength(1);
        expect(fits[0].patchId).toBe(bestPatchFor(rawFirmwareHooks('kraken_v1')).id);
    });

    it('at the SHOP takes Amplifier, which is what §3 says the shelf stocks', () => {
        expect(choosePatches([member('mm1', 'kraken_v1')], {}, 'shop')[0].patchId).toBe(SHOP_STOCK_PATCH);
    });

    it('skips a body whose slot is already full — one per body, and no replacing', () => {
        expect(PATCH_SLOTS).toBe(1);
        expect(choosePatches([member('mm1', 'kraken_v1')], { mm1: ['amplifier'] }, 'gate')).toEqual([]);
        expect(choosePatches([member('mm1', 'kraken_v1')], { mm1: ['amplifier'] }, 'shop')).toEqual([]);
    });

    it('offers one per body, so a party of three is three decisions', () => {
        const party = [member('mm1', 'kraken_v1'), member('mm2', 'fenrir_v1'), member('mm3', 'huldra_v1')];
        expect(choosePatches(party, {}, 'gate')).toHaveLength(3);
        expect(choosePatches(party, { mm2: ['relay'] }, 'gate')).toHaveLength(2);
    });
});

describe('157-r1 — the truncated walk, which is the fight-one read', () => {
    /*
     * The one thing this flag can get wrong, and it would not look wrong: a truncation that changed
     * the fight it stopped at. The read is being compared against a ruled target of 95, so a
     * truncated walk that played a slightly different first fight from a full one would produce a
     * number Henry rules on and nobody can reproduce from a real run.
     *
     * Asserted as byte-equality of the whole `FightRecord`, on the SAME seed, rather than on the
     * win alone — a first fight that matched on the outcome and differed on the deck would be the
     * same bug one step further from being caught.
     */
    it('plays the same fight one a full walk does, on the same seed', () => {
        const seed = 't157r1:truncation';
        const full = walkRun({ seed, starter: 'kraken_v1', gymIndex: 0 });
        const cut = walkRun({ seed, starter: 'kraken_v1', gymIndex: 0, stopAfterFights: 1 });

        expect(cut.fights[0]).toEqual(full.fights[0]);
        expect(full.fights.length).toBeGreaterThan(1);
    });

    it('stops AT the stop rather than one fight either side of it', () => {
        const seed = 't157r1:truncation';
        // Fight one is won on this seed (the case above proves the record is shared), so the walk
        // stops because the budget ran out rather than because the run ended.
        const cut = walkRun({ seed, starter: 'kraken_v1', gymIndex: 0, stopAfterFights: 1 });
        expect(cut.fights).toHaveLength(1);
        expect(cut.fights[0].won).toBe(true);

        const two = walkRun({ seed, starter: 'kraken_v1', gymIndex: 0, stopAfterFights: 2 });
        expect(two.fights).toHaveLength(2);
        expect(two.fights[0]).toEqual(cut.fights[0]);
    });

    it('reports a truncated run as a DEFEAT, which is why only `byFightIndex` may be read off it', () => {
        // Stated as a test rather than only in the docblock: `outcome` and `finalDeck` on a
        // truncated walk are artefacts of the stop, and a later reader folding them into a win rate
        // would report every starter at 0% and call it a finding.
        const cut = walkRun({ seed: 't157r1:truncation', starter: 'kraken_v1', gymIndex: 0, stopAfterFights: 1 });
        expect(cut.outcome).toBe('defeat');
    });
});

describe('157-r1 — summariseFightOne reads one fight and nothing else', () => {
    it('counts only the fight at the index, conditional on having reached it', () => {
        const results = [0, 1, 2].map((i) => walkRun({
            seed: `t157r1:summary:${i}`, starter: 'kraken_v1', gymIndex: i % 3, stopAfterFights: 1,
        }));
        const row = summariseFightOne('kraken_v1', results);

        expect(row.played).toBe(results.filter((r) => r.fights.length >= 1).length);
        expect(row.wins).toBe(results.filter((r) => r.fights[0]?.won).length);
        expect(row.rate).toBeCloseTo((100 * row.wins) / row.played, 6);
    });

    it('reports a starter nobody walked as 0 of 0 rather than as a loss', () => {
        // The denominator is "reached it", so an index past every walk is an EMPTY row. A summary
        // that returned 0% here would make "fight 12" look like a wall rather than like no data.
        const row = summariseFightOne('kraken_v1', [], 12);
        expect(row).toMatchObject({ played: 0, wins: 0, rate: 0, meanSurvivorHp: null });
    });
});

describe('40 — a WHOLE run is deterministic in its seed, end to end', () => {
    /*
     * ══ THE GAP THE PER-PIECE DETERMINISM TESTS LEAVE. ══
     *
     * Seven files already pin determinism one subsystem at a time: `createRun`, `generateRegionGraph`,
     * `offerGyms`, `rollGauntletFight`, `rollEncounter`'s seed, the marketplace's restock and the
     * workshop's roll. Each asserts that ONE call is a pure function of its inputs.
     *
     * None asserts the thing a player actually depends on — that **the same seed plays the same
     * run** — and that can be false while every piece is individually pure, by the two mechanisms
     * this repo has already been bitten by once each:
     *
     *  - a shared `SeedStream` consumed a different number of times down one branch, so a later
     *    draw lands at a different position (the reason `rollEncounter` forks its two streams, and
     *    the header there records what went wrong when it did not);
     *  - a policy or reducer reading something outside the seed — a clock, a `Math.random`, a `Set`
     *    iteration order — which no single-call test can see, because one call is consistent with
     *    itself.
     *
     * `walkRun` closes it: it plays the run through the real store, the real reducers, the real
     * rolls and the real battles, and its records are a fingerprint of every decision on the way.
     *
     * # THE COST, MEASURED RATHER THAN GUESSED, AND THE TRADE IT FORCES
     *
     * This runs on every push, so it had to be cheap, and three attempts were not: three walks of
     * `kraken_v2` cost **93 seconds**; bounding them to four fights apiece still cost 36; and
     * `skoll_v2` bounded to TWO fights still cost 37, because the cost is how long a starter's
     * individual fights take rather than how many it plays.
     *
     * Measuring every (starter, gym) pair gives the real trade, and it is unavoidable: **a run that
     * goes deep is slow and a run that is fast is shallow.** The walks that finish in under a
     * second are the ones that die at fight one or two. There is no cheap deep run.
     *
     * So this takes the cheap one — a COMPLETE run that ends in defeat at fight two, in ~100ms —
     * and says plainly what it therefore cannot speak for: **it never reaches the gauntlet.**
     * `gauntlet.test.ts` has that determinism case, and the deep-run version of this one costs 90
     * seconds, which is not a price a push gate should pay for an assertion that is already
     * cumulative. Both failure mechanisms above diverge at the first draw that moves, not the last.
     *
     * A run ending in defeat is not a weaker test than one ending in victory — it is how most runs
     * end, and `outcome`, `finalDeck` and `scrapAtEnd` are all real here because the walk was never
     * truncated.
     */
    const input = { seed: 't40:determinism', starter: 'kraken_v1', gymIndex: 2 } as const;
    const a = walkRun(input);
    const b = walkRun(input);
    const other = walkRun({ ...input, seed: 't40:determinism:other' });

    it('plays the same fights, in the same order, with the same decks and outcomes', () => {
        // The fight record carries node id, kind, biome, deck size, deck power, the result, the
        // turn count and who was left standing — so equality here is equality of every battle the
        // run played, not just of who won it.
        expect(b.fights).toEqual(a.fights);
        expect(a.fights.length).toBeGreaterThan(1);
    });

    it('takes the same picks, buys, recruits and route — the decisions, not just the battles', () => {
        /*
         * GUARDED AGAINST VACUITY FIRST. Most of these traces are short on a two-fight run, and
         * `toEqual` on two empty arrays passes while asserting nothing — so the route and the picks
         * are required to be non-empty before they are compared. If a future change makes this seed
         * die on fight one, this fails loudly rather than quietly becoming a no-op.
         */
        expect(a.steps.length, 'the walk must actually move for the route to mean anything').toBeGreaterThan(0);
        expect(a.picks.length, 'the walk must actually be offered a card').toBeGreaterThan(0);

        // Asserted separately from the fights so a failure says WHICH half drifted: a run that
        // fought identically but shopped differently is a different bug from the reverse.
        expect(b.steps).toEqual(a.steps);
        expect(b.picks).toEqual(a.picks);
        expect(b.bought).toEqual(a.bought);
        expect(b.recruits).toEqual(a.recruits);
        expect(b.patches).toEqual(a.patches);
    });

    it('ends the same way, holding the same deck and the same scrap', () => {
        // The end state is its own case because it is the one a SAVE round-trips (ticket 23): a run
        // resumed from its seed must not mint a different deck than the one the player was shown.
        expect(b.outcome).toBe(a.outcome);
        expect(b.finalDeck).toEqual(a.finalDeck);
        expect(b.scrapAtEnd).toBe(a.scrapAtEnd);
    });

    it('is a function of the SEED — a different one plays a different run', () => {
        // Guards the guard. Two walks that agreed because the walker ignored its seed entirely
        // would pass every case above, and that is exactly the bug they exist to catch.
        expect(other.fights).not.toEqual(a.fights);
    });
});

/*
 * TICKET 169j — the walker plays tiers and modifiers.
 *
 * Bounded to a fight or two with `stopAfterFights` like every walk in the gate (see the note on
 * "a whole walk" above): the claims are about what the walker PASSES to `createRun` and what it
 * logs, not about how the fights end.
 */
/** The first event of a kind from a walk's log, typed by its kind. */
function eventOf<K extends IRunEvent['kind']>(result: ReturnType<typeof walkRun>, kind: K): Extract<IRunEvent, { kind: K }> {
    const found = result.log.events.find((e): e is Extract<IRunEvent, { kind: K }> => e.kind === kind);
    if (!found) throw new Error(`no ${kind} in the log`);
    return found;
}

describe('169j — tiers and modifiers reach the run', () => {
    const SEED = 't169j:walk';
    const fightsOf = (input: Partial<Parameters<typeof walkRun>[0]> = {}) =>
        walkRun({ seed: SEED, starter: 'kraken_v1', gymIndex: 0, stopAfterFights: 2, ...input });
    const started = (result: ReturnType<typeof walkRun>) =>
        eventOf(result, 'RUN_STARTED');

    it('reproduces today\'s walk exactly when tier and modifiers are left out, or given as the defaults', () => {
        const plain = fightsOf();
        const explicit = fightsOf({ tier: 0, modifiers: [] });
        expect(explicit.fights).toEqual(plain.fights);
        expect(explicit.finalDeck).toEqual(plain.finalDeck);
        expect(started(plain)).toMatchObject({ tier: 0, modifiers: [] });
    });

    it('plays a higher tier: the run is built at it and the log says so', () => {
        const tier3 = fightsOf({ tier: 3 });
        expect(started(tier3).tier).toBe(3);
    });

    it('logs the modifiers it was given', () => {
        const junk = fightsOf({ modifiers: ['junk_start'] });
        expect(started(junk).modifiers).toEqual(['junk_start']);
    });

    it('walkStarter forwards both to every walk', () => {
        const [only] = walkStarter('kraken_v1', 1, 't169j:starter', false, undefined, 2, ['tight_budget']);
        expect(started(only).tier).toBe(2);
        expect(started(only).modifiers).toEqual(['tight_budget']);
    });
});

describe('169j — the Draft Start policy', () => {
    const KRAKEN = memberFor('mm1', 'kraken_v1');
    const kit = startKitIdsFor(KRAKEN, START_KIT_SIZE);

    it('drafts exactly five cards, all from the tuned deck, no card more often than the deck holds it', () => {
        for (let i = 0; i < 20; i++) {
            const picks = draftKitFor(`policy-${i}`, KRAKEN);
            expect(picks).toHaveLength(DRAFT_PICKS);
            const pool = draftPool(KRAKEN);
            for (const id of new Set(picks)) {
                expect(picks.filter((p) => p === id).length).toBeLessThanOrEqual(pool.filter((p) => p === id).length);
            }
        }
    });

    it('is deterministic in the seed', () => {
        expect(draftKitFor('same', KRAKEN)).toEqual(draftKitFor('same', KRAKEN));
    });

    it('takes the first offered card that is in the start kit and not yet used up', () => {
        expect(chooseDraftPick(['x', 'b', 'a'], ['a', 'b', 'c', 'd', 'e'], [])).toBe('b');
    });

    it('does not take a kit card the kit has run out of: one copy in the kit, one already taken', () => {
        // `b` is in the kit once and was taken already, so `a` is the first usable kit card.
        expect(chooseDraftPick(['b', 'a'], ['a', 'b'], ['b'])).toBe('a');
        // A kit that holds two copies of `b` lets a second copy through.
        expect(chooseDraftPick(['b', 'a'], ['a', 'b', 'b'], ['b'])).toBe('b');
    });

    it('falls back to the highest-scoring offer when no offered card is a usable kit card, ties to the first', () => {
        const offer = draftPool(KRAKEN).filter((id) => !kit.includes(id)).slice(0, 3);
        const best = offer.reduce((top, id) => ((scoreOf(id) ?? -Infinity) > (scoreOf(top) ?? -Infinity) ? id : top), offer[0]);
        expect(chooseDraftPick(offer, kit, [])).toBe(best);
        // Two cards that score the same: the first offered wins.
        expect(chooseDraftPick(['tackle', 'tackle'], [], [])).toBe('tackle');
    });

    it('takes nothing from an empty offer', () => {
        expect(chooseDraftPick([], kit, [])).toBeUndefined();
    });

    it('follows the kit rule in a whole draft: a kit card offered at pick 0 is what is taken', () => {
        for (let i = 0; i < 20; i++) {
            const seed = `kit-first-${i}`;
            const offer = draftOffer(seed, 0, 0, draftPool(KRAKEN));
            const expected = offer.find((id) => kit.includes(id));
            if (expected === undefined) continue;
            expect(draftKitFor(seed, KRAKEN)[0]).toBe(expected);
        }
    });

    it('a walk with Draft Start starts on the drafted kit, and logs the modifier', () => {
        const seed = 't169j:draft';
        const result = walkRun({ seed, starter: 'kraken_v1', gymIndex: 0, stopAfterFights: 1, modifiers: ['draft_start'] });
        expect(eventOf(result, 'RUN_STARTED').modifiers).toEqual(['draft_start']);
        // Fight one's deck opens with the five drafted cards.
        const deck = eventOf(result, 'FIGHT_DECK');
        const drafted = draftKitFor(seed, memberFor('mm1', 'kraken_v1'));
        for (const id of new Set(drafted)) {
            expect(deck.deck.filter((d) => d === id).length).toBeGreaterThanOrEqual(drafted.filter((d) => d === id).length);
        }
    });
});

describe('169j — the walker pays Tight Budget\'s prices for what it prices itself', () => {
    it('the upgrade bench: a purse that reaches the plain price but not the raised one buys nothing', () => {
        const deck = [{ instanceId: 'c1', dataId: 'tackle', ownerId: null }];
        const plain = chooseUpgrade(deck, 999, false);
        expect(plain).not.toBeNull();
        const raised = (base: number): number => base + 10;

        expect(chooseUpgrade(deck, plain!.price + 5, false, raised)).toBeNull();
        const bought = chooseUpgrade(deck, plain!.price + 10, false, raised);
        expect(bought?.price).toBe(plain!.price + 10);
        // A free bench stays free whatever the rule.
        expect(chooseUpgrade(deck, 0, true, raised)?.price).toBe(0);
    });
});

describe('173b — the gauntlet carries HP in the walker', () => {
    const party = [
        { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v2', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
        { id: 'mm2', definitionId: 'skoll', activeOS: 'skoll_v2', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
        { id: 'mm3', definitionId: 'jormungandr', activeOS: 'jormungandr_v2', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
    ];
    const setup = {
        seed: 's',
        player: { party: party.map((m) => ({ definitionId: m.definitionId })), deck: [] },
        enemies: [],
    } as unknown as ComposedSetup;

    it('puts the carried HP of each member on its row, 0 included', () => {
        const carried = withCarriedHp(setup, party, { mm1: 400, mm2: 0 });
        expect(carried.player.party.map((u) => u.currentHp)).toEqual([400, 0, undefined]);
    });

    it('leaves a fight with no carried map exactly as built', () => {
        expect(withCarriedHp(setup, party, undefined)).toBe(setup);
    });
});
