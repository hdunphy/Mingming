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
 * > Every launch deck tags a **5-card engine: the payoff plus 4 enablers**. The STARTER opens the
 * > run with its 5 engine cards **+ 3 generics = an 8-card deck**. A mid-run RECRUIT brings ONLY
 * > its 5 engine cards, no generics. Base contribution by party size: **8 / 13 / 18** — which is
 * > also the active deck's minimum. The player's OS is active from the start.
 *
 * **Why EIGHT, and why it came back.** Draw per turn is `sum(cardDraw) - (N - 1)` across an
 * N-member party — 3 / 5 / 7 cards at one, two and three members — and tuned decks run 8-11.
 * Ticket 08 argued from that to eight: a deck small enough to be redrawn in its entirety every
 * turn makes "draw a card" and every duplicate copy stop meaning anything, and 8 was the smallest
 * deck that still felt like a deck. That argument was right, it was briefly abandoned, and it is
 * back — the opening deck is 8 again.
 *
 * **THE LINEAGE, BECAUSE IT IS THE ARGUMENT.** Ticket 08: 5 kit + 3 generics per member, recruits
 * 3 + 1. 2026-08-24: recruits 5 + 0 — the right bug, the wrong lever. Ticket 60: everyone 4 + 2.
 * 2026-08-25: generics run-level, 4 + 2 once. **2026-08-26 (this spec): a 5-card engine, 3 generics
 * for the STARTER only, recruits bare.**
 *
 * Three separate faults were fixed, one per pass, and they are worth keeping apart:
 *
 * 1. **The kit was missing its engine.** Ticket 09's tables deliberately withheld each deck's
 *    payoff so the run could "build back toward" it, which meant *"ratatoskr's startKit carried
 *    none of his engine, making him pure feed."* A kit of enablers with no payoff is a pile of
 *    setup for a card you may never draw. Fixed by tagging the payoff, first in the list.
 * 2. **The filler multiplied with the party.** At 3 generics per member, recruiting a third
 *    mingming brought a third engine AND three more `Tackle`s, so a third of what the workshop
 *    sold you was padding. Fixed by making the generics the STARTER's alone.
 * 3. **Four tagged cards was too thin to play a species with.** The intermediate 4 + 2 table
 *    solved (1) and (2) and left a solo opener at six, half of which was the same neutral hit.
 *    Fixed here: five tags, and the eight-card opener ticket 08 had reasoned its way to.
 *
 * A recruit is therefore not a lesser kind of member — it is simply not the one who carries the
 * run's filler, and it arrives with the whole engine that makes its species work.
 */
export const START_KIT_SIZE = 5;
export const RECRUIT_KIT_SIZE = 5;

/**
 * The generics the STARTER brings — three, and only the starter (Henry, 2026-08-26).
 *
 * Filler exists to stop a solo opening deck being five cards, redrawn every turn. A party that grew
 * does not need padding, it needs room, so a recruit brings its bare engine: *"a RECRUIT brings ONLY
 * its 5 engine cards. No generics for recruits."*
 *
 * There is deliberately no `RECRUIT_GENERICS`. A named constant at zero reads as a knob someone
 * might turn, and there is no such quantity — there is one starting allowance, spent at the top.
 */
export const STARTER_GENERICS = 3;

/**
 * The smallest active deck a party is allowed to edit down to: **8 / 13 / 18** at one, two and
 * three members.
 *
 * *"You can never edit below what the team itself brings — the team is the deck, as a floor."* It
 * is the party's own base contribution rather than a flat number (the earlier spec said 16), which
 * is what makes it mean something at every party size: a solo run cannot be edited to four cards
 * and call itself a deck, and a full party cannot bench two members' worth of engine and keep
 * fielding them.
 *
 * The floor is a property of the PARTY, not of what the player owns. A run that somehow holds fewer
 * cards than this — nothing today can produce one — keeps all of them; the caller handles that,
 * because "all of them" is not a number this function can know.
 */
export function minimumActiveDeck(partySize: number): number {
    if (partySize <= 0) return 0;
    return STARTER_GENERICS + START_KIT_SIZE * partySize;
}

/**
 * What a run opens with, in scrap (Henry, playtest 2026-08-24).
 *
 * 20 rather than 25: it must not silently BE a recruit. At 20 the first workshop is a real choice —
 * recruit now if the run has already paid a fight or two, or take a removal at the market instead —
 * which is the decision the opening shop was supposed to offer and could not at 0. See the
 * `scrap:` field below for the measurement this came from.
 */
