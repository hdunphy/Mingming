/**
 * TICKET 180b — the workshop: assembly, swaps, reflash and the upgrade bench do what the game's own
 * reducers do. As in `market.test.ts`, the expected run is built by calling the reducer with the
 * action the bay would send, and nothing pins on-screen wording.
 */
import { describe, it, expect } from 'vitest';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { PARTY_SIZE } from '../../engine/party';
import { planRecruit, planReflash, reflashOptionsFor } from '../../engine/run/workshop';
import { speciesOwningFirmware } from '../../engine/run/gyms';
import type { IRanchMember } from '../../engine/runTypes';
import { eaStarters } from '../balance/runWalker';
import runReducer, { addRunCards, recruitIntoParty, recruitToBench, reflashEngine } from '../../ui/store/runSlice';
import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { upgradeIdFor } from '../../engine/data/plusRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { giveBlueprint, marketWithBlueprint, setScrap, standAt } from './walkKit';
import { applyMove } from './world';
import type { World } from './types';
import { runOf } from './types';

const keysOf = (world: World): string[] => currentScreen(world).moves.map((m) => m.key);
const press = (world: World, key: string): void => applyMove(world, { key, why: 'test' });
const ranchOf = (world: World) => world.store.getState().game;

function workshopWorld(starter?: string, modifiers: string[] = []): World {
    const world = freshWorld({ ...(starter ? { starter } : {}), modifiers });
    standAt(world, 'workshop');
    setScrap(world, 500);
    return world;
}

/** Species other than the party's, each with at least one firmware. */
const otherSpecies = (world: World): string[] => {
    const mine = ranchOf(world).roster.map((m) => m.definitionId);
    return Object.keys(MingmingRegistry).filter((id) => !mine.includes(id) && MingmingRegistry[id].availableOS.length > 0);
};

const assembleKeys = (world: World, suffix: string): string[] => keysOf(world).filter((k) => k.startsWith('workshop:assemble:') && k.includes(suffix));

describe('180b — arriving at a workshop', () => {
    it('is the workshop screen, and leaving shows the map with a way back in', () => {
        const world = workshopWorld();
        expect(currentScreen(world).id).toBe('workshop');
        press(world, 'leave');
        expect(currentScreen(world).id).toBe('map');
        expect(keysOf(world)).toContain('reopen');
        press(world, 'reopen');
        expect(currentScreen(world).id).toBe('workshop');
    });

    it('offers no assembly without a blueprint', () => {
        expect(keysOf(workshopWorld()).filter((k) => k.startsWith('workshop:assemble:'))).toEqual([]);
    });
});

describe('180b — assembly', () => {
    it('assembles into the party as the bay does: blueprint spent, member rostered, kit in the deck', () => {
        const world = workshopWorld();
        const [species] = otherSpecies(world);
        giveBlueprint(world, species);
        const osId = MingmingRegistry[species].availableOS[0];
        const run = runOf(world);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const plan = planRecruit({ ranch: ranchOf(world), run, node, speciesId: species, osId })!;
        const expected = runReducer({ run }, recruitIntoParty({ memberId: plan.member.id, cards: plan.cards, price: plan.scrap })).run;

        press(world, `workshop:assemble:${species}:${osId}:party`);
        expect(runOf(world)).toEqual(expected);
        expect(ranchOf(world).roster.some((m) => m.id === plan.member.id)).toBe(true);
        expect(ranchOf(world).blueprints[species] ?? 0).toBe(0);
        expect(runOf(world).partyIds).toContain(plan.member.id);
    });

    it('assembles onto the bench as recruitToBench does', () => {
        const world = workshopWorld();
        const [species] = otherSpecies(world);
        giveBlueprint(world, species);
        const osId = MingmingRegistry[species].availableOS[0];
        const run = runOf(world);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const plan = planRecruit({ ranch: ranchOf(world), run, node, speciesId: species, osId })!;
        const expected = runReducer({ run }, recruitToBench({ memberId: plan.member.id, cards: plan.cards, price: plan.scrap })).run;
        press(world, `workshop:assemble:${species}:${osId}:bench`);
        expect(runOf(world)).toEqual(expected);
        expect(runOf(world).bench).toContain(plan.member.id);
    });

    it('a full party can only swap, never just add', () => {
        const world = workshopWorld();
        const species = otherSpecies(world).slice(0, PARTY_SIZE);
        for (const id of species) giveBlueprint(world, id);
        for (const id of species.slice(0, PARTY_SIZE - 1)) {
            press(world, `workshop:assemble:${id}:${MingmingRegistry[id].availableOS[0]}:party`);
        }
        expect(runOf(world).partyIds.length).toBe(PARTY_SIZE);

        const last = species[PARTY_SIZE - 1];
        const lastOs = MingmingRegistry[last].availableOS[0];
        expect(assembleKeys(world, `${last}:${lastOs}:party`)).toEqual([]);
        const swaps = assembleKeys(world, `${last}:${lastOs}:swap-`);
        expect(swaps.length).toBe(PARTY_SIZE);

        const out = runOf(world).partyIds[0];
        press(world, `workshop:assemble:${last}:${lastOs}:swap-${out}`);
        expect(runOf(world).partyIds).not.toContain(out);
        expect(runOf(world).bench).toContain(out);
        expect(runOf(world).partyIds.length).toBe(PARTY_SIZE);
    });

    it('has no move for a build already on the team, nor one it cannot pay for', () => {
        const world = workshopWorld();
        const [species] = otherSpecies(world);
        giveBlueprint(world, species);
        setScrap(world, 0);
        expect(keysOf(world).filter((k) => k.startsWith('workshop:assemble:'))).toEqual([]);
    });

    it('offers no assembly when recruiting is switched off', () => {
        const world = workshopWorld(undefined, ['no_recruits']);
        const [species] = otherSpecies(world);
        giveBlueprint(world, species);
        expect(keysOf(world).filter((k) => k.startsWith('workshop:assemble:'))).toEqual([]);
    });
});

