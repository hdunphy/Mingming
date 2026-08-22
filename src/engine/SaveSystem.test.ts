/**
 * Save v4 — the persistence contract, ticket 23.
 *
 * These tests drive the real module through the **storage adapter seam** (`save/storage.ts`)
 * rather than a stubbed global `localStorage`. That is deliberate: ticket 42 swaps in a file
 * backend for Steam Cloud, and a suite written against `localStorage` would have to be rewritten
 * along with it. Written against `ISaveStorage`, every assertion below stays true for any backend.
 *
 * The v1–v3 migration cases that used to live here are gone rather than updated. v4 is the floor
 * (Henry, 2026-08-21) and the thing worth asserting now is the *absence* of a repair path — see
 * "v4 is the floor".
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
    CURRENT_SAVE_VERSION,
    deleteSave,
    hasSave,
    loadGameState,
    saveRanch,
    saveRun,
} from './SaveSystem';
import { getActiveRanchKey, getActiveRunKey } from './SaveSlots';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from './save/storage';
import type { IRanchState, IRunState } from './runTypes';

// --- A backend under the test's control ------------------------------------------------------

class MemoryStorage implements ISaveStorage {
    readonly map = new Map<string, string>();
    /** Set to throw from `write`, to drive the quota/unavailable classification. */
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

let storage: MemoryStorage;

beforeEach(() => {
    storage = new MemoryStorage();
    setSaveStorage(storage);
});

afterEach(() => {
    resetSaveStorage();
});

const ranchKey = (): string => getActiveRanchKey();
const runKey = (): string => getActiveRunKey();

// --- Fixtures ---------------------------------------------------------------------------------

function makeRanch(overrides: Partial<IRanchState> = {}): IRanchState {
    return {
        roster: [
            { id: 'mm1', definitionId: 'kraken', nickname: 'Bubbles', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 8, hpIV: 12 },
            { id: 'mm2', definitionId: 'fenrir', activeOS: 'fenrir_v1', attackIV: 3, defenseIV: 31, hpIV: 0 },
        ],
        blueprints: { kraken: 2, fenrir: 1 },
        codex: { seen: ['prog_a'], played: ['prog_a'] },
        gymsCleared: ['gym_water'],
        highestTierCleared: 1,
        seenTips: [],
        ...overrides,
    };
}

function makeRun(overrides: Partial<IRunState> = {}): IRunState {
    return {
        seed: 'seed-1',
        gymId: 'gym_water',
        biomes: [
            { id: 'b0', name: 'Ember Flats', elements: ['Fire'] },
            { id: 'b1', name: 'Tidewrack', elements: ['Water'] },
            { id: 'b2', name: 'Rootfall', elements: ['Nature'] },
        ],
        nodes: [
            { id: 'n0', kind: 'wild', biomeIndex: 0, layer: 0, pocket: false, edges: ['n1'], visited: 1 },
            { id: 'n1', kind: 'marketplace', biomeIndex: 0, layer: 1, pocket: false, edges: ['n0'], visited: 0 },
        ],
        currentNodeId: 'n0',
        partyIds: ['mm1'],
        deck: [{ instanceId: 'c1', dataId: 'prog_a', ownerId: 'mm1' }],
        scrap: 40,
        macros: [null, null, null],
        drivers: [],
        tier: 0,
        modifiers: [],
        phase: 'map',
        gauntlet: null,
        outcome: null,
        fightsResolved: 2,
        startedAt: 1_700_000_000_000,
        ...overrides,
    };
}

// --- Round trip -------------------------------------------------------------------------------

