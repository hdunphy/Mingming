/**
 * TICKET 182c — the intro run's engine half: the map, the biome rule, the run it builds, the leader,
 * the recruit and the one function the rest of the game asks (`introRules`).
 */
import { describe, expect, it } from 'vitest';
import { GetMingmingData } from '../../data/mingmingRegistry';
import { toMingmingState } from '../battleSetup';
import { createRanchMember } from '../../gameTypes';
import { RunStateSchema, RanchStateSchema, RunSaveSchema, SAVE_VERSION_V4 } from '../../runTypes';
import { COUNTERED_BY } from '../gyms';
import { rollGauntletFight, GAUNTLET_FIGHTS } from '../gauntlet';
import { drawEvent } from '../events/eventDraw';
import { createRun } from '../createRun';
import { offerGyms } from '../gyms';
import { buildIntroNodes } from './introMap';
import { introBiomeElement } from './introBiome';
import { createIntroRun } from './createIntroRun';
import { INTRO_LEADERS } from './introLeader';
import { introRules, NORMAL_RULES, INTRO_RULES, INTRO_STARTERS, introRecruitOptions } from './introRules';

const SEED = 'intro-182c';

function introRunFor(species: string, seed = SEED) {
    const member = createRanchMember(species, GetMingmingData(species).availableOS[0]);
    return createIntroRun({ seed, starter: toMingmingState(member), startedAt: 1_700_000_000_000 });
}

describe('182c the intro map', () => {
    const nodes = buildIntroNodes();
    const byLayer = (layer: number) => nodes.filter((n) => n.layer === layer);

    it('is seven nodes in five layers, all in biome 0', () => {
        expect(nodes).toHaveLength(7);
        expect(new Set(nodes.map((n) => n.layer))).toEqual(new Set([0, 1, 2, 3, 4]));
        expect(nodes.every((n) => n.biomeIndex === 0 && !n.detour)).toBe(true);
    });

    it('goes Start, a wild fight and the stray, a fork, one more wild fight, then the leader', () => {
        expect(byLayer(0).map((n) => n.kind)).toEqual(['wild']);
        expect(byLayer(1).map((n) => n.kind).sort()).toEqual(['event', 'wild']);
        expect(byLayer(2).map((n) => n.kind).sort()).toEqual(['marketplace', 'wild']);
        expect(byLayer(3).map((n) => n.kind)).toEqual(['wild']);
        expect(byLayer(4).map((n) => n.kind)).toEqual(['gym']);
    });

    it('opens one way: Start leads only to the first wild fight, which leads only on to the stray', () => {
        const [start] = byLayer(0);
        const wild = byLayer(1).find((n) => n.kind === 'wild')!;
        const stray = byLayer(1).find((n) => n.kind === 'event')!;
        expect(start.edges).toEqual([wild.id]);
        expect([...wild.edges].sort()).toEqual([start.id, stray.id].sort());
        expect(stray.edges).not.toContain(start.id);
    });

    it('makes the last wild fight unavoidable: both fork nodes lead to it, and it is the leader\'s only way in', () => {
        const [last] = byLayer(3);
        const [leader] = byLayer(4);
        for (const forkNode of byLayer(2)) {
            expect(forkNode.edges).toContain(last.id);
            expect(forkNode.edges).not.toContain(leader.id);
        }
        expect(leader.edges).toEqual([last.id]);
    });

    it('opens on Start, visited once, so nothing fires before the player moves', () => {
        expect(byLayer(0)[0].visited).toBe(1);
        expect(nodes.filter((n) => n.visited > 0)).toHaveLength(1);
    });

    it('joins the fork so the player can take one node or both', () => {
        const [a, b] = byLayer(2);
        expect(a.edges).toContain(b.id);
        expect(b.edges).toContain(a.id);
    });

    it('has edges that are walkable both ways and name real nodes', () => {
        const ids = new Set(nodes.map((n) => n.id));
        for (const n of nodes) {
            for (const edge of n.edges) {
                expect(ids.has(edge)).toBe(true);
                expect(nodes.find((m) => m.id === edge)!.edges).toContain(n.id);
            }
        }
    });

    it('is the same seven nodes every time, whatever the seed', () => {
        expect(buildIntroNodes()).toEqual(nodes);
    });
});