describe('180b — reflash', () => {
    const reflashable = (): string => {
        const starter = eaStarters().find((id) => {
            const species = speciesOwningFirmware(id)!;
            return MingmingRegistry[species].availableOS.length > 1;
        });
        expect(starter, 'some starter species has a second firmware').toBeDefined();
        return starter!;
    };

    it('swaps firmware and engine as the bay does, spending the blueprint', () => {
        const world = workshopWorld(reflashable());
        const member = ranchOf(world).roster[0] as IRanchMember;
        giveBlueprint(world, member.definitionId);
        const targetOS = reflashOptionsFor(member)[0];
        const run = runOf(world);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const plan = planReflash({ ranch: ranchOf(world), run, node, member, targetOS })!;
        const expected = runReducer({ run }, reflashEngine({ memberId: member.id, retireIds: plan.retireIds, cards: plan.cards, price: plan.scrap })).run;

        press(world, `workshop:reflash:${member.id}:${targetOS}`);
        expect(runOf(world)).toEqual(expected);
        expect(ranchOf(world).blueprints[member.definitionId] ?? 0).toBe(0);
    });

    it('has no move without the blueprint', () => {
        const world = workshopWorld(reflashable());
        expect(keysOf(world).filter((k) => k.startsWith('workshop:reflash:'))).toEqual([]);
    });
});

describe('180b — the workshop upgrade bench', () => {
    it('is the same bench as the market, keyed to the workshop, with two upgrades a visit', () => {
        const world = workshopWorld();
        const ids = Object.keys(ProgramRegistry).filter((id) => upgradeIdFor(id) !== undefined).slice(0, 3);
        world.store.dispatch(addRunCards(ids.map((dataId, i) => ({ instanceId: `up-${i}`, dataId, ownerId: null }))));
        const upgradeKeys = () => keysOf(world).filter((k) => k.startsWith('workshop:upgrade:'));
        expect(upgradeKeys().length).toBeGreaterThan(0);
        press(world, 'workshop:upgrade:up-0');
        press(world, 'workshop:upgrade:up-1');
        expect(runOf(world).upgradesTaken?.length).toBe(2);
        expect(upgradeKeys()).toEqual([]);
    });
});

describe('180b — one trip: a blueprint from the market, a recruit at the workshop', () => {
    it('buys the blueprint at the stall and assembles it at the bay', () => {
        const { world, speciesId } = marketWithBlueprint();
        setScrap(world, 400);
        press(world, 'market:blueprint');
        expect(ranchOf(world).blueprints[speciesId]).toBeGreaterThan(0);
        press(world, 'leave');

        standAt(world, 'workshop');
        const osId = MingmingRegistry[speciesId].availableOS[0];
        const keys = keysOf(world).filter((k) => k.startsWith(`workshop:assemble:${speciesId}:${osId}:`));
        expect(keys.length).toBeGreaterThan(0);
        press(world, keys[0]);
        expect(ranchOf(world).roster.some((m) => m.definitionId === speciesId)).toBe(true);
    });
});