describe('saveRanch / saveRun round-trip', () => {
    it('restores a ranch byte-for-byte', () => {
        const ranch = makeRanch();
        expect(saveRanch(ranch).success).toBe(true);

        const loaded = loadGameState();
        expect(loaded.error).toBeUndefined();
        expect(loaded.ranch).toEqual(ranch);
        expect(loaded.run).toBeNull();
    });

    it('an in-progress run survives a restart at the same node and seed', () => {
        // The headline requirement of ticket 23: closing the app mid-run must not cost the run.
        saveRanch(makeRanch());
        expect(saveRun(makeRun()).success).toBe(true);

        const loaded = loadGameState();
        expect(loaded.discarded).toBeUndefined();
        expect(loaded.run?.seed).toBe('seed-1');
        expect(loaded.run?.currentNodeId).toBe('n0');
        expect(loaded.run?.scrap).toBe(40);
    });

    it('writes the two keys independently — a ranch save does not touch the run key', () => {
        saveRanch(makeRanch());
        saveRun(makeRun());
        const runBytes = storage.read(runKey());

        saveRanch(makeRanch({ highestTierCleared: 2 }));
        expect(storage.read(runKey())).toBe(runBytes);
    });

    it('saveRun(null) REMOVES the run key rather than writing a null envelope', () => {
        saveRanch(makeRanch());
        saveRun(makeRun());
        expect(storage.read(runKey())).not.toBeNull();

        expect(saveRun(null).success).toBe(true);
        // Absence, not a stored null: "no run" then has exactly one representation, which is the
        // same one a fresh player produces.
        expect(storage.read(runKey())).toBeNull();
        expect(loadGameState().run).toBeNull();
    });
});

// --- v4 is the floor --------------------------------------------------------------------------

describe('v4 is the floor — a pre-v4 blob is a NEW PLAYER, not a corrupt one', () => {
    it('reads a v3 save as no save at all, with no error reported', () => {
        // The distinction is load-bearing. Ticket 04's loader treats a reported error as damage and
        // clings to the last good bytes; a v3 save is meant to be abandoned, so reporting it as
        // corruption would be exactly wrong.
        storage.write(ranchKey(), JSON.stringify({
            version: 3,
            roster: [],
            activeParty: [],
            cardInventory: [],
            activeDeck: null,
            scrapCount: 250,
        }));

        const loaded = loadGameState();
        expect(loaded.ranch).toBeNull();
        expect(loaded.error).toBeUndefined();
    });

    it('checks the version BEFORE the schema, so ordering is what produces that result', () => {
        // A v3 blob also fails `RanchSaveSchema`. If the parse ran first it would surface as an
        // error. This asserts the ordering, not just the outcome.
        storage.write(ranchKey(), JSON.stringify({ version: 3, garbage: true }));
        expect(loadGameState().error).toBeUndefined();
    });

    it('still reports genuinely corrupt bytes as corruption', () => {
        storage.write(ranchKey(), '{ not json');
        const loaded = loadGameState();
        expect(loaded.ranch).toBeNull();
        expect(loaded.error).toContain('Corrupted save data');
    });

    it('reports a v4 envelope that fails the ranch schema as an error', () => {
        storage.write(ranchKey(), JSON.stringify({
            version: CURRENT_SAVE_VERSION,
            ranch: { roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 99, defenseIV: 0, hpIV: 0 }] },
        }));
        const loaded = loadGameState();
        expect(loaded.ranch).toBeNull();
        expect(loaded.error).toContain('attackIV');
    });
});

// --- Reconciliation ---------------------------------------------------------------------------

describe('a corrupt run costs the run and nothing else', () => {
    it('keeps the ranch and reports the discard when the run bytes are unparseable', () => {
        const ranch = makeRanch();
        saveRanch(ranch);
        storage.write(runKey(), '{ not json');

        const loaded = loadGameState();
        expect(loaded.ranch).toEqual(ranch);
        expect(loaded.run).toBeNull();
        expect(loaded.discarded).toBe('run-schema-invalid');
    });

    it('keeps the ranch when the run fails its schema', () => {
        saveRanch(makeRanch());
        storage.write(runKey(), JSON.stringify({ version: CURRENT_SAVE_VERSION, run: { seed: 'x' } }));

        const loaded = loadGameState();
        expect(loaded.ranch).not.toBeNull();
        expect(loaded.discarded).toBe('run-schema-invalid');
    });

    it('discards a run whose party points at a member the ranch does not have', () => {
        saveRanch(makeRanch({ roster: [] }));
        saveRun(makeRun());

        const loaded = loadGameState();
        expect(loaded.ranch).not.toBeNull();
        expect(loaded.discarded).toBe('party-references-missing-member');
    });

    it('discards a run whose party holds two of the same species', () => {
        saveRanch(makeRanch({
            roster: [
                { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 1, defenseIV: 1, hpIV: 1 },
                { id: 'mm2', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 2, defenseIV: 2, hpIV: 2 },
            ],
        }));
        saveRun(makeRun({ partyIds: ['mm1', 'mm2'] }));

        const loaded = loadGameState();
        expect(loaded.ranch).not.toBeNull();
        expect(loaded.discarded).toBe('party-has-duplicate-species');
    });

    it('a run with no ranch is nothing, since every party id points into the roster', () => {
        saveRun(makeRun());
        const loaded = loadGameState();
        expect(loaded.ranch).toBeNull();
        expect(loaded.run).toBeNull();
    });
});

