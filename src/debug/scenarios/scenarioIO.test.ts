import { describe, it, expect, vi, afterEach } from 'vitest';
import { describeRegistryMismatch, loadScenario, saveScenario } from './scenarioIO';
import { computeRegistryHash } from './registryHash';
import { normalizeBattleState } from './normalizeBattleState';
import { CURRENT_SCENARIO_VERSION } from './scenarioSchema';
import type { ComposedScenario, ComposedSetup, SnapshotScenario } from './scenarioSchema';
import { createSparseBattleState } from './scenarioTestSupport';
import fixture from './repro/ash-reclamation-burn-consume.scenario.json';

const SETUP: ComposedSetup = {
    seed: 'seed-0001',
    enemyMode: 'MOVES',
    player: {
        party: [{ definitionId: 'fenrir', level: 10, attackIV: 31, defenseIV: 0, hpIV: 15 }],
        deck: ['ignite', 'scorch'],
        relics: [],
    },
    enemies: [{ definitionId: 'draugr', level: 10, attackIV: 0, defenseIV: 0, hpIV: 0 }],
    gauntlet: null,
};

const composedDraft = { kind: 'composed' as const, name: 'Composed draft', setup: SETUP };

const snapshotDraft = {
    kind: 'snapshot' as const,
    name: 'Snapshot draft',
    state: createSparseBattleState(),
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('saveScenario', () => {
    it('stamps version, registryHash and createdAt', () => {
        const result = saveScenario(composedDraft);

        expect(result.success).toBe(true);
        expect(result.scenario!.version).toBe(CURRENT_SCENARIO_VERSION);
        expect(result.scenario!.registryHash).toBe(computeRegistryHash());
        expect(typeof result.scenario!.createdAt).toBe('string');
        expect(result.json).toContain('"kind": "composed"');
    });

    it('preserves a createdAt the draft already carries', () => {
        const result = saveScenario({ ...composedDraft, createdAt: '2020-01-01T00:00:00.000Z' });

        expect(result.scenario!.createdAt).toBe('2020-01-01T00:00:00.000Z');
    });

    it('normalizes a snapshot state on write', () => {
        const result = saveScenario(snapshotDraft);

        expect(result.success).toBe(true);
        const written = JSON.parse(result.json!);
        expect(written.state).toEqual(normalizeBattleState(createSparseBattleState()));
        expect(written.state.enemyMode).toBe('MOVES');
        expect(written.state.playerParty[0].hooks).toEqual([]);
        expect(written.state.playerParty[0].currentIntent).toBeNull();
    });

    it('reports a validation failure instead of writing garbage', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const bad = saveScenario({
            ...composedDraft,
            setup: {
                ...SETUP,
                player: {
                    ...SETUP.player,
                    // 32 is one past the mirrored MingmingInstanceSchema IV ceiling.
                    party: [
                        { definitionId: 'fenrir', level: 10, attackIV: 32, defenseIV: 0, hpIV: 0 },
                    ],
                },
            },
        });

        expect(bad.success).toBe(false);
        expect(bad.json).toBeUndefined();
        expect(bad.error).toContain('attackIV');
    });
});

describe('loadScenario', () => {
    it('round-trips a composed scenario written by saveScenario', () => {
        const saved = saveScenario(composedDraft);
        const loaded = loadScenario(saved.json!);

        expect(loaded.error).toBeUndefined();
        expect(loaded.registryHashMismatch).toBe(false);
        expect(loaded.scenario).toEqual(saved.scenario);
    });

    it('round-trips a snapshot scenario and leaves the state canonical', () => {
        const saved = saveScenario(snapshotDraft);
        const loaded = loadScenario(saved.json!);

        expect(loaded.registryHashMismatch).toBe(false);
        expect(loaded.scenario).toEqual(saved.scenario);
        expect(loaded.scenario!.kind).toBe('snapshot');
        expect((loaded.scenario! as SnapshotScenario).state).toEqual(
            normalizeBattleState(createSparseBattleState()),
        );
    });

    it('preserves an optional tape through the round trip', () => {
        const tape = [{ type: 'battle/playCard', payload: { cardId: 'c1' } }];
        const saved = saveScenario({ ...snapshotDraft, tape });
        const loaded = loadScenario(saved.json!);

        expect((loaded.scenario! as SnapshotScenario).tape).toEqual(tape);
    });

    it('accepts an already-parsed object as well as raw JSON text', () => {
        const saved = saveScenario(composedDraft);

        expect(loadScenario(JSON.parse(saved.json!)).scenario).toEqual(saved.scenario);
    });

    it('warns loudly on registry drift but loads anyway', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const saved = saveScenario(composedDraft);
        const stale = { ...saved.scenario!, registryHash: '1:deadbeef' };

        const loaded = loadScenario(stale);

        expect(loaded.scenario).not.toBeNull();
        expect(loaded.registryHashMismatch).toBe(true);
        expect(loaded.currentRegistryHash).toBe(computeRegistryHash());
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toBe(
            describeRegistryMismatch('1:deadbeef', computeRegistryHash()),
        );
    });

    it('returns an error for corrupted JSON', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const loaded = loadScenario('{ not json');

        expect(loaded.scenario).toBeNull();
        expect(loaded.error).toContain('Corrupted');
    });

    it('returns an error for a structurally invalid scenario', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const loaded = loadScenario({ version: 1, kind: 'composed', name: 'no setup' });

        expect(loaded.scenario).toBeNull();
        expect(loaded.error).toBeTruthy();
        expect(loaded.registryHashMismatch).toBe(false);
    });
});

describe('the checked-in repro fixture', () => {
    it('loads and validates', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const loaded = loadScenario(fixture);

        expect(loaded.error).toBeUndefined();
        expect(loaded.scenario).not.toBeNull();
        expect(loaded.scenario!.kind).toBe('composed');

        const setup = (loaded.scenario! as ComposedScenario).setup;
        expect(setup.player.party).toHaveLength(2);
        expect(setup.enemies).toHaveLength(2);
        expect(setup.enemyMode).toBe('MOVES');
    });

    it('survives its own placeholder registry stamp - warn, not block', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const loaded = loadScenario(fixture);

        expect(loaded.scenario).not.toBeNull();
        if (loaded.registryHashMismatch) {
            expect(warn).toHaveBeenCalled();
        }
    });

    it('can be re-stamped by round-tripping through saveScenario', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const loaded = loadScenario(fixture);

        const restamped = saveScenario(loaded.scenario!);

        expect(restamped.success).toBe(true);
        expect(restamped.scenario!.registryHash).toBe(computeRegistryHash());
        expect(loadScenario(restamped.json!).registryHashMismatch).toBe(false);
    });
});
