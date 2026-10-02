/**
 * TICKET 180a — the map, the fight and the reward screens.
 *
 * Nothing here pins on-screen wording (182 rewrites the copy and 183h renames words): it reads the
 * screens' structure, their move keys, and the run state they change.
 */
import { describe, it, expect } from 'vitest';

import { blueprintBankedModifier } from '../../engine/run/runSummary';
import { currentScreen } from './screen';
import { applyMove } from './world';
import { runOf } from './types';
import { freshWorld, play } from './testKit';

describe('180a — the map', () => {
    it('opens on the map, and the only places to go are the scripted opening fights', () => {
        // The ticket expected one move; the opening layer is three nodes, all forced to wild
        // (`REGION_PARAMS.scriptedOpeningLayer`), so the first screen offers three scripted fights.
        const world = freshWorld();
        const screen = currentScreen(world);
        expect(screen.id).toBe('map');
        expect(screen.moves.length).toBeGreaterThan(0);
        const run = runOf(world);
        for (const move of screen.moves) {
            expect(move.key).toMatch(/^enter:/);
            const target = run.nodes.find((n) => `enter:${n.id}` === move.key)!;
            expect(target.kind).toBe('wild');
        }
    });

    it('lists one move per node the current node has an edge to', () => {
        const world = freshWorld();
        play(world, 2);
        const run = runOf(world);
        const here = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const screen = currentScreen(world);
        if (screen.id === 'map') {
            expect(screen.moves.filter((m) => m.key.startsWith('enter:')).map((m) => m.key))
                .toEqual(expect.arrayContaining(here.edges.map((id) => `enter:${id}`)));
        }
    });
});

describe('180a — a fight and its rewards', () => {
    it('plays the fight on the spot and shows what it paid', () => {
        const world = freshWorld();
        const first = currentScreen(world).moves[0];
        applyMove(world, { key: first.key, why: 'test' });
        const run = runOf(world);
        expect(run.phase === 'ended' || run.fightsResolved === 1 || world.view.reward !== null).toBe(true);
        const after = currentScreen(world);
        // Either the run is over (a loss) or the screen after a win carries the fight's report.
        if (run.outcome === 'defeat') expect(after.id).toBe('end');
        else expect(world.view.fight).not.toBeNull();
        expect(world.view.fight!.hits.length).toBeLessThanOrEqual(5);
    });

    it('a card pick lands in the deck, a stored pick lands in the collection', () => {
        const world = freshWorld({ seed: 'ps1' });
        applyMove(world, { key: currentScreen(world).moves[0].key, why: 'test' });
        let screen = currentScreen(world);
        expect(screen.id).toBe('reward');
        const before = runOf(world).deck.length;
        const take = screen.moves.find((m) => m.key.includes(':take:'))!;
        applyMove(world, { key: take.key, why: 'test' });
        // Finish whatever other decisions the fight asked.
        for (let guard = 0; guard < 6 && world.view.reward; guard += 1) {
            screen = currentScreen(world);
            const skip = screen.moves.find((m) => m.key.endsWith(':skip'))!;
            applyMove(world, { key: skip.key, why: 'test' });
        }
        expect(world.view.reward).toBeNull();
        expect(runOf(world).deck.length).toBe(before + 1);
        expect(runOf(world).phase).toBe('map');
        expect(runOf(world).fightsResolved).toBe(1);

        const stored = freshWorld({ seed: 'ps1' });
        applyMove(stored, { key: currentScreen(stored).moves[0].key, why: 'test' });
        const store = currentScreen(stored).moves.find((m) => m.key.includes(':store:'))!;
        applyMove(stored, { key: store.key, why: 'test' });
        for (let guard = 0; guard < 6 && stored.view.reward; guard += 1) {
            const skip = currentScreen(stored).moves.find((m) => m.key.endsWith(':skip'))!;
            applyMove(stored, { key: skip.key, why: 'test' });
        }
        expect(runOf(stored).collection?.length).toBe(1);
        expect(runOf(stored).deck.length).toBe(before);
    });

    it('banks a blueprint into the ranch the moment the fight is won', () => {
        // Over a few seeds, at least one win pays a blueprint; whenever one does, the ranch holds it.
        let seen = 0;
        for (const seed of ['ps1', 'ps2', 'ps3', 'ps4', 'ps5', 'ps6']) {
            const world = freshWorld({ seed });
            play(world, 12);
            const held = Object.values(world.store.getState().game.blueprints).reduce((a, b) => a + b, 0);
            const bankedFor = (species: string) => runOf(world).modifiers.includes(blueprintBankedModifier(species));
            for (const species of Object.keys(world.store.getState().game.blueprints)) expect(bankedFor(species)).toBe(true);
            if (held > 0) seen += 1;
        }
        expect(seen).toBeGreaterThan(0);
    });
});
