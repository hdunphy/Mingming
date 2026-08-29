/**
 * THE RUN LOG — ticket 59. What the player actually did, in order, so it can be read afterwards.
 *
 * # WHY IT EXISTS
 *
 * Henry, after the 2026-08-24 playtest: *"We should record/log everything I do in the playtest run
 * so you can analyze it later."* Every finding from that session — the mandatory card pick diluting
 * the deck past its own 20-25 gate, seven fights to afford a 25-scrap recruit, a recruit arriving
 * with three of its five kit cards — was reconstructed from **one sentence of recollection each**
 * and then confirmed by reading constants. That works for exactly one tester, who happens to own
 * the repo, and it cannot answer "how many cards did that run actually end with", "which nodes did
 * he walk", or "what was the scrap curve", because nothing wrote them down.
 *
 * # HOW IT RELATES TO `runTelemetry.ts`
 *
 * They are the summary and the transcript, and they are deliberately separate files with separate
 * keys. `runTelemetry` is ten scalars per FINISHED run, fifty runs deep — the shape you scan to see
 * whether run length is drifting. This is the row-by-row record of ONE run, three runs deep,
 * because a transcript is two orders of magnitude bigger than a summary and the useful window is
 * correspondingly shorter. Neither can be derived from the other.
 *
 * Everything `runTelemetry`'s header argues about storage applies here verbatim and is not repeated:
 * own key, through the `ISaveStorage` adapter (never `localStorage`), bounded so instrumentation
 * cannot eat the quota the ranch save depends on, no clock reads in the engine.
 *
 * # THE TWO BOUNDS, AND WHY BOTH
 *
 * `RUN_LOG_EVENT_CAP` bounds ONE run; `RUN_LOG_RUNS` bounds how many runs are kept. A single bound
 * would not do: a normal run is a couple of hundred rows, so a per-store cap large enough to hold
 * three of them is also large enough for one pathological run (a macro fired in a loop, a reroll
 * held down) to evict every other run in the store. Capping per run first means a runaway run
 * truncates itself and leaves its neighbours alone.
 *
 * When a run hits its cap the log keeps the OLDEST rows and drops the rest, recording how many in
 * `droppedEvents`. Keeping the head rather than the tail is the deliberate choice: the questions
 * this log exists to answer are about how a run *develops* — when the deck got big, where the scrap
 * went early — and a tail-window of a truncated run answers none of them while looking complete.
 * `droppedEvents` is what stops it looking complete.
 *
 * # WHAT IS NOT HERE
 *
 * Per-hit damage rows. The `damageLedger` added the same day makes them newly cheap, which is
 * exactly why the ticket names them out of scope: the questions this log must answer are
 * run-shaped, and a per-hit stream would bury them under three orders of magnitude of combat.
 */

import { z } from 'zod';

import { getSaveStorage } from '../save/storage';
import type { NodeKind, RunOutcome } from '../runTypes';

/** A dedicated key, sibling to `mingming_run_telemetry`. Never part of a save slot. */
export const RUN_LOG_KEY = 'mingming_run_log';

/** Bumped only if the row shape changes. An unrecognised version reads as "no logs". */
export const RUN_LOG_VERSION = 1;

/** Rows kept for one run. A full run measures a couple of hundred; see the header on the bounds. */
export const RUN_LOG_EVENT_CAP = 800;

/** Runs kept in the store, newest last. A playtest session is a handful; three is the useful window. */
export const RUN_LOG_RUNS = 3;

// ---------------------------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------------------------

/**
 * What every row carries, whatever kind it is.
 *
 * `deckSize` and `scrap` are stamped on EVERY row rather than emitted as their own event kinds, and
 * that is the design's one real decision. *"When did the deck get big"* and *"where did the scrap
 * go"* are questions about the shape of a curve, and a curve you have to reconstruct by interleaving
 * two event streams is a curve nobody plots. Stamped inline, every row is a sample, and both curves
 * fall out of a single pass with no joining.
 *
 * `fightIndex` is `IRunState.fightsResolved` at the time — the run's own clock, and the x-axis
 * ticket 25's gates (10-13 fights, 20-25 cards at the gauntlet) are written against.
 */
export interface IRunEventBase {
    /** Monotonic within a run, from 1. Ordering that survives a JSON round trip and a re-sort. */
    readonly seq: number;
    /** `IRunState.fightsResolved` when this happened. */
    readonly fightIndex: number;
    /** Cards in the run deck when this happened. */
    readonly deckSize: number;
    /** Scrap held when this happened. */
    readonly scrap: number;
}

