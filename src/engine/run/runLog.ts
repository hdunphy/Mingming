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
 * **2,000 since ticket 156**, and the number is arithmetic rather than taste. A real 21-turn 3v3,
 * driven through the reducer and counted: 376 log lines and 12.5 KB of text. 156 adds, per fight,
 * one `FIGHT_DECK`, one `FIGHT_LOG` and one `FIGHT_TURN` per side per turn — about 46 rows for a
 * fight that long. Fourteen of those is 644 rows, and the rest of a run's picks, purchases and
 * scrap moves is another 150 or so. At the old cap of 800 a long run would have started dropping
 * rows somewhere in its last third — and because the cap keeps the HEAD, what it would have
 * dropped is the elite that killed you and `RUN_ENDED` with it. That is the exact failure 156 was
 * opened to stop, so the cap moves with the rows that caused it.
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

import { clearFightLogs, collectFightLogs, pruneFightLogs } from './fightLog';
import { getSaveStorage } from '../save/storage';
import type { NodeKind, RunOutcome } from '../runTypes';

/** A dedicated key, sibling to `mingming_run_telemetry`. Never part of a save slot. */
export const RUN_LOG_KEY = 'mingming_run_log';

/** Bumped only if the row shape changes. An unrecognised version reads as "no logs". */
export const RUN_LOG_VERSION = 1;

/** Rows kept for one run. A full run measures a couple of hundred; see the header on the bounds. */
export const RUN_LOG_EVENT_CAP = 2000;

/** Runs kept in the store, newest last. A playtest session is a handful; three is the useful window. */
export const RUN_LOG_RUNS = 3;