describe('182c the biome the starter beats', () => {
    it.each([['kraken', 'Fire'], ['fenrir', 'Nature'], ['ratatoskr', 'Water']])('%s plays in the %s biome', (starter, biome) => {
        const element = GetMingmingData(starter).primaryElement;
        expect(introBiomeElement(element)).toBe(biome);
        expect(COUNTERED_BY[biome]).toBe(element);
        const run = introRunFor(starter);
        expect(run.biomes[0].elements).toEqual([biome]);
    });
});

describe('182c the run it builds', () => {
    const run = introRunFor('kraken');

    it('is an intro run on tier 0 with no modifiers, macros or drivers', () => {
        expect(run.mode).toBe('intro');
        expect(run.tier).toBe(0);
        expect(run.modifiers).toEqual([]);
        expect(run.macros).toEqual([null, null, null]);
        expect(run.drivers).toEqual([]);
        expect(run.nodes.some((n) => n.driverStake !== undefined)).toBe(false);
    });

    it('opens the way an ordinary run does: one member, the starter deck, the starting scrap', () => {
        const ordinary = createRun({
            seed: SEED, offer: offerGyms(`${SEED}:gyms`)[0], startedAt: 1_700_000_000_000,
            party: [toMingmingState(createRanchMember('kraken', 'kraken_v1'))],
        });
        expect(run.partyIds).toHaveLength(1);
        expect(run.deck).toHaveLength(ordinary.deck.length);
        expect(run.scrap).toBe(ordinary.scrap);
        expect(run.phase).toBe('map');
    });

    it('stands on Start, on the hand-built map', () => {
        expect(run.nodes).toEqual(buildIntroNodes());
        expect(run.currentNodeId).toBe('b0l0n0');
    });

    it('parses against the run schema and round-trips through a save', () => {
        expect(RunStateSchema.safeParse(run).success).toBe(true);
        const parsed = RunSaveSchema.parse({ version: SAVE_VERSION_V4, run });
        expect(parsed.run.mode).toBe('intro');
    });

    it('is deterministic in its seed', () => {
        const member = toMingmingState(createRanchMember('kraken', 'kraken_v1'));
        const a = createIntroRun({ seed: SEED, starter: member, startedAt: 5 });
        const b = createIntroRun({ seed: SEED, starter: member, startedAt: 5 });
        expect(a).toEqual(b);
    });
});

describe('182c the save fields are add-only', () => {
    it('a run saved before `mode` existed is an ordinary run', () => {
        const ordinary = createRun({
            seed: SEED, offer: offerGyms(`${SEED}:gyms`)[0], startedAt: 1,
            party: [toMingmingState(createRanchMember('kraken', 'kraken_v1'))],
        });
        const { mode: _mode, ...old } = { ...ordinary, mode: 'normal' as const };
        expect(RunStateSchema.parse(old).mode).toBe('normal');
    });

    it('a ranch saved before `introDone` existed has done the intro', () => {
        const parsed = RanchStateSchema.parse({ roster: [] });
        expect(parsed.introDone).toBe(true);
    });
});

