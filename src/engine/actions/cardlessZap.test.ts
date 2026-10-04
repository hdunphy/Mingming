/**
 * TICKET 193a — a hook-fired attack with no card behind it is not an attack.
 *
 * Henry (2026-10-04): *"It's not an attack."* Feedback Loop's zap (`daemon_draw_damage_proc`) and
 * Short Circuit's (`short_circuit_discharge`) fire from an `onCardDraw` hook, so the executor has no
 * program to hand the damage modifiers and invents `{ element }`. That stand-in had no `actions`, and
 * every Driver hook with `actionType: "ATTACK"` read `program.actions.some(...)` and threw. 2026-10-02
 * r01 died of it on entering the layer-4 elite, with FIRST BLOOD installed.
 *
 * The ruling's meaning: the stand-in carries an honest empty action list, so an `actionType` check is
 * false and the zap gets no FIRST BLOOD, TENTH STRIKE or element Driver boost, and does not count
 * toward them. A malformed program can also never throw again.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from '../battleReducer';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import { GetProgramData } from '../data/programRegistry';
import { applyDriver } from '../data/driverRegistry';
import { ConditionValidator } from '../core/ConditionValidator';
import { standInProgram } from './standInProgram';
import type { IBattleState, IBattleEntity } from '../types';

const FRAME = 2000;

function unit(id: string, extra: Partial<IBattleEntity> = {}): IBattleEntity {
    return createSparseEntity({ id, name: id, currentHp: FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5, ...extra });
}

/** The player plays Forage (an effect draw) holding the Aura and the Driver. */
function drawWith(drivers: string[]): IBattleState {
    let caster = unit('p1', { hooks: ['daemon_draw_damage_proc'] });
    for (const d of drivers) caster = applyDriver(caster, d);
    const state = createSparseBattleState({
        activeSide: 'PLAYER', phase: 'ACTION',
        playerParty: [caster],
        enemyParty: [unit('e1')],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], discard: [], exhaust: [],
            drawpile: [{ id: 'd1', dataId: 'tackle', currentCost: 1, isPlayable: true }],
            hand: [{ id: 'h1', dataId: 'forage', currentCost: GetProgramData('forage').baseCost as number, isPlayable: true }],
        },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
    });
    return battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'p1', programId: 'h1' } } as never);
}

const foeHp = (s: IBattleState): number => s.enemyParty[0].currentHp;

describe('193a — Feedback Loop under a Driver', () => {
    it.each(['driver_first_blood', 'driver_tenth_strike', 'driver_element_water'])('does not throw with %s installed', (driver) => {
        expect(() => drawWith([driver])).not.toThrow();
    });

    it('the zap still lands', () => {
        expect(foeHp(drawWith(['driver_first_blood']))).toBeLessThan(FRAME);
    });

    it('is not boosted by the Water Driver (a card-less zap is not an attack)', () => {
        expect(foeHp(drawWith(['driver_element_water']))).toBe(foeHp(drawWith([])));
    });

    it('is not boosted by First Blood either', () => {
        expect(foeHp(drawWith(['driver_first_blood']))).toBe(foeHp(drawWith([])));
    });
});

describe('193a — Short Circuit under a Driver on the zapping side', () => {
    it('an enemy that draws is zapped and the owner\'s Driver does not throw', () => {
        const enemy = unit('e1');
        const state = createSparseBattleState({
            activeSide: 'ENEMY', phase: 'ACTION',
            playerParty: [applyDriver(unit('p1', { hooks: ['short_circuit_discharge'] }), 'driver_first_blood')],
            enemyParty: [enemy],
            playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
            enemyDeck: {
                ownerId: 'ENEMY', deck: [], discard: [], exhaust: [],
                drawpile: [{ id: 'd1', dataId: 'tackle', currentCost: 1, isPlayable: true }],
                hand: [{ id: 'h1', dataId: 'forage', currentCost: 0, isPlayable: true }],
            },
        });
        let next: IBattleState | undefined;
        expect(() => { next = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'e1', targetId: 'e1', programId: 'h1' } } as never); }).not.toThrow();
        expect(next!.enemyParty[0].currentHp).toBeLessThan(FRAME);
    });
});

describe('193a — the stand-in program', () => {
    it('has the element and an honest empty action list', () => {
        const p = standInProgram('Water');
        expect(p.element).toBe('Water');
        expect(p.actions).toEqual([]);
    });

    it('a program with no actions list at all cannot make the validator throw', () => {
        const owner = unit('p1');
        const state = createSparseBattleState({ playerParty: [owner] });
        const broken = { element: 'Water' } as never;
        expect(() => ConditionValidator.evaluateHookCondition(
            { source: 'SELF', actionType: 'ATTACK' } as never,
            { state, program: broken, source: owner } as never,
            owner,
        )).not.toThrow();
    });
});
