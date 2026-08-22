import { describe, it, expect } from 'vitest';
import {
    CURRENT_SCENARIO_VERSION,
    ScenarioSchema,
    migrateScenario,
} from './scenarioSchema';
import { normalizeBattleState } from './normalizeBattleState';
import { createSparseBattleState } from './scenarioTestSupport';

/** A minimal valid `composed` envelope. Mutate the returned copy freely. */
function composedScenario() {
    return {
        version: CURRENT_SCENARIO_VERSION,
        kind: 'composed',
        name: 'Fixture',
        registryHash: '1:00000000',
        setup: {
            seed: 'seed-0001',
            enemyMode: 'MOVES',
            player: {
                party: [
                    { definitionId: 'fenrir', attackIV: 31, defenseIV: 0, hpIV: 15 },
                ],
                deck: ['ignite', 'scorch'],
                relics: [] as string[],
            },
            enemies: [
                { definitionId: 'draugr', attackIV: 0, defenseIV: 0, hpIV: 0 },
            ],
            gauntlet: null as unknown,
        },
    };
}

/** A minimal valid `snapshot` envelope carrying an already-canonical state. */
function snapshotScenario() {
    return {
        version: CURRENT_SCENARIO_VERSION,
        kind: 'snapshot',
        name: 'Snapshot fixture',
        registryHash: '1:00000000',
        state: JSON.parse(JSON.stringify(normalizeBattleState(createSparseBattleState()))),
    };
}

function partyOf(count: number) {
    return Array.from({ length: count }, (_unused, index) => ({
        definitionId: 'fenrir',
        attackIV: 0,
        defenseIV: 0,
        hpIV: index,
    }));
}

describe('CURRENT_SCENARIO_VERSION', () => {
    it('is 1', () => {
        expect(CURRENT_SCENARIO_VERSION).toBe(1);
    });
});

describe('migrateScenario', () => {
    it('is a no-op at v1', () => {
        const scenario = composedScenario();

        expect(migrateScenario(scenario)).toEqual(scenario);
        expect((migrateScenario(scenario) as { version: number }).version).toBe(1);
    });

    it('is a no-op at v1 for a snapshot, tape included', () => {
        const scenario = { ...snapshotScenario(), tape: [{ type: 'battle/playCard' }] };

        expect(migrateScenario(scenario)).toEqual(scenario);
    });

    it('treats an unversioned file as v1', () => {
        const { version: _dropped, ...unversioned } = composedScenario();

        expect((migrateScenario(unversioned) as { version: number }).version).toBe(1);
    });

    it('passes non-objects straight through', () => {
        expect(migrateScenario(null)).toBeNull();
        expect(migrateScenario('nope')).toBe('nope');
        expect(migrateScenario(7)).toBe(7);
    });

    it('does not mutate its input', () => {
        const { version: _dropped, ...unversioned } = composedScenario();
        const before = JSON.stringify(unversioned);

        migrateScenario(unversioned);

        expect(JSON.stringify(unversioned)).toBe(before);
    });
});

describe('ScenarioSchema - composed', () => {
    it('accepts a well-formed composed scenario', () => {
        expect(ScenarioSchema.safeParse(composedScenario()).success).toBe(true);
    });

    it('accepts an omitted gauntlet', () => {
        const scenario = composedScenario();
        Reflect.deleteProperty(scenario.setup, 'gauntlet');

        expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
    });

    it('caps the party at 3, mirroring PARTY_SIZE / RunStateSchema.partyIds', () => {
        const ok = composedScenario();
        ok.setup.player.party = partyOf(3);
        expect(ScenarioSchema.safeParse(ok).success).toBe(true);

        const tooMany = composedScenario();
        tooMany.setup.player.party = partyOf(4);
        expect(ScenarioSchema.safeParse(tooMany).success).toBe(false);
    });

    it('bounds IVs to int 0..31, mirroring MingmingInstanceSchema', () => {
        for (const badIV of [-1, 32, 1.5]) {
            const scenario = composedScenario();
            scenario.setup.player.party[0].attackIV = badIV;
            expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
        }

        const edge = composedScenario();
        edge.setup.player.party[0].attackIV = 31;
        edge.setup.player.party[0].hpIV = 0;
        expect(ScenarioSchema.safeParse(edge).success).toBe(true);
    });

    it('requires enemyMode to be explicit on disk', () => {
        const scenario = composedScenario();
        Reflect.deleteProperty(scenario.setup, 'enemyMode');

        expect(ScenarioSchema.safeParse(scenario).success).toBe(false);
    });

    it('accepts the enemy-only extras', () => {
        const base = composedScenario();
        const scenario = {
            ...base,
            setup: {
                ...base.setup,
                enemies: [
                    {
                        definitionId: 'draugr',
                        attackIV: 0,
                        defenseIV: 0,
                        hpIV: 0,
                        activeOS: 'draugr_v1',
                        currentHp: 12,
                        statusEffects: [{ id: 'st1', type: 'Burn', stacks: 2 }],
                        maxHpOverride: 60,
                        deck: ['ignite'],
                    },
                ],
            },
        };

        expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
    });

    it('rejects a composed scenario that carries a snapshot state instead of a setup', () => {
        const { setup: _dropped, ...withoutSetup } = composedScenario();

        expect(ScenarioSchema.safeParse(withoutSetup).success).toBe(false);
        expect(
            ScenarioSchema.safeParse({ ...withoutSetup, state: snapshotScenario().state }).success,
        ).toBe(false);
    });
});

describe('ScenarioSchema - snapshot', () => {
    it('accepts a snapshot without a tape', () => {
        expect(ScenarioSchema.safeParse(snapshotScenario()).success).toBe(true);
    });

    it('accepts a snapshot with a loosely typed tape', () => {
        const scenario = {
            ...snapshotScenario(),
            tape: [{ type: 'battle/playCard', payload: { cardId: 'c1' } }, 'anything'],
        };

        expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
    });

    it('rejects a snapshot with no state', () => {
        const { state: _dropped, ...withoutState } = snapshotScenario();

        expect(ScenarioSchema.safeParse(withoutState).success).toBe(false);
    });
});

describe('ScenarioSchema - envelope', () => {
    it('rejects an unknown kind', () => {
        expect(ScenarioSchema.safeParse({ ...composedScenario(), kind: 'replay' }).success).toBe(
            false,
        );
    });

    it('requires a registryHash and a name', () => {
        const { registryHash: _hash, ...noHash } = composedScenario();
        expect(ScenarioSchema.safeParse(noHash).success).toBe(false);

        const { name: _name, ...noName } = composedScenario();
        expect(ScenarioSchema.safeParse(noName).success).toBe(false);
    });

    it('requires version to be an int >= 1', () => {
        expect(ScenarioSchema.safeParse({ ...composedScenario(), version: 0 }).success).toBe(false);
        expect(ScenarioSchema.safeParse({ ...composedScenario(), version: 1.5 }).success).toBe(
            false,
        );
    });

    it('accepts the informational envelope extras', () => {
        const scenario = {
            ...composedScenario(),
            description: 'why this file exists',
            tags: ['repro', 'burn'],
            createdAt: '2026-08-03T00:00:00.000Z',
        };

        expect(ScenarioSchema.safeParse(scenario).success).toBe(true);
    });
});