// --- `.default()`, never `.catch()` ------------------------------------------------------------

describe('malformed persistent currency FAILS rather than emptying itself', () => {
    it('rejects a negative blueprint count instead of parsing it away as {}', () => {
        // v3 used `.catch([])` here. Under `.catch` this loaded clean with an EMPTY inventory and
        // the next autosave wrote that emptiness over the good save. Blueprints are the only
        // persistent currency in the game, so that is unrecoverable data loss.
        storage.write(ranchKey(), JSON.stringify({
            version: CURRENT_SAVE_VERSION,
            ranch: { ...makeRanch(), blueprints: { kraken: -1 } },
        }));
        const loaded = loadGameState();
        expect(loaded.ranch).toBeNull();
        expect(loaded.error).toContain('blueprints');
    });

    it('still fills a MISSING optional field, which is what `.default()` is for', () => {
        storage.write(ranchKey(), JSON.stringify({
            version: CURRENT_SAVE_VERSION,
            ranch: { roster: [] },
        }));
        const loaded = loadGameState();
        expect(loaded.ranch).toEqual({
            roster: [],
            blueprints: {},
            codex: { seen: [], played: [] },
            gymsCleared: [],
            highestTierCleared: 0,
            // Ticket 24's added field, filled by its `.default([])` — which is the whole reason it
            // needed no version bump: a v4 save written before tips existed is a player who has
            // seen none.
            seenTips: [],
        });
    });
});

// --- Write failures ---------------------------------------------------------------------------

describe('a bad write never overwrites a good save', () => {
    it('refuses a schema-invalid ranch and leaves the stored bytes untouched', () => {
        saveRanch(makeRanch());
        const good = storage.read(ranchKey());

        const result = saveRanch({ ...makeRanch(), highestTierCleared: -5 });
        expect(result.success).toBe(false);
        expect(result.kind).toBe('validation');
        expect(storage.read(ranchKey())).toBe(good);
    });

    it('classifies a Chrome-style full quota as `quota`', () => {
        storage.failWith = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
        const result = saveRanch(makeRanch());
        expect(result.kind).toBe('quota');
    });

    it('classifies a Firefox-style full quota as `quota` too', () => {
        storage.failWith = Object.assign(new Error('persistent storage maximum size reached'), {
            name: 'NS_ERROR_DOM_QUOTA_REACHED',
        });
        expect(saveRanch(makeRanch()).kind).toBe('quota');
    });

    it('classifies an unavailable backend as `storage`, not `quota`', () => {
        storage.failWith = new Error('Storage is unavailable');
        const result = saveRanch(makeRanch());
        expect(result.kind).toBe('storage');
    });
});

// --- Removal ----------------------------------------------------------------------------------

describe('deleteSave / hasSave', () => {
    it('hasSave asks about the ranch — a run without one is meaningless', () => {
        expect(hasSave()).toBe(false);
        saveRanch(makeRanch());
        expect(hasSave()).toBe(true);
    });

    it('deleteSave wipes BOTH keys', () => {
        saveRanch(makeRanch());
        saveRun(makeRun());

        deleteSave();

        expect(storage.read(ranchKey())).toBeNull();
        expect(storage.read(runKey())).toBeNull();
        expect(hasSave()).toBe(false);
    });
});
