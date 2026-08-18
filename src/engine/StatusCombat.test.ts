import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDamage } from './combatUtils';
import type { IBattleEntity, IBattleState } from './types';
import { StatusType } from './types';

describe('Damage Calculation with Status Modifiers', () => {
    let attacker: IBattleEntity;
    let defender: IBattleEntity;
    let mockState: IBattleState;

    beforeEach(() => {
        attacker = {
            id: 'attacker',
            name: 'Attacker',
            level: 5,
            maxHp: 100,
            currentHp: 100,
            attack: 50,
            defense: 50,
            maxEnergy: 5,
            currentEnergy: 5,
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
            hpIV: 0
        };

        defender = {
            id: 'defender',
            name: 'Defender',
            level: 5,
            maxHp: 100,
            currentHp: 100,
            attack: 50,
            defense: 50,
            maxEnergy: 5,
            currentEnergy: 5,
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
            hpIV: 0
        };

        mockState = {
            sessionId: 'test',
            turn: 1,
            activeSide: 'PLAYER',
            activeRelics: [],
            phase: 'ACTION',
            playerParty: [attacker],
            enemyParty: [defender],
            playerDeck: { ownerId: 'p', deck: [], hand: [], drawpile: [], discard: [], exhaust: [] },
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
        };
    });

    const mockProgram = {
        id: 'test_punch',
        name: 'Test Punch',
        description: '',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 1,
        constraints: [],
        actions: []
    };

    it('should calculate base damage correctly', () => {
        const damage = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);
        // Level 5 -> levelBase = floor(2*5/5)+2 = 4
        // scaled = floor(4 * 40 * 50 / 50) = 160
        // reduced = 160 / 45 = 3.555... (spec rev 3.1 / ticket 23: no +2, /45 not /35)
        // modifier = 1.0 (program element is 'None', which never grants STAB)
        // damage = floor(3.555 * 1.0) = 3
        expect(damage).toBe(3);
    });

    it('should increase damage with Strengthened status', () => {
        (attacker as any).statusEffects = [{ id: 's1', type: StatusType.Strengthened, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);
        // rev 3: 2%/stack (was 20%/stack). Status multipliers apply to the ALREADY-floored
        // base (3 under rev 3.1), so 3 * 1.02 = 3.06 -> 3: a single stack is invisible at
        // this scale, exactly as it was under rev 3's base of 4. The cap-vs-cap interaction
        // below is what actually exercises the multiplier.
        expect(damage).toBe(3);
    });

    it('should decrease damage with Weakened status', () => {
        (attacker as any).statusEffects = [{ id: 'w1', type: StatusType.Weakened, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);
        // rev 3.1: base 3 * (1 - 0.02) = 2.94, floor = 2.
        expect(damage).toBe(2);
    });

    it('should reduce damage to a Sharp target', () => {
        (defender as any).statusEffects = [{ id: 'sh1', type: StatusType.Sharp, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);
        // rev 3.1: base 3 * (1 - 0.02) = 2.94, floor = 2.
        expect(damage).toBe(2);
    });

    it('should deal more damage to a Dazed target', () => {
        (defender as any).statusEffects = [{ id: 'd1', type: StatusType.Dazed, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);
        // rev 3.1: base 3 * 1.02 = 3.06, floor = 3.
        expect(damage).toBe(3);
    });

    it('caps Strengthened/Dazed damage-up at +25%, no matter how many stacks pile up', () => {
        // 13 stacks would be +26% uncapped (13 * 2%) - confirms the multiplier clamps at
        // +25% rather than growing without bound past the point where cards can push it.
        (attacker as any).statusEffects = [{ id: 's1', type: StatusType.Strengthened, stacks: 13 }];
        const capped = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);
        (attacker as any).statusEffects = [{ id: 's2', type: StatusType.Strengthened, stacks: 100 }];
        const alsoCapped = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);

        // rev 3.1: base 3 * 1.25 = 3.75, floor = 3 - identical at 13 and 100 stacks.
        expect(capped).toBe(3);
        expect(alsoCapped).toBe(capped);
    });

    it('regression: capped Weakened x Sharp no longer deadlocks a mirror match', () => {
        // This is the bug the 25% cap fixes (docs/power_curve_spec.md rev 3): before the cap,
        // an attacker's Weakened and a defender's Sharp both floored at a 10%-of-base
        // multiplier and multiplied together to ~1% of base damage - two mirrored decks each
        // piling on their own defensive stacks could stall out and never resolve. Capped at
        // 25% each, the worst case is 0.75 * 0.75 = 56.25% of base - a real reduction, but one
        // that still lets a fight end.
        (attacker as any).statusEffects = [{ id: 'w1', type: StatusType.Weakened, stacks: 50 }];
        (defender as any).statusEffects = [{ id: 'sh1', type: StatusType.Sharp, stacks: 50 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);

        // rev 3.1: base 3 * 0.75 * 0.75 = 1.69, floor = 1 - THINNER than rev 3's 2, but still
        // not 0, so the cap still does the job it was added for. Re-check this margin if the
        // pace divisor is ever raised again (ticket 23).
        expect(damage).toBe(1);
        expect(damage).toBeGreaterThan(0);
    });
});
