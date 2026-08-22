/**
 * RUN CREATION — ticket 09. Turns "this gym, this party, this seed" into a live `IRunState`.
 *
 * Everything a run needs is decided here and nowhere else: the region graph (delegated to ticket
 * 07's `generateRegionGraph`), the starting deck (ticket 08's ruled kit rule, below), and the
 * run-scoped economy's zero point. After this returns, the run is a pure function of its seed plus
 * the player's choices, which is what ticket 23 needs in order to resume a mid-run app close from
 * one stored seed string.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random`, and —
 * pointedly — **no `Date.now()`**. `startedAt` is injected. A module that reads the clock cannot be
 * tested deterministically, and `IRunState` is deep-compared in tests card instance id by card
 * instance id.
 */

import { SeedStream } from '../core/SeedStream';
import { GENERIC_HIT, GetMingmingData, getDeckForOS } from '../data/mingmingRegistry';
import type { IMingmingState } from '../types';
import type { IRunCard, IRunState, MacroSlots } from '../runTypes';
import { generateRegionGraph } from './regionGraph';
import type { IGymOffer } from './gyms';

// ---------------------------------------------------------------------------------------------
// The start-deck rule (ticket 08, RULED by Henry 2026-08-21)
// ---------------------------------------------------------------------------------------------

/**
 * > Start deck = **8 cards: 5 `startKit`-tagged cards from the member's species x OS deck list +
 * > 3 generic None-element hits**. A recruit joins with **4: 3 `startKit` cards + 1 generic**. The
 * > player's OS is active from the start.
 *
 * **Why 8 and not a literal fraction of the tuned deck**, since the number looks arbitrary and is
 * not. Draw per turn is `sum(cardDraw) - (N - 1)` across an N-member party, which is 3 / 5 / 7
 * cards at one, two and three members, and tuned decks run 8-11 cards. So a *tuned* solo deck
 * cycles itself about every three turns — enough that a draw is a draw and not a script.
 *
 * A one-third kit (3 cards) held solo would be redrawn in its entirety every single turn: zero
 * variance, and every "draw a card" and every duplicate copy in the list becomes literally
 * meaningless. 8 is the smallest number that keeps a solo opening deck feeling like a deck while
 * still being clearly weaker than the tuned list the run builds back toward
 * (`economy-session.md`, bite two: "the run BUILDS toward the ~20-25 cards a good 3v3 deck wants").
 *
 * Recruits get the shorter kit because they arrive mid-run into a deck that is already growing —
 * the shared pool they join is not empty, so their contribution is a seed rather than a starter.
 */
export const START_KIT_SIZE = 5;
export const START_GENERICS = 3;
export const RECRUIT_KIT_SIZE = 3;
export const RECRUIT_GENERICS = 1;

/**
 * Species already warned about for missing `startKits`, so a three-member debug party of untagged
 * species does not print the same line three times per run.
 */
const warnedMissingKits = new Set<string>();

/**
 * Resolve the ids a member contributes from its own species, before generics.
 *
 * `activeOS` falls back to `definition.availableOS[0]` — deliberately the same rule `getDeckForOS`
 * and `initializeBattleEntity` already use, so a member with no OS chosen resolves to the same
 * firmware everywhere rather than to a different one per subsystem.
 *
 * **Duplicates are meaningful and the order is transcribed, not sorted or deduped.** Ticket 09's
 * kits say so explicitly in their own comments — `fenrir_v1` keeps *both* `blood_rite` copies
 * because "one copy is a coin flip and two is an engine", `jormungandr_v1` doubles `undertow`
 * because its OS counts Water cards drawn. Deduping a kit would silently delete the design.
 *
 * **The untagged fallback.** Only the six launch species (`LAUNCH_SPECIES`) carry `startKits`
 * today; the other ten get theirs when their decks ship, and `IMingmingDefinition.startKits` is
 * optional for exactly that reason. Those ten are still reachable — the balance harness and debug
 * scenarios can field anything in the registry — so an untagged species must produce a plausible
 * deck rather than throw or hand back an empty one. Taking the first `START_KIT_SIZE` ids of the
 * tuned deck is the honest approximation: it is the same list the tags are chosen *from*, just
 * without anyone having chosen. The `console.warn` is what keeps that from being mistaken for a
 * ruled kit when someone reads a playtest log.
 */
function kitIdsFor(member: IMingmingState, size: number): string[] {
    const definition = GetMingmingData(member.definitionId);
    const os = member.activeOS ?? definition.availableOS[0];
    const tagged = definition.startKits?.[os];

    if (tagged) {
        // Recruits take the FIRST `RECRUIT_KIT_SIZE` of the ruled five (Henry, ticket 09 data
        // note) rather than a random three — the kits are written front-loaded, with the card the
        // OS needs from turn one first, so the first three are already the right three.
        return tagged.slice(0, size);
    }

    if (!warnedMissingKits.has(member.definitionId)) {
        warnedMissingKits.add(member.definitionId);
        console.warn(
            `[ticket 08] No startKits tags for species "${member.definitionId}" (OS "${os}"); ` +
            `falling back to the first ${START_KIT_SIZE} cards of its tuned deck. Only the six ` +
            `launch species are tagged today.`,
        );
    }
    return getDeckForOS(member.definitionId, os).slice(0, START_KIT_SIZE).slice(0, size);
}