describe('182c introRules: the one question', () => {
    it('answers the ordinary game for a normal run, a missing run and a run with no mode', () => {
        expect(introRules(null)).toBe(NORMAL_RULES);
        expect(introRules(undefined)).toBe(NORMAL_RULES);
        expect(introRules({})).toBe(NORMAL_RULES);
        expect(introRules({ mode: 'normal' })).toBe(NORMAL_RULES);
        expect(introRules(introRunFor('fenrir'))).toBe(INTRO_RULES);
    });

    it('lets an ordinary run do everything it does today', () => {
        expect(NORMAL_RULES.countsAsProgress).toBe(true);
        expect(NORMAL_RULES.gauntletFights).toBeNull();
        expect(NORMAL_RULES.showMacros && NORMAL_RULES.showPatches && NORMAL_RULES.showBattleLogs).toBe(true);
        expect(Object.values(NORMAL_RULES.market).every(Boolean)).toBe(true);
        expect(NORMAL_RULES.leader).toBeNull();
        expect(NORMAL_RULES.eventFor).toBeNull();
        expect(NORMAL_RULES.recruitOptions).toBeNull();
        expect(NORMAL_RULES.grantsRecruitBlueprint).toBe(false);
    });

    it('keeps the intro out of the ladder and strips everything but the four ideas', () => {
        expect(INTRO_RULES.countsAsProgress).toBe(false);
        expect(INTRO_RULES.gauntletFights).toBe(1);
        expect(INTRO_RULES.showMacros).toBe(false);
        expect(INTRO_RULES.showPatches).toBe(false);
        expect(INTRO_RULES.showBattleLogs).toBe(false);
        expect(Object.values(INTRO_RULES.market).some(Boolean)).toBe(false);
    });
});

describe('182c the leader', () => {
    it.each(['kraken', 'fenrir', 'ratatoskr'])('is one fight of two monsters from the %s intro biome, on v1, with no driver', (starter) => {
        const run = introRunFor(starter);
        const gate = run.nodes.find((n) => n.kind === 'gym')!;
        const fight = rollGauntletFight({ run, node: gate, fightIndex: 0 });
        expect(fight.enemyParty).toHaveLength(2);
        expect(fight.enemyDrivers).toBeUndefined();
        const biomeElement = run.biomes[0].elements[0];
        for (const enemy of fight.enemyParty) {
            expect(enemy.primaryElement).toBe(biomeElement);
            expect(enemy.activeOS).toMatch(/_v1$/);
        }
        expect(INTRO_LEADERS[biomeElement]).toHaveLength(2);
    });

    it('is the same fight for the same run', () => {
        const run = introRunFor('kraken');
        const gate = run.nodes.find((n) => n.kind === 'gym')!;
        const a = rollGauntletFight({ run, node: gate, fightIndex: 0 });
        const b = rollGauntletFight({ run, node: gate, fightIndex: 0 });
        expect(a.enemyParty.map((e) => e.id)).toEqual(b.enemyParty.map((e) => e.id));
        expect(a.seed).toBe(b.seed);
    });

    it('leaves an ordinary run on the three-monster gauntlet', () => {
        const ordinary = createRun({
            seed: SEED, offer: offerGyms(`${SEED}:gyms`)[0], startedAt: 1,
            party: [toMingmingState(createRanchMember('kraken', 'kraken_v1'))],
        });
        const gate = ordinary.nodes.find((n) => n.kind === 'gym')!;
        expect(rollGauntletFight({ run: ordinary, node: gate, fightIndex: 0 }).enemyParty).toHaveLength(3);
        expect(GAUNTLET_FIGHTS).toBe(3);
    });
});

describe('182c the stray Mingming', () => {
    it('is the recruit event with no way to refuse it', () => {
        const run = introRunFor('kraken');
        const stray = run.nodes.find((n) => n.kind === 'event')!;
        const event = drawEvent(run, stray, { roster: [], blueprints: {} });
        expect(event?.id).toBe('stray_mingming');
        expect(event?.choices.map((c) => c.id)).toEqual(['recruit']);
    });

    it.each([['kraken', ['fenrir', 'ratatoskr']], ['fenrir', ['kraken', 'ratatoskr']], ['ratatoskr', ['kraken', 'fenrir']]])(
        'offers the two starters %s did not pick, each on v1', (starter, others) => {
            const options = introRecruitOptions(introRunFor(starter));
            expect(options.map((o) => o.speciesId).sort()).toEqual([...others].sort());
            for (const option of options) expect(option.osId).toBe(`${option.speciesId}_v1`);
            expect(INTRO_STARTERS).toContain(starter);
        });
});
