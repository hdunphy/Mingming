/**
 * TICKET 193h — the numbers that explain a night, free every morning: party size at the end,
 * blueprints still held, where each run ended, and one table of how party size lined up with
 * reaching the gym.
 *
 * The fixture is a night of two sessions played for real: one solo Kraken and one that assembled a
 * second member at a Den with a spare blueprint left over. Nothing here pins the game's own wording;
 * node labels are read from the game's own `nodeLabel`.
 */
import { describe, expect, it } from 'vitest';

import { MingmingRegistry } from '../../../engine/data/mingmingRegistry';
import { nodeLabel } from '../gameText';
import { currentScreen } from '../screen';
import { writeSession } from '../sessionFile';
import { freshWorld, tempRoot } from '../testKit';
import { giveBlueprint, setScrap, standAt } from '../walkKit';
import { applyMove } from '../world';
import type { World } from '../types';
import { runOf } from '../types';
import { endFactsOf } from './endFacts';
import { gatherRun, type RunFact } from './facts';
import { partyTable } from './partyTable';
import { renderReport } from './render';

const save = (root: string, name: string, world: World): void => writeSession(root, name, { ...world.header, moves: world.log, notes: [] });

/** Solo: stood at a Den holding one blueprint it never spent. */
function soloWorld(): World {
    const world = freshWorld();
    const [species] = otherSpecies(world);
    giveBlueprint(world, species);
    standAt(world, 'workshop');
    return world;
}

/** Party: assembled a second member with the first blueprint and kept a second one. */
function partyWorld(): World {
    const world = freshWorld();
    const [first, second] = otherSpecies(world);
    giveBlueprint(world, first);
    giveBlueprint(world, second);
    standAt(world, 'workshop');
    setScrap(world, 500);
    applyMove(world, { key: `workshop:assemble:${first}:${MingmingRegistry[first].availableOS[0]}:party`, why: 'a second member' });
    return world;
}

const otherSpecies = (world: World): string[] => {
    const mine = world.store.getState().game.roster.map((m) => m.definitionId);
    return Object.keys(MingmingRegistry).filter((id) => !mine.includes(id) && MingmingRegistry[id].availableOS.length > 0);
};

describe('193h — what a run holds when it stops', () => {
    it('reads party size, blueprints held and where it stands from the world', () => {
        const solo = endFactsOf(soloWorld());
        const party = endFactsOf(partyWorld());
        expect(solo).toMatchObject({ partySize: 1, blueprints: 1, reachedGym: false });
        expect(party).toMatchObject({ partySize: 2, blueprints: 1, reachedGym: false });
        const world = soloWorld();
        const run = runOf(world);
        expect(solo.endedAt).toBe(nodeLabel(run.nodes.find((n) => n.id === run.currentNodeId)!));
    });

    it('counts blueprints summed over species, and reaching the gym means its node was entered', () => {
        const world = freshWorld();
        const [a, b] = otherSpecies(world);
        giveBlueprint(world, a);
        giveBlueprint(world, a);
        giveBlueprint(world, b);
        expect(endFactsOf(world).blueprints).toBe(3);
        standAt(world, 'gym');
        expect(endFactsOf(world).reachedGym).toBe(true);
        expect(endFactsOf(world).endedAt).toBe(nodeLabel(runOf(world).nodes.find((n) => n.id === runOf(world).currentNodeId)!));
    });

    it('gatherRun carries them into the run\'s facts, from the replayed session file', () => {
        const root = tempRoot();
        const world = freshWorld();
        applyMove(world, { key: currentScreen(world).moves[0].key, why: 'first step' });
        save(root, 'r01', world);
        const fact = gatherRun(root, 'r01');
        expect(fact).toMatchObject({ partySize: 1, blueprints: endFactsOf(world).blueprints, reachedGym: false, endedAt: endFactsOf(world).endedAt });
    });
});

const stub = (over: Partial<RunFact> = {}): RunFact => ({
    session: 'r01', header: { seed: 's', starter: 'x', gymIndex: 0, mode: 'run', tier: 0, modifiers: [], moves: [], notes: [] },
    starter: 'Firmware', gym: 'Gym', outcome: 'defeat', fights: 1, biome: '1 of 3', deckSize: 8, scrap: 0, decisions: 4,
    partySize: 1, blueprints: 0, endedAt: 'Elite', reachedGym: false,
    findings: [], notes: [], choices: [], shelfOffers: [], ...over,
});

describe('193h — the party table', () => {
    it('counts sessions, how many reached the gym and how many won, by party size', () => {
        const table = partyTable([
            stub({ session: 'r01' }), stub({ session: 'r02' }),
            stub({ session: 'r03', partySize: 2, reachedGym: true }),
            stub({ session: 'r04', partySize: 2, reachedGym: true, outcome: 'victory' }),
            stub({ session: 'r05', partySize: 3 }),
        ]);
        expect(table[0]).toMatch(/Party at the end \| Sessions \| Reached the gym \| Won/);
        const rows = table.slice(2).join('\n');
        expect(rows).toMatch(/\| 1 \(solo\) \| 2 \| 0 \| 0 \|/);
        expect(rows).toMatch(/\| 2 \| 2 \| 2 \| 1 \|/);
        expect(rows).toMatch(/\| 3 \| 1 \| 0 \| 0 \|/);
    });

    it('has no rows for a size nobody had, and says nothing for a night with no runs', () => {
        expect(partyTable([stub()]).slice(2).filter((l) => l.startsWith('| '))).toHaveLength(1);
        expect(partyTable([])).toEqual([]);
    });
});

describe('193h — in the morning report', () => {
    it('puts the table at the top, and three columns on each run line', () => {
        const text = renderReport('2026-10-06', [
            stub({ session: 'r01', partySize: 1, blueprints: 2, endedAt: 'Elite' }),
            stub({ session: 'r02', partySize: 2, blueprints: 1, endedAt: 'Gym', reachedGym: true }),
        ]);
        expect(text.indexOf('Party at the end')).toBeGreaterThan(-1);
        expect(text.indexOf('Party at the end')).toBeLessThan(text.indexOf('## Invariant failures'));
        const lines = text.split('\n').filter((l) => /^- r0[12]:/.test(l));
        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain('party of 1, 2 blueprints unspent, ended at Elite');
        expect(lines[1]).toContain('party of 2, 1 blueprint unspent, ended at Gym');
    });
});
