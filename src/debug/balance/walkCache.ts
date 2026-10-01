/**
 * TICKET 170 — an on-disk cache for the long measurements, so an hours-long run can be stopped,
 * resumed and split across two processes.
 *
 * A full 30-seed ladder is hours of walking on a two-core machine. One process that dies at hour
 * five loses all five, and two processes cannot share a table that is built inside one test. This
 * stores each UNIT of work (one starter on one seed: the walk, and the gauntlets played from it) as
 * one small JSON file, written whole-or-not-at-all (temp file, then rename), and reads it back
 * instead of computing it again.
 *
 * It is OFF unless `BALANCE_CACHE_DIR` is set, so `npm run balance` behaves as it always has.
 *
 * **A cache directory is only valid for one version of the code.** The key says what was measured
 * (a label, a starter, a seed), not which commit measured it, so start a fresh directory for every
 * commit you measure (for example `/tmp/balance-cache/<short hash>`). Reusing a directory across
 * a change to the walker or the game would print numbers nobody measured.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The directory named by `BALANCE_CACHE_DIR`, or undefined when caching is off. */
export function cacheDirFromEnv(): string | undefined {
    const dir = process.env.BALANCE_CACHE_DIR;
    return dir && dir.trim() !== '' ? dir : undefined;
}

/**
 * A key as a file path under `dir`. Per part, anything that is not a letter, digit, dot, dash or
 * underscore becomes `_`, and a part made only of dots becomes `_`, so a key cannot leave `dir`.
 */
export function cachePath(dir: string, key: ReadonlyArray<string | number>): string {
    const parts = key.map((part) => {
        const clean = String(part).replace(/[^A-Za-z0-9._-]/g, '_');
        return /^\.*$/.test(clean) ? '_' : clean;
    });
    return `${join(dir, ...parts)}.json`;
}

/**
 * The cached value for `key`, or the result of `compute`, which is then cached. With `dir`
 * undefined this is just `compute()`. A file that cannot be parsed (a half-written one from a
 * killed run, which the rename makes unlikely) is recomputed rather than trusted.
 */
export function cached<T>(dir: string | undefined, key: ReadonlyArray<string | number>, compute: () => T): T {
    if (dir === undefined) return compute();
    const file = cachePath(dir, key);
    if (existsSync(file)) {
        try {
            return JSON.parse(readFileSync(file, 'utf8')) as T;
        } catch {
            // fall through and recompute
        }
    }
    const value = compute();
    mkdirSync(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(value));
    renameSync(temp, file);
    return value;
}
