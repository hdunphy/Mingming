/**
 * THE WORKSHOP'S TWO-SLICE TRANSACTION — ticket 14.
 *
 * `engine/run/workshop.test.ts` proves what things cost and who may be built. This proves what
 * pressing the button does to the game, which is a different failure and the one with teeth,
 * because **an assembly writes both halves of the save**:
 *
 * - a blueprint is spent and an individual joins `ranch.roster` (`gameSlice.assembleMingming`);
 * - scrap is spent, `run.partyIds` grows and the recruit's six cards merge into `run.deck`
 *   (`runSlice.recruitIntoParty`).
 *
 * No reducer can do both. Ticket 11's reward claim hit the same wall and split its dispatch; this
 * file pins the split — **the ranch half goes first** — by writing out what each ordering leaves
 * behind when the app dies in the middle, and handing both to `reconcileLoadedState` to adjudicate.
 * That is not a stylistic preference: one order costs the player nothing and the other costs them
 * the whole run.
 *
 * It also pins ticket 14's Done-when that lives across the two slices: **the assembled individual
 * persists to the ranch** — assemble mid-run, kill the run, the member is still there.
 *
 * Everything is asserted against the reducers alone, with no screen in the way. Ticket 20: a check
 * that lives only in a component is a check that races.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import gameReducer, { assembleMingming, createEmptyRanch, swapOS } from './gameSlice';
import runReducer, {
    addRunScrap,
    clearRun,
    endRun,
    recruitIntoParty,
    removeRunCardForScrap,
    spendRunScrap,
    startRun,
    type RunSliceState,
} from './runSlice';
import { RECRUIT_GENERICS, RECRUIT_KIT_SIZE, createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import {
    WORKSHOP_ASSEMBLY_SCRAP,
    WORKSHOP_REFLASH_SCRAP,
    WORKSHOP_REMOVAL_PRICE,
    planRecruit,
} from '../../engine/run/workshop';
import { PARTY_SIZE } from '../../engine/party';
import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import { SAVE_VERSION_V4, reconcileLoadedState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import type { IRanchMember, IRanchState, IRegionNode, IRunState } from '../../engine/runTypes';

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const ROSTER: IRanchMember[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 },
];

function makeStore(ranch: Partial<IRanchState> = {}) {
    return configureStore({
        reducer: { game: gameReducer, run: runReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
        preloadedState: {
            game: { ...createEmptyRanch(), roster: ROSTER, ...ranch },
            run: { run: null } as RunSliceState,
        },
    });
}

function makeRun(scrap: number, seed = 'workshop-store-seed'): IRunState {
    const run = createRun({ seed, offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 1_700_000_000_000 });
    const workshop = run.nodes.find((n) => n.kind === 'workshop')!;
    // Stand the run on its first workshop, as `enterNode` would leave it.
    return {
        ...run,
        scrap,
        currentNodeId: workshop.id,
        nodes: run.nodes.map((n) => (n.id === workshop.id ? { ...n, visited: n.visited + 1 } : n)),
    };
}

function nodeOf(run: IRunState): IRegionNode {
    return run.nodes.find((n) => n.id === run.currentNodeId)!;
}

type Store = ReturnType<typeof makeStore>;

/** What `WorkshopNode`'s assemble handler does, verbatim: plan, ranch half, verify, run half. */
function assembleAt(store: Store, speciesId: string, osId?: string): IRanchMember | null {
    const { game: ranch, run: runState } = store.getState();
    const run = runState.run!;
    const plan = planRecruit({ ranch, run, node: nodeOf(run), speciesId, osId });
    if (!plan) return null;
    if (run.scrap < plan.scrap) return null;

    store.dispatch(assembleMingming(plan.member));
    // The cross-slice verification: charge the run only if the ranch actually changed.
    if (!store.getState().game.roster.some((m) => m.id === plan.member.id)) return null;
    store.dispatch(recruitIntoParty({ memberId: plan.member.id, cards: plan.cards, price: plan.scrap }));
    return plan.member;
}

