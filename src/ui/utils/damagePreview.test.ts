import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeDamagePreview } from './damagePreview';
import { calculateDamage } from '../../engine/combatUtils';
import { GetProgramData } from '../../engine/data/programRegistry';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';

// Adds an elemental attack card so the STAB / effectiveness breakdown can be exercised.
vi.mock('../../engine/data/programRegistry', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../engine/data/programRegistry')>();
    return {
        ...original,
        GetProgramData: vi.fn((id: string) =>
            id === 'fire_strike'
                ? {
                    id: 'fire_strike', name: 'Fire Strike', description: 'Test fire attack.',
                    element: 'Fire', target: 'Single', category: 'Attack', rarity: 'Common',
                    baseCost: 1, constraints: [], actions: [{ type: 'ATTACK', power: 10, target: 'TARGET' }]
                }
                : original.GetProgramData(id)
        )
    };
});

const makeEntity = (id: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id,
    name: id,
    level: 5,
    maxHp: 100,
    currentHp: 100,
    attack: 50,
    defense: 50,
    maxEnergy: 3,
    currentEnergy: 3,
    primaryElement: 'None',
    secondaryElement: 'None',
    statusEffects: [],
    hooks: [],
    speed: 10,
    cardDraw: 3,
    tempHp: 0,
    daemons: [],
    definitionId: 'none',
    experience: 0,
    blueprintsCollected: 0,
    attackIV: 0,
    defenseIV: 0,
    hpIV: 0,
    ...overrides
} as IBattleEntity);

const CARD: ProgramEntity = { id: 'card_1', dataId: 'test_strike', currentCost: 1, isPlayable: true };

describe('computeDamagePreview', () => {
    let weak: IBattleEntity;
    let strong: IBattleEntity;
    let enemy: IBattleEntity;
    let state: IBattleState;

    beforeEach(() => {
        weak = makeEntity('weak', { attack: 40 });
        strong = makeEntity('strong', { attack: 120 });
        enemy = makeEntity('enemy');
        state = {
            sessionId: 'test',
            turn: 1,
            activeSide: 'PLAYER',
            activeRelics: [],
            phase: 'ACTION',
            playerParty: [weak, strong],
            enemyParty: [enemy],
            playerDeck: { ownerId: 'p', deck: [], hand: [CARD], drawpile: [], discard: [], exhaust: [] },
            enemyDeck: { ownerId: 'e', deck: [], hand: [], drawpile: [], discard: [], exhaust: [] },
            logs: [],
            osLogs: [],
            procs: [],
            seed: 'test-seed',
            cardsPlayedThisTurn: 0,
            levelUpQueue: [],
            cardsDrawnThisTurn: 0,
            lastProgramPlayed: null,
            counters: {}
        } as unknown as IBattleState;
    });

    it('uses the SELECTED source unit, not the first party member with enough energy', () => {
        const data = GetProgramData('test_strike');
        const expected = calculateDamage(strong, enemy, data, 10, state);

        const preview = computeDamagePreview(state, 'strong', 'card_1', 'enemy');
        expect(preview.damage).toBe(expected);

        // Selecting the other unit must change the preview (different attack stat)
        const weakPreview = computeDamagePreview(state, 'weak', 'card_1', 'enemy');
        expect(weakPreview.damage).toBe(calculateDamage(weak, enemy, data, 10, state));
        expect(weakPreview.damage).not.toBe(preview.damage);
    });

    it('returns 0 when no source is selected', () => {
        expect(computeDamagePreview(state, null, 'card_1', 'enemy').damage).toBe(0);
        expect(computeDamagePreview(state, undefined, 'card_1', 'enemy').damage).toBe(0);
    });

    it('returns 0 when the selected source is dead', () => {
        state = {
            ...state,
            playerParty: [weak, { ...strong, currentHp: 0 }]
        };
        expect(computeDamagePreview(state, 'strong', 'card_1', 'enemy').damage).toBe(0);
    });

    it('returns 0 when the selected source cannot afford the card', () => {
        state = {
            ...state,
            playerParty: [weak, { ...strong, currentEnergy: 0 }]
        };
        expect(computeDamagePreview(state, 'strong', 'card_1', 'enemy').damage).toBe(0);
    });

    it('returns 0 when a SELF constraint blocks the source (e.g. Stunned)', () => {
        state = {
            ...state,
            playerParty: [weak, {
                ...strong,
                statusEffects: [{ id: 's1', type: 'Stunned' as const, stacks: 1 }]
            }]
        };
        expect(computeDamagePreview(state, 'strong', 'card_1', 'enemy').damage).toBe(0);
    });

    it('returns 0 for a missing card or a dead target', () => {
        expect(computeDamagePreview(state, 'strong', 'nope', 'enemy').damage).toBe(0);
        state = { ...state, enemyParty: [{ ...enemy, currentHp: 0 }] };
        expect(computeDamagePreview(state, 'strong', 'card_1', 'enemy').damage).toBe(0);
    });

    describe('elemental breakdown', () => {
        const FIRE_CARD: ProgramEntity = { id: 'card_f', dataId: 'fire_strike', currentCost: 1, isPlayable: true };

        beforeEach(() => {
            state = {
                ...state,
                playerDeck: { ...state.playerDeck, hand: [CARD, FIRE_CARD] }
            };
        });

        it('reports STAB + super effectiveness for a matched card vs a weak target', () => {
            const fireSource = { ...strong, primaryElement: 'Fire' as const, secondaryElement: undefined };
            const natureEnemy = { ...enemy, primaryElement: 'Nature' as const, secondaryElement: undefined };
            state = { ...state, playerParty: [weak, fireSource], enemyParty: [natureEnemy] };

            const preview = computeDamagePreview(state, 'strong', 'card_f', 'enemy');
            expect(preview.stab).toBe(true);
            expect(preview.effectiveness).toBe(2); // Fire vs Nature
            expect(preview.element).toBe('Fire');
            expect(preview.damage).toBeGreaterThan(0);
        });

        it('reports no STAB and not-very-effective vs a resistant target', () => {
            const airSource = { ...strong, primaryElement: 'Air' as const, secondaryElement: undefined };
            const waterEnemy = { ...enemy, primaryElement: 'Water' as const, secondaryElement: undefined };
            state = { ...state, playerParty: [weak, airSource], enemyParty: [waterEnemy] };

            const preview = computeDamagePreview(state, 'strong', 'card_f', 'enemy');
            expect(preview.stab).toBe(false);
            expect(preview.effectiveness).toBe(0.5); // Fire vs Water
            expect(preview.element).toBe('Fire');
        });

        it('applies secondary-type mitigation to the effectiveness product', () => {
            const source = { ...strong, primaryElement: 'Air' as const, secondaryElement: undefined };
            // Fire vs Light = 1.0, Fire vs Water secondary = 0.5 × 0.75 → 0.375
            const dualEnemy = { ...enemy, primaryElement: 'Light' as const, secondaryElement: 'Water' as const };
            state = { ...state, playerParty: [weak, source], enemyParty: [dualEnemy] };

            const preview = computeDamagePreview(state, 'strong', 'card_f', 'enemy');
            expect(preview.effectiveness).toBe(0.375);
        });

        it('is neutral effectiveness for the None-element test card', () => {
            // Engine quirk surfaced, not changed: every unit here has a 'None'
            // secondary, so a 'None' card still counts as STAB in the engine.
            const preview = computeDamagePreview(state, 'strong', 'card_1', 'enemy');
            expect(preview.effectiveness).toBe(1);
            expect(preview.stab).toBe(false);
            expect(preview.element).toBe('None');
        });
    });
});
