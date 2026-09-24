/**
 * TICKET 142 — the route to the gym: rivals on the road, and a scout at the last exit.
 *
 * THE COMPLAINT (Henry, playtest 2026-09-05): *"If I want to go Nature gym I would pick Fenrir
 * first, then my goal is to recruit Rat. But then next is the Fire biome, so either I go in with a
 * type disadvantage or I drop Rat and go back to 1v1 to try to recruit Sköll... Maybe that's the
 * route we want, but it doesn't really prepare you for the fight."*
 *
 * Two mechanics produce that, and neither is the walk order (which fixes a different problem and
 * stays):
 *
 *   1. **Recruits are tied to where you stand.** A blueprint is the species you defeated, and a
 *      node fields the biome's own element — so on Rootfall (Nature → Fire → Water) the map decides
 *      that the Nature bridge comes first and has to be carried through the Fire biome at a
 *      disadvantage, or benched. 142a puts the PATH species on one wild in three, in every biome,
 *      so the order is the player's again.
 *   2. **Nothing before gauntlet tier 1 looks like the gym.** 142b makes the last fight before the
 *      gauntlet two bodies of the leader's own comp, at full HP, with a market and a workshop still
 *      behind you.
 *
 * The path pair comes from ticket 141's gym check: Fire×2 + Nature beats the three strongest
 * Nature-gym builds 75% over 120 battles, so what a Rootfall run needs off the road is one more
 * Fire body and one Nature body — `[what beats the gym, the gym's own]`.
 *
 * WHAT THIS FILE CANNOT TELL YOU. Whether it fixes the FEEL. Ticket 142 §6 is explicit that
 * acceptance is a playtest, not a grid: could the Fire pair be assembled by the end of biome 2
 * without benching anyone, did the scout say something the gauntlet then confirmed, did rivals read
 * as a choice on the map. These tests only prove the mechanism does what it says.
 */
import { describe, expect, it } from 'vitest';
import { generateRegionGraph, REGION_PARAMS } from './regionGraph';
import { createRun } from './createRun';
import { encounterSpeciesPool, scoutFirmwareFor, rollEncounter, gradeFor, enemyLoadoutFor, rivalElementPlan } from './encounter';
import { GYM_REGISTRY, gymLeaderFirmware, offerGyms, pathElementsFor, type IGymOffer } from './gyms';
import { authoredBossFor } from './bosses';
import { MingmingRegistry } from '../data/mingmingRegistry';
import { BLUEPRINT_DROP_RATE } from '../RewardSystem';
import type { IBiome, IRunState } from '../runTypes';
import type { IMingmingState } from '../types';

const member = (id: string, definitionId: string): IMingmingState => ({
    id, definitionId, nickname: id, activeOS: `${definitionId}_v1`,
    blueprintsCollected: 0, hpIV: 0, attackIV: 0, defenseIV: 0,
});

const biome = (element: string, index: number): IBiome => ({
    id: `biome_${element.toLowerCase()}_${index}`, name: `${element} ${index}`, elements: [element],
});

/** A Rootfall run — the one Henry's complaint is about. Walk order: Nature, Fire, Water. */
function rootfallRun(seed = 'path-test'): IRunState {
    const offer: IGymOffer = {
        gym: GYM_REGISTRY.gym_rootfall,
        biomes: ['Nature', 'Fire', 'Water'].map((e, i) => biome(e, i)),
    };
    return {
        ...createRun({ seed, offer, party: [member('mm1', 'fenrir')], startedAt: 0 }),
        fightsResolved: 1,
    };
}

const speciesOf = (firmware: string): string =>
    Object.values(MingmingRegistry).find(d => d.availableOS.includes(firmware))!.id;

