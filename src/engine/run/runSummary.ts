/**
 * THE RUN SUMMARY — ticket 19 (steam-release map). What a finished run has to be able to say about
 * itself, derived from the corpse `runSlice.endRun` leaves behind.
 *
 * # WHY THIS IS AN ENGINE MODULE AND NOT A COMPONENT
 *
 * Three callers need the same numbers and they must not disagree: the summary screen the player
 * reads, the telemetry entry ticket 25 reads (`runTelemetry.ts`), and the tests that pin both. A
 * screen that computed its own totals would be a second implementation of the run's arithmetic, and
 * the first thing to drift would be the one number nobody can check afterwards — the run clock.
 *
 * Engine rules apply, and one of them shapes the API: **no `Date.now()` in `src/engine`**. The run
 * clock is therefore `endedAt - startedAt` with `endedAt` **injected**, exactly the way
 * `createRun` takes `startedAt`. A module that reads the clock cannot be tested, and a duration that
 * cannot be tested is a duration nobody should quote in a playtest report.
 *
 * # WHAT `IRunState` CAN AND CANNOT ANSWER
 *
 * `runTypes.ts` is ratified (ticket 06) and this ticket may not widen it, so every figure below is
 * derived from fields that already exist. Two of the summary's five headline numbers are therefore
 * *not* the number a naive reading of the ticket asks for, and the difference is documented at each
 * one rather than papered over:
 *
 *  - **Scrap spent is not derivable.** `IRunState.scrap` is a *balance*, not a ledger: `addRunScrap`
 *    and `spendRunScrap` both write the same field and neither keeps a running total. What is true
 *    at the end of a run is how much scrap is left in hand, so that is what `scrapRemaining` is, and
 *    the screen says "left" rather than "spent". Inventing a `scrapSpent` field would have meant
 *    changing the ratified save shape for a line of flavour text.
 *  - **The opening deck size is not derivable once the party grew.** A run opens with
 *    a run's opening size depends on how many members it started with AND on the run-level generic
 *    allowance landing on the first of them, and `IRunState` does not record how many were there at
 *    the start. What IS exact is the split by `ownerId`: `runTypes.IRunCard` reserves `ownerId: null`
 *    for cards that were "bought, drafted, or granted by an event", so **`pickedCards` is precisely
 *    the deck-building track** — every card the player chose to add — and `kitCards` is what the
 *    party walked in with. Those two are exact and they sum to the deck, which the guessed opening
 *    size would not have been.
 */

import type { IRunCard, IRunState, RunOutcome } from '../runTypes';
import { STARTER_GENERICS, START_KIT_SIZE } from './createRun';

// ---------------------------------------------------------------------------------------------
// The deck-building track's two ends
// ---------------------------------------------------------------------------------------------

/**
 * What a SOLO run opens with: one member's five engine cards plus the starter's three generics — 8.
 *
 * Renamed from `START_DECK_PER_MEMBER` on 2026-08-25, because per-member is exactly what it stopped
 * being — the generics belong to the starter alone (`STARTER_GENERICS`), so a second or third member
 * adds `START_KIT_SIZE` and no filler. A name that still said "per member" would have the summary
 * quoting eight for a party of three, which owns thirteen or eighteen.
 *
 * Derived from `createRun`'s constants rather than written as `8`, so a re-ruling moves this with it
 * instead of leaving the summary quoting a number the game stopped using — which this constant has
 * now survived four times.
 */
export const SOLO_START_DECK = START_KIT_SIZE + STARTER_GENERICS;

/**
 * `economy-session.md`, bite two: *"the run BUILDS toward the ~20-25 cards a good 3v3 deck wants."*
 *
 * These lived in `ui/screens/MarketplaceNode.tsx` until this ticket, which is where ticket 13 first
 * needed them. The summary needs the same two numbers, and an engine module may not import a
 * screen — so they move here and the marketplace re-exports them. **The summary is the one place a
 * player learns what the deck-building track was for**, so it and the shop have to quote the same
 * target or the lesson contradicts itself.
 */
export const DECK_TARGET_MIN = 20;
export const DECK_TARGET_MAX = 25;

