/**
 * THE RUN CLOCK — ticket 19's playtest telemetry. **Local only, and not part of the save.**
 *
 * # WHAT THIS IS FOR
 *
 * `exploration-map.md` targets **8-10 battles plus the gauntlet = 10-13 fights, 35-45 minutes**, and
 * ticket 25's playtest has to find out whether that holds. `IRunState.fightsResolved` and
 * `startedAt` are already on the run for exactly that purpose (`runTypes.ts` says so at both
 * fields), but a run is thrown away the moment it ends — so measuring it means writing the numbers
 * down somewhere before the corpse goes.
 *
 * # WHY IT IS NOT IN THE SAVE
 *
 * `IRanchState` is ratified (ticket 06) and has no field for a run log, and this ticket may not
 * widen it. That constraint happens to agree with what the data is: a rolling measurement of how
 * long the designer's own runs take is **instrumentation**, not progress. It must never be
 * something a player can lose, sync, or be affected by, and it must never be a reason the ranch
 * fails to save.
 *
 * So it gets **its own key**, the way `AudioEngine` keeps settings under `mingming_audio` — a
 * separate key, not a separate store — and it goes **through the `ISaveStorage` adapter**
 * (`engine/save/storage.ts`) rather than touching `localStorage`. Two things fall out of that, both
 * deliberate:
 *
 *  1. **Ticket 42's file-backend swap stays free.** Steam Cloud syncs files; when `FileSaveStorage`
 *     lands behind the adapter, this module follows it with no edit.
 *  2. **`grep -rn "localStorage" src` stays clean** — the standing test that the seam is real, and
 *     the reason ticket 23 cut it before the save layer was rewritten rather than after.
 *
 * # WHY IT IS BOUNDED
 *
 * `RUN_TELEMETRY_LIMIT` entries, oldest dropped. An unbounded append-only log living in a
 * save-sized store is a leak with a slow fuse: `localStorage` is a per-origin quota shared with the
 * ranch, so the failure mode of "we never trimmed the playtest log" is **the player's ranch stops
 * saving**. A rolling window of the last 50 runs is more than ticket 25 needs (a playtest session is
 * a handful of runs) and cannot grow into the save's quota.
 *
 * # NO CLOCK READS IN HERE
 *
 * `endedAt` is injected, exactly as `createRun` takes `startedAt` and for the same reason: engine
 * modules do not read `Date.now()`, because a module that reads the clock cannot be tested
 * deterministically. The UI reads the clock once, at the moment the run ends, and passes it in.
 */

import { z } from 'zod';

import type { IRunState, RunOutcome } from '../runTypes';
import { getSaveStorage } from '../save/storage';
import { summarizeRun } from './runSummary';

/** A dedicated key, sibling to the save keys and to `mingming_audio`. Never part of a save slot. */
export const RUN_TELEMETRY_KEY = 'mingming_run_telemetry';

/**
 * The rolling window. See the header: the bound is what keeps an instrumentation log from eating
 * the quota the ranch save depends on.
 */
export const RUN_TELEMETRY_LIMIT = 50;

/** Bumped only if the entry shape changes. An unrecognised version reads as "no telemetry". */
export const RUN_TELEMETRY_VERSION = 1;

/**
 * One finished run, as ticket 25 will read it.
 *
 * Everything the ticket asked to record — outcome, duration, fights resolved, deck size, biome
 * reached, gym, tier — plus `runKey`, which is not data about the run but about this log: see
 * `recordRunEnd`.
 */
export interface IRunTelemetryEntry {
    /**
     * `<seed>@<startedAt>` — this run's identity, used only to make recording idempotent.
     *
     * The summary screen records on mount, and a run sitting at `phase: 'ended'` when the app is
     * closed comes back to that same screen on the next load (the run key is not removed until
     * teardown). Without an identity the log would gain a duplicate entry per reload, which is the
     * one way a bounded window can still lie: fifty entries describing three runs.
     */
    readonly runKey: string;
    readonly outcome: RunOutcome;
    readonly startedAt: number;
    readonly endedAt: number;
    readonly durationMs: number;
    readonly fightsResolved: number;
    readonly deckSize: number;
    /** 1-based: which of the three biomes the run ended in. */
    readonly biomeReached: number;
    readonly gymId: string;
    readonly tier: number;
}