/**
 * Mint run cards for one member. `ownerId` is the member's roster instance id — `runTypes.ts` keeps
 * it as write-only bookkeeping against the day a member can leave the party mid-run, and it is what
 * the tests read to prove a three-member deck was built from three different members.
 *
 * Instance ids come from the shared `SeedStream`, never `crypto.randomUUID()`, so a run and its
 * replay produce byte-identical decks.
 */
function mintCards(member: IMingmingState, dataIds: ReadonlyArray<string>, stream: SeedStream): IRunCard[] {
    return dataIds.map((dataId): IRunCard => ({
        instanceId: stream.nextId('card'),
        dataId,
        ownerId: member.id,
    }));
}

/**
 * The 8 cards a starting party member brings: 5 kit + 3 generics.
 *
 * The generic is `GENERIC_HIT` (ticket 09) — a None-element card, so no species gains STAB from it
 * and the filler is worth the same to everyone.
 */
export function startDeckFor(member: IMingmingState, stream: SeedStream): IRunCard[] {
    const ids = [
        ...kitIdsFor(member, START_KIT_SIZE),
        ...Array.from({ length: START_GENERICS }, () => GENERIC_HIT),
    ];
    return mintCards(member, ids, stream);
}

/**
 * The 4 cards a mid-run recruit brings: the first 3 kit cards + 1 generic. Not called by
 * `createRun` — the workshop node (ticket 14) is its caller — but it lives here because it is the
 * same ruling, and splitting the two halves of ticket 08 across two files is how they drift apart.
 */
export function recruitDeckFor(member: IMingmingState, stream: SeedStream): IRunCard[] {
    const ids = [
        ...kitIdsFor(member, RECRUIT_KIT_SIZE),
        ...Array.from({ length: RECRUIT_GENERICS }, () => GENERIC_HIT),
    ];
    return mintCards(member, ids, stream);
}

// ---------------------------------------------------------------------------------------------
// createRun
// ---------------------------------------------------------------------------------------------

export interface CreateRunInput {
    readonly seed: string;
    readonly offer: IGymOffer;
    /** 1-3 members, already species-unique. `reconcileLoadedState` enforces both laws at load. */
    readonly party: ReadonlyArray<IMingmingState>;
    /** Epoch ms, injected by the caller. See the header note on why this is not read here. */
    readonly startedAt: number;
}

/**
 * Build the initial `IRunState`. Pure, and deterministic in `input` — including card instance ids.
 */
export function createRun(input: CreateRunInput): IRunState {
    const { seed, offer, party, startedAt } = input;

    // The graph forks its own labelled child off `seed` internally, so passing the raw run seed is
    // correct here and does not collide with the deck stream below.
    const graph = generateRegionGraph(seed);

    // A labelled fork for deck minting, for the same reason: card instance ids must not be drawn
    // from the same point in the thread as the graph's layout rolls.
    const deckStream = new SeedStream(new SeedStream(seed).fork('start-deck'));

    const deck: IRunCard[] = [];
    for (const member of party) deck.push(...startDeckFor(member, deckStream));

    // `macros-and-drivers.md`: three fixed slots (`MACRO_SLOTS`), all empty at run start. Written
    // as a literal rather than built from the constant because `MacroSlots` is a fixed-length
    // tuple, and a tuple built by `Array.from` needs a cast that would hide a genuine mismatch if
    // the slot count ever changed. The annotation is the check instead: change `MacroSlots` and
    // this line stops compiling.
    const macros: MacroSlots = [null, null, null];

    return {
        // Stored verbatim: the graph, the offer screen that produced this run, and every future
        // node roll all derive from this one string (ticket 23's resume contract).
        seed,

        gymId: offer.gym.id,
        // `exploration-map.md`: tier is chosen at run start and never changes mid-run. It comes
        // from the gym because at Early Access the gym IS the difficulty selection — all three
        // launch leaders are tier 0, so this is a single value today and a real choice later.
        tier: offer.gym.tier,
        biomes: offer.biomes,

        nodes: graph.nodes,
        currentNodeId: graph.entryNodeId,

        partyIds: party.map((m) => m.id),
        deck,

        // Ticket 09: a run starts with NO scrap. Scrap is run-scoped and resets with the run
        // (`economy-session.md`, the anti-mudflation line) — carrying any in would make the first
        // marketplace a function of the previous run.
        scrap: 0,

        macros,
        // Drivers are party-wide passives won from elites; there are none before the first fight.
        drivers: [],
        // Opt-in ascension-shaped run modifiers. Empty for the vertical slice.
        modifiers: [],

        // The run opens standing on the entry node with the map up. `generateRegionGraph` marks
        // that node `visited: 1` so the "entering a node triggers it" rule does not fire a fight
        // before the player has moved.
        phase: 'map',
        gauntlet: null,
        outcome: null,
        fightsResolved: 0,

        startedAt,
    };
}