export type IRunEvent = IRunEventBase & (
    | { readonly kind: 'RUN_STARTED'; readonly gymId: string; readonly tier: number; readonly party: ReadonlyArray<string> }
    | { readonly kind: 'NODE_ENTERED'; readonly nodeKind: NodeKind; readonly biome: number; readonly layer: number }
    | { readonly kind: 'FIGHT_STARTED'; readonly nodeKind: NodeKind; readonly enemies: ReadonlyArray<string> }
    | {
        readonly kind: 'FIGHT_ENDED';
        readonly turns: number;
        readonly won: boolean;
        /** Party HP as it stood when the battle closed, by member id. The attrition curve. */
        readonly partyHp: Readonly<Record<string, number>>;
    }
    /**
     * Any change to `IRunState.scrap`, with the action that caused it.
     *
     * Derived from the state delta rather than emitted per call site, which is what makes it
     * impossible to forget: a new scrap sink added next month is logged before anyone remembers
     * this file exists.
     */
    | { readonly kind: 'SCRAP'; readonly delta: number; readonly reason: string }
    | { readonly kind: 'CARD_PICKED'; readonly dataId: string; readonly offered: ReadonlyArray<string> }
    | { readonly kind: 'CARD_SKIPPED'; readonly offered: ReadonlyArray<string> }
    | { readonly kind: 'CARD_BOUGHT'; readonly dataId: string; readonly price: number }
    | { readonly kind: 'CARD_REMOVED'; readonly dataId: string; readonly price: number }
    | { readonly kind: 'RECRUITED'; readonly definitionId: string; readonly cards: ReadonlyArray<string> }
    | { readonly kind: 'REFLASHED'; readonly memberId: string; readonly osId: string }
    | { readonly kind: 'MACRO_BOUGHT'; readonly macroId: string; readonly price: number }
    | { readonly kind: 'MACRO_FIRED'; readonly macroId: string }
    | { readonly kind: 'REROLLED'; readonly price: number }
    | { readonly kind: 'RUN_ENDED'; readonly outcome: RunOutcome; readonly biomeReached: number }
);

/**
 * Everything a row needs except the four stamped fields, which the recorder fills in.
 *
 * Distributive on purpose. A plain `Omit<IRunEvent, keyof IRunEventBase>` collapses the union into
 * one object of its COMMON keys — which is `{ kind }` and nothing else — so every caller would be
 * rejected for passing the payload that makes its row worth recording. `T extends unknown ?` forces
 * the conditional to distribute across the members, and each one keeps its own fields.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type RunEventInput = DistributiveOmit<IRunEvent, keyof IRunEventBase>;

/** One run's transcript. */
export interface IRunLog {
    /** `<seed>@<startedAt>`, the identity `runTelemetry` uses, so the two stores join on it. */
    readonly runKey: string;
    readonly seed: string;
    readonly startedAt: number;
    readonly events: ReadonlyArray<IRunEvent>;
    /** Rows the cap threw away. Non-zero means this transcript is incomplete — say so when reading. */
    readonly droppedEvents: number;
}

// ---------------------------------------------------------------------------------------------
// Pure operations
// ---------------------------------------------------------------------------------------------

/** `<seed>@<startedAt>` — the same identity `runTelemetry.runKeyFor` mints, so logs join summaries. */
export function runLogKeyFor(seed: string, startedAt: number): string {
    return `${seed}@${startedAt}`;
}

export function emptyRunLog(seed: string, startedAt: number): IRunLog {
    return { runKey: runLogKeyFor(seed, startedAt), seed, startedAt, events: [], droppedEvents: 0 };
}

/**
 * Append one row. Pure, and the only place `seq` is minted.
 *
 * At the cap the row is DROPPED and counted, rather than evicting the oldest — see the header:
 * a head-truncated transcript answers the questions this log exists for, a tail-truncated one
 * does not, and `droppedEvents` is what stops the truncation being silent.
 */
export function appendRunEvent(log: IRunLog, input: RunEventInput, stamp: IRunEventBase): IRunLog {
    if (log.events.length >= RUN_LOG_EVENT_CAP) {
        return { ...log, droppedEvents: log.droppedEvents + 1 };
    }
    const event = { ...stamp, ...input } as IRunEvent;
    return { ...log, events: [...log.events, event] };
}

// ---------------------------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------------------------

/**
 * Rows are validated loosely on read: `kind` and the four stamped fields, and everything else
 * passthrough.
 *
 * A strict per-kind union here would mean this schema and `IRunEvent` are two declarations of one
 * shape, and the failure mode of that drift is the worst one available to a log — a row written by
 * a build that knew about a new event kind is thrown away by a build that does not, silently, and
 * the transcript reads as if the thing never happened. Loose beats lossy: an unknown kind survives
 * the round trip and shows up in the panel as an unknown kind, which is a thing a reader can see.
 */
const EventSchema = z.object({
    seq: z.number().int().nonnegative(),
    fightIndex: z.number().int().nonnegative(),
    deckSize: z.number().int().nonnegative(),
    scrap: z.number().int(),
    kind: z.string().min(1),
}).passthrough();

const LogSchema = z.object({
    runKey: z.string().min(1),
    seed: z.string(),
    startedAt: z.number(),
    events: z.array(EventSchema),
    droppedEvents: z.number().int().nonnegative().default(0),
});

const StoreSchema = z.object({
    version: z.literal(RUN_LOG_VERSION),
    logs: z.array(LogSchema),
});