// ---------------------------------------------------------------------------------------------
// The blueprints this run banked, recorded in `modifiers`
// ---------------------------------------------------------------------------------------------

/**
 * A blueprint banked during this run is recorded as `banked:blueprint:<speciesId>` in
 * `IRunState.modifiers`.
 *
 * **This is a record of a payment that already happened, not the payment.** Ticket 12 banks a
 * blueprint to the ranch the instant it drops (`BattleArena`'s banking effect), precisely so that a
 * dead run — or an app closed on the reward screen — still pays forward. The summary therefore has
 * nothing to pay and everything to report, and what it needs is the one thing the ranch cannot tell
 * it: *which of the blueprints sitting at the ranch came from this run*. `IRanchState.blueprints` is
 * a running count with no provenance, and diffing it would need a snapshot taken at run start that
 * nothing stores.
 *
 * **Why `modifiers` and not a new field.** Ticket 15 set this precedent for the map-reveal and the
 * argument is unchanged (see `macroRegistry.BIOME_REVEAL_PREFIX`): `runTypes.ts` is ratified with no
 * migration path, `modifiers` is already a persisted `ReadonlyArray<string>` parsed as a plain
 * string array, and its documented purpose is facts about this run. Being in the run save is also
 * exactly right for this fact — the ledger dies with the run, as it should, while the blueprints it
 * describes are already safe at the ranch.
 *
 * **Duplicates are kept.** Blueprints are consumable currency (ticket 20: `addBlueprint` stacks,
 * never dedupes), so two kraken blueprints is two entries and collapsing them would under-report
 * the run. That is the opposite of the map-reveal, where a second reveal of one biome is nothing.
 *
 * The namespaced prefix keeps it from colliding with an ascension modifier, and every reader below
 * ignores anything that is not exactly this shape.
 */
export const BLUEPRINT_BANKED_PREFIX = 'banked:blueprint:';

/** The modifier string recording that one blueprint of `speciesId` was banked this run. */
export function blueprintBankedModifier(speciesId: string): string {
    return `${BLUEPRINT_BANKED_PREFIX}${speciesId}`;
}

/**
 * Every blueprint this run banked, in drop order, duplicates included.
 *
 * Total and forgiving, for `revealedBiomesFrom`'s reason: this is called from a render, and a save
 * carrying a modifier from a future version must not take the summary down on the one screen whose
 * whole job is to reassure the player that nothing was lost.
 */
export function bankedBlueprintsFrom(modifiers: ReadonlyArray<string>): ReadonlyArray<string> {
    const out: string[] = [];
    for (const modifier of modifiers) {
        if (!modifier.startsWith(BLUEPRINT_BANKED_PREFIX)) continue;
        const speciesId = modifier.slice(BLUEPRINT_BANKED_PREFIX.length);
        if (speciesId !== '') out.push(speciesId);
    }
    return out;
}

/** The same list as counts per species — what the screen prints, since "kraken ×2" beats two rows. */
export function bankedBlueprintCounts(modifiers: ReadonlyArray<string>): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const speciesId of bankedBlueprintsFrom(modifiers)) {
        counts[speciesId] = (counts[speciesId] ?? 0) + 1;
    }
    return counts;
}

// ---------------------------------------------------------------------------------------------
// The codex's honest minimum
// ---------------------------------------------------------------------------------------------

/**
 * The card dataIds this run **held**, deduped and in first-seen order — what teardown merges into
 * `IRanchState.codex.seen`.
 *
 * **`seen` only. The seen/played distinction is ticket 31's**, and it is not a rename away: `played`
 * means "actually cast", which needs a hook inside the battle reducer that fires per resolved
 * program, and a hook in the combat path is not something a run-end screen should be adding. Ticket
 * 31 owns the codex properly — seen/played, completion payouts — and this is deliberately the least
 * that can be written without pretending to be that.
 *
 * It is also honest about its own limits: this records what the run was **holding at the end**, so a
 * card bought and later sold at a marketplace is not in it. Nothing in `IRunState` remembers a card
 * that left the deck, and inferring one is not possible from the ratified shape.
 */
