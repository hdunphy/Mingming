/**
 * TICKET 185 follow-up (Henry's ruling on the 185 report, decision 1 and 2) — the Drivers that
 * talk about "attack cards" read ATTACK-category cards, not "any card with an ATTACK action in it".
 *
 * Forage ("take damage equal to 15 power") and Dark Pact ("lose 3% of your max HP") carry an ATTACK
 * action aimed at YOURSELF, so card-level `actionType: "ATTACK"` counted them. Henry: *"They should
 * not read forage"*, and Dark Pact "works similarly" so it gets the same fix.
 *
 * The data fix is `programCategoryIn: ["Attack"]` on the Tenth Strike, First Blood and Dark Driver
 * hooks — the same condition 185a put on fenrir_v1. These tests drive the real reducer.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { GetProgramData } from './data/programRegistry';
import { applyDriver } from './data/driverRegistry';
import type { IBattleState } from './types';
import HOOKS from './data/lib/hooks.json';

function play(driverId: string, dataId: string, targetsSelf: boolean): IBattleState {
    const base = createSparseEntity({
        id: 'p1', name: 'Ally', currentHp: 1000, maxHp: 1000, currentEnergy: 5, maxEnergy: 5,
    });
    const deck = {
        ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
        hand: [{ id: 'h1', dataId, currentCost: GetProgramData(dataId).baseCost as number, isPlayable: true }],
    };
    const empty = { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] };
    const state = createSparseBattleState({
        activeSide: 'PLAYER', phase: 'ACTION',
        playerParty: [applyDriver(base, driverId)],
        enemyParty: [createSparseEntity({ id: 'e1', name: 'Foe', currentHp: 1000, maxHp: 1000 })],
        playerDeck: deck, enemyDeck: empty,
    });
    return battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: 'p1', targetId: targetsSelf ? 'p1' : 'e1', programId: 'h1' },
    } as never);
}

const counted = (s: IBattleState, key: string): number =>
    Object.entries(s.counters ?? {}).filter(([k]) => k.includes(key)).reduce((n, [, v]) => n + v, 0);

describe('Tenth Strike counts attack cards only', () => {
    it('Forage does not tick the count', () => {
        expect(counted(play('driver_tenth_strike', 'forage', true), 'tenth_strike')).toBe(0);
    });
    it('Dark Pact does not tick the count', () => {
        expect(counted(play('driver_tenth_strike', 'dark_pact', true), 'tenth_strike')).toBe(0);
    });
    it('Tackle still ticks it', () => {
        expect(counted(play('driver_tenth_strike', 'tackle', false), 'tenth_strike')).toBe(1);
    });
});

describe('First Blood is spent by attack cards only', () => {
    it('Forage does not use up the first blow', () => {
        expect(counted(play('driver_first_blood', 'forage', true), 'first_blood')).toBe(0);
    });
    it('Dark Pact does not use up the first blow', () => {
        expect(counted(play('driver_first_blood', 'dark_pact', true), 'first_blood')).toBe(0);
    });
    it('Tackle still does', () => {
        expect(counted(play('driver_first_blood', 'tackle', false), 'first_blood')).toBe(1);
    });
});

describe('Dark Driver boosts attack cards only', () => {
    const hp = (s: IBattleState, id: string) => s.playerParty.concat(s.enemyParty).find(e => e.id === id)!.currentHp;
    it('a Dark attack card still hits harder under it (positive control)', () => {
        const withDriver = hp(play('driver_element_dark', 'shadow_claw', false), 'e1');
        const without = hp(play('driver_tenth_strike', 'shadow_claw', false), 'e1');
        expect(withDriver).toBeLessThan(without);
    });
    it('Dark Pact does not hurt itself harder under it', () => {
        expect(hp(play('driver_element_dark', 'dark_pact', true), 'p1'))
            .toBe(hp(play('driver_tenth_strike', 'dark_pact', true), 'p1'));
    });
});

describe('the hook data names the Attack category', () => {
    type Hook = { id: string; when?: { actionType?: string; programCategoryIn?: string[] } };
    const hooksOf = (id: string): Hook[] => (HOOKS as unknown as Record<string, { hooks: Hook[] }>)[id].hooks;

    it.each([
        ['driver_tenth_strike', ['count', 'boost', 'fire']],
        ['driver_first_blood', ['count', 'fire', 'boost']],
        ['driver_element_dark', ['boost']],
    ])('%s: every ATTACK-reading hook also asks for the Attack category', (driver, parts) => {
        for (const part of parts) {
            const hook = hooksOf(driver).find(h => h.id === `${driver}_${part}`)!;
            expect(hook, `${driver}_${part}`).toBeDefined();
            expect(hook.when?.programCategoryIn, `${driver}_${part}`).toEqual(['Attack']);
        }
    });
});
