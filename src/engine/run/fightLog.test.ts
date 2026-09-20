/**
 * THE TRANSCRIPTS, AND THE RETENTION THEY INHERIT — Henry, 2026-09-20.
 *
 * *"Should we instead add a log for each fight and reference it in the full log instead of one big
 * log?"* The split's whole risk is that the two stores drift: a run whose fights were evicted, or
 * fights outliving the run that made them and never collected. There is deliberately no second cap
 * to get wrong — `writeRunLog` prunes — so these are the tests that the one rule is actually
 * enforced on both stores.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    clearFightLogs, collectFightLogs, fightLogIdFor, fightLogIds, pruneFightLogs, readFightLog,
    writeFightLog,
} from './fightLog';
import { emptyRunLog, readRunLogs, writeRunLog, type IRunLog } from './runLog';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../save/storage';

class MemoryStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    read(key: string) { return this.data.get(key) ?? null; }
    write(key: string, value: string) { this.data.set(key, value); }
    remove(key: string) { this.data.delete(key); }
    keys() { return [...this.data.keys()]; }
}

const store = (runKey: string, ordinal: number, lines: string[] = ['a']): string => {
    const id = fightLogIdFor(runKey, ordinal);
    writeFightLog({ id, runKey, lines, truncated: 0 });
    return id;
};

/** A run log carrying one FIGHT_LOG row per given transcript id. */
function logWith(seed: string, startedAt: number, ids: string[]): IRunLog {
    const base = emptyRunLog(seed, startedAt);
    return {
        ...base,
        events: ids.map((logId, index) => ({
            seq: index + 1, fightIndex: index, deckSize: 10, scrap: 0,
            kind: 'FIGHT_LOG' as const, logId, lineCount: 1, truncated: 0,
        })),
    };
}

let storage: MemoryStorage;
beforeEach(() => { storage = new MemoryStorage(); setSaveStorage(storage); });
afterEach(() => { resetSaveStorage(); });

describe('a transcript per fight', () => {
    it('round-trips, and reports absence rather than throwing', () => {
        const id = store('seed@1', 1, ['opened', 'hit', 'won']);
        expect(readFightLog(id)?.lines).toEqual(['opened', 'hit', 'won']);
        expect(readFightLog('seed@1#99')).toBeNull();
    });

    it('names a transcript by WHICH fight it was, not by a row number', () => {
        // `alpha@5#3` reads as "the third fight of that run" in a key listing. A `seq` would not.
        expect(fightLogIdFor('alpha@5', 3)).toBe('alpha@5#3');
    });

    it('keeps the text out of the run log, which is the point of the split', () => {
        /*
         * The measurement that started this: a 21-turn 3v3 is 376 lines and 12.5 KB, against
         * roughly 30 KB for every other row in a whole run — and `writeRunLog` re-serialises the
         * entire log on a microtask after every dispatch. Text in the row meant re-stringifying
         * every past fight on every card play.
         */
        const lines = Array.from({ length: 376 }, (_, i) => `line ${i} of a long fight`);
        store('seed@1', 1, lines);
        writeRunLog(logWith('seed', 1, ['seed@1#1']));

        const runLogBytes = storage.data.get('mingming_run_log')!.length;
        const transcriptBytes = storage.data.get('mingming_fight_log:seed@1#1')!.length;

        expect(transcriptBytes).toBeGreaterThan(5000);
        // The run log holds a pointer and two numbers, and does not grow with the fight's length.
        expect(runLogBytes).toBeLessThan(500);
    });
});

describe('retention is the run log\'s, enforced on both stores', () => {
    it('takes a run\'s fights with it when the run is evicted', () => {
        // RUN_LOG_RUNS is 3. A fourth run pushes the first out — and its transcripts with it.
        for (let run = 1; run <= 4; run += 1) {
            const ids = [store(`seed${run}@1`, 1), store(`seed${run}@1`, 2)];
            writeRunLog(logWith(`seed${run}`, 1, ids));
        }

        expect(readRunLogs().map((log) => log.seed)).toEqual(['seed2', 'seed3', 'seed4']);
        // Six transcripts for three runs, and none belonging to the run that left.
        expect(fightLogIds()).toHaveLength(6);
        expect(fightLogIds().some((id) => id.startsWith('seed1@'))).toBe(false);
        expect(readFightLog('seed1@1#1')).toBeNull();
    });

    it('collects a transcript no run references any more', () => {
        store('orphan@1', 1);
        store('live@1', 1);
        expect(pruneFightLogs(['live@1'])).toBe(1);
        expect(fightLogIds()).toEqual(['live@1#1']);
    });

    it('clears both stores together, so a wipe leaves nothing orphaned', () => {
        store('seed@1', 1);
        clearFightLogs();
        expect(fightLogIds()).toEqual([]);
    });
});

describe('the export gathers them back into one file', () => {
    it('inlines exactly the transcripts that are referenced, and skips the missing', () => {
        // 156 §3: *"the export stays a single JSON"* — a playtester sends one file.
        store('seed@1', 1, ['kept']);
        const collected = collectFightLogs(['seed@1#1', 'seed@1#2']);

        expect(Object.keys(collected)).toEqual(['seed@1#1']);
        expect(collected['seed@1#1'].lines).toEqual(['kept']);
    });
});