describe('142c — a rival always fields the body the biome cannot give you', () => {
    /*
     * Henry, after the first Rootfall playtest: *"We should guarantee at least one 'off biome'
     * mingming. So the first is always the Nature in a fire biome (1v1 it's just nature); in 3v3 we
     * can coin flip the last one to make it NFN or NFF."*
     *
     * 142a drew every body from the flat union of the two path elements, so with two species an
     * element the guarantee was a coin flip and a solo player's rival was half the time an
     * ordinary-looking on-biome fight dropping a blueprint they already had. The node's whole
     * purpose is to break the map's grip on recruiting order, and half the time it did not.
     */
    const run = rootfallRun();
    const rival = (biomeIndex: number) => ({
        id: `rival_b${biomeIndex}`, kind: 'rival' as const, biomeIndex, layer: 2, visited: 1,
        x: 0, y: 0, edges: [], pocket: false,
    } as unknown as Parameters<typeof rivalElementPlan>[1]);

    it('deals the off-biome element FIRST, and off-biome means this biome, not the gym', () => {
        // The path is [Fire, Nature] in all three biomes — it is fully determined by the leader.
        // What changes is which HALF of it the biome already gives you, so the rule has to be
        // biome-relative. Fire beats Rootfall, but standing in the Fire biome the body you cannot
        // otherwise get is the Nature one.
        expect(rivalElementPlan(run, rival(0), 1)).toEqual(['Fire']);    // Nature biome
        expect(rivalElementPlan(run, rival(1), 1)).toEqual(['Nature']);  // Fire biome — Henry's case
    });

    it('deals one of each path element before anything rolls', () => {
        expect(rivalElementPlan(run, rival(1), 2)).toEqual(['Nature', 'Fire']);
        expect(rivalElementPlan(run, rival(1), 3)).toEqual(['Nature', 'Fire']);
    });

    it('leaves the third body to the roll — NFN or NFF, never NNN or FFF', () => {
        // The plan is shorter than the party on purpose: `rollEncounter` deals plan[i] while it
        // lasts and rolls the rest from the union, which is the coin flip Henry asked for.
        const plan = rivalElementPlan(run, rival(1), 3);
        expect(plan).toHaveLength(2);
    });

    it('in the third biome neither path element is the biome, so the path order stands', () => {
        // Rootfall's biome 3 is Water and the path is Fire+Nature — both off-biome. Nothing to
        // reorder, and the counter element leads because that is the path's own order.
        expect(rivalElementPlan(run, rival(2), 2)).toEqual(['Fire', 'Nature']);
    });

    it('says nothing about a wild — the deal is the rival node, not the biome', () => {
        const wild = { ...rival(1), kind: 'wild' } as unknown as Parameters<typeof rivalElementPlan>[1];
        expect(rivalElementPlan(run, wild, 3)).toEqual([]);
    });

    it('a solo player in the Fire biome meets a NATURE body every time, over 200 rivals', () => {
        // The regression in one line: this was 50% before 142c. Rolled through the real
        // `rollEncounter` rather than off the plan, so it covers the deal AND the draw.
        for (let i = 0; i < 200; i += 1) {
            const node = { ...rival(1), id: `rival_b1_${i}`, visited: i + 1 };
            const { enemyParty } = rollEncounter({ run, node, party: [member('mm1', 'fenrir')] });
            expect(enemyParty).toHaveLength(1);
            expect(MingmingRegistry[enemyParty[0].definitionId].primaryElement).toBe('Nature');
        }
    });

    it('a full party gets one of each and a coin flip — both NFN and NFF appear', () => {
        const party = [member('mm1', 'fenrir'), member('mm2', 'skoll'), member('mm3', 'ratatoskr')];
        const shapes = new Set<string>();
        for (let i = 0; i < 200; i += 1) {
            const node = { ...rival(1), id: `rival_full_${i}`, visited: i + 1 };
            const { enemyParty } = rollEncounter({ run, node, party });
            const els = enemyParty.map(e => MingmingRegistry[e.definitionId].primaryElement);
            expect(els[0]).toBe('Nature');
            expect(els[1]).toBe('Fire');
            shapes.add(els.join(''));
        }
        expect(shapes).toEqual(new Set(['NatureFireNature', 'NatureFireFire']));
    });
});
describe('142a — the path elements are what beats the gym, then the gym itself', () => {
    it('Rootfall walks Fire and Nature; each gym gets its own pair', () => {
        expect(pathElementsFor('Nature')).toEqual(['Fire', 'Nature']);
        expect(pathElementsFor('Water')).toEqual(['Nature', 'Water']);
        expect(pathElementsFor('Fire')).toEqual(['Water', 'Fire']);
    });

    it('every offer on the screen has a derivable pair — nothing is rolled', () => {
        for (const offer of offerGyms('offer-seed')) {
            const pair = pathElementsFor(offer.gym.element);
            expect(pair).toHaveLength(2);
            expect(pair[1]).toBe(offer.gym.element);
            expect(pair[0]).not.toBe(offer.gym.element);
        }
    });
});

