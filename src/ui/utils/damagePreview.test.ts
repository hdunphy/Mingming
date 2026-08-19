import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computeDamagePreview } from './damagePreview';
import { calculateDamage } from '../../engine/combatUtils';
import { GetProgramData } from '../../engine/data/programRegistry';
import { battleReducer } from '../../engine/battleReducer';
import type { IBattleEntity, IBattleState, ProgramEntity, StatusEffectInstance } from '../../engine/types';

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
                : id === 'herd_charge'
                ? {
                    // Ticket 90: a CARDS_PLAYED scaler, the shape `stampede` uses. Its damage is
                    // multiplied AFTER the divisor by the turn's play count, which is the half the
                    // preview used to be blind to.
                    id: 'herd_charge', name: 'Herd Charge', description: 'Test per-card scaler.',
                    element: 'None', target: 'Single', category: 'Attack', rarity: 'Common',
                    baseCost: 1, constraints: [],
                    actions: [{ type: 'ATTACK', power: 10, target: 'TARGET', scaling: 'CARDS_PLAYED' }]
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
            expect(preview.effectiveness).toBe(1.5); // Fire vs Nature (ticket 35: 2.0 -> 1.5)
            expect(preview.element).toBe('Fire');
            expect(preview.damage).toBeGreaterThan(0);
        });

        it('reports no STAB and NEUTRAL into a former resistance (ticket 35)', () => {
            // Fire into Water used to preview 0.5x. Resistance is gone, so the preview reads
            // neutral - the player is never shown a halved number any more.
            const airSource = { ...strong, primaryElement: 'Air' as const, secondaryElement: undefined };
            const waterEnemy = { ...enemy, primaryElement: 'Water' as const, secondaryElement: undefined };
            state = { ...state, playerParty: [weak, airSource], enemyParty: [waterEnemy] };

            const preview = computeDamagePreview(state, 'strong', 'card_f', 'enemy');
            expect(preview.stab).toBe(false);
            expect(preview.effectiveness).toBe(1); // Fire vs Water
            expect(preview.element).toBe('Fire');
        });

        it('secondary mitigation now only ever scales an ADVANTAGE (ticket 35)', () => {
            // Resisted pairs are absent from the matrix, so the secondary branch is skipped
            // for them entirely. Fire vs Light = no entry, Fire vs Nature secondary =
            // 1.5 × 0.75 → 1.125.
            const source = { ...strong, primaryElement: 'Air' as const, secondaryElement: undefined };
            const dualEnemy = { ...enemy, primaryElement: 'Light' as const, secondaryElement: 'Nature' as const };
            state = { ...state, playerParty: [weak, source], enemyParty: [dualEnemy] };

            const preview = computeDamagePreview(state, 'strong', 'card_f', 'enemy');
            expect(preview.effectiveness).toBeCloseTo(1.125, 5);
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

    describe('action-scaling parity (SHARP_STACKS — spike_launch)', () => {
        // Real registry card: 20 power, +5 power per Sharp stack on the attacker.
        const SPIKE: ProgramEntity = { id: 'card_s', dataId: 'spike_launch', currentCost: 1, isPlayable: true };
        const SHARP_3: StatusEffectInstance[] = [{ id: 'sh1', type: 'Sharp' as const, stacks: 3 }];

        beforeEach(() => {
            state = {
                ...state,
                playerDeck: { ...state.playerDeck, hand: [SPIKE] }
            };
        });

        it('previews MORE damage with 3 Sharp than without, and reports the +15 power bonus', () => {
            const without = computeDamagePreview(state, 'strong', 'card_s', 'enemy');
            expect(without.sharpBonus).toBe(0);

            const sharpState = {
                ...state,
                playerParty: [weak, { ...strong, statusEffects: SHARP_3 }]
            };
            const withSharp = computeDamagePreview(sharpState, 'strong', 'card_s', 'enemy');
            expect(withSharp.sharpBonus).toBe(15);
            expect(withSharp.damage).toBeGreaterThan(without.damage);
        });

        it('preview equals the ACTUAL reducer damage for the same state (exact)', () => {
            const sharpState = {
                ...state,
                playerParty: [weak, { ...strong, statusEffects: SHARP_3 }]
            };
            const preview = computeDamagePreview(sharpState, 'strong', 'card_s', 'enemy');
            expect(preview.damage).toBeGreaterThan(0);

            const after = battleReducer(sharpState, {
                type: 'PLAY_PROGRAM',
                payload: { sourceId: 'strong', targetId: 'enemy', programId: 'card_s' }
            });
            const actualDamage = enemy.currentHp - after.enemyParty[0].currentHp;
            expect(actualDamage).toBe(preview.damage);
        });
    });

    describe('post-damage scalings (ticket 90 - the preview Henry could not trust)', () => {
        const SCALER: ProgramEntity = { id: 'card_h', dataId: 'herd_charge', currentCost: 1, isPlayable: true };

        it('scales the preview by cards played this turn, and says so', () => {
            const base = { ...state, playerDeck: { ...state.playerDeck, hand: [SCALER] } } as IBattleState;
            // The preview counts the card being cast, exactly as the reducer does.
            const atZero = computeDamagePreview({ ...base, cardsPlayedThisTurn: 0 }, 'strong', 'card_h', 'enemy');
            const atThree = computeDamagePreview({ ...base, cardsPlayedThisTurn: 3 }, 'strong', 'card_h', 'enemy');

            expect(atZero.damage).toBeGreaterThan(0);
            expect(atZero.scalingMultiplier).toBe(1);
            expect(atThree.damage).toBe(atZero.damage * 4);
            expect(atThree.scalingMultiplier).toBe(4);
            expect(atThree.scalingKind).toBe('CARDS_PLAYED');
        });

        it('preview equals the ACTUAL reducer damage for a per-card scaler (exact)', () => {
            // Three cards already played this turn: the card should hit for 4x its printed damage
            // once this play increments the counter, and the preview must agree exactly.
            const played = {
                ...state,
                cardsPlayedThisTurn: 3,
                playerDeck: { ...state.playerDeck, hand: [SCALER] },
            } as IBattleState;

            const preview = computeDamagePreview(played, 'strong', 'card_h', 'enemy');
            const after = battleReducer(played, {
                type: 'PLAY_PROGRAM',
                payload: { sourceId: 'strong', targetId: 'enemy', programId: 'card_h' },
            });
            const actualDamage = enemy.currentHp - after.enemyParty[0].currentHp;
            expect(actualDamage).toBe(preview.damage);
        });

        it('leaves a plain card at a multiplier of 1 with no scaling label', () => {
            const plain = computeDamagePreview(state, 'strong', 'card_1', 'enemy');
            expect(plain.scalingMultiplier).toBe(1);
            expect(plain.scalingKind).toBeUndefined();
        });
    });
});