export const STARTING_SCRAP = 20;

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
 *
 * **Exported since ticket 11.** `engine/run/encounter.ts` fields enemies under the same ruling
 * (ticket 08's kit fraction: a biome-1 enemy holds "the species' `startKit`"), and it has to be the
 * *same* four cards the player would get from that species, chosen by the same tags and the same
 * untagged fallback. A second implementation would drift the moment a kit was retagged.
 */
export function startKitIdsFor(
    member: Pick<IMingmingState, 'definitionId' | 'activeOS'>,
    size: number,
): string[] {
    const definition = GetMingmingData(member.definitionId);
    const os = member.activeOS ?? definition.availableOS[0];
    const tagged = definition.startKits?.[os];

    if (tagged) {
        /*
         * TICKET 60: THE SLICE IS NOW A NO-OP, AND THAT IS THE POINT.
         *
         * A tag list is exactly `START_KIT_SIZE` long and a recruit takes the same four, so this
         * takes all of them. It used to take the first three of five for a recruit, which is how
         * Ratatoskr arrived carrying `forage, forage, healing_mist` — the front of a list whose
         * engine was at the back. There is no front and back any more: four tags, all of them,
         * every time.
         *
         * The warn is a data check, not a defence. A kit of the wrong length still works — it just
         * quietly hands one species a different-sized opening than every other, which is invisible
         * in play and obvious here.
         */
        if (tagged.length !== START_KIT_SIZE && !warnedMissingKits.has(`${os}:size`)) {
            warnedMissingKits.add(`${os}:size`);
            console.warn(
                `[ticket 61] startKits["${os}"] has ${tagged.length} tags; the ratified engine ` +
                `is ${START_KIT_SIZE} (payoff + ${START_KIT_SIZE - 1} enablers). ` +
                `Using ${Math.min(tagged.length, size)}.`,
            );
        }
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
 * What ONE member contributes: its four tagged cards, and nothing else.
 *
 * `withGenerics` is a required parameter rather than an optional one with a default, and that is
 * deliberate. The generics are the starter's alone (`STARTER_GENERICS`), so every caller has to
 * state which case it is — a default would let a new call site silently deal a second helping of
 * filler, which is precisely the bug this ruling removes.
 *
 * The generic is `GENERIC_HIT` (ticket 09) — a None-element card, so no species gains STAB from it
 * and the filler is worth the same to everyone.
 */
export function startDeckFor(
    member: IMingmingState,
    stream: SeedStream,
    withGenerics: boolean,
): IRunCard[] {
    const ids = [
        ...startKitIdsFor(member, START_KIT_SIZE),
        ...(withGenerics ? Array.from({ length: STARTER_GENERICS }, () => GENERIC_HIT) : []),
    ];
    return mintCards(member, ids, stream);
}

/**
 * The `RECRUIT_KIT_SIZE` cards a mid-run recruit brings — its whole engine, no filler.
 *
 * Identical to a non-first starting member, which is the ruling stated as code: a recruit is not a
 * lesser kind of party member, it is simply never the first one. Not called by `createRun` —
 * `engine/run/workshop.ts`'s `planRecruit` (ticket 14) is its caller — but it lives here because it
 * is the same ruling, and splitting the two halves across two files is how they drift apart.
 */
export function recruitDeckFor(member: IMingmingState, stream: SeedStream): IRunCard[] {
    return mintCards(member, startKitIdsFor(member, RECRUIT_KIT_SIZE), stream);
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
    // The generics ride on the FIRST member and only the first (`STARTER_GENERICS`). A party picked
    // at run start can be one, two or three members; whichever is first carries the filler.
    party.forEach((member, index) => deck.push(...startDeckFor(member, deckStream, index === 0)));

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
        // Nothing is owned-but-unplayed at the start: the party's engines ARE the deck.
        collection: [],
        // Nobody is benched at run start: the party you picked IS the party.
        bench: [],

        /*
         * A run starts with STARTING_SCRAP, and the anti-mudflation rule is intact.
         *
         * Ticket 09 set this to 0 with the right argument — *"carrying any in would make the first
         * marketplace a function of the previous run"* — and that argument is about CARRYING, not
         * about the opening balance. A fixed grant every run carries nothing: it is the same 20
         * after a win and after a wipe, so no run can bank into the next one.
         *
         * What 0 actually cost, measured in Henry's 2026-08-24 playtest: early fights are 1-2
         * enemies at 10-15 scrap, the first things worth buying are a recruit (25) and a card
         * removal (20), and the first market or workshop arrives 1-3 fights in. So the opening
         * shop was a shop you walked past, and *"I had to farm like 7 battles to afford my 2nd
         * mingming and remove a card."* Total run income was never the problem (~210, above the
         * 150-180 ticket 56 modelled) — the run was poor exactly where the decisions are.
         */
        scrap: STARTING_SCRAP,

        macros,
        // Drivers are party-wide passives won from elites; there are none before the first fight.
        drivers: [],
        // Opt-in ascension-shaped run modifiers. Empty for the vertical slice.
        //
        // Ticket 24 briefly put an `onboarding` flag here, gating an easier first fight on whether
        // the player had seen the tips. Henry retired it (2026-08-23): the opening fight is easy in
        // EVERY run, Slay the Spire's model, so there is nothing per-player to carry and nothing to
        // couple to "Skip tips". See `isOpeningFight`.
        modifiers: [],

        // The run opens standing on the entry node with the map up. `generateRegionGraph` marks
        // that node `visited: 1` so the "entering a node triggers it" rule does not fire a fight
        // before the player has moved.
        phase: 'map',
        gauntlet: null,
        outcome: null,
        fightsResolved: 0,
        // The pity floor's counter (2026-09-01). Explicitly 0 rather than left absent: a run that
        // starts owing nothing is a fact worth writing down, and the field is optional only so that
        // saves written before the floor existed still parse.
        blueprintDryFights: 0,

        startedAt,
    };
}
