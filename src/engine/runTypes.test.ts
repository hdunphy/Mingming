/**
 * PROTOTYPE tests — ticket 06. These exist so Henry can see the schema's *claims* fail when they
 * should, not to cover a shipped system. When ticket 23 lands the ratified shape in
 * `SaveSystem.ts`, these move with it.
 *
 * Each case here is a rule from the design docs expressed as a failing save.
 */

import { describe, expect, it } from 'vitest';

import {
    RanchSaveSchema,
    RunSaveSchema,
    RunStateSchema,
    isSupportedSaveVersion,
    reconcileLoadedState,
} from './runTypes';

// The fixtures below are deliberately typed as loose records rather than as `IRunState` /
// `IPlayerSaveV4`. These are *schema inputs* — the point is to hand the parser malformed data and
// watch it refuse, which the domain types exist to make impossible to express.
type Fixture = Record<string, unknown>;

/** Mono by default — ticket 05's EA shape. Pass a second element for the deferred pair shape. */
function biome(i: number, ...elements: string[]) {
    return { id: `b${i}`, name: `Biome ${i}`, elements };
}

function run(overrides: Fixture = {}) {
    return {
        seed: 'seed-0001',
        gymId: 'gym_emberfall',
        biomes: [biome(0, 'Fire'), biome(1, 'Water'), biome(2, 'Nature')],
        nodes: [
            { id: 'n0', kind: 'wild', biomeIndex: 0, edges: ['n1'], x: 0, y: 0, visited: 1 },
            { id: 'n1', kind: 'gym', biomeIndex: 2, edges: [], x: 1, y: 0, visited: 0 },
        ],
        currentNodeId: 'n0',
        partyIds: ['m1'],
        deck: [{ instanceId: 'c1', dataId: 'ember_strike', ownerId: 'm1' }],
        scrap: 40,
        macros: ['surge', null, null],
        drivers: [],
        tier: 0,
        modifiers: [],
        phase: 'map',
        gauntlet: null,
        outcome: null,
        fightsResolved: 3,
        startedAt: 1_787_000_000_000,
        ...overrides,
    };
}

function member(id: string, definitionId: string) {
    return { id, definitionId, activeOS: `${definitionId}_v1`, attackIV: 15, defenseIV: 15, hpIV: 15 };
}

describe('RunStateSchema — the run-shape rulings', () => {
    it('accepts a well-formed run', () => {
        expect(RunStateSchema.safeParse(run()).success).toBe(true);
    });

    it('requires exactly three biomes (exploration-map.md)', () => {
        expect(RunStateSchema.safeParse(run({ biomes: [biome(0, 'Fire')] })).success).toBe(false);
        expect(
            RunStateSchema.safeParse(
                run({ biomes: [...(run().biomes as unknown[]), biome(3, 'Dark')] }),
            ).success,
        ).toBe(false);
    });

    it('accepts MONO biomes — ticket 05 ruled one element each at EA launch', () => {
        expect(RunStateSchema.safeParse(run()).success).toBe(true);
        expect((run().biomes as Array<{ elements: string[] }>)[0].elements).toEqual(['Fire']);
    });

    it('still accepts TWO-element biomes, so the deferred pair shape needs no save break', () => {
        // Ticket 05 defers two-element biomes rather than cancelling them, and save v4 has no
        // migration path — so the schema has to admit the later shape today or a post-launch patch
        // would have to wipe real players' runs.
        const paired = [biome(0, 'Fire', 'Earth'), biome(1, 'Water', 'Ice'), biome(2, 'Nature', 'Air')];
        expect(RunStateSchema.safeParse(run({ biomes: paired })).success).toBe(true);
    });

    it('rejects a biome with no elements, or three', () => {
        const none = [{ id: 'b0', name: 'B', elements: [] }, ...(run().biomes as unknown[]).slice(1)];
        expect(RunStateSchema.safeParse(run({ biomes: none })).success).toBe(false);
        const three = [{ id: 'b0', name: 'B', elements: ['Fire', 'Earth', 'Ice'] }, ...(run().biomes as unknown[]).slice(1)];
        expect(RunStateSchema.safeParse(run({ biomes: three })).success).toBe(false);
    });

    it('caps the party at 3', () => {
        expect(RunStateSchema.safeParse(run({ partyIds: ['a', 'b', 'c', 'd'] })).success).toBe(false);
    });

    it('rejects a currentNodeId that points at nothing — a soft-locked run', () => {
        const result = RunStateSchema.safeParse(run({ currentNodeId: 'n99' }));
        expect(result.success).toBe(false);
        expect(JSON.stringify(result)).toContain('currentNodeId');
    });

    it('rejects phase "gauntlet" without gauntlet progress', () => {
        expect(RunStateSchema.safeParse(run({ phase: 'gauntlet', gauntlet: null })).success).toBe(false);
    });

    it('accepts phase "gauntlet" with progress, carrying HP and the downed list', () => {
        const result = RunStateSchema.safeParse(
            run({
                phase: 'gauntlet',
                gauntlet: {
                    fightIndex: 1,
                    totalFights: 3,
                    persistedHp: { m1: 22, m2: 0 },
                    downedMemberIds: ['m2'],
                },
            }),
        );
        expect(result.success).toBe(true);
    });

    it('rejects phase "ended" without an outcome', () => {
        expect(RunStateSchema.safeParse(run({ phase: 'ended', outcome: null })).success).toBe(false);
    });

    it('rejects negative scrap', () => {
        expect(RunStateSchema.safeParse(run({ scrap: -1 })).success).toBe(false);
    });

    it('holds exactly three macro slots, empties included', () => {
        expect(RunStateSchema.safeParse(run({ macros: ['a', null] })).success).toBe(false);
        expect(RunStateSchema.safeParse(run({ macros: [null, null, null] })).success).toBe(true);
    });
});


