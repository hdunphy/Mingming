/**
 * WHERE A CLAIMED REWARD ACTUALLY GOES — ticket 12, piece 5.
 *
 * `RewardSystem.test.ts` proves what a fight *pays*. This file proves where each half of it *lands*,
 * because ticket 06 split the destination in two and `BattleArena` is the only place that knows the
 * split: **blueprints to the ranch, immediately; scrap and picked cards to the run, on claim.**
 *
 * The dispatch sequences below mirror `BattleArena`'s victory path exactly — the blueprint-banking
 * effect and `handleContinue` — against a local store rather than by rendering the arena, which
 * would drag in framer-motion, the audio engine and the whole battle reducer to assert three
 * dispatches. What is being pinned is the *contract between the two slices*, and that is visible
 * here and nowhere else:
 *
 * - a reward card becomes an `IRunCard` in the SHARED RUN DECK with `ownerId: null`;
 * - the blueprint is on the ranch before the player presses CONTINUE, so a dead run still pays
 *   forward (ticket 12's Done-when);
 * - a species the ranch already holds stacks rather than dedupes (the re-roll grind).
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import gameReducer, { addBlueprint, createEmptyRanch } from './gameSlice';
import runReducer, { addRunCards, addRunScrap, endRun, startRun } from './runSlice';
import { rewardCardPool, rollDropTable } from '../../engine/RewardSystem';
import { STARTING_SCRAP, createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IOwnedProgram } from '../../engine/gameTypes';
import type { IRunCard } from '../../engine/runTypes';
import type { IBattleEntity, IMingmingState } from '../../engine/types';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
    { id: 'mm2', definitionId: 'fenrir', activeOS: 'fenrir_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

function makeStore() {
    return configureStore({
        reducer: { game: gameReducer, run: runReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
        preloadedState: { game: createEmptyRanch(), run: { run: null } },
    });
}

function makeRun(seed = 'claim-run') {
    return createRun({ seed, offer: offerGyms('offer-seed')[0], party: PARTY, startedAt: 1_700_000_000_000 });
}

function deadEnemy(id: string, definitionId: string): IBattleEntity {
    return {
        id, name: `Wild ${definitionId}`, definitionId,
        hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
        maxHp: 100, attack: 15, defense: 5, maxEnergy: 10, cardDraw: 1,
        currentHp: 0, currentEnergy: 0, primaryElement: 'Water',
        statusEffects: [], tempHp: 0, speed: 10, daemons: [],
    };
}

/** `BattleArena.handleContinue`'s mapping, verbatim: a reward card belongs to the deck, not a member. */
function toRunCards(chosen: ReadonlyArray<IOwnedProgram>): IRunCard[] {
    return chosen.map((card) => ({ instanceId: card.instanceId, dataId: card.dataId, ownerId: null }));
}

describe('claiming a reward bundle (ticket 12, piece 5)', () => {
    it('puts one picked card per defeated enemy into the shared run deck', () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        const deckBefore = store.getState().run.run!.deck.length;

        const bundle = rollDropTable({
            defeated: [deadEnemy('e1', 'jormungandr'), deadEnemy('e2', 'jormungandr')],
            nodeKind: 'wild',
            party: PARTY,
            seed: 'claim-seed',
        });

        // The player takes the first option of each pick — one card per defeated enemy.
        const chosen = bundle.cardChoices.map((choice) => choice.options[0]);
        store.dispatch(addRunCards(toRunCards(chosen)));
        store.dispatch(addRunScrap(bundle.scraps));

        const deck = store.getState().run.run!.deck;
        expect(deck).toHaveLength(deckBefore + 2);
        // The claim ADDS to what the run was already holding, and since 2026-08-24 a run is not
        // holding nothing: it opens on `STARTING_SCRAP`. Written as the sum rather than as the new
        // literal because the claim's job here is the addition, not either number.
        expect(store.getState().run.run!.scrap).toBe(STARTING_SCRAP + bundle.scraps);

        const claimed = deck.slice(deckBefore);
        for (const [i, card] of claimed.entries()) {
            // `ownerId: null` is `runTypes.ts`'s reserved value for a card that was bought,
            // drafted or granted rather than brought by a member. A reward card has no owner: it
            // belongs to the deck, and nothing about it changes if a member ever leaves.
            expect(card.ownerId).toBeNull();
            expect(card.dataId).toBe(chosen[i].dataId);
            // The instance id survives the claim, which is what makes a resumed run (ticket 23)
            // hand the player the same card they were shown rather than a fresh copy.
            expect(card.instanceId).toBe(chosen[i].instanceId);
        }
    });

    it('claims cards the party could plausibly want — the pick pool is the party (ticket 08/12)', () => {
        const pool = new Set(rewardCardPool(PARTY));
        const bundle = rollDropTable({
            defeated: [deadEnemy('e1', 'jormungandr')],
            nodeKind: 'wild',
            party: PARTY,
            seed: 'pool-claim',
        });
        for (const option of bundle.cardChoices[0].options) {
            expect(pool).toContain(option.dataId);
        }
    });

    it('the start deck keeps its owners — only the reward card is ownerless', () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        const startDeck = store.getState().run.run!.deck;
        expect(startDeck.every((c) => c.ownerId !== null)).toBe(true);

        const bundle = rollDropTable({
            defeated: [deadEnemy('e1', 'jormungandr')],
            nodeKind: 'wild',
            party: PARTY,
            seed: 'owner-seed',
        });
        store.dispatch(addRunCards(toRunCards([bundle.cardChoices[0].options[1]])));

        const deck = store.getState().run.run!.deck;
        expect(deck.filter((c) => c.ownerId === null)).toHaveLength(1);
    });
});

