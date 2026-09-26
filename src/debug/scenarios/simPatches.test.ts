/**
 * Ticket 164f — Patches reach simulated fights (buildScenarioState and runWalker).
 */
import { describe, expect, it } from 'vitest';
import { buildScenarioState } from './buildScenarioState';
import { entityHooksFor } from '../../engine/core/entityHooks';
import type { ComposedSetup } from './scenarioSchema';
import { configureStore } from '@reduxjs/toolkit';
import runReducer, { startRun, fitPatch } from '../../ui/store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { GYM_REGISTRY } from '../../engine/run/gyms';
import { rollEncounter } from '../../engine/run/encounter';
import { setupFor } from '../balance/runWalker';

describe('Ticket 164f — Patches reach simulated fights', () => {
    it('1. A scenario whose player member carries a patch builds an entity with that patch, and its hooks differ from the unpatched entity', () => {
        const setupWithPatch: ComposedSetup = {
            seed: 'patch-sim-seed',
            enemyMode: 'CARDS',
            player: {
                drivers: [],
                deck: ['water_slap'],
                party: [{
                    definitionId: 'skoll',
                    activeOS: 'skoll_v1',
                    attackIV: 0,
                    defenseIV: 0,
                    hpIV: 0,
                    patches: ['amplifier'],
                }],
            },
            enemies: [{
                definitionId: 'fenrir',
                activeOS: 'fenrir_v1',
                attackIV: 0,
                defenseIV: 0,
                hpIV: 0,
                deck: ['water_slap'],
            }],
        };

        const stateWithPatch = buildScenarioState(setupWithPatch);
        const entityWithPatch = stateWithPatch.playerParty[0];

        expect(entityWithPatch.patches, 'entity carries fitted patch').toEqual(['amplifier']);

        const setupWithoutPatch: ComposedSetup = {
            ...setupWithPatch,
            player: {
                ...setupWithPatch.player,
                party: [{
                    ...setupWithPatch.player.party[0],
                    patches: undefined,
                }],
            },
        };
        const stateWithoutPatch = buildScenarioState(setupWithoutPatch);
        const entityWithoutPatch = stateWithoutPatch.playerParty[0];

        const patchedHooks = entityHooksFor(entityWithPatch, 'onPostDamage');
        const unpatchedHooks = entityHooksFor(entityWithoutPatch, 'onPostDamage');

        expect(patchedHooks[0]).not.toBe(unpatchedHooks[0]);
    });

    it('2. A walker run that fits a patch produces a battle whose entity carries it', () => {
        const gym = GYM_REGISTRY.gym_rootfall;
        const party = [{
            id: 'mm1',
            definitionId: 'skoll',
            activeOS: 'skoll_v1',
            blueprintsCollected: 0,
            attackIV: 15,
            defenseIV: 15,
            hpIV: 15,
        }];
        const store = configureStore({ reducer: { run: runReducer } });
        store.dispatch(startRun(createRun({
            seed: 'walker-patch-test',
            offer: { gym, biomes: [{ id: 'b1', name: 'Biome', elements: ['Water'] }] },
            party,
            startedAt: 0,
        })));

        store.dispatch(fitPatch({ memberId: 'mm1', patchId: 'amplifier' }));
        const run = store.getState().run.run!;
        expect(run.patches?.['mm1']).toEqual(['amplifier']);

        const encounter = rollEncounter({
            run,
            node: run.nodes.find(n => n.kind === 'wild')!,
            party,
        });

        // The walker translates run state to ComposedSetup via setupFor, then builds the battle
        const members = run.partyIds.map(id => party.find(m => m.id === id)!);
        const setup = setupFor(
            encounter.seed,
            members,
            run.deck.map(c => c.dataId),
            encounter.enemyParty,
            encounter.enemyDeckIds,
            encounter.enemyDrivers ?? [],
            run.drivers ?? [],
            run.patches
        );

        expect(setup.player.party[0].patches, 'setup member carries patch').toEqual(['amplifier']);
        const battle = buildScenarioState(setup);
        expect(battle.playerParty[0].patches, 'simulated battle entity carries patch').toEqual(['amplifier']);
    });
});
