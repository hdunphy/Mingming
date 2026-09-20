/**
 * One transcript per fight, stored beside the run log rather than inside it — Henry, 2026-09-20.
 *
 * # WHY THIS EXISTS
 *
 * 156 §2 put the combat log into the run log as a `FIGHT_LOG` row carrying four hundred strings.
 * That worked and it was the wrong shape, and the measurement says why: a 21-turn 3v3 produces
 * **376 lines and 12.5 KB of text**, against roughly 30 KB for every other row in an entire run.
 * So the transcripts were ~85% of the store, and three runs of them came to half a megabyte of a
 * five-megabyte `localStorage` budget.
 *
 * Worse than the size was the WRITE. `runLogMiddleware` flushes the whole run log on a microtask
 * after every dispatch, and `writeRunLog` re-serialises it entirely — so a fight's transcript was
 * being re-stringified on every card play for the rest of the run.
 *
 * Henry: *"Should we instead add a log for each fight and reference it in the full log instead of
 * one big log?"* So: the row keeps the NUMBERS (how many lines, how many truncated) and carries an
 * id; the text lives under its own key and is read only when somebody actually asks for it.
 *
 * # RETENTION IS INHERITED, NOT INVENTED
 *
 * There is no second cap here. A transcript lives exactly as long as the run that produced it:
 * `writeRunLog` keeps the last `RUN_LOG_RUNS` runs, and `pruneFightLogs` deletes every transcript
 * whose run is no longer in the store. One retention rule, and it is the one already written down.
 *
 * A second number would be a second thing to reason about and a new way for the two to disagree —
 * a run present with its fights evicted, or fights outliving their run and never collected.
 *
 * # THE EXPORT STAYS ONE FILE
 *
 * 156 §3: *"the export stays a single JSON"*, and that is the whole point of the export — a
 * playtester sends one file. `serializeRunLogs` inlines the referenced transcripts into a
 * `fightLogs` map beside `logs`. Split in storage, whole on the way out.
 */

import { getSaveStorage } from '../save/storage';

/** Prefix for a single fight's transcript. `mingming_fight_log:<id>`. */
export const FIGHT_LOG_KEY_PREFIX = 'mingming_fight_log:';

/**
 * Lines of combat log kept per fight — ticket 156 §2 asks for 400.
 *
 * `IBattleState.logs` has no cap of its own and grows for the life of a battle, so this is the
 * first thing in the codebase that bounds it. Measured: a long 3v3 came in at 376 lines, so 400
 * holds all of an ordinary fight and `truncated` is non-zero only on a genuinely long one.
 */
export const FIGHT_LOG_CAP = 400;

export interface IFightLog {
    readonly id: string;
    /** The run this fight belonged to. The only thing retention keys on. */
    readonly runKey: string;
    readonly lines: ReadonlyArray<string>;
    /** Lines dropped off the FRONT because the fight ran past `FIGHT_LOG_CAP`. */
    readonly truncated: number;
}

/**
 * The id a fight's transcript is stored under, and the id its `FIGHT_LOG` row carries.
 *
 * `<runKey>#<fightOrdinal>` — the run key plus WHICH FIGHT of that run it was, counted from 1.
 *
 * Not the row's `seq`: the ordinal is derived from the transcript itself (how many `FIGHT_STARTED`
 * rows are already in it), so it survives a resumed run, it does not depend on predicting what the
 * next `seq` will be, and `alpha@1789876864980#3` reads as "the third fight of that run" in a key
 * listing rather than as a row number nobody can place.
 */
export function fightLogIdFor(runKey: string, fightOrdinal: number): string {
    return `${runKey}#${fightOrdinal}`;
}

const keyOf = (id: string): string => `${FIGHT_LOG_KEY_PREFIX}${id}`;

/**
 * Store one fight's transcript. Never throws.
 *
 * A failed write is a transcript that is simply not there, which `readFightLog` already reports as
 * absence — and the `FIGHT_LOG` row still carries the line counts, so the run log stays readable
 * and says honestly that the text is missing. Instrumentation may not break a fight ending.
 */
export function writeFightLog(log: IFightLog): boolean {
    try {
        getSaveStorage().write(keyOf(log.id), JSON.stringify(log));
        return true;
    } catch {
        return false;
    }
}

/** One fight's transcript, or `null` when it was never stored, was pruned, or will not parse. */
export function readFightLog(id: string): IFightLog | null {
    try {
        const raw = getSaveStorage().read(keyOf(id));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as IFightLog;
        return Array.isArray(parsed?.lines) ? parsed : null;
    } catch {
        return null;
    }
}

/** Every stored transcript id. */
export function fightLogIds(): string[] {
    try {
        return getSaveStorage().keys()
            .filter((key) => key.startsWith(FIGHT_LOG_KEY_PREFIX))
            .map((key) => key.slice(FIGHT_LOG_KEY_PREFIX.length));
    } catch {
        return [];
    }
}

/**
 * Delete every transcript whose run is no longer in the run-log store.
 *
 * Called from `writeRunLog`, right after it slices to `RUN_LOG_RUNS`, so the two stores cannot
 * drift apart: a run leaving takes its fights with it, in the same operation.
 *
 * Returns how many went, for the tests to assert on.
 */
export function pruneFightLogs(liveRunKeys: ReadonlyArray<string>): number {
    const live = new Set(liveRunKeys);
    let removed = 0;
    for (const id of fightLogIds()) {
        // `runKey#seq` — and a runKey is `<seed>@<startedAt>`, neither of which contains a '#'.
        const runKey = id.slice(0, id.lastIndexOf('#'));
        if (runKey && live.has(runKey)) continue;
        try {
            getSaveStorage().remove(keyOf(id));
            removed += 1;
        } catch {
            // A remove that fails leaves a transcript behind; the next prune tries again.
        }
    }
    return removed;
}

/** Every transcript, gone. The run-log wipe calls this so the two stores clear together. */
export function clearFightLogs(): void {
    for (const id of fightLogIds()) {
        try {
            getSaveStorage().remove(keyOf(id));
        } catch {
            // As above.
        }
    }
}

/**
 * The transcripts an export needs, as `{ [id]: IFightLog }`.
 *
 * Only the ids the given runs actually reference, so an export is exactly as big as the runs in
 * it — and a referenced transcript that has gone missing is simply absent from the map rather
 * than being a null the reader has to special-case.
 */
export function collectFightLogs(ids: ReadonlyArray<string>): Record<string, IFightLog> {
    const out: Record<string, IFightLog> = {};
    for (const id of ids) {
        const log = readFightLog(id);
        if (log) out[id] = log;
    }
    return out;
}