// ---------------------------------------------------------------------------------------------
// Two keys, and the reconciliation that pays for them
// ---------------------------------------------------------------------------------------------

function ranchSave(overrides: Fixture = {}) {
    return {
        version: 4,
        ranch: {
            roster: [member('m1', 'kraken'), member('m2', 'fenrir'), member('m3', 'kraken')],
            blueprints: { kraken: 2, fenrir: 1 },
            codex: { seen: ['ember_strike'], played: [] },
            gymsCleared: [],
            highestTierCleared: 0,
        },
        ...overrides,
    };
}

function runSave(runOverrides: Fixture = {}, overrides: Fixture = {}) {
    return { version: 4, run: run(runOverrides), ...overrides };
}

describe('the two save envelopes', () => {
    it('parse independently', () => {
        expect(RanchSaveSchema.safeParse(ranchSave()).success).toBe(true);
        expect(RunSaveSchema.safeParse(runSave()).success).toBe(true);
    });

    it('reject any version that is not 4 — v4 is the floor, there is no migration', () => {
        expect(RanchSaveSchema.safeParse(ranchSave({ version: 3 })).success).toBe(false);
        expect(RunSaveSchema.safeParse(runSave({}, { version: 3 })).success).toBe(false);
        expect(isSupportedSaveVersion(4)).toBe(true);
        expect(isSupportedSaveVersion(3)).toBe(false);
        expect(isSupportedSaveVersion(undefined)).toBe(false);
    });

    it('keeps blueprints as counts, not a dedup\'d list (blueprints are CONSUMABLE)', () => {
        const parsed = RanchSaveSchema.parse(ranchSave());
        expect(parsed.ranch.blueprints.kraken).toBe(2);
    });

    it('treats a count of 0 as legal — "seen it, have none left"', () => {
        const r = ranchSave().ranch;
        expect(RanchSaveSchema.safeParse({ version: 4, ranch: { ...r, blueprints: { kraken: 0 } } }).success).toBe(true);
    });

    it('REFUSES a malformed count instead of silently emptying the inventory', () => {
        // The bug this test was written to catch: `.catch({})` would have made this parse succeed
        // with an empty inventory, and the next autosave would have written that over the good save.
        const r = ranchSave().ranch;
        expect(RanchSaveSchema.safeParse({ version: 4, ranch: { ...r, blueprints: { kraken: -1 } } }).success).toBe(false);
    });

    it('fills in a MISSING optional field rather than failing', () => {
        const r = ranchSave().ranch as Record<string, unknown>;
        delete r.codex;
        delete r.gymsCleared;
        const parsed = RanchSaveSchema.safeParse({ version: 4, ranch: r });
        expect(parsed.success).toBe(true);
    });

    it('has no level or experience anywhere — ticket 21 freezes the engine', () => {
        const text = JSON.stringify(RanchSaveSchema.parse(ranchSave()));
        expect(text).not.toContain('level');
        expect(text).not.toContain('experience');
    });
});

describe('reconcileLoadedState — the run is always the disposable half', () => {
    it('loads a ranch with no run in progress', () => {
        const result = reconcileLoadedState(ranchSave(), null);
        expect(result.ranch).not.toBeNull();
        expect(result.run).toBeNull();
        expect(result.discarded).toBeUndefined();
    });

    it('loads a ranch and a legal run together', () => {
        const result = reconcileLoadedState(ranchSave(), runSave({ partyIds: ['m1', 'm2'] }));
        expect(result.ranch).not.toBeNull();
        expect(result.run).not.toBeNull();
        expect(result.discarded).toBeUndefined();
    });

    it('a corrupt RUN costs only the run — the ranch survives intact', () => {
        const result = reconcileLoadedState(ranchSave(), { version: 4, run: { seed: 'nonsense' } });
        expect(result.ranch?.blueprints.kraken).toBe(2);
        expect(result.ranch?.roster).toHaveLength(3);
        expect(result.run).toBeNull();
        expect(result.discarded).toBe('run-schema-invalid');
    });

    it('a corrupt RANCH yields no state at all — a run without a roster is meaningless', () => {
        const result = reconcileLoadedState({ version: 4, ranch: { roster: 'not an array' } }, runSave());
        expect(result.ranch).toBeNull();
        expect(result.run).toBeNull();
    });

    it('a torn write — run names a member the ranch has never heard of — discards the run', () => {
        const result = reconcileLoadedState(ranchSave(), runSave({ partyIds: ['m1', 'ghost'] }));
        expect(result.ranch).not.toBeNull();
        expect(result.run).toBeNull();
        expect(result.discarded).toBe('party-references-missing-member');
    });

    it('REJECTS duplicate species in the party — the law nothing enforced before', () => {
        // m1 and m3 are both kraken.
        const result = reconcileLoadedState(ranchSave(), runSave({ partyIds: ['m1', 'm3'] }));
        expect(result.ranch).not.toBeNull();
        expect(result.run).toBeNull();
        expect(result.discarded).toBe('party-has-duplicate-species');
    });

    it('never half-repairs a run — a discarded run is null, not a trimmed party', () => {
        const result = reconcileLoadedState(ranchSave(), runSave({ partyIds: ['m1', 'm3'] }));
        expect(result.run).toBeNull();
    });

    it('a v3 blob reads as NO SAVE, not as corruption', () => {
        // The distinction ticket 23 has to preserve: a v3 save means "new player", not
        // "your save is damaged" — the latter would make ticket 04 cling to it forever.
        const result = reconcileLoadedState({ version: 3, roster: [], scrapCount: 100 }, null);
        expect(result.ranch).toBeNull();
        expect(isSupportedSaveVersion(3)).toBe(false);
    });
});
