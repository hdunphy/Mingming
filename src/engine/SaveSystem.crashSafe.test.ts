/**
 * Ticket 04 (steam-release map): autosave must never write a save that fails validation, and a
 * quota / write failure must not lose progress.
 *
 * The guarantee under test is an *ordering* one — validate, then serialize, then write — so every
 * case here asserts the same thing from a different angle: after the failure, what you can still
 * LOAD is the last state that was known good. `SaveSystem.test.ts` covers the classification of
 * each failure kind; this file covers what survives one.
 *
 * Ticket 23 moved these from the single v3 blob to save v4's two keys, which adds a case the blob
 * could not have: a failing run write must leave the *ranch* alone. That is the entire argument
 * for splitting the keys, so it is asserted directly.
 *
 * The reporting half (a failed write becoming visible to the player) lives in
 * `src/ui/store/saveHealth.test.ts`; the engine has no business importing from `src/ui`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadGameState, saveRanch, saveRun } from './SaveSystem';
import { getActiveRanchKey } from './SaveSlots';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from './save/storage';
import type { IRanchState, IRunState } from './runTypes';

class FlakyStorage implements ISaveStorage {
    readonly map = new Map<string, string>();
    /** When set, `write` throws this instead of storing. */
    failWith: unknown = null;

    read(key: string): string | null {
        return this.map.get(key) ?? null;
    }
    write(key: string, value: string): void {
        if (this.failWith !== null) throw this.failWith;
        this.map.set(key, value);
    }
    remove(key: string): void {
        this.map.delete(key);
    }
    keys(): string[] {
        return [...this.map.keys()];
    }
}

let storage: FlakyStorage;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    storage = new FlakyStorage();
    setSaveStorage(storage);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    consoleError.mockRestore();
    resetSaveStorage();
});

function goodRanch(overrides: Partial<IRanchState> = {}): IRanchState {
    return {
        roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 5, defenseIV: 5, hpIV: 5 }],
        blueprints: { kraken: 3 },
        codex: { seen: [], played: [] },
        gymsCleared: [],
        highestTierCleared: 0,
        seenTips: [],
        ...overrides,
    };
}

function goodRun(overrides: Partial<IRunState> = {}): IRunState {
    return {
        seed: 'seed-1',
        gymId: 'gym_water',
        biomes: [
            { id: 'b0', name: 'A', elements: ['Fire'] },
            { id: 'b1', name: 'B', elements: ['Water'] },
            { id: 'b2', name: 'C', elements: ['Nature'] },
        ],
        nodes: [{ id: 'n0', kind: 'wild', biomeIndex: 0, layer: 0, pocket: false, edges: [], visited: 1 }],
        currentNodeId: 'n0',
        partyIds: ['mm1'],
        deck: [],
        scrap: 10,
        macros: [null, null, null],
        drivers: [],
        tier: 0,
        modifiers: [],
        phase: 'map',
        gauntlet: null,
        outcome: null,
        fightsResolved: 0,
        startedAt: 1,
        ...overrides,
    };
}

describe('a refused write leaves the loadable state exactly as it was', () => {
    it('a schema-invalid ranch never reaches the backend', () => {
        saveRanch(goodRanch());

        // `highestTierCleared` cannot be negative. Nothing is written, so the last good bytes stand.
        const result = saveRanch(goodRanch({ highestTierCleared: -1 }));

        expect(result.success).toBe(false);
        expect(result.kind).toBe('validation');
        expect(loadGameState().ranch).toEqual(goodRanch());
    });

    it('an IV outside 0–31 is refused rather than clamped', () => {
        saveRanch(goodRanch());
        const result = saveRanch(goodRanch({
            roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 32, defenseIV: 5, hpIV: 5 }],
        }));

        expect(result.success).toBe(false);
        expect(loadGameState().ranch?.roster[0].attackIV).toBe(5);
    });

    it('a backend that throws mid-write leaves the previous bytes intact', () => {
        saveRanch(goodRanch());
        const before = storage.read(getActiveRanchKey());

        storage.failWith = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
        const result = saveRanch(goodRanch({ highestTierCleared: 9 }));

        expect(result.success).toBe(false);
        expect(storage.read(getActiveRanchKey())).toBe(before);
        expect(loadGameState().ranch?.highestTierCleared).toBe(0);
    });

    it('says so loudly — a packaged build has no console anyone reads, so this feeds the banner', () => {
        storage.failWith = new Error('nope');
        saveRanch(goodRanch());
        expect(consoleError).toHaveBeenCalled();
    });
});

describe('two keys means a failing run write cannot cost the ranch', () => {
    it('leaves the ranch loadable when the run write throws', () => {
        saveRanch(goodRanch());

        storage.failWith = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
        const result = saveRun(goodRun());

        expect(result.success).toBe(false);
        // The whole point of the split (Henry, 2026-08-21): the blast radius of a failed run write
        // stops at the run. Under the v3 single blob this same failure took the roster with it.
        expect(loadGameState().ranch).toEqual(goodRanch());
    });

    it('refuses a run whose currentNodeId matches no node, without touching the ranch', () => {
        saveRanch(goodRanch());
        const result = saveRun(goodRun({ currentNodeId: 'nowhere' }));

        expect(result.success).toBe(false);
        expect(result.kind).toBe('validation');
        expect(loadGameState().ranch).toEqual(goodRanch());
        expect(loadGameState().run).toBeNull();
    });
});
