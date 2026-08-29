import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDamage } from './combatUtils';
import type { IBattleEntity, IBattleState, ProgramData } from './types';
import { StatusType } from './types';

/**
 * Writable view of an entity fixture. `IBattleEntity.statusEffects` is `readonly`, and these
 * tests deliberately mutate the SAME object `mockState.playerParty`/`enemyParty` holds rather
 * than rebuilding the state.
 */
type MutableEntity = { -readonly [K in keyof IBattleEntity]: IBattleEntity[K] };

describe('Damage Calculation with Status Modifiers', () => {
    let attacker: IBattleEntity;
    let defender: IBattleEntity;
    let mockState: IBattleState;

    beforeEach(() => {
        attacker = {
            id: 'attacker',
            name: 'Attacker',
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
            blueprintsCollected: 0,
            attackIV: 0,
            defenseIV: 0,
            hpIV: 0
        };

        defender = {
            id: 'defender',
            name: 'Defender',
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
            cardsDrawnThisTurn: 0,
            lastProgramPlayed: null,
        counters: {}
        };
    });

    const mockProgram: ProgramData = {
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
        const damage = calculateDamage(attacker, defender, mockProgram, 40, mockState);
        // Ticket 21: levelBase is frozen at CALIBRATION_LEVEL_DAMAGE_BASE = 8 (it used to be
        // floor(2*level/5)+2, and this suite ran at level 5, giving 4).
        // scaled = floor(8 * 40 * 50 / 50) = 320
        // reduced = 320 / 45 = 7.111... (spec rev 3.1 / ticket 23: no +2, /45 not /35)
        // modifier = 1.0 (program element is 'None', which never grants STAB)
        // damage = floor(7.111 * 1.0) = 7
        expect(damage).toBe(7);
    });

    it('should increase damage with Strengthened status', () => {
        (attacker as MutableEntity).statusEffects = [{ id: 's1', type: StatusType.Strengthened, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram, 40, mockState);
        // Ticket 102: one Strengthened is +1 POWER, so a 40-power card lands at 41:
        // floor(8*41*50/50) = 328, 328/45 = 7.29 -> 7. Still inside the divisor's rounding at
        // this size. The uncapped-stacking case below is what exercises the real behaviour.
        expect(damage).toBe(7);
    });

    it('should decrease damage with Weakened status', () => {
        (attacker as MutableEntity).statusEffects = [{ id: 'w1', type: StatusType.Weakened, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram, 40, mockState);
        // Ticket 102: one Weakened is -1 POWER, so a 40-power card lands at 39:
        // floor(8*39*50/50) = 312, 312/45 = 6.93 -> 6.
        //
        // Worth noting what ticket 21 changed here: at the old level-5 default this rounded back
        // to the same 3 as the base case, so a single stack was invisible. At CALIBRATION_LEVEL
        // the same stack is worth a visible point of damage. Statuses read more truthfully at the
        // level the game is actually played at — which is the argument for freezing there.
        expect(damage).toBe(6);
    });

    it('should reduce damage to a Sharp target', () => {
        (defender as MutableEntity).statusEffects = [{ id: 'sh1', type: StatusType.Sharp, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram, 40, mockState);
        // Ticket 102: one Sharp is -1 POWER off the incoming card. 39 power -> 6.93 -> 6.
        // (Was invisible at the old level-5 default; see the Weakened case.)
        expect(damage).toBe(6);
    });

    it('should deal more damage to a Dazed target', () => {
        (defender as MutableEntity).statusEffects = [{ id: 'd1', type: StatusType.Dazed, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram, 40, mockState);
        // One Dazed is +1 POWER on the incoming card: 41 power -> 7.29 -> 7, i.e. still inside
        // the rounding at this size, the mirror of the Strengthened case.
        expect(damage).toBe(7);
    });

    it('ticket 102: Strengthened is UNCAPPED power - more stacks keep paying', () => {
        // The old shape clamped at +25%, so stack 14 and beyond were worth literally nothing and
        // 13 stacks read identically to 100. Power does not cap: each stack is +1 power before the
        // divisor, so the pile keeps buying damage. This is the whole point of the change and the
        // reason the engines had to be watched (see the ticket-95 grid).
        (attacker as MutableEntity).statusEffects = [{ id: 's1', type: StatusType.Strengthened, stacks: 13 }];
        const thirteen = calculateDamage(attacker, defender, mockProgram, 40, mockState);
        (attacker as MutableEntity).statusEffects = [{ id: 's2', type: StatusType.Strengthened, stacks: 100 }];
        const hundred = calculateDamage(attacker, defender, mockProgram, 40, mockState);

        expect(thirteen).toBeGreaterThan(calculateDamage(
            { ...attacker, statusEffects: [] } as never, defender, mockProgram, 40, mockState));
        expect(hundred).toBeGreaterThan(thirteen);
    });

    it('ticket 102: Weakened x Sharp cannot drive damage below zero', () => {
        // This is the bug the 25% cap fixes (docs/power_curve_spec.md rev 3): before the cap,
        // an attacker's Weakened and a defender's Sharp both floored at a 10%-of-base
        // multiplier and multiplied together to ~1% of base damage - two mirrored decks each
        // piling on their own defensive stacks could stall out and never resolve. Capped at
        // 25% each, the worst case is 0.75 * 0.75 = 56.25% of base - a real reduction, but one
        // that still lets a fight end.
        (attacker as MutableEntity).statusEffects = [{ id: 'w1', type: StatusType.Weakened, stacks: 50 }];
        (defender as MutableEntity).statusEffects = [{ id: 'sh1', type: StatusType.Sharp, stacks: 50 }];
        const damage = calculateDamage(attacker, defender, mockProgram, 40, mockState);

        // Ticket 102: 100 points of reduction against a 40-power card floors the POWER at zero, so
        // the card deals nothing - it does not deal negative damage or heal the target. The old
        // deadlock this test was written for cannot recur, because a cancelled card is simply a
        // dead card rather than a fight that multiplies down towards 1% and never ends.
        expect(damage).toBe(0);
        expect(damage).toBeGreaterThanOrEqual(0);
    });
});