/** Every stored transcript, oldest first. Absent, unparseable or version-mismatched reads as `[]`. */
export function readRunLogs(): IRunLog[] {
    let raw: string | null = null;
    try {
        raw = getSaveStorage().read(RUN_LOG_KEY);
    } catch {
        return [];
    }
    if (!raw) return [];
    try {
        const parsed = StoreSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) return [];
        // Through `unknown`: the schema is deliberately looser than `IRunEvent` (see its comment),
        // so the two types do not overlap enough for a direct assertion — which is the point. What
        // comes back is what was written, including rows whose `kind` this build has never heard of.
        return parsed.data.logs as unknown as IRunLog[];
    } catch {
        return [];
    }
}

/**
 * Write one transcript, replacing any earlier one with the same `runKey`.
 *
 * Replace-by-key rather than append is what makes this safe to call on every event: the current
 * run's log is rewritten in place as it grows, so a reload mid-run resumes a transcript rather than
 * starting a second one beside it. Returns false on a failed write and never throws — a full quota
 * must cost the log, never the run.
 */
export function writeRunLog(log: IRunLog): boolean {
    try {
        const existing = readRunLogs().filter((entry) => entry.runKey !== log.runKey);
        const logs = [...existing, log].slice(-RUN_LOG_RUNS);
        getSaveStorage().write(RUN_LOG_KEY, JSON.stringify({ version: RUN_LOG_VERSION, logs }));
        return true;
    } catch {
        return false;
    }
}

/** The most recently written transcript, or null. What the debug panel opens on. */
export function latestRunLog(): IRunLog | null {
    const logs = readRunLogs();
    return logs.length > 0 ? logs[logs.length - 1] : null;
}

/** Throw the transcripts away. `wipeSave` calls this; nothing in the game does. */
export function clearRunLogs(): void {
    try {
        getSaveStorage().remove(RUN_LOG_KEY);
    } catch {
        // A failed clear is not worth surfacing: the log is instrumentation, and the next write
        // replaces it anyway.
    }
}

/** The export payload — every stored transcript, pretty-printed. `exportedAt` is injected. */
export function serializeRunLogs(exportedAt: number): string {
    return JSON.stringify({ version: RUN_LOG_VERSION, exportedAt, logs: readRunLogs() }, null, 2);
}

/** One transcript by key, or null. What the auto-save writes when a run ends. */
export function findRunLog(runKey: string): IRunLog | null {
    return readRunLogs().find((log) => log.runKey === runKey) ?? null;
}

/**
 * The same payload shape as `serializeRunLogs`, holding one run.
 *
 * Same envelope on purpose — `{version, exportedAt, logs: [...]}` either way — so whoever reads
 * these does not need two parsers, and a pile of per-run files concatenates into a bulk export
 * without translation.
 */
export function serializeOneRunLog(log: IRunLog, exportedAt: number): string {
    return JSON.stringify({ version: RUN_LOG_VERSION, exportedAt, logs: [log] }, null, 2);
}

// ---------------------------------------------------------------------------------------------
// Reading it back
// ---------------------------------------------------------------------------------------------

/** One point on the two curves the panel draws. */
export interface IRunCurvePoint {
    readonly seq: number;
    readonly fightIndex: number;
    readonly deckSize: number;
    readonly scrap: number;
}

/**
 * The deck-size and scrap curves, one point per row.
 *
 * Trivial because every row is already a sample — which is the whole reason the stamped fields are
 * on `IRunEventBase` rather than being their own event kinds.
 */
export function runCurves(log: IRunLog): IRunCurvePoint[] {
    return log.events.map((e) => ({ seq: e.seq, fightIndex: e.fightIndex, deckSize: e.deckSize, scrap: e.scrap }));
}

/** Where the scrap went, biggest sink first. Answers the second of the three questions. */
export function scrapByReason(log: IRunLog): Array<{ reason: string; total: number }> {
    const totals = new Map<string, number>();
    for (const event of log.events) {
        if (event.kind !== 'SCRAP') continue;
        totals.set(event.reason, (totals.get(event.reason) ?? 0) + event.delta);
    }
    return [...totals.entries()]
        .map(([reason, total]) => ({ reason, total }))
        .sort((a, b) => a.total - b.total);
}

/** Cards taken, declined and bought. Answers the third: what did he skip. */
export function cardFlow(log: IRunLog): {
    picked: string[]; skipped: number; bought: string[]; removed: string[];
} {
    const picked: string[] = [];
    const bought: string[] = [];
    const removed: string[] = [];
    let skipped = 0;
    for (const event of log.events) {
        if (event.kind === 'CARD_PICKED') picked.push(event.dataId);
        else if (event.kind === 'CARD_SKIPPED') skipped++;
        else if (event.kind === 'CARD_BOUGHT') bought.push(event.dataId);
        else if (event.kind === 'CARD_REMOVED') removed.push(event.dataId);
    }
    return { picked, skipped, bought, removed };
}