/** Re-exported from `fightLog.ts`, which owns the transcripts the cap applies to. */
export { FIGHT_LOG_CAP } from './fightLog';

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
    /**
     * THE BOARD AND THE DECK THIS FIGHT WAS WALKED INTO — ticket 156 §2.
     *
     * `FIGHT_STARTED` named the enemy species and nothing else, so a run could say it lost to an
     * elite and not say what it was carrying at the time. This is the row 148/153 need: deck at
     * fight N across a run IS the progression curve, and it cannot be reconstructed afterwards
     * because every pick, purchase and removal between fights moved it.
     *
     * The deck is `dataId[]` SORTED, not in draw order — a multiset, because what is being asked
     * of it is "what was in here" and a sorted list diffs cleanly between two fights. Duplicates
     * are kept: three copies of a card is the fact.
     */
    | {
        readonly kind: 'FIGHT_DECK';
        readonly deck: ReadonlyArray<string>;
        readonly party: ReadonlyArray<{
            readonly memberId: string;
            readonly species: string;
            /** `null` where a unit runs no firmware — see the enemy note below. */
            readonly osId: string | null;
            readonly hp: number;
            readonly maxHp: number;
        }>;
        /**
         * `osId` is `null` rather than `''` on purpose. `encounter.ts` strips `activeOS` from a
         * wild whose loadout has no firmware (ticket 142b: `kraken_v1` and `kraken_v2` are
         * different fights on the same body, and a moveset enemy is a third thing) — so "no OS" is
         * a real and common answer here, and an empty string would read as a recording failure.
         */
        readonly enemies: ReadonlyArray<{ readonly species: string; readonly osId: string | null }>;
        readonly nodeKind: NodeKind;
        readonly biome: number;
    }
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
    /**
     * ONE SIDE'S TURN, AS NUMBERS — ticket 156 §2.
     *
     * The `FIGHT_LOG` row beside this one is the "what happened"; this is the "how much", and it
     * is the half a reader can aggregate. Built from the bus rather than from the board, because
     * the board only ever shows the CURRENT state and the question is what moved during the turn.
     *
     * `partyHp` is the player's side as the turn closed, so a sequence of these rows IS the
     * attrition curve at turn resolution rather than at fight resolution.
     */
    | {
        readonly kind: 'FIGHT_TURN';
        readonly turn: number;
        readonly side: 'PLAYER' | 'ENEMY';
        readonly cardsPlayed: ReadonlyArray<{
            readonly dataId: string;
            readonly casterId: string;
            readonly targetId: string;
        }>;
        /** Damage the ACTING side dealt to the other, by this turn's events. */
        readonly damageDealt: number;
        /** Damage the acting side took in its own turn — recoil, tolls and status ticks. */
        readonly damageTaken: number;
        readonly statusesApplied: ReadonlyArray<{
            readonly status: string;
            readonly stacks: number;
            readonly targetId: string;
        }>;
        readonly partyHp: Readonly<Record<string, number>>;
    }
    /**
     * A POINTER TO THE COMBAT LOG, AND ITS SHAPE — ticket 156 §2, rebuilt 2026-09-20.
     *
     * Henry: *"Do we not save the actual battle logs?"* — and then, once they were in:
     * *"Should we instead add a log for each fight and reference it in the full log instead of one
     * big log?"* He is right, and the numbers say so. The first cut put four hundred strings in
     * this row; a 21-turn 3v3 makes 376 lines and 12.5 KB, against roughly 30 KB for every other
     * row in an entire run. The transcripts were ~85% of the store — and worse, `writeRunLog`
     * re-serialises the whole log on a microtask after every dispatch, so a fight's text was being
     * re-stringified on every card play for the rest of the run.
     *
     * So the row keeps what a reader scans — how long the fight's log was, how much was truncated
     * — and carries an id into `fightLog.ts`, where the text lives under its own key and is read
     * only when somebody asks for it. The export inlines them again, so one file still goes to a
     * playtest.
     *
     * `logId` is `null` when the player has battle logs switched off: the counts are still worth
     * having (*"that fight ran 376 lines"*), and a row that vanished entirely would make the
     * setting look like a bug.
     */
    | {
        readonly kind: 'FIGHT_LOG';
        readonly logId: string | null;
        /** How many lines the transcript holds — a COUNT, not the lines. */
        readonly lineCount: number;
        /** Lines dropped off the FRONT because the fight ran past `FIGHT_LOG_CAP`. */
        readonly truncated: number;
    }
    | { readonly kind: 'SCRAP'; readonly delta: number; readonly reason: string }
    | { readonly kind: 'CARD_PICKED'; readonly dataId: string; readonly offered: ReadonlyArray<string> }
    | { readonly kind: 'CARD_SKIPPED'; readonly offered: ReadonlyArray<string> }
    | { readonly kind: 'CARD_BOUGHT'; readonly dataId: string; readonly price: number }
    | { readonly kind: 'CARD_REMOVED'; readonly dataId: string; readonly price: number }
    | { readonly kind: 'RECRUITED'; readonly definitionId: string; readonly cards: ReadonlyArray<string> }
    | { readonly kind: 'REFLASHED'; readonly memberId: string; readonly osId: string }
    /**
     * TICKET 163b — a card in the active deck became its `+` form.
     *
     * `from` and `to` rather than one id and a flag, because the row has to be readable without
     * the registry: a run read three tickets from now should say "Venom Fang -> Venom Fang+" off
     * the log alone. `price` is the field 163b asks to TUNE the band from — a gym-gate upgrade
     * records 0, which is how "how many upgrades were free" is a question the log can answer.
     */
    | { readonly kind: 'CARD_UPGRADED'; readonly from: string; readonly to: string; readonly price: number }
    /**
     * TICKET 163d — a patch was fitted to a body.
     *
     * `memberId` rather than a species, because the question 163e asks of this row is *"take-rate
     * by kind"* and the interesting cut is which BODY took which rider — a party can field two
     * Kraken-shaped problems and give them different answers.
     */
    | { readonly kind: 'PATCH_TAKEN'; readonly memberId: string; readonly patchId: string }
    | { readonly kind: 'MACRO_BOUGHT'; readonly macroId: string; readonly price: number }
    | { readonly kind: 'MACRO_WON'; readonly macroId: string; readonly replaced: string | null }
    | { readonly kind: 'MACRO_FIRED'; readonly macroId: string }
    | { readonly kind: 'REROLLED'; readonly price: number }
    /** TICKET 168a: an event node's choice was made. `eventId` is `empty_relay` for the fallback. */
    | { readonly kind: 'EVENT_RESOLVED'; readonly eventId: string; readonly choiceId: string }
    /**
     * `biomeReached` is the 0-BASED biome index. `runTelemetry`'s field of the same name is 1-based
     * ("biome 1 of 3") — both are stored, so neither is renumbered; readers add 1 to this one.
     */
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
/**
 * The longest gap between two dispatches that still counts as playing — ticket 156 §2.
 *
 * Henry's summary read *5h 01m* for a three-fight run, because `durationMs` is `endedAt -
 * startedAt` and the run sat open across a day away from the app. Active time is accumulated from
 * the gaps BETWEEN dispatches, and this is where a gap stops being a player thinking and starts
 * being a player gone: a minute covers reading a card, a shop and an unhurried turn, and anything
 * longer is not counted at all rather than counted in part.
 */
