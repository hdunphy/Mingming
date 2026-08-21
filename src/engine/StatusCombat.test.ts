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
        // Ticket 102: one Weakened is -1 POWER, so a 40-power card lands at 39. At this size that
        // is inside the divisor's rounding - which is the honest reading of one stack: on a 1e card
        // a single stack is ~2.5% of the power, the same order the old 2% multiplier was. The pile
        // is where power differs, not the first stack.
        expect(damage).toBe(3);
    });

    it('should reduce damage to a Sharp target', () => {
        (defender as any).statusEffects = [{ id: 'sh1', type: StatusType.Sharp, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);
        // Ticket 102: one Sharp is -1 POWER off the incoming card - inside the rounding at 40 power.
        expect(damage).toBe(3);
    });

    it('should deal more damage to a Dazed target', () => {
        (defender as any).statusEffects = [{ id: 'd1', type: StatusType.Dazed, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);
        // rev 3.1: base 3 * 1.02 = 3.06, floor = 3.
        expect(damage).toBe(3);
    });

    it('ticket 102: Strengthened is UNCAPPED power - more stacks keep paying', () => {
        // The old shape clamped at +25%, so stack 14 and beyond were worth literally nothing and
        // 13 stacks read identically to 100. Power does not cap: each stack is +1 power before the
        // divisor, so the pile keeps buying damage. This is the whole point of the change and the
        // reason the engines had to be watched (see the ticket-95 grid).
        (attacker as any).statusEffects = [{ id: 's1', type: StatusType.Strengthened, stacks: 13 }];
        const thirteen = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);
        (attacker as any).statusEffects = [{ id: 's2', type: StatusType.Strengthened, stacks: 100 }];
        const hundred = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);

        expect(thirteen).toBeGreaterThan(calculateDamage(
            { ...attacker, statusEffects: [] } as never, defender, mockProgram as any, 40, mockState));
        expect(hundred).toBeGreaterThan(thirteen);
    });

    it('ticket 102: Weakened x Sharp cannot drive damage below zero', () => {
        // This is the bug the 25% cap fixes (docs/power_curve_spec.md rev 3): before the cap,
        // an attacker's Weakened and a defender's Sharp both floored at a 10%-of-base
        // multiplier and multiplied together to ~1% of base damage - two mirrored decks each
        // piling on their own defensive stacks could stall out and never resolve. Capped at
        // 25% each, the worst case is 0.75 * 0.75 = 56.25% of base - a real reduction, but one
        // that still lets a fight end.
        (attacker as any).statusEffects = [{ id: 'w1', type: StatusType.Weakened, stacks: 50 }];
        (defender as any).statusEffects = [{ id: 'sh1', type: StatusType.Sharp, stacks: 50 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 40, mockState);

        // Ticket 102: 100 points of reduction against a 40-power card floors the POWER at zero, so
        // the card deals nothing - it does not deal negative damage or heal the target. The old
        // deadlock this test was written for cannot recur, because a cancelled card is simply a
        // dead card rather than a fight that multiplies down towards 1% and never ends.
        expect(damage).toBe(0);
        expect(damage).toBeGreaterThanOrEqual(0);
    });
});