const EntrySchema = z.object({
    runKey: z.string().min(1),
    outcome: z.enum(['victory', 'defeat', 'abandoned']),
    startedAt: z.number(),
    endedAt: z.number(),
    durationMs: z.number().min(0),
    fightsResolved: z.number().int().min(0),
    deckSize: z.number().int().min(0),
    biomeReached: z.number().int().min(1),
    gymId: z.string(),
    tier: z.number().int().min(0),
});

const LogSchema = z.object({
    version: z.literal(RUN_TELEMETRY_VERSION),
    entries: z.array(EntrySchema),
});

/** This run's identity in the log. Pure, and stable across a reload of the same ended run. */
export function runTelemetryKeyFor(run: IRunState): string {
    return `${run.seed}@${run.startedAt}`;
}

/**
 * Turn a finished run plus one injected clock reading into the entry the log stores.
 *
 * Derived through `summarizeRun` rather than by reading `IRunState` again, so the duration and the
 * fight count in a playtest table are provably the same numbers the player was shown on the summary
 * screen. Two implementations of the run clock would eventually disagree, and the log is the half
 * nobody can check afterwards.
 *
 * A run with no outcome (never ended) is recorded as `'abandoned'`: the log's `outcome` is not
 * nullable because a nullable outcome is a column every reader has to special-case, and a run that
 * reached this function without ending is, in every path that exists, one the player walked out of.
 */
export function runTelemetryEntryFor(run: IRunState, endedAt: number): IRunTelemetryEntry {
    const summary = summarizeRun(run, endedAt);
    return {
        runKey: runTelemetryKeyFor(run),
        outcome: summary.outcome ?? 'abandoned',
        startedAt: run.startedAt,
        endedAt,
        durationMs: summary.durationMs,
        fightsResolved: summary.fightsResolved,
        deckSize: summary.deckSize,
        biomeReached: summary.biomeReached,
        gymId: summary.gymId,
        tier: summary.tier,
    };
}

/**
 * Every recorded run, oldest first. Empty for anything unreadable.
 *
 * Deliberately total and silent: unparseable bytes, a version this build does not know, a schema
 * mismatch and an absent key all read as "no telemetry". This is instrumentation — there is no
 * player-visible failure to report and nothing to recover, and the alternative (throwing out of a
 * render, or reporting into `saveHealth` beside a real save failure) would make a diagnostic tool
 * into a source of alarm.
 */
export function readRunTelemetry(): ReadonlyArray<IRunTelemetryEntry> {
    let raw: string | null;
    try {
        raw = getSaveStorage().read(RUN_TELEMETRY_KEY);
    } catch {
        return [];
    }
    if (raw === null) return [];

    try {
        const parsed = LogSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data.entries : [];
    } catch {
        return [];
    }
}

/**
 * Append one finished run to the log, trimming to `RUN_TELEMETRY_LIMIT`.
 *
 * Returns whether anything was written. Two reasons it may not be, and neither is an error:
 *
 *  - **The run is already in the log** (same `runKey`). See `IRunTelemetryEntry.runKey`: recording
 *    happens when the summary mounts, and an ended run survives an app close, so this has to be
 *    idempotent per run rather than per mount. It is also what makes `StrictMode`'s double-invoked
 *    effects harmless.
 *  - **Storage refused the write.** `ISaveStorage.write` throws on a full or unavailable store, and
 *    telemetry is the last thing in the game entitled to surface that. It is swallowed here so a
 *    full quota costs a playtest data point and never the summary screen.
 */
export function recordRunEnd(entry: IRunTelemetryEntry): boolean {
    const existing = readRunTelemetry();
    if (existing.some((e) => e.runKey === entry.runKey)) return false;

    // Trim from the FRONT: the window keeps the most recent runs, because a playtest question is
    // always about the runs just played.
    const entries = [...existing, entry].slice(-RUN_TELEMETRY_LIMIT);

    try {
        getSaveStorage().write(RUN_TELEMETRY_KEY, JSON.stringify({ version: RUN_TELEMETRY_VERSION, entries }));
        return true;
    } catch {
        return false;
    }
}

/** Throw the log away. For the debug tools and for tests; nothing in the game calls it. */
export function clearRunTelemetry(): void {
    try {
        getSaveStorage().remove(RUN_TELEMETRY_KEY);
    } catch {
        // Nothing to remove either way — and a telemetry log that cannot be cleared is not a fault
        // worth propagating into a caller that has no way to act on it.
    }
}
