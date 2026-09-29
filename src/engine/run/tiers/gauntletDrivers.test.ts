/**
 * TICKET 169c — Tier 3 (Leaders' Drivers): the gym leader's Driver is active in all three gauntlet
 * fights, not just the boss fight.
 *
 * Enemy Drivers already work (`IBattleSetup.enemyDrivers`), and the boss fight already carries the
 * gym's signature. What tier 3 adds is the same Driver on fights 1 and 2, from `tiers.json`'s
 * `leaderDrivers`. It is content, not a number, so the enemies themselves must not change.
 */

import { describe, expect, it } from 'vitest';

import { GetMingmingData } from '../../data/mingmingRegistry';
import type { IBiome, IRegionNode, IRunState } from '../../runTypes';
import type { IMingmingState } from '../../types';
import { authoredBossFor } from '../bosses';
import { createRun } from '../createRun';
import { GAUNTLET_FIGHTS, rollGauntletFight } from '../gauntlet';
import { GYM_REGISTRY, type IGymOffer } from '../gyms';
import { gauntletDriversFor } from './gauntletDrivers';
import { leaderDriverFor } from './tierRegistry';

const member = (id: string, definitionId: string): IMingmingState => ({
    id,
    definitionId,
    activeOS: GetMingmingData(definitionId).availableOS[0],
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
});

const PARTY = [member('mm1', 'kraken'), member('mm2', 'fenrir'), member('mm3', 'ratatoskr')];

const biome = (element: string, index: number): IBiome => ({
    id: `biome_${element.toLowerCase()}_${index}`,
    name: `${element} ${index}`,
    elements: [element],
});

const GYM_IDS = Object.keys(GYM_REGISTRY);

function runOf(gymId: string, tier: number, seed = 'gauntlet-drivers'): IRunState {
    const offer: IGymOffer = {
        gym: GYM_REGISTRY[gymId],
        biomes: [biome('Fire', 0), biome('Water', 1), biome('Nature', 2)],
    };
    return createRun({ seed, offer, party: PARTY, startedAt: 0, tier });
}

function fightOf(run: IRunState, fightIndex: number) {
    const gym = run.nodes.find((n) => n.kind === 'gym') as IRegionNode;
    return rollGauntletFight({ run, node: { ...gym, visited: gym.visited + 1 }, fightIndex });
}

describe('gauntletDriversFor', () => {
    it('the boss fight carries the gym’s authored Driver at every tier', () => {
        for (const gymId of GYM_IDS) {
            for (const tier of [0, 1, 2, 3]) {
                expect(gauntletDriversFor(runOf(gymId, tier), true), `${gymId} tier ${tier}`).toEqual([
                    authoredBossFor(gymId)!.driver,
                ]);
            }
        }
    });

    it('fights 1 and 2 carry no Driver below tier 3', () => {
        for (const gymId of GYM_IDS) {
            for (const tier of [0, 1, 2]) expect(gauntletDriversFor(runOf(gymId, tier), false)).toEqual([]);
        }
    });

    it('fights 1 and 2 carry the leader’s Driver from tiers.json at tier 3', () => {
        for (const gymId of GYM_IDS) {
            expect(gauntletDriversFor(runOf(gymId, 3), false)).toEqual([leaderDriverFor(gymId)]);
        }
    });
});

describe('rollGauntletFight', () => {
    for (const gymId of GYM_IDS) {
        it(`${gymId}: tier 0 has a Driver on the boss fight only`, () => {
            const run = runOf(gymId, 0);
            for (let i = 0; i < GAUNTLET_FIGHTS - 1; i += 1) expect(fightOf(run, i).enemyDrivers).toBeUndefined();
            expect(fightOf(run, GAUNTLET_FIGHTS - 1).enemyDrivers).toEqual([authoredBossFor(gymId)!.driver]);
        });

        it(`${gymId}: tier 3 has one Driver on each of the three fights, the leader's`, () => {
            const run = runOf(gymId, 3);
            for (let i = 0; i < GAUNTLET_FIGHTS; i += 1) {
                expect(fightOf(run, i).enemyDrivers, `fight ${i + 1}`).toEqual([leaderDriverFor(gymId)]);
            }
        });

        it(`${gymId}: tier 3 fields the same species, IVs and decks as tier 0 for the same seed`, () => {
            const base = runOf(gymId, 0);
            const top = runOf(gymId, 3);
            for (let i = 0; i < GAUNTLET_FIGHTS; i += 1) {
                const a = fightOf(base, i);
                const b = fightOf(top, i);
                expect(b.enemyParty).toEqual(a.enemyParty);
                expect(b.enemyDeckIds).toEqual(a.enemyDeckIds);
                expect(b.seed).toBe(a.seed);
            }
        });
    }
});