describe('142a — rivals field the path species, and nothing else about them moves', () => {
    const run = rootfallRun();
    const rival = run.nodes.find(n => n.kind === 'rival')!;

    it('a rival exists', () => {
        expect(rival).toBeDefined();
    });

    it('its pool is the path species — the Fire pair and the Nature bridge', () => {
        const pool = encounterSpeciesPool(run, rival);
        const elements = new Set(pool.map(id => MingmingRegistry[id].primaryElement));
        expect([...elements].sort()).toEqual(['Fire', 'Nature']);
    });

    it('a WILD in the same biome still fields the biome, so the map keeps its promise', () => {
        const wild = run.nodes.find(n => n.kind === 'wild' && n.biomeIndex === rival.biomeIndex)!;
        const pool = encounterSpeciesPool(run, wild);
        const biomeElement = run.biomes[wild.biomeIndex].elements[0];
        for (const id of pool) expect(MingmingRegistry[id].primaryElement).toBe(biomeElement);
    });

    it('it is a wild in every way but its species: same rung, same AI, same blueprint rate', () => {
        expect(gradeFor('rival')).toBe('wild');
        expect(enemyLoadoutFor('rival', 0)).toEqual(enemyLoadoutFor('wild', 0));
        expect(BLUEPRINT_DROP_RATE.rival).toBe(BLUEPRINT_DROP_RATE.wild);
    });

    it('EVERY biome of EVERY offer has at least one — that is the whole point', () => {
        // A biome with no rival is a biome where the map dictates the recruiting order again, which
        // is the complaint. `Math.floor` of two wilds is zero, hence the floor of 1 in the generator.
        for (let s = 0; s < 40; s += 1) {
            const graph = generateRegionGraph(`coverage-${s}`);
            for (let b = 0; b < REGION_PARAMS.biomesPerRun; b += 1) {
                const rivals = graph.nodes.filter(n => n.biomeIndex === b && n.kind === 'rival');
                expect(rivals.length, `seed ${s}, biome ${b}`).toBeGreaterThanOrEqual(1);
            }
        }
    });

    it('rivals are the minority — two wilds in three still belong to the biome', () => {
        let rivals = 0, fights = 0;
        for (let s = 0; s < 40; s += 1) {
            for (const n of generateRegionGraph(`mix-${s}`).nodes) {
                if (n.kind === 'rival') { rivals += 1; fights += 1; }
                if (n.kind === 'wild') fights += 1;
            }
        }
        expect(rivals / fights).toBeLessThan(0.5);
    });

    it('is stable in the seed, and did not disturb the rest of the map', () => {
        const a = generateRegionGraph('stability');
        const b = generateRegionGraph('stability');
        expect(a.nodes.map(n => `${n.id}:${n.kind}:${n.scout ?? false}`))
            .toEqual(b.nodes.map(n => `${n.id}:${n.kind}:${n.scout ?? false}`));
        // The rival stream is FORKED, so ids, layers, edges and the market/workshop guarantee are
        // untouched by this ticket. A shared stream would have re-rolled every existing seed's map.
        expect(a.nodes.map(n => `${n.id}:${n.layer}:${n.edges.join(',')}`))
            .toEqual(b.nodes.map(n => `${n.id}:${n.layer}:${n.edges.join(',')}`));
    });
});

