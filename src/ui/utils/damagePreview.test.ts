import { describe, it, expect, beforeEach } from 'vitest';
import { computeDamagePreview } from './damagePreview';
import { calculateDamage } from '../../engine/combatUtils';
import { GetProgramData } from '../../engine/data/programRegistry';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';

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
        expect(preview).toBe(expected);

        // Selecting the other unit must change the preview (different attack stat)
        const weakPreview = computeDamagePreview(state, 'weak', 'card_1', 'enemy');
        expect(weakPreview).toBe(calculateDamage(weak, enemy, data, 10, state));
        expect(weakPreview).not.toBe(preview);
    });

    it('returns 0 when no source is selected', () => {
        expect(computeDamagePreview(state, null, 'card_1', 'enemy')).toBe(0);
        expect(computeDamagePreview(state, undefined, 'card_1', 'enemy')).toBe(0);
    });

    it('returns 0 when the selected source is dead', () => {
        state = {
            ...state,
            playerParty: [weak, { ...strong, currentHp: 0 }]
        };
        expect(computeDamagePreview(state, 'strong', 'card_1', 'enemy')).toBe(0);
    });

    it('returns 0 when the selected source cannot afford the card', () => {
        state = {
            ...state,
            playerParty: [weak, { ...strong, currentEnergy: 0 }]
        };
        expect(computeDamagePreview(state, 'strong', 'card_1', 'enemy')).toBe(0);
    });

    it('returns 0 when a SELF constraint blocks the source (e.g. Stunned)', () => {
        state = {
            ...state,
            playerParty: [weak, {
                ...strong,
                statusEffects: [{ id: 's1', type: 'Stunned' as const, stacks: 1 }]
            }]
        };
        expect(computeDamagePreview(state, 'strong', 'card_1', 'enemy')).toBe(0);
    });

    it('returns 0 for a missing card or a dead target', () => {
        expect(computeDamagePreview(state, 'strong', 'nope', 'enemy')).toBe(0);
        state = { ...state, enemyParty: [{ ...enemy, currentHp: 0 }] };
        expect(computeDamagePreview(state, 'strong', 'card_1', 'enemy')).toBe(0);
    });
});
