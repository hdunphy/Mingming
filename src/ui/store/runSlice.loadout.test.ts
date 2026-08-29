/**
 * THE FOUR EDIT SURFACES' VERBS — ticket 61 §3 and §5, at the reducer.
 *
 * `LoadoutEditor.test.tsx` proves the screen SAYS these things; this proves the store DOES them.
 * The split matters more here than anywhere else in the run, because the whole design of ticket 61
 * is that **editing is free** — there is no payment to make a mistake expensive and no confirmation
 * to slow one down, so the only thing standing between a mis-click and an illegal run is what these
 * reducers refuse.
 *
 * # WHAT THEY ARE FOR
 *
 * Henry, 2026-08-26, after the playtest that produced the ticket:
 *
 * > *"It felt bad to build a deck, it was hard to get the right cards and deck bloat became a
 * > massive problem. I want to be able to swap out mingmings from the active roster based on the
 * > upcoming biome or challenges. I also want to experiment more."*
 *
 * Five verbs come out of that. `moveCardToCollection` and `moveCardToDeck` are the deck's two
 * directions. `benchPartyMember` and `swapBenchMember` are the team's. `reflashEngine` is the
 * workshop's re-aim, and it is here rather than in the workshop's own file because what it moves is
 * the deck.
 *
 * # THE ONE LAW ALL OF THEM SHARE
 *
 * **The floor.** Ticket 61 §5: the minimum active deck is the party's own contribution — 8, 13 or
 * 18 by party size, `minimumActiveDeck`. Every verb that can shrink the deck is tested against it,
 * and `runSlice.marketplace.test.ts` tests the sixth door (a sale) for the same reason. A floor
 * enforced at four of five doors is not a floor.
 *
 * Refusals are **silent and byte-identical**, the slice's standing convention: a reducer has no
 * error channel, and a run that changed a little on a refused action is worse than one that did
 * not change at all.
 */

import { describe, expect, it } from 'vitest';

import runReducer, {
    addRunCollection,
    benchPartyMember,
    dismissBoundaryAlert,
    moveCardToCollection,
    moveCardToDeck,
    recruitToBench,
    reflashEngine,
    resolveEncounter,
    swapBenchMember,
    type RunSliceState,
} from './runSlice';
import { createRun, minimumActiveDeck } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { REGION_PARAMS } from '../../engine/run/regionGraph';
import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import type { IMingmingState } from '../../engine/types';
import type { IRegionNode, IRunCard, IRunState } from '../../engine/runTypes';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const FENRIR: IMingmingState = { ...KRAKEN, id: 'mm2', definitionId: 'fenrir', activeOS: 'fenrir_v1' };

const stateOf = (run: IRunState): RunSliceState => ({ run });

function makeRun(party: IMingmingState[] = [KRAKEN]): IRunState {
    return createRun({
        seed: 'loadout-reducer-seed',
        offer: offerGyms('offer-seed')[0],
        party,
        startedAt: 1_700_000_000_000,
    });
}

/**
 * The run with room above its floor.
 *
 * A fresh run's deck is EXACTLY `minimumActiveDeck(partyIds.length)` — that is what §5 means by
 * "the party's own contribution" — so a test about *moving* a card has to buy the deck some room
 * first or it is testing the floor instead. The added cards carry `ownerId: null`, exactly as a
 * purchase or a reward pick does.
 */
function withSlack(run: IRunState, n = 3): IRunState {
    const extra: IRunCard[] = Array.from({ length: n }, (_, i) => ({
        instanceId: `slack-${i}`, dataId: GENERIC_HIT, ownerId: null,
    }));
    return { ...run, deck: [...run.deck, ...extra] };
}

// =================================================================================================
// The deck's two directions
// =================================================================================================