describe('a blueprint reaches the ranch immediately (ticket 12, Done-when)', () => {
    /** `BattleArena`'s banking effect: one dispatch per entry, the moment the bundle is rolled. */
    function bank(store: ReturnType<typeof makeStore>, blueprints: ReadonlyArray<string>): void {
        for (const speciesId of blueprints) store.dispatch(addBlueprint(speciesId));
    }

    it('is banked before the reward is claimed, so a dead run still pays forward', () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));

        const bundle = rollDropTable({
            defeated: [deadEnemy('e1', 'jormungandr')],
            nodeKind: 'alpha', // guaranteed drop (ticket 07)
            party: PARTY,
            seed: 'forward-seed',
        });
        expect(bundle.blueprints).toEqual(['jormungandr']);

        // The blueprint lands here — NOT in the claim below. Before ticket 12 both happened in
        // `handleContinue`, so closing the app on the reward screen lost the blueprint outright.
        bank(store, bundle.blueprints);
        expect(store.getState().game.blueprints).toEqual({ jormungandr: 1 });

        // The player never claims: the run dies instead. The ranch keeps the blueprint, which is
        // the whole of "dead runs still pay forward".
        store.dispatch(endRun('defeat'));
        expect(store.getState().game.blueprints).toEqual({ jormungandr: 1 });
        expect(store.getState().run.run?.outcome).toBe('defeat');
    });

    it('stacks a species the ranch already holds — that is the re-roll grind', () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(addBlueprint('jormungandr')); // already owned, from an earlier run

        const bundle = rollDropTable({
            defeated: [deadEnemy('e1', 'jormungandr')],
            nodeKind: 'alpha',
            party: PARTY,
            seed: 'stack-seed',
        });
        bank(store, bundle.blueprints);

        expect(store.getState().game.blueprints).toEqual({ jormungandr: 2 });
    });

    it('two farmed fights on the same node bank two blueprints', () => {
        // The store-level face of Henry's farming ruling: nothing between the reward roll and the
        // ranch count consults how many times the node has been entered.
        const store = makeStore();
        store.dispatch(startRun(makeRun()));

        for (const visit of [1, 2]) {
            const bundle = rollDropTable({
                defeated: [deadEnemy('e1', 'kraken')],
                nodeKind: 'alpha',
                party: PARTY,
                seed: `farm-visit-${visit}`,
            });
            bank(store, bundle.blueprints);
        }

        expect(store.getState().game.blueprints).toEqual({ kraken: 2 });
    });

    it('leaves scrap out of the ranch entirely', () => {
        // Anti-mudflation (`economy-session.md`): scrap is run-scoped and the ranch has no field
        // for it. Asserted here because the claim path is the one place someone might add one.
        const store = makeStore();
        store.dispatch(startRun(makeRun()));
        store.dispatch(addRunScrap(120));

        expect(Object.keys(store.getState().game)).not.toContain('scrap');
        // The 120 lands on top of the run's opening `STARTING_SCRAP` grant, which is still purely
        // run-scoped: a grant every run is not a carry, so nothing here reaches the ranch either.
        expect(store.getState().run.run!.scrap).toBe(STARTING_SCRAP + 120);
    });
});