const envelopes = (ranch: IRanchState, run: IRunState | null) => [
    { version: SAVE_VERSION_V4, ranch },
    run === null ? null : { version: SAVE_VERSION_V4, run },
] as const;

// ---------------------------------------------------------------------------------------------
// The transaction
// ---------------------------------------------------------------------------------------------

describe('assembling at a workshop', () => {
    it('spends BOTH currencies and writes BOTH slices', () => {
        const store = makeStore({ blueprints: { fenrir: 2 } });
        store.dispatch(startRun(makeRun(200)));
        const deckBefore = store.getState().run.run!.deck.length;

        const member = assembleAt(store, 'fenrir', 'fenrir_v1')!;

        const { game, run } = store.getState();
        // Ranch: one blueprint gone, one individual gained.
        expect(game.blueprints).toEqual({ fenrir: 1 });
        expect(game.roster.map((m) => m.id)).toEqual(['mm1', member.id]);
        // Run: scrap gone, party grown, the recruit's whole deck merged into the shared one. Six
        // cards since ticket 60 (4 kit + 2 generics — a starter's exact six, superseding the 5 + 0
        // of 2026-08-24 and ticket 08's 3 + 1) — derived from the constants because what this test
        // is pinning is that ALL of the plan's cards arrive, not how many the ruling currently says
        // there are.
        expect(run.run!.scrap).toBe(200 - WORKSHOP_ASSEMBLY_SCRAP);
        expect(run.run!.partyIds).toEqual(['mm1', member.id]);
        expect(run.run!.deck).toHaveLength(deckBefore + RECRUIT_KIT_SIZE + RECRUIT_GENERICS);
    });

    it('merges the recruit’s six cards into the SHARED deck, owned by the recruit', () => {
        const store = makeStore({ blueprints: { fenrir: 1 } });
        store.dispatch(startRun(makeRun(200)));
        const deckBefore = store.getState().run.run!.deck;

        const member = assembleAt(store, 'fenrir')!;
        const joined = store.getState().run.run!.deck.slice(deckBefore.length);

        expect(joined).toHaveLength(6);
        // The ruled recruit kit: 4 startKit and 2 generics (ticket 60, playtest round 5), which is
        // a starter's six exactly. It supersedes the 5 + 0 of 2026-08-24, which had fixed a real
        // bug — a recruit arriving as a body wearing somebody else's deck — by cutting the filler
        // to pay for the missing tags, and so left a recruit shaped unlike a starter of the same
        // species. Pinned as a literal 2 as well as against the constant, because "a recruit brings
        // the same filler a starter does" is the half of the ruling that a well-meaning "recruits
        // should feel leaner" patch would quietly undo, exactly as the last table did.
        expect(joined.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(RECRUIT_GENERICS);
        expect(joined.filter((c) => c.dataId === GENERIC_HIT)).toHaveLength(2);
        for (const card of joined) expect(card.ownerId).toBe(member.id);
        // The starting member's cards are untouched, and one deck holds both members' cards — which
        // is what "the team is the deck" means (`economy-session.md`, bite two).
        expect(store.getState().run.run!.deck.slice(0, deckBefore.length)).toEqual(deckBefore);
        expect(new Set(store.getState().run.run!.deck.map((c) => c.ownerId)).size).toBe(2);
    });

    it('grows a party 1 → 2 → 3, here and only here', () => {
        // Ticket 14's Done-when, first half. Two workshops, two blueprints, two recruits.
        const store = makeStore({ blueprints: { fenrir: 1, ratatoskr: 1 } });
        store.dispatch(startRun(makeRun(400)));
        expect(store.getState().run.run!.partyIds).toHaveLength(1);

        assembleAt(store, 'fenrir');
        expect(store.getState().run.run!.partyIds).toHaveLength(2);

        assembleAt(store, 'ratatoskr');
        expect(store.getState().run.run!.partyIds).toHaveLength(PARTY_SIZE);

        const { game, run } = store.getState();
        expect(game.blueprints).toEqual({});
        expect(run.run!.scrap).toBe(400 - 2 * WORKSHOP_ASSEMBLY_SCRAP);
        // 6 start cards + 6 + 6 = 18 under ticket 60, where the previous table reached the same 18
        // as 8 + 5 + 5 and ticket 08's original reached 16 as 8 + 4 + 4. The TOTAL is deliberately
        // unchanged across the retag — `economy-session.md`'s 20-25 gate is the number that watches
        // it, and ticket 60 was a change of composition, not of size. What moved is that all 18 now
        // do something for the species that brought them, and six of them (2 a member) are generics
        // the market can be paid to strip, where it used to be three.
        expect(run.run!.deck).toHaveLength(18);
        expect(new Set(run.run!.partyIds).size).toBe(PARTY_SIZE);
    });

    it('refuses a duplicate species — the standing clause, enforced before anything is spent', () => {
        const store = makeStore({ blueprints: { kraken: 3 } });
        store.dispatch(startRun(makeRun(400)));
        const before = store.getState();

        expect(assembleAt(store, 'kraken')).toBeNull();

        // Nothing at all happened: the blueprint is unspent and the party is unchanged. That is the
        // point of `planRecruit` returning null rather than of a reducer refusing halfway.
        expect(store.getState().game).toEqual(before.game);
        expect(store.getState().run.run).toEqual(before.run.run);
    });

    it('refuses a fourth member', () => {
        const store = makeStore({ blueprints: { fenrir: 1, ratatoskr: 1, jormungandr: 1 } });
        store.dispatch(startRun(makeRun(400)));
        assembleAt(store, 'fenrir');
        assembleAt(store, 'ratatoskr');
        const before = store.getState();

        expect(assembleAt(store, 'jormungandr')).toBeNull();

        expect(store.getState().game).toEqual(before.game);
        expect(store.getState().run.run).toEqual(before.run.run);
        expect(store.getState().run.run!.partyIds).toHaveLength(PARTY_SIZE);
    });
});

// ---------------------------------------------------------------------------------------------
// The Done-when that crosses the two slices
// ---------------------------------------------------------------------------------------------

describe('the assembled individual persists to the ranch (ticket 14 Done-when)', () => {
    it('survives the run dying — that is what makes it a ranch write and not a run one', () => {
        const store = makeStore({ blueprints: { fenrir: 1 } });
        store.dispatch(startRun(makeRun(200)));
        const member = assembleAt(store, 'fenrir')!;

        store.dispatch(endRun('defeat'));
        store.dispatch(clearRun());

        expect(store.getState().run.run).toBeNull();
        // The individual, its stat roll and its firmware are all still there. A run never costs the
        // player an individual (`runTypes.ts`: the run is always the disposable half).
        expect(store.getState().game.roster).toContainEqual(member);
        // And the cards it brought went with the run, because cards are run-scoped.
        expect(Object.keys(store.getState().game)).not.toContain('deck');
    });

    it('is fieldable in the NEXT run, which is the whole reason it goes on the roster', () => {
        const store = makeStore({ blueprints: { fenrir: 1 } });
        store.dispatch(startRun(makeRun(200)));
        const member = assembleAt(store, 'fenrir')!;
        store.dispatch(clearRun());

        const next = createRun({
            seed: 'the-next-run',
            offer: offerGyms('offer-seed')[0],
            party: [{ ...KRAKEN, id: member.id, definitionId: member.definitionId, activeOS: member.activeOS }],
            startedAt: 1_700_000_100_000,
        });
        store.dispatch(startRun(next));

        const [ranch, run] = envelopes(store.getState().game, store.getState().run.run);
        expect(reconcileLoadedState(ranch, run).run).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------------------------
// The ordering
// ---------------------------------------------------------------------------------------------

describe('the dispatch ordering — which half goes first', () => {
    it('ranch-first leaves a state the game already has a name for', () => {
        // The app dies between the two dispatches. The player has spent a blueprint and gained an
        // individual: the ranch transaction, exactly. No scrap taken, the party unchanged, and
        // nothing to repair.
        const store = makeStore({ blueprints: { fenrir: 1 } });
        store.dispatch(startRun(makeRun(200)));
        const { game: ranch, run: runState } = store.getState();
        const plan = planRecruit({ ranch, run: runState.run!, node: nodeOf(runState.run!), speciesId: 'fenrir' })!;

        store.dispatch(assembleMingming(plan.member)); // ...and the process dies here.

        const state = store.getState();
        expect(state.game.roster.some((m) => m.id === plan.member.id)).toBe(true);
        expect(state.run.run!.scrap).toBe(200);
        expect(state.run.run!.partyIds).toEqual(['mm1']);

        const [ranchSave, runSave] = envelopes(state.game, state.run.run);
        const reconciled = reconcileLoadedState(ranchSave, runSave);
        // The run RESUMES. The player walks back into the workshop and can try again — with the
        // individual already built, so the blueprint is not lost either.
        expect(reconciled.run).not.toBeNull();
        expect(reconciled.discarded).toBeUndefined();
        expect(reconciled.ranch!.roster.some((m) => m.id === plan.member.id)).toBe(true);
    });

    it('run-first would cost the player the whole run, which is why it is not the order', () => {
        // The same crash, the other way round: scrap spent, cards in the deck, and a party id naming
        // a member the roster does not hold. `reconcileLoadedState` is REQUIRED to throw that run
        // away — forty minutes for 75 scrap.
        const store = makeStore({ blueprints: { fenrir: 1 } });
        store.dispatch(startRun(makeRun(200)));
        const { game: ranch, run: runState } = store.getState();
        const plan = planRecruit({ ranch, run: runState.run!, node: nodeOf(runState.run!), speciesId: 'fenrir' })!;

        store.dispatch(recruitIntoParty({ memberId: plan.member.id, cards: plan.cards, price: plan.scrap }));
        // ...and the process dies here, before `assembleMingming`.

        const state = store.getState();
        expect(state.game.roster.some((m) => m.id === plan.member.id)).toBe(false);
        expect(state.run.run!.partyIds).toContain(plan.member.id);

        const [ranchSave, runSave] = envelopes(state.game, state.run.run);
        const reconciled = reconcileLoadedState(ranchSave, runSave);
        expect(reconciled.run).toBeNull();
        expect(reconciled.discarded).toBe('party-references-missing-member');
        // And the blueprint is still unspent, so the loss is the run rather than the currency —
        // which is the *smaller* half of why this ordering loses.
        expect(reconciled.ranch!.blueprints).toEqual({ fenrir: 1 });
    });

    it('the verification step stops a stale second click from charging for a refused assembly', () => {
        // Two clicks, the second carrying the props of the first render: the plan is identical (the
        // member id is a pure function of the node), `assembleMingming` refuses it for want of a
        // blueprint, and the handler's read-back means the run is never charged.
        const store = makeStore({ blueprints: { fenrir: 1 } });
        store.dispatch(startRun(makeRun(400)));

        const stale = store.getState();
        const plan = planRecruit({
            ranch: stale.game, run: stale.run.run!, node: nodeOf(stale.run.run!), speciesId: 'fenrir',
        })!;

        assembleAt(store, 'fenrir');
        const afterFirst = store.getState();

        // The second click, replayed from the stale plan exactly as the handler would.
        store.dispatch(assembleMingming(plan.member));
        const committed = store.getState().game.roster.filter((m) => m.id === plan.member.id).length;
        expect(committed).toBe(1); // the ranch refused: no blueprint left
        // ...so the handler never reaches the run half. And even if it did, the reducer refuses a
        // party id it already holds.
        store.dispatch(recruitIntoParty({ memberId: plan.member.id, cards: plan.cards, price: plan.scrap }));
        expect(store.getState().run.run).toEqual(afterFirst.run.run);
    });
});

// ---------------------------------------------------------------------------------------------
// recruitIntoParty on its own
// ---------------------------------------------------------------------------------------------

const stateOf = (run: IRunState): RunSliceState => ({ run });

describe('recruitIntoParty refuses what it cannot honour, byte-identically', () => {
    const run = makeRun(0);
    const ranch: IRanchState = { ...createEmptyRanch(), roster: ROSTER, blueprints: { fenrir: 1 } };
    const plan = planRecruit({ ranch, run, node: nodeOf(run), speciesId: 'fenrir' })!;
    const action = () => recruitIntoParty({ memberId: plan.member.id, cards: plan.cards, price: plan.scrap });

    it('refuses a recruit the run cannot afford, and changes NOTHING', () => {
        const poor = { ...run, scrap: WORKSHOP_ASSEMBLY_SCRAP - 1 };
        // Not "did not charge" — identical. A half-applied recruit (paid, no member; or a member,
        // unpaid) is the bug this reducer exists to make unrepresentable.
        expect(runReducer(stateOf(poor), action()).run).toEqual(poor);
    });

    it('affords a recruit that costs exactly the scrap held', () => {
        const exact = { ...run, scrap: WORKSHOP_ASSEMBLY_SCRAP };
        const after = runReducer(stateOf(exact), action()).run!;
        expect(after.scrap).toBe(0);
        expect(after.partyIds).toHaveLength(2);
    });

    it('refuses a fourth party member', () => {
        const full = { ...run, scrap: 500, partyIds: ['mm1', 'mm2', 'mm3'] };
        expect(runReducer(stateOf(full), action()).run).toEqual(full);
    });

    it('refuses the same member twice — the double-click guard', () => {
        const rich = { ...run, scrap: 500 };
        const once = runReducer(stateOf(rich), action());
        const twice = runReducer(once, action());
        expect(twice.run).toEqual(once.run);
        expect(twice.run!.partyIds).toHaveLength(2);
    });

    it('refuses cards whose instance ids are already in the deck', () => {
        // Two deck cards sharing an instance id would both vanish on the first removal — the
        // correctness half of the guard rather than the economy half.
        const seeded = { ...run, scrap: 500, deck: [...run.deck, plan.cards[0]] };
        expect(runReducer(stateOf(seeded), action()).run).toEqual(seeded);
    });

    it('refuses a negative, fractional or NaN price rather than paying the player to recruit', () => {
        const rich = { ...run, scrap: 500 };
        for (const price of [-10, 1.5, Number.NaN]) {
            expect(runReducer(stateOf(rich), recruitIntoParty({
                memberId: plan.member.id, cards: plan.cards, price,
            })).run).toEqual(rich);
        }
    });

    it('is a no-op with no run in progress', () => {
        const empty = runReducer(undefined, { type: '@@init' });
        expect(runReducer(empty, action()).run).toBeNull();
    });
});

// ---------------------------------------------------------------------------------------------
// The other two verbs
// ---------------------------------------------------------------------------------------------

describe('reflashing at a workshop', () => {
    /** `WorkshopNode`'s reflash handler: ranch half, verify the blueprint fell, then charge. */
    function reflash(store: Store, memberId: string, targetOS: string): void {
        const member = store.getState().game.roster.find((m) => m.id === memberId)!;
        if (store.getState().run.run!.scrap < WORKSHOP_REFLASH_SCRAP) return;
        const before = store.getState().game.blueprints[member.definitionId] ?? 0;
        if (before < 1) return;
        store.dispatch(swapOS({ id: memberId, targetOS }));
        if ((store.getState().game.blueprints[member.definitionId] ?? 0) >= before) return;
        store.dispatch(spendRunScrap(WORKSHOP_REFLASH_SCRAP));
    }

    it('spends a blueprint and the workshop’s scrap, and changes the firmware', () => {
        const store = makeStore({ blueprints: { kraken: 1 } });
        store.dispatch(startRun(makeRun(200)));

        reflash(store, 'mm1', 'kraken_v2');

        expect(store.getState().game.roster[0].activeOS).toBe('kraken_v2');
        expect(store.getState().game.blueprints).toEqual({});
        expect(store.getState().run.run!.scrap).toBe(200 - WORKSHOP_REFLASH_SCRAP);
    });

    it('charges nothing when the ranch refuses — the blueprint count is the receipt', () => {
        // Keyed on the count falling rather than on the OS reading as the target, because after a
        // double click the OS already reads as the target and "did it change?" would answer yes.
        const store = makeStore({ blueprints: { kraken: 1 } });
        store.dispatch(startRun(makeRun(200)));

        reflash(store, 'mm1', 'kraken_v2');
        const after = store.getState();
        reflash(store, 'mm1', 'kraken_v2'); // the stale second click

        expect(store.getState().game).toEqual(after.game);
        expect(store.getState().run.run!.scrap).toBe(200 - WORKSHOP_REFLASH_SCRAP);
    });

    it('leaves the deck alone — a reflash grants no cards', () => {
        const store = makeStore({ blueprints: { kraken: 1 } });
        store.dispatch(startRun(makeRun(200)));
        const deck = store.getState().run.run!.deck;

        reflash(store, 'mm1', 'kraken_v2');

        expect(store.getState().run.run!.deck).toEqual(deck);
        expect(store.getState().run.run!.partyIds).toEqual(['mm1']);
    });

    it('does not fire, and does not charge, without a blueprint', () => {
        const store = makeStore({ blueprints: {} });
        store.dispatch(startRun(makeRun(200)));
        const before = store.getState();

        reflash(store, 'mm1', 'kraken_v2');

        expect(store.getState().game).toEqual(before.game);
        expect(store.getState().run.run).toEqual(before.run.run);
    });
});

describe('stripping a card at a workshop', () => {
    it('charges the marketplace’s removal price — one sink, two counters', () => {
        const store = makeStore();
        store.dispatch(startRun(makeRun(0)));
        store.dispatch(addRunScrap(100));
        const target = store.getState().run.run!.deck.find((c) => c.dataId === GENERIC_HIT)!;
        const deckBefore = store.getState().run.run!.deck.length;

        store.dispatch(removeRunCardForScrap({ instanceId: target.instanceId, price: WORKSHOP_REMOVAL_PRICE }));

        expect(store.getState().run.run!.scrap).toBe(100 - WORKSHOP_REMOVAL_PRICE);
        expect(store.getState().run.run!.deck).toHaveLength(deckBefore - 1);
        expect(store.getState().run.run!.deck.some((c) => c.instanceId === target.instanceId)).toBe(false);
    });

    it('refuses when the run cannot afford it, without removing the card', () => {
        const run = makeRun(WORKSHOP_REMOVAL_PRICE - 1);
        const target = run.deck[0];
        const after = runReducer(
            stateOf(run),
            removeRunCardForScrap({ instanceId: target.instanceId, price: WORKSHOP_REMOVAL_PRICE }),
        ).run!;
        expect(after).toEqual(run);
    });

    it('is what an empty-handed workshop is for — it needs no blueprint at all', () => {
        // A blueprint drops from ~20% of wilds, so most workshops are entered with nothing to
        // assemble. Removal is the floor that keeps the node from being a dead one.
        const store = makeStore({ blueprints: {} });
        store.dispatch(startRun(makeRun(60)));
        const target = store.getState().run.run!.deck[0];

        store.dispatch(removeRunCardForScrap({ instanceId: target.instanceId, price: WORKSHOP_REMOVAL_PRICE }));

        expect(store.getState().run.run!.scrap).toBe(60 - WORKSHOP_REMOVAL_PRICE);
        expect(store.getState().game.blueprints).toEqual({});
    });
});

// ---------------------------------------------------------------------------------------------
// The line ticket 06 drew
// ---------------------------------------------------------------------------------------------

describe('the workshop respects the ranch/run split', () => {
    it('banks nothing run-scoped on the ranch and nothing permanent in the run', () => {
        const store = makeStore({ blueprints: { fenrir: 1 } });
        store.dispatch(startRun(makeRun(200)));
        assembleAt(store, 'fenrir');

        // The ranch gained an individual and lost a blueprint. It gained no scrap and no cards.
        expect(Object.keys(store.getState().game).sort())
            .toEqual(['blueprints', 'codex', 'codexMilestones', 'gymsCleared', 'highestTierCleared', 'roster', 'seenTips']);
        // The run gained a party member and four cards. It gained nothing that outlives it.
        store.dispatch(endRun('victory'));
        store.dispatch(clearRun());
        expect(store.getState().run.run).toBeNull();
        expect(store.getState().game.roster).toHaveLength(2);
    });
});
