import { describe, it, expect } from 'vitest';
import {
    DEFAULT_RELIC_BONUSES,
    normalizeBattleEntity,
    normalizeBattleState,
    zeroFilledElementPlays,
} from './normalizeBattleState';
import { BattleStateSchema } from './scenarioSchema';
import {
    createRichBattleState,
    createRichEntity,
    createSparseBattleState,
    createSparseEntity,
} from './scenarioTestSupport';
import { ELEMENTS } from '../../engine/types';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';

const STRIP_CLASS_KEYS = [
    'secondaryElement',
    'forcedTargetId',
    'nextProgramModifier',
    'moves',
] as const;

describe('normalizeBattleState - fill class', () => {
    it('fills the state-level defaults', () => {
        const normalized = normalizeBattleState(createSparseBattleState());

        expect(normalized.enemyMode).toBe('MOVES');
        expect(normalized.lastStatusConsumed).toBe(0);
    });

    it('zero-fills elementPlays for every member of the Element union', () => {
        const normalized = normalizeBattleState(createSparseBattleState());
        const elementPlays = normalized.elementPlays!;

        expect(Object.keys(elementPlays).sort()).toEqual([...ELEMENTS].sort());
        for (const element of ELEMENTS) {
            expect(elementPlays[element]).toBe(0);
        }
    });

    it('keeps counts already present while filling the missing elements', () => {
        expect(zeroFilledElementPlays({ Fire: 3 })).toEqual({
            Fire: 3,
            Water: 0,
            Earth: 0,
            Air: 0,
            Nature: 0,
            Ice: 0,
            Light: 0,
            Dark: 0,
            None: 0,
        });
    });

    it('fills the entity-level defaults', () => {
        const entity = normalizeBattleEntity(createSparseEntity());

        expect(entity.relicBonuses).toEqual({ draw: 0, energy: 0, attackMod: 1 });
        expect(entity.relicBonuses).toEqual(DEFAULT_RELIC_BONUSES);
        expect(entity.hooks).toEqual([]);
        expect(entity.currentIntent).toBeNull();
        expect(entity.playsThisTurn).toBe(0);
    });

    it('resolves a missing activeOS to the definition first available OS', () => {
        const entity = normalizeBattleEntity(createSparseEntity({ definitionId: 'fenrir' }));

        expect(entity.activeOS).toBe(GetMingmingData('fenrir').availableOS[0]);
        expect(entity.activeOS).toBe('fenrir_v1');
    });

    it('never overwrites a fill-class field that already has a value', () => {
        const rich = createRichEntity();
        const entity = normalizeBattleEntity(rich);

        expect(entity.relicBonuses).toEqual({ draw: 1, energy: 2, attackMod: 1.5 });
        expect(entity.hooks).toEqual(['hook_a']);
        expect(entity.activeOS).toBe('draugr_v2');
        expect(entity.playsThisTurn).toBe(2);
        expect(entity.currentIntent).toEqual(rich.currentIntent);
    });

    it('normalizes both parties', () => {
        const normalized = normalizeBattleState(createSparseBattleState());

        for (const entity of [...normalized.playerParty, ...normalized.enemyParty]) {
            expect(entity.hooks).toEqual([]);
            expect(entity.playsThisTurn).toBe(0);
        }
    });
});

describe('normalizeBattleState - strip class', () => {
    it('leaves strip-class keys absent, not present-and-undefined', () => {
        const entity = normalizeBattleEntity(createSparseEntity());

        for (const key of STRIP_CLASS_KEYS) {
            expect(Object.prototype.hasOwnProperty.call(entity, key)).toBe(false);
        }
    });

    it('removes a strip-class key that was explicitly undefined', () => {
        const entity = normalizeBattleEntity(
            createSparseEntity({ forcedTargetId: undefined, moves: undefined }),
        );

        expect(Object.prototype.hasOwnProperty.call(entity, 'forcedTargetId')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(entity, 'moves')).toBe(false);
    });

    it('passes a strip-class key through untouched when it carries a real value', () => {
        const rich = createRichEntity();
        const entity = normalizeBattleEntity(rich);

        expect(entity.secondaryElement).toBe('Ice');
        expect(entity.forcedTargetId).toBe('p1');
        expect(entity.nextProgramModifier).toEqual({ multiplier: 2, appliesTo: 'Attack' });
        expect(entity.moves).toEqual(rich.moves);
    });
});

describe('normalizeBattleState - canonical form', () => {
    it('is idempotent', () => {
        for (const state of [createSparseBattleState(), createRichBattleState()]) {
            const once = normalizeBattleState(state);
            expect(normalizeBattleState(once)).toEqual(once);
        }
    });

    it('does not mutate its input', () => {
        const state = createSparseBattleState();
        const before = JSON.stringify(state);

        normalizeBattleState(state);

        expect(JSON.stringify(state)).toBe(before);
    });

    it('round-trips through JSON and validation unchanged (audit gap #9 regression)', () => {
        for (const state of [createSparseBattleState(), createRichBattleState()]) {
            const normalized = normalizeBattleState(state);

            const reparsed = JSON.parse(JSON.stringify(normalized));
            const validated = BattleStateSchema.parse(reparsed) as unknown as typeof normalized;

            // Serialization must not have dropped anything the normalizer put there...
            expect(validated).toEqual(normalized);
            // ...and re-normalizing the round-tripped state must be a no-op.
            expect(normalizeBattleState(validated)).toEqual(normalized);
        }
    });

    it('brings a sparse and a pre-filled state to the same canonical form', () => {
        const sparse = createSparseBattleState();
        const preFilled = createSparseBattleState({
            enemyMode: 'MOVES',
            lastStatusConsumed: 0,
            elementPlays: zeroFilledElementPlays(),
            playerParty: [
                createSparseEntity({
                    relicBonuses: { draw: 0, energy: 0, attackMod: 1 },
                    hooks: [],
                    currentIntent: null,
                    playsThisTurn: 0,
                    activeOS: 'fenrir_v1',
                }),
            ],
        });

        expect(normalizeBattleState(sparse)).toEqual(normalizeBattleState(preFilled));
    });
});