describe('moveCardToCollection — the free removal that replaced the paid one', () => {
    it('takes one instance out of the deck and puts it in the collection, at no cost', () => {
        /*
         * This verb IS the amendment. Until 2026-08-26 the only way a card left the deck was
         * `removeRunCardForScrap`, at 20 scrap a card — and with roughly eleven fights offering a
         * pick each, cleaning a deck cost more than the cards that dirtied it. Henry deleted the
         * price outright: *"we don't need to remove cards as we can just put them in the run's
         * collection."*
         *
         * So the assertion is as much about what does NOT move as what does. Scrap is untouched;
         * nothing is destroyed; the card is still owned.
         */
        const run = withSlack(makeRun());
        const target = run.deck.find((c) => c.instanceId === 'slack-0')!;

        const after = runReducer(stateOf(run), moveCardToCollection(target.instanceId)).run!;

        expect(after.deck).toHaveLength(run.deck.length - 1);
        expect(after.deck.some((c) => c.instanceId === target.instanceId)).toBe(false);
        expect(after.collection).toHaveLength(1);
        expect(after.collection![0]).toEqual(target);
        expect(after.scrap).toBe(run.scrap);
    });

    it('moves ONE instance, not every copy of the card', () => {
        // A starter deals three identical generics and several ruled engines double a card, so
        // "move a `tackle`" is ambiguous by construction. Keyed on `instanceId` for the reason
        // `sellRunCard` is: the moment `ownerId` means anything, which of the three left matters.
        const run = withSlack(makeRun());
        const generics = run.deck.filter((c) => c.dataId === GENERIC_HIT);
        expect(generics.length).toBeGreaterThan(1);

        const after = runReducer(stateOf(run), moveCardToCollection(generics[0].instanceId)).run!;

        expect(after.deck.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(generics.length - 1);
    });

    it('refuses at the floor — the whole of ticket 61 §5, in one guard', () => {
        /*
         * The floor is *"minimum active deck = the party's base contribution"*, and it is a
         * statement about what you can FIELD: a deck below it is a deck that cannot draw the engine
         * the party brought. `LoadoutEditor` greys the rows and prints the pill, but a screen that
         * forgets to grey something must still not be able to produce an illegal deck — the same
         * argument ticket 20 made for affordability living beside the payment rather than only on
         * the button.
         */
        const run = makeRun();
        expect(run.deck).toHaveLength(minimumActiveDeck(run.partyIds.length));

        const after = runReducer(stateOf(run), moveCardToCollection(run.deck[0].instanceId)).run!;

        // Byte-identical: the standing refusal convention.
        expect(after).toEqual(run);
    });

    it('is a no-op for a card that is not in the deck at all', () => {
        const run = withSlack(makeRun());
        expect(runReducer(stateOf(run), moveCardToCollection('nothing-like-this')).run).toEqual(run);
    });
});

describe('moveCardToDeck — the other direction, and the one with no ceiling', () => {
    it('takes one instance out of the collection and puts it in the deck', () => {
        const stored: IRunCard = { instanceId: 'stored-1', dataId: GENERIC_HIT, ownerId: null };
        const run = { ...makeRun(), collection: [stored] };

        const after = runReducer(stateOf(run), moveCardToDeck(stored.instanceId)).run!;

        expect(after.deck).toHaveLength(run.deck.length + 1);
        expect(after.deck.some((c) => c.instanceId === stored.instanceId)).toBe(true);
        expect(after.collection).toHaveLength(0);
    });

    it('has NO upper bound, deliberately', () => {
        /*
         * The floor is a minimum and there is no maximum, which is worth pinning because the
         * obvious symmetry would be to add one. `economy-session.md`'s 20-25 is a TARGET the player
         * is allowed to miss in both directions — a bloated deck punishes itself by diluting the
         * draw, and that self-correction is the mechanism the collection exists to make usable. A
         * hard ceiling would replace a strategy with a refusal.
         */
        const stored: IRunCard[] = Array.from({ length: 40 }, (_, i) => ({
            instanceId: `stored-${i}`, dataId: GENERIC_HIT, ownerId: null,
        }));
        let state = stateOf({ ...makeRun(), collection: stored });
        for (const card of stored) state = runReducer(state, moveCardToDeck(card.instanceId));

        expect(state.run!.deck).toHaveLength(makeRun().deck.length + 40);
        expect(state.run!.collection).toHaveLength(0);
    });

    it('is a no-op for a card that is not in the collection at all', () => {
        const run = makeRun();
        expect(runReducer(stateOf(run), moveCardToDeck('nothing-like-this')).run).toEqual(run);
    });
});

// =================================================================================================
// The team's two directions
// =================================================================================================

describe('benchPartyMember — a routing decision, not a loss', () => {
    it('moves the member AND their cards, both in the same action', () => {
        /*
         * `runTypes.ts` on the bench: *"a benched member is still yours… **its five engine cards
         * follow it** out of the collection and into the active deck"*, and back the other way when
         * it leaves. That pairing is the whole feature — benching a Ratatoskr for the fire biome and
         * leaving its four enablers in the deck would be worse than not benching it, because the
         * player would be drawing setup for a payoff that is no longer on the field.
         */
        const run = makeRun([KRAKEN, FENRIR]);
        const fenrirCards = run.deck.filter((c) => c.ownerId === 'mm2');
        expect(fenrirCards.length).toBeGreaterThan(0);

        const after = runReducer(stateOf(run), benchPartyMember('mm2')).run!;

        expect(after.partyIds).toEqual(['mm1']);
        expect(after.bench).toEqual(['mm2']);
        expect(after.deck.some((c) => c.ownerId === 'mm2')).toBe(false);
        expect(after.collection).toEqual(fenrirCards);
    });

    it('refuses to empty the party', () => {
        // A run with nobody in it cannot start a fight — `createBattleState` throws on an empty
        // party — so this is not a preference, it is the one state the run may not reach. A run
        // OPENS solo, so it is also the first thing anyone can try.
        const run = makeRun();
        expect(runReducer(stateOf(run), benchPartyMember('mm1')).run).toEqual(run);
    });

    it('is a no-op for someone who is not in the party', () => {
        const run = makeRun([KRAKEN, FENRIR]);
        expect(runReducer(stateOf(run), benchPartyMember('ghost')).run).toEqual(run);
    });
});

describe('swapBenchMember — the verb the biome boundary exists for', () => {
    it('trades the two members and their two engines in one action', () => {
        /*
         * *"Remove Rat for the fire biome"* — and the reason it is ONE action rather than a bench
         * followed by a call-up is the floor. Benching first would drop the deck below its minimum
         * for the length of one dispatch, which `moveCardToCollection` would then be right to refuse
         * and a save written in between would be right to reject. A swap is atomic because the
         * legal states are the two ends of it.
         */
        const run = runReducer(stateOf(makeRun([KRAKEN, FENRIR])), benchPartyMember('mm2')).run!;
        expect(run.bench).toEqual(['mm2']);

        const after = runReducer(stateOf(run), swapBenchMember({ outId: 'mm1', inId: 'mm2' })).run!;

        expect(after.partyIds).toEqual(['mm2']);
        expect(after.bench).toEqual(['mm1']);
        // Each member's cards followed them. The deck is the same SIZE — both engines are five —
        // which is why a swap needs no floor check of its own.
        expect(after.deck.some((c) => c.ownerId === 'mm1')).toBe(false);
        expect(after.deck.some((c) => c.ownerId === 'mm2')).toBe(true);
        expect(after.collection!.every((c) => c.ownerId === 'mm1')).toBe(true);
    });

    it('is a no-op unless BOTH halves are where they claim to be', () => {
        // Half a swap is the torn state this reducer exists to make unrepresentable: a party id on
        // the bench, or a benched id in the party, is a run `reconcileLoadedState` has no rule for.
        const run = runReducer(stateOf(makeRun([KRAKEN, FENRIR])), benchPartyMember('mm2')).run!;

        // `inId` is in the party, not on the bench.
        expect(runReducer(stateOf(run), swapBenchMember({ outId: 'mm1', inId: 'mm1' })).run).toEqual(run);
        // `outId` is on the bench, not in the party.
        expect(runReducer(stateOf(run), swapBenchMember({ outId: 'mm2', inId: 'mm2' })).run).toEqual(run);
        // Neither exists.
        expect(runReducer(stateOf(run), swapBenchMember({ outId: 'ghost', inId: 'phantom' })).run).toEqual(run);
    });
});

// =================================================================================================
// The workshop's two writes into the run
// =================================================================================================

describe('recruitToBench — assembling for a biome you have not reached yet', () => {
    const CARDS: IRunCard[] = [
        { instanceId: 'new-1', dataId: GENERIC_HIT, ownerId: 'mm9' },
        { instanceId: 'new-2', dataId: GENERIC_HIT, ownerId: 'mm9' },
    ];

    it('parks the member AND the engine, leaving the live deck alone', () => {
        /*
         * Ticket 65 rules that an assembled member's engine goes straight to the active deck — right
         * for the member you are about to field, wrong for the one you are building for two nodes
         * from now. A bench assembly that shoved five cards into the live deck would tax the
         * experiment with a deck it did not ask for, and the player would walk into the editor to
         * undo half of what they just paid for.
         */
        const run = { ...makeRun(), scrap: 100 };
        const after = runReducer(
            stateOf(run), recruitToBench({ memberId: 'mm9', cards: CARDS, price: 25 }),
        ).run!;

        expect(after.bench).toEqual(['mm9']);
        expect(after.partyIds).toEqual(run.partyIds);
        expect(after.deck).toEqual(run.deck);
        expect(after.collection).toEqual(CARDS);
        expect(after.scrap).toBe(75);
    });

    it('refuses what it cannot pay for, and pays nothing when it refuses', () => {
        // Atomic, for `buyMarketCard`'s reason: the failure this shape prevents is paying for a
        // recruit that did not arrive, or receiving one that was never charged for.
        const run = { ...makeRun(), scrap: 10 };
        expect(runReducer(stateOf(run), recruitToBench({ memberId: 'mm9', cards: CARDS, price: 25 })).run)
            .toEqual(run);
    });

    it('refuses a member already in the party or already on the bench — the double-click guard', () => {
        // `planRecruit` mints its member id deterministically from the node seed, so a second click
        // computes the SAME id rather than a second recruit. Both piles are checked because a bench
        // assembly and a party assembly reach this from the same two buttons.
        const run = { ...makeRun(), scrap: 100 };
        const once = runReducer(stateOf(run), recruitToBench({ memberId: 'mm9', cards: CARDS, price: 25 }));
        const twice = runReducer(once, recruitToBench({ memberId: 'mm9', cards: CARDS, price: 25 }));
        expect(twice.run).toEqual(once.run);

        expect(runReducer(stateOf(run), recruitToBench({ memberId: 'mm1', cards: CARDS, price: 25 })).run)
            .toEqual(run);
    });

    it('refuses cards whose instance ids are already owned', () => {
        // Two cards sharing an instance id would both vanish on the first move — the correctness
        // half of this guard rather than the economy half.
        const run = { ...makeRun(), scrap: 100 };
        const clash = [{ ...CARDS[0], instanceId: run.deck[0].instanceId }];
        expect(runReducer(stateOf(run), recruitToBench({ memberId: 'mm9', cards: clash, price: 25 })).run)
            .toEqual(run);
    });
});

describe('reflashEngine — five out, five in', () => {
    const NEW_ENGINE: IRunCard[] = Array.from({ length: 5 }, (_, i) => ({
        instanceId: `reflash-${i}`, dataId: 'ignite', ownerId: 'mm2',
    }));

    it('retires the old engine to the collection and lands the new one in the deck', () => {
        /*
         * Ticket 65: *"reflash swaps engines 5-for-5, with the old set to the collection."* Nothing
         * is destroyed — the retired five are still owned, still sellable, still addable back by a
         * player who decides the old shell was better — which is what makes the 15 scrap a re-aim
         * rather than a gamble.
         */
        const run = { ...makeRun([KRAKEN, FENRIR]), scrap: 100 };
        const oldEngine = run.deck.filter((c) => c.ownerId === 'mm2');
        const retireIds = oldEngine.map((c) => c.dataId);

        const after = runReducer(stateOf(run), reflashEngine({
            memberId: 'mm2', retireIds, cards: NEW_ENGINE, price: 15,
        })).run!;

        expect(after.scrap).toBe(85);
        // Five out, five in: the deck is the same size, which is why this needs no floor check.
        expect(after.deck).toHaveLength(run.deck.length);
        expect(after.deck.filter((c) => c.dataId === 'ignite')).toHaveLength(5);
        expect(after.collection).toEqual(oldEngine);
    });

    it('retires ONE instance per listed id, so a doubled engine retires both copies', () => {
        /*
         * Several ruled engines list a card twice — `kraken_v1` is `ink_stream, undertow,
         * whirlpool_v2, pressure_point, pressure_point`, because *"one copy is a coin flip and two
         * is an engine"*. A retirement that deduped by `dataId` would leave one `pressure_point`
         * behind every reflash, and the card left behind is an enabler for a payoff that is no
         * longer in the deck: the exact deck bloat this ticket exists to delete, produced by the
         * verb that is supposed to prevent it.
         *
         * So the fixture is chosen for its duplicate rather than for convenience, and the test says
         * so out loud before it asserts anything.
         */
        const run = { ...makeRun([KRAKEN, FENRIR]), scrap: 100 };
        const engine = run.deck.filter((c) => c.ownerId === 'mm1');
        const byData = engine.map((c) => c.dataId);
        const duplicated = byData.filter((id, i) => byData.indexOf(id) !== i);
        expect(duplicated.length).toBeGreaterThan(0);

        const after = runReducer(stateOf(run), reflashEngine({
            memberId: 'mm1', retireIds: byData, cards: [], price: 0,
        })).run!;

        // Every copy went, including the second `pressure_point`.
        expect(after.deck.some((c) => c.ownerId === 'mm1')).toBe(false);
        expect(after.collection).toEqual(engine);
        expect(after.collection!.filter((c) => c.dataId === duplicated[0])).toHaveLength(2);
    });

    it('retires no MORE than the ids list asks for', () => {
        // The other side of the same budget. A list naming `pressure_point` once must leave the
        // second copy in the deck — the count is the instruction, not a filter.
        const run = { ...makeRun([KRAKEN, FENRIR]), scrap: 100 };
        const engine = run.deck.filter((c) => c.ownerId === 'mm1');
        const byData = engine.map((c) => c.dataId);
        const duplicated = byData.filter((id, i) => byData.indexOf(id) !== i)[0];

        const after = runReducer(stateOf(run), reflashEngine({
            memberId: 'mm1', retireIds: [duplicated], cards: [], price: 0,
        })).run!;

        expect(after.collection).toHaveLength(1);
        expect(after.deck.filter((c) => c.ownerId === 'mm1' && c.dataId === duplicated)).toHaveLength(1);
    });

    it('never retires another member\'s copy of the same card', () => {
        /*
         * Matched by (owner, dataId), and the owner half is the load-bearing one: a generic or a
         * shared card in somebody else's engine is not this member's to retire. Without it, a
         * Fenrir reflash could quietly strip a card the Kraken brought.
         */
        const run = { ...makeRun([KRAKEN, FENRIR]), scrap: 100 };
        const krakenCards = run.deck.filter((c) => c.ownerId === 'mm1');

        const after = runReducer(stateOf(run), reflashEngine({
            // Every dataId in the deck, offered as if it were mm2's engine.
            memberId: 'mm2', retireIds: run.deck.map((c) => c.dataId), cards: [], price: 0,
        })).run!;

        expect(after.deck.filter((c) => c.ownerId === 'mm1')).toEqual(krakenCards);
    });

    it('refuses for a member who is in neither the party nor the bench', () => {
        const run = { ...makeRun([KRAKEN, FENRIR]), scrap: 100 };
        expect(runReducer(stateOf(run), reflashEngine({
            memberId: 'ghost', retireIds: [], cards: NEW_ENGINE, price: 15,
        })).run).toEqual(run);
    });

    it('refuses what it cannot pay for', () => {
        const run = { ...makeRun([KRAKEN, FENRIR]), scrap: 5 };
        expect(runReducer(stateOf(run), reflashEngine({
            memberId: 'mm2', retireIds: [], cards: NEW_ENGINE, price: 15,
        })).run).toEqual(run);
    });
});

// =================================================================================================
// The reward pick's other destination
// =================================================================================================

describe('addRunCollection — the STORE half of a taken pick', () => {
    it('adds to the collection and leaves the deck alone', () => {
        /*
         * Ticket 61 §2. It exists because the alternative was the problem: while a taken pick could
         * only go into the live deck, *taking a card* and *diluting a deck* were the same act, and
         * the playtest verdict was that *"deck bloat became a massive problem."* Two acts now, and
         * only one of them costs anything.
         */
        const run = makeRun();
        const picked: IRunCard[] = [{ instanceId: 'pick-1', dataId: GENERIC_HIT, ownerId: null }];

        const after = runReducer(stateOf(run), addRunCollection(picked)).run!;

        expect(after.collection).toEqual(picked);
        expect(after.deck).toEqual(run.deck);
    });

    it('is a no-op on an empty list', () => {
        const run = makeRun();
        expect(runReducer(stateOf(run), addRunCollection([])).run).toEqual(run);
    });
});

// =================================================================================================
// The boundary alert's debt
// =================================================================================================

describe('the biome boundary — a debt the RUN owes, not a flag a screen holds', () => {
    /** Stand the run on a biome's exit elite, as `enterNode` would leave it. */
    function atExitElite(run: IRunState, biomeIndex: number): IRunState {
        const exitLayer = REGION_PARAMS.layersPerBiome - 1;
        const exit = run.nodes.find(
            (n: IRegionNode) => n.biomeIndex === biomeIndex && n.layer === exitLayer,
        )!;
        return { ...run, currentNodeId: exit.id, phase: 'encounter' };
    }

    it('raises the alert when the biome-exit elite resolves', () => {
        /*
         * Henry added this surface after the other three: *"I think after defeating the elite that
         * gates the next biome you should be able to manage your deck and team."* The gate is the
         * exit elite, so the moment it resolves is the moment the offer is owed.
         *
         * It is written into `IRunState` rather than watched for by a component because the alert
         * carries information the map cannot show — what element the next biome runs — and an app
         * close between the elite dying and the modal being answered must resume with the offer
         * still open. An effect keyed on "did `fightsResolved` just go up?" survives neither a
         * reload nor `StrictMode`'s double invocation.
         */
        const run = atExitElite(makeRun(), 0);
        expect(run.nodes.find((n) => n.id === run.currentNodeId)!.kind).toBe('elite');

        const after = runReducer(stateOf(run), resolveEncounter()).run!;

        expect(after.boundaryBiome).toBe(1);
        expect(after.phase).toBe('map');
    });

    it('does not raise it for an ordinary fight', () => {
        // Every wild in a run would otherwise open a modal about a biome the player is nowhere near.
        const run = makeRun();
        const wild = run.nodes.find((n) => n.kind === 'wild' && n.layer > 0)!;
        const after = runReducer(
            stateOf({ ...run, currentNodeId: wild.id, phase: 'encounter' }), resolveEncounter(),
        ).run!;

        expect(after.boundaryBiome).toBeUndefined();
    });

    it('does not raise it at the LAST biome — there is nowhere to prepare for', () => {
        // Biome 3's exit is the gym, and clearing it ends the run. The guard is written as
        // "another biome follows" rather than "the kind is not gym", so it needs no list of kinds.
        const run = atExitElite(makeRun(), REGION_PARAMS.biomesPerRun - 1);
        const after = runReducer(stateOf(run), resolveEncounter()).run!;

        expect(after.boundaryBiome).toBeUndefined();
    });

    it('clears on either answer — IGNORE and EDIT are the same debt paid', () => {
        /*
         * One reducer for both buttons rather than two named after them. A reducer called
         * `ignoreBoundary` would invite a later ticket to make ignoring *mean* something, and
         * ticket 62 is explicit that it does not: *"an alert offers the edit screen; player accepts
         * or ignores."* An alert with a real IGNORE is an offer; one that charges for ignoring is a
         * toll.
         */
        const raised = runReducer(stateOf(atExitElite(makeRun(), 0)), resolveEncounter()).run!;
        expect(raised.boundaryBiome).toBe(1);

        const cleared = runReducer(stateOf(raised), dismissBoundaryAlert()).run!;

        expect(cleared.boundaryBiome).toBeUndefined();
        // The FIELD is gone, not set to undefined — `RunStateSchema` marks it `.optional()` rather
        // than defaulted, because "no alert owed" has no number to stand for it and 0 is a real
        // biome. A run saved with `boundaryBiome: undefined` in it is a run whose JSON has dropped
        // the key anyway, so writing it that way here keeps the in-memory shape and the saved shape
        // identical.
        expect('boundaryBiome' in cleared).toBe(false);
        // And nothing else moved — dismissing an offer is not a transaction.
        const { boundaryBiome: _raised, ...withoutAlert } = raised;
        expect(cleared).toEqual(withoutAlert);
    });

    it('is a no-op when no alert is owed', () => {
        const run = makeRun();
        expect(runReducer(stateOf(run), dismissBoundaryAlert()).run).toEqual(run);
    });
});
