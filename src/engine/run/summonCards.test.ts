/**
 * TICKET 195d — the count on the Summon option is the count the summon delivers.
 */
import { describe, expect, it } from 'vitest';

import { MingmingRegistry } from '../data/mingmingRegistry';
import { RECRUIT_KIT_SIZE } from './createRun';
import { planRecruit } from './workshop';
import { summonCardCount, summonCardsText } from './summonCards';
import { freshWorld } from '../../debug/playtest/testKit';
import { giveBlueprint, setScrap, standAt } from '../../debug/playtest/walkKit';
import { hereNode } from '../../debug/playtest/stalls';
import { runOf } from '../../debug/playtest/types';
import { assembleMingming } from '../../ui/store/gameSlice';
import { recruitIntoParty, recruitToBench } from '../../ui/store/runSlice';
import { countedDeckSize } from './junk';

describe('195d — summonCardCount', () => {
    it('is the five-card engine for every species on every firmware it can run', () => {
        for (const [speciesId, data] of Object.entries(MingmingRegistry)) {
            for (const osId of data.availableOS) expect(summonCardCount(speciesId, osId), `${speciesId}/${osId}`).toBe(RECRUIT_KIT_SIZE);
        }
    });

    it('is what planRecruit mints, for every species on every firmware', () => {
        const world = freshWorld();
        standAt(world, 'workshop');
        setScrap(world, 500);
        const mine = world.store.getState().game.roster.map((m) => m.definitionId);
        let checked = 0;
        for (const [speciesId, data] of Object.entries(MingmingRegistry)) {
            if (mine.includes(speciesId)) continue;
            giveBlueprint(world, speciesId);
            for (const osId of data.availableOS) {
                const plan = planRecruit({ ranch: world.store.getState().game, run: runOf(world), node: hereNode(world), speciesId, osId });
                if (!plan) continue;
                expect(plan.cards.length, `${speciesId}/${osId}`).toBe(summonCardCount(speciesId, osId));
                checked += 1;
            }
        }
        expect(checked).toBeGreaterThan(10);
    });

    it('a summon into the party grows the deck by that many; onto the bench the collection grows by that many', () => {
        for (const destination of ['party', 'bench'] as const) {
            const world = freshWorld();
            standAt(world, 'workshop');
            setScrap(world, 500);
            const mine = world.store.getState().game.roster.map((m) => m.definitionId);
            const speciesId = Object.keys(MingmingRegistry).find((id) => !mine.includes(id) && MingmingRegistry[id].availableOS.length > 0)!;
            giveBlueprint(world, speciesId);
            const osId = MingmingRegistry[speciesId].availableOS[0];
            const before = runOf(world);
            const plan = planRecruit({ ranch: world.store.getState().game, run: before, node: hereNode(world), speciesId, osId })!;
            world.store.dispatch(assembleMingming(plan.member));
            const recruit = { memberId: plan.member.id, cards: plan.cards, price: plan.scrap };
            world.store.dispatch(destination === 'party' ? recruitIntoParty(recruit) : recruitToBench(recruit));
            const after = runOf(world);
            const n = summonCardCount(speciesId, osId);
            if (destination === 'party') expect(countedDeckSize(after.deck) - countedDeckSize(before.deck)).toBe(n);
            else expect((after.collection ?? []).length - (before.collection ?? []).length).toBe(n);
        }
    });
});

describe('195d — summonCardsText', () => {
    it('says "+5 cards to your deck", or to the collection for a bench summon', () => {
        expect(summonCardsText(5)).toBe('+5 cards to your deck');
        expect(summonCardsText(5, 'collection')).toBe('+5 cards to your collection');
        expect(summonCardsText(1)).toBe('+1 card to your deck');
    });
});