export function codexSeenFrom(deck: ReadonlyArray<IRunCard>): ReadonlyArray<string> {
    const out: string[] = [];
    const held = new Set<string>();
    for (const card of deck) {
        if (held.has(card.dataId)) continue;
        held.add(card.dataId);
        out.push(card.dataId);
    }
    return out;
}

// ---------------------------------------------------------------------------------------------
// The summary itself
// ---------------------------------------------------------------------------------------------

export interface IRunSummary {
    /** Null only for a run that has not ended — `RunStateSchema` forbids `phase: 'ended'` without one. */
    readonly outcome: RunOutcome | null;
    readonly gymId: string;
    readonly tier: number;

    /** `IRunState.fightsResolved`. `exploration-map.md` targets 10-13 including the gauntlet. */
    readonly fightsResolved: number;

    readonly deckSize: number;
    /** Cards with an `ownerId` — brought by a party member, at run start or as a recruit's kit. */
    readonly kitCards: number;
    /** Cards with `ownerId: null` — bought, drafted or granted. **This is "cards picked".** */
    readonly pickedCards: number;

    /**
     * Scrap **left in hand**, not scrap spent. See the header: `IRunState` keeps a balance and no
     * ledger, so a spend total is not derivable and this ticket may not add the field.
     */
    readonly scrapRemaining: number;

    /** Species ids, duplicates included, in drop order. Already at the ranch — see the prefix note. */
    readonly blueprintsBanked: ReadonlyArray<string>;
    /** Card dataIds the run held, deduped — merged into `codex.seen` at teardown. */
    readonly codexSeen: ReadonlyArray<string>;

    readonly partySize: number;
    /** 1-based, for printing: "biome 2 of 3". Derived from the node the run ended standing on. */
    readonly biomeReached: number;
    readonly biomeName: string;

    /** `endedAt - startedAt`, floored at 0. Wall-clock: it counts time the game sat paused. */
    readonly durationMs: number;
}

/**
 * Everything the summary screen and the telemetry entry both need, from the run and one injected
 * clock reading.
 *
 * Works on any `IRunState`, not only an ended one — a mid-run call is a legal question ("what would
 * this run's summary say right now?") and the debug tools may want it. `outcome` is simply null
 * until `endRun` sets it.
 */
export function summarizeRun(run: IRunState, endedAt: number): IRunSummary {
    const here = run.nodes.find((node) => node.id === run.currentNodeId);
    const biomeIndex = here?.biomeIndex ?? 0;

    let pickedCards = 0;
    for (const card of run.deck) {
        if (card.ownerId === null) pickedCards += 1;
    }

    // Floored at 0 and guarded against a non-finite clock: a negative duration is what a system
    // clock moved backwards mid-run produces, and a negative run length in a playtest table is
    // worse than a zero because it looks like a real measurement.
    const raw = endedAt - run.startedAt;
    const durationMs = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;

    return {
        outcome: run.outcome,
        gymId: run.gymId,
        tier: run.tier,
        fightsResolved: run.fightsResolved,
        deckSize: run.deck.length,
        kitCards: run.deck.length - pickedCards,
        pickedCards,
        scrapRemaining: run.scrap,
        blueprintsBanked: bankedBlueprintsFrom(run.modifiers),
        codexSeen: codexSeenFrom(run.deck),
        partySize: run.partyIds.length,
        biomeReached: biomeIndex + 1,
        biomeName: run.biomes[biomeIndex]?.name ?? 'the region',
        durationMs,
    };
}

/**
 * `2 700 000` → `"45m 00s"`. Minutes and seconds, because the whole point of the number is to be
 * compared against `exploration-map.md`'s **35-45 minute** target, and a run that reads "0.75h"
 * cannot be.
 *
 * Hours appear only past the hour, where the target has already been missed by so much that the
 * precise seconds have stopped being the interesting part.
 */
export function formatRunDuration(durationMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    const pad = (n: number): string => String(n).padStart(2, '0');
    if (hours > 0) return `${hours}h ${pad(minutes)}m`;
    return `${minutes}m ${pad(seconds)}s`;
}