export const ACTIVE_GAP_CAP_MS = 60_000;

export interface IRunLog {
    /** `<seed>@<startedAt>`, the identity `runTelemetry` uses, so the two stores join on it. */
    readonly runKey: string;
    readonly seed: string;
    readonly startedAt: number;
    readonly events: ReadonlyArray<IRunEvent>;
    /** Rows the cap threw away. Non-zero means this transcript is incomplete — say so when reading. */
    readonly droppedEvents: number;
    /**
     * Milliseconds the player was actually playing — ticket 156 §2.
     *
     * Wall clock stays available as `endedAt - startedAt` wherever it is wanted; this is the
     * other number, and it is the one a pacing target is about. Summed from the gaps between
     * dispatches, each capped at `ACTIVE_GAP_CAP_MS`, so a laptop shut for a day adds nothing
     * and a turn spent thinking adds itself. It undercounts a player who reads without clicking,
     * which is the right direction to be wrong in for a number answering *"is a run twenty
     * minutes?"*
     */
    readonly activeMs: number;
}

// ---------------------------------------------------------------------------------------------
// Pure operations
// ---------------------------------------------------------------------------------------------

/** `<seed>@<startedAt>` — the same identity `runTelemetry.runKeyFor` mints, so logs join summaries. */
export function runLogKeyFor(seed: string, startedAt: number): string {
    return `${seed}@${startedAt}`;
}

export function emptyRunLog(seed: string, startedAt: number): IRunLog {
    return {
        runKey: runLogKeyFor(seed, startedAt), seed, startedAt, events: [], droppedEvents: 0,
        activeMs: 0,
    };
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
    /*
     * A TOP-LEVEL FIELD MUST BE LISTED HERE OR IT IS DELETED ON READ. `EventSchema` is
     * `.passthrough()`, so a new event KIND round-trips untouched and needs nothing from this
     * file — but `LogSchema` is a plain `z.object`, which strips what it does not name. A new
     * container field added only to the interface survives in memory and vanishes on the next
     * load, silently. `.default(0)` is what makes a log written before 156 still readable.
     */
    activeMs: z.number().nonnegative().default(0),
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
        /*
         * A RUN LEAVING TAKES ITS FIGHTS WITH IT, in the same operation that dropped it.
         *
         * The fight transcripts live under their own keys (`fightLog.ts`) and have no retention
         * rule of their own on purpose: a second cap would be a second thing to reason about and a
         * new way for the two stores to disagree. `RUN_LOG_RUNS` is the one rule, and this is where
         * it is enforced on the other store.
         */
        pruneFightLogs(logs.map((entry) => entry.runKey));
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
    // The two stores clear together, or a wipe leaves half a megabyte of orphaned transcripts
    // behind with nothing left that references them.
    clearFightLogs();
    try {
        getSaveStorage().remove(RUN_LOG_KEY);
    } catch {
        // A failed clear is not worth surfacing: the log is instrumentation, and the next write
        // replaces it anyway.
    }
}

/**
 * Every `FIGHT_LOG` row's `logId` in these runs, in order, skipping the nulls.
 *
 * Exported because `runRead` wants the same list when it reads a file back.
 */
export function fightLogIdsIn(logs: ReadonlyArray<IRunLog>): string[] {
    const ids: string[] = [];
    for (const log of logs) {
        for (const event of log.events) {
            if (event.kind !== 'FIGHT_LOG') continue;
            if (event.logId) ids.push(event.logId);
        }
    }
    return ids;
}

/**
 * The export payload — every stored transcript, pretty-printed. `exportedAt` is injected.
 *
 * SPLIT IN STORAGE, WHOLE ON THE WAY OUT. 156 §3 says *"the export stays a single JSON"*, and
 * that is the whole point of an export: a playtester sends one file. The combat logs live under
 * their own keys now (see `fightLog.ts`), so they are gathered back here into a `fightLogs` map
 * keyed by the same `logId` the rows carry. A transcript that has gone missing is simply absent
 * from the map, which a reader can see, rather than a null it has to special-case.
 */
export function serializeRunLogs(exportedAt: number): string {
    const logs = readRunLogs();
    return JSON.stringify({
        version: RUN_LOG_VERSION,
        exportedAt,
        logs,
        fightLogs: collectFightLogs(fightLogIdsIn(logs)),
    }, null, 2);
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
    return JSON.stringify({
        version: RUN_LOG_VERSION,
        exportedAt,
        logs: [log],
        fightLogs: collectFightLogs(fightLogIdsIn([log])),
    }, null, 2);
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