describe('142b — the scout is a cut of the leader, at the last exit', () => {
    const run = rootfallRun();
    const scout = run.nodes.find(n => n.scout)!;

    it('exists, in the final biome, and is an elite', () => {
        expect(scout).toBeDefined();
        expect(scout.biomeIndex).toBe(REGION_PARAMS.biomesPerRun - 1);
        expect(scout.kind).toBe('elite');
    });

    it('there is exactly one in the run', () => {
        expect(run.nodes.filter(n => n.scout)).toHaveLength(1);
    });

    it('it never eats the last market or workshop before the gym', () => {
        // The guarantee is one of each per biome and it is structural. Promoting a shop would delete
        // the one the scout exists to send the player back to.
        for (let s = 0; s < 40; s += 1) {
            const graph = generateRegionGraph(`shops-${s}`);
            const last = REGION_PARAMS.biomesPerRun - 1;
            const middles = graph.nodes.filter(n => n.biomeIndex === last && n.layer >= 1 && n.layer <= 3);
            expect(middles.filter(n => n.kind === 'marketplace')).toHaveLength(1);
            expect(middles.filter(n => n.kind === 'workshop')).toHaveLength(1);
            expect(graph.nodes.filter(n => n.scout)).toHaveLength(1);
        }
    });

    it('fields TWO of the leader comp, as themselves — the firmware is the preview', () => {
        const firmware = scoutFirmwareFor(run, scout);
        expect(firmware).toHaveLength(2);
        for (const os of firmware) expect(gymLeaderFirmware('gym_rootfall')).toContain(os);

        const { enemyParty } = rollEncounter({ run, node: scout, party: [member('mm1', 'fenrir')] });
        expect(enemyParty).toHaveLength(2);
        expect(enemyParty.map(e => e.activeOS).sort()).toEqual([...firmware].sort());
        expect(enemyParty.map(e => e.definitionId).sort()).toEqual(firmware.map(speciesOf).sort());
    });

    it('two bodies whatever the player brought — it previews the gym, not your party', () => {
        const solo = rollEncounter({ run, node: scout, party: [member('mm1', 'fenrir')] });
        const full = rollEncounter({
            run, node: scout,
            party: [member('mm1', 'fenrir'), member('mm2', 'kraken'), member('mm3', 'huldra')],
        });
        expect(solo.enemyParty).toHaveLength(2);
        expect(full.enemyParty).toHaveLength(2);
    });

    it('shows the same two on re-entry — a preview that reshuffles is a slot machine', () => {
        const first = scoutFirmwareFor(run, scout);
        expect(scoutFirmwareFor(run, scout)).toEqual(first);
    });

    it('an ordinary elite is untouched', () => {
        const plain = run.nodes.find(n => n.kind === 'elite' && !n.scout)!;
        expect(scoutFirmwareFor(run, plain)).toEqual([]);
    });

    it('every gym has a comp to cut, and every firmware in it is real', () => {
        for (const gym of Object.values(GYM_REGISTRY)) {
            expect(gymLeaderFirmware(gym.id)).toHaveLength(3);
            for (const os of gymLeaderFirmware(gym.id)) {
                expect(Object.values(MingmingRegistry).some(d => d.availableOS.includes(os)),
                    `${gym.id} fields unknown firmware ${os}`).toBe(true);
            }
        }
    });

    /**
     * TICKET 28a — **ONE TABLE, and this is the assertion that keeps it one.**
     *
     * Until 2026-09-24 the scout read `IGym.leaderComp` (a 142b placeholder) and the gauntlet read
     * `bosses.AUTHORED_BOSSES`, and they disagreed at EVERY gym. Nothing failed, because nothing
     * compared them: the preview and the exam were two facts about the same fight that no test ever
     * put side by side. `leaderComp` is deleted, and this is what stops a second one growing back.
     */
    it('previews the team the gauntlet actually fields — 28a\'s one table', () => {
        for (const gymId of Object.keys(GYM_REGISTRY)) {
            const authored = authoredBossFor(gymId);
            expect(authored, `${gymId} has no authored boss`).toBeDefined();
            expect(gymLeaderFirmware(gymId)).toEqual(authored!.members.map((m) => m.os));
        }
    });

    it('fields two own-element bodies and one guest at every gym — 28a\'s composition rule', () => {
        // Henry's ruling is "whichever trio synergises best", and the shape every candidate kept is
        // 2 + 1. Asserted so a later re-composition has to decide to break it rather than drift.
        for (const gym of Object.values(GYM_REGISTRY)) {
            const elements = gymLeaderFirmware(gym.id)
                .map((os) => Object.values(MingmingRegistry).find((d) => d.availableOS.includes(os))?.primaryElement);
            expect(elements.filter((e) => e === gym.element), `${gym.id}`).toHaveLength(2);
            expect(elements.filter((e) => e !== gym.element), `${gym.id}`).toHaveLength(1);
        }
    });

    it('fields no OS at more than one gym — a roster, not a pool', () => {
        // 72's own note, now true of all three: "the same OS at two gyms makes the roster read as a
        // pool". It was not true before 28a — `ratatoskr_v2` sat at Emberfall and `kraken_v2` and
        // `skoll_v2` at Tidewrack while Rootfall and Emberfall each held one of their partners.
        const all = Object.keys(GYM_REGISTRY).flatMap((id) => [...gymLeaderFirmware(id)]);
        expect(new Set(all).size, `${all.join(', ')}`).toBe(all.length);
    });
});
