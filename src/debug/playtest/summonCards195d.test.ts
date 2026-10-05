/**
 * TICKET 195d — the playtest tool's Den says how many cards a summon adds, from the same module the game reads.
 */
import { describe, expect, it } from 'vitest';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { summonCardCount, summonCardsText } from '../../engine/run/summonCards';
import { countedDeckSize } from '../../engine/run/junk';
import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { giveBlueprint, setScrap, standAt } from './walkKit';
import { applyMove } from './world';
import { runOf } from './types';

function denWith(): { world: ReturnType<typeof freshWorld>; speciesId: string } {
    const world = freshWorld();
    standAt(world, 'workshop');
    setScrap(world, 500);
    const mine = world.store.getState().game.roster.map((m) => m.definitionId);
    const speciesId = Object.keys(MingmingRegistry).find((id) => !mine.includes(id) && MingmingRegistry[id].availableOS.length > 0)!;
    giveBlueprint(world, speciesId);
    return { world, speciesId };
}

describe('195d — the tool’s Den', () => {
    it('says how many cards each build adds, on the line that lists its engine', () => {
        const { world, speciesId } = denWith();
        const text = currentScreen(world).body.join('\n');
        const osId = MingmingRegistry[speciesId].availableOS[0];
        expect(text).toContain(summonCardsText(summonCardCount(speciesId, osId)));
    });

    it('says it on the party move, and says the bench move goes to the collection', () => {
        const { world } = denWith();
        const moves = currentScreen(world).moves.filter((m) => m.key.startsWith('workshop:assemble:'));
        const party = moves.find((m) => m.key.endsWith(':party'))!;
        const bench = moves.find((m) => m.key.endsWith(':bench'))!;
        expect(party.label).toContain('+5 cards to your deck');
        expect(bench.label).toContain('+5 cards to your collection');
    });

    it('is true: the deck grows by the number the move said', () => {
        const { world } = denWith();
        const party = currentScreen(world).moves.find((m) => m.key.startsWith('workshop:assemble:') && m.key.endsWith(':party'))!;
        const n = Number(/\+(\d+) cards to your deck/.exec(party.label)![1]);
        const before = countedDeckSize(runOf(world).deck);
        applyMove(world, { key: party.key, why: 'test' });
        expect(countedDeckSize(runOf(world).deck) - before).toBe(n);
    });
});
