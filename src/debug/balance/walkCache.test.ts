/**
 * TICKET 170 — the on-disk cache that lets a long measurement be resumed and split.
 */
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { cacheDirFromEnv, cachePath, cached } from './walkCache';

const dirs: string[] = [];
const freshDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'walk-cache-'));
    dirs.push(dir);
    return dir;
};
afterEach(() => {
    vi.unstubAllEnvs();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('cached', () => {
    it('computes once and reads the file back the second time', () => {
        const dir = freshDir();
        const compute = vi.fn(() => ({ fightsWon: 2, tiers: [1, 2, 3] }));
        expect(cached(dir, ['gym', 'kraken_v1', 0], compute)).toEqual({ fightsWon: 2, tiers: [1, 2, 3] });
        expect(cached(dir, ['gym', 'kraken_v1', 0], compute)).toEqual({ fightsWon: 2, tiers: [1, 2, 3] });
        expect(compute).toHaveBeenCalledTimes(1);
    });

    it('keeps different keys apart', () => {
        const dir = freshDir();
        expect(cached(dir, ['a', 0], () => 'zero')).toBe('zero');
        expect(cached(dir, ['a', 1], () => 'one')).toBe('one');
        expect(cached(dir, ['a', 0], () => 'changed')).toBe('zero');
    });

    it('is plain compute() when there is no directory', () => {
        const compute = vi.fn(() => 7);
        expect(cached(undefined, ['x'], compute)).toBe(7);
        expect(cached(undefined, ['x'], compute)).toBe(7);
        expect(compute).toHaveBeenCalledTimes(2);
    });

    it('recomputes a file it cannot parse instead of trusting it', () => {
        const dir = freshDir();
        cached(dir, ['k'], () => 1);
        writeFileSync(cachePath(dir, ['k']), '{"half');
        expect(cached(dir, ['k'], () => 2)).toBe(2);
        expect(cached(dir, ['k'], () => 3)).toBe(2);
    });

    it('leaves no temp file behind, and puts a key in a folder per part', () => {
        const dir = freshDir();
        cached(dir, ['gym', 'fenrir_v2', 4], () => ({}));
        expect(existsSync(cachePath(dir, ['gym', 'fenrir_v2', 4]))).toBe(true);
        expect(readdirSync(join(dir, 'gym', 'fenrir_v2'))).toEqual(['4.json']);
    });

    it('cannot be walked out of its directory by a key', () => {
        const dir = freshDir();
        const path = cachePath(dir, ['..', '..', 'etc/passwd']);
        expect(path.startsWith(dir)).toBe(true);
        expect(path).not.toContain('..' + '/');
    });
});

describe('cacheDirFromEnv', () => {
    it('is undefined unless BALANCE_CACHE_DIR is set to something', () => {
        vi.stubEnv('BALANCE_CACHE_DIR', '');
        expect(cacheDirFromEnv()).toBeUndefined();
        vi.stubEnv('BALANCE_CACHE_DIR', '/tmp/x');
        expect(cacheDirFromEnv()).toBe('/tmp/x');
    });
});
