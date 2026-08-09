import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { StatusType } from './types';
import { calculateHeal } from './combatUtils';

/**
 * Stance system (Hel / TWILIGHT_CADENCE):
 * - DarkStance / LightStance are mutually exclusive, cap at 1 stack, never decay.
 * - DarkStance: +30% outgoing damage. LightStance: -30% damage TAKEN (ticket 36 - it
 *   used to grant +50% healing, which was dead weight on a defense-60 striker; the
 *   +50% moved onto hel_v2's UNDERWORLD_GATEWAY via the new onHealCalculated path).
 * - SHIFT_STANCE card actions shift the SOURCE's stance (Watcher model).
 * - hel_v1 TWILIGHT_CADENCE sets her stance from the ELEMENT of the card she just cast,
 *   on onActionEnd - so the card that sets a stance never benefits from it.
 *
 * These tests use the REAL program registry (nightfall_edge / dawns_respite /
 * shadow_claw are real cards) and the real reducer.
 */

const PLAYER_ID = 'stance_player_1';
const ENEMY_ID = 'stance_enemy_1';

const makeEntity = (id: string, name: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id,
    name,
    definitionId: 'hel',
    nickname: name,
    level: 10,
    experience: 0,
    blueprintsCollected: 0,
    attackIV: 0,
    defenseIV: 0,
    hpIV: 0,
    maxHp: 200,
    currentHp: 200,
    tempHp: 0,
    attack: 100,
    defense: 10,
    maxEnergy: 5,
    currentEnergy: 5,
    cardDraw: 3,
    speed: 10,
    primaryElement: 'None',
    statusEffects: [],
    hooks: [],
    daemons: [],
    ...overrides
});

const makeState = (playerOverrides: Partial<IBattleEntity> = {}, hand: ProgramEntity[] = [], drawpile: ProgramEntity[] = []): IBattleState => ({
    sessionId: 'stance-test',
    seed: '12345',
    turn: 1,
    phase: 'ACTION',
    activeSide: 'PLAYER',
    activeRelics: [],
    playerParty: [makeEntity(PLAYER_ID, 'Hel', playerOverrides)],
    enemyParty: [makeEntity(ENEMY_ID, 'Target Dummy')],
    playerDeck: { ownerId: 'PLAYER', deck: [], drawpile, hand, discard: [], exhaust: [] },
    enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
    logs: [],
    osLogs: [],
    procs: [],
    cardsPlayedThisTurn: 0,
    cardsDrawnThisTurn: 0,
    lastProgramPlayed: null,
    counters: {},
    levelUpQueue: []
});

const card = (id: string, dataId: string, cost = 1): ProgramEntity => ({ id, dataId, currentCost: cost, isPlayable: true });

const play = (state: IBattleState, programId: string, targetId: string = ENEMY_ID): IBattleState =>
    battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: PLAYER_ID, targetId, programId } });

const getStatus = (entity: IBattleEntity, type: StatusType) => entity.statusEffects.find(s => s.type === type);

describe('Stance exclusivity and stacking', () => {
    it('playing Nightfall Edge shifts the SOURCE into Dark Stance (even though the card targets an enemy)', () => {
        const state = makeState({}, [card('c1', 'nightfall_edge')]);
        const next = play(state, 'c1');

        const player = next.playerParty[0];
        expect(getStatus(player, StatusType.DarkStance)?.stacks).toBe(1);
        expect(getStatus(next.enemyParty[0], StatusType.DarkStance)).toBeUndefined();
        expect(next.logs.some(l => l.includes('☾') && l.includes('enters Dark Stance'))).toBe(true);
    });

    it("playing Dawn's Respite shifts into Light Stance and removes Dark Stance", () => {
        let state = makeState({}, [card('c1', 'nightfall_edge'), card('c2', 'dawns_respite')]);
        state = play(state, 'c1');
        expect(getStatus(state.playerParty[0], StatusType.DarkStance)?.stacks).toBe(1);

        state = play(state, 'c2', PLAYER_ID);
        const player = state.playerParty[0];
        expect(getStatus(player, StatusType.LightStance)?.stacks).toBe(1);
        expect(getStatus(player, StatusType.DarkStance)).toBeUndefined();
        expect(state.logs.some(l => l.includes('☀') && l.includes('enters Light Stance'))).toBe(true);
    });

    it('entering Dark Stance removes Light Stance (reverse direction)', () => {
        let state = makeState({}, [card('c1', 'dawns_respite'), card('c2', 'nightfall_edge')]);
        state = play(state, 'c1', PLAYER_ID);
        state = play(state, 'c2');

        const player = state.playerParty[0];
        expect(getStatus(player, StatusType.DarkStance)?.stacks).toBe(1);
        expect(getStatus(player, StatusType.LightStance)).toBeUndefined();
    });

    it('re-entering the same stance caps at 1 stack', () => {
        let state = makeState({}, [card('c1', 'nightfall_edge'), card('c2', 'nightfall_edge')]);
        state = play(state, 'c1');
        state = play(state, 'c2');

        const player = state.playerParty[0];
        const stance = getStatus(player, StatusType.DarkStance);
        expect(stance?.stacks).toBe(1);
        expect(player.statusEffects.filter(s => s.type === StatusType.DarkStance)).toHaveLength(1);
    });
});

describe('Dark Stance: +30% outgoing damage', () => {
    it('an identical attack deals exactly +30% (floored) while in Dark Stance, through the real reducer', () => {
        // shadow_claw: 0-cost Dark poke, 5 power + 1 Weakened (ticket 36 redesign). The
        // Weakened lands on the TARGET after the hit, so it cannot skew this measurement.
        const baseState = makeState({}, [card('c1', 'shadow_claw', 0)]);
        const afterBase = play(baseState, 'c1');
        const baseDamage = 200 - afterBase.enemyParty[0].currentHp;
        expect(baseDamage).toBeGreaterThan(0);

        const stancedState = makeState(
            { statusEffects: [{ id: 's1', type: StatusType.DarkStance, stacks: 1 }] },
            [card('c1', 'shadow_claw', 0)]
        );
        const afterStanced = play(stancedState, 'c1');
        const stancedDamage = 200 - afterStanced.enemyParty[0].currentHp;

        expect(stancedDamage).toBe(Math.floor(baseDamage * 1.3));
        expect(stancedDamage).toBeGreaterThan(baseDamage);
    });

    it('does not boost damage while in Light Stance', () => {
        const baseState = makeState({}, [card('c1', 'shadow_claw', 0)]);
        const baseDamage = 200 - play(baseState, 'c1').enemyParty[0].currentHp;

        const lightState = makeState(
            { statusEffects: [{ id: 's1', type: StatusType.LightStance, stacks: 1 }] },
            [card('c1', 'shadow_claw', 0)]
        );
        const lightDamage = 200 - play(lightState, 'c1').enemyParty[0].currentHp;

        expect(lightDamage).toBe(baseDamage);
    });
});

describe('Light Stance: -30% damage taken', () => {
    it('an identical attack lands for exactly -30% (floored) into Light Stance, through the real reducer', () => {
        const baseState = makeState({}, [card('c1', 'nights_bite')]);
        const baseDamage = 200 - play(baseState, 'c1').enemyParty[0].currentHp;
        expect(baseDamage).toBeGreaterThan(0);

        const guardedState: IBattleState = {
            ...baseState,
            enemyParty: [{
                ...baseState.enemyParty[0],
                statusEffects: [{ id: 's1', type: StatusType.LightStance, stacks: 1 }]
            }]
        };
        const guardedDamage = 200 - play(guardedState, 'c1').enemyParty[0].currentHp;

        expect(guardedDamage).toBe(Math.floor(baseDamage * 0.7));
        expect(guardedDamage).toBeLessThan(baseDamage);
    });

    it('no longer boosts healing at all - the +50% retired to hel_v2 UNDERWORLD_GATEWAY', () => {
        const healer = makeEntity(PLAYER_ID, 'Healer');
        const stancedHealer = makeEntity(PLAYER_ID, 'Healer', {
            statusEffects: [{ id: 's1', type: StatusType.LightStance, stacks: 1 }]
        });
        const wounded = makeEntity(ENEMY_ID, 'Wounded', { currentHp: 1 }); // plenty of missing HP

        const base = calculateHeal(healer, wounded, 10);
        const stanced = calculateHeal(stancedHealer, wounded, 10);

        // docs/power_curve_spec.md rev 3: calculateHeal is a flat % of the RECEIVING
        // entity's maxHp (`maxHp * power / 400`), not scaled by the healer's stats.
        expect(base).toBe(Math.floor((wounded.maxHp * 10) / 400));
        expect(stanced).toBe(base);
    });

    it('leaves healOverride heals alone in either stance', () => {
        // Dawn's Respite heals 10 flat and then shifts. Both plays heal the same 10 now.
        let state = makeState({ currentHp: 100 }, [card('c1', 'dawns_respite'), card('c2', 'dawns_respite')]);

        state = play(state, 'c1', PLAYER_ID);
        expect(state.playerParty[0].currentHp).toBe(110);

        state = play(state, 'c2', PLAYER_ID); // already in Light Stance
        expect(state.playerParty[0].currentHp).toBe(120);
    });

    it('does not boost heals while in Dark Stance', () => {
        let state = makeState(
            { currentHp: 100, statusEffects: [{ id: 's1', type: StatusType.DarkStance, stacks: 1 }] },
            [card('c1', 'leech_strike')]
        );
        // leech_strike: attack + healOverride 10 on SELF; Dark Stance must not touch the heal.
        state = play(state, 'c1');
        expect(state.playerParty[0].currentHp).toBe(110);
    });
});

describe('hel_v1 TWILIGHT_CADENCE OS', () => {
    it('a Dark card leaves her in Dark Stance at end of action', () => {
        let state = makeState({ activeOS: 'hel_v1' }, [card('c1', 'shadow_claw', 0)]);
        state = play(state, 'c1');

        expect(getStatus(state.playerParty[0], StatusType.DarkStance)?.stacks).toBe(1);
        expect(getStatus(state.playerParty[0], StatusType.LightStance)).toBeUndefined();
    });

    it('a Light card leaves her in Light Stance and strips Dark', () => {
        let state = makeState(
            { activeOS: 'hel_v1' },
            [card('c1', 'shadow_claw', 0), card('c2', 'pale_mercy', 0)]
        );
        state = play(state, 'c1');
        expect(getStatus(state.playerParty[0], StatusType.DarkStance)?.stacks).toBe(1);

        state = play(state, 'c2', PLAYER_ID);
        expect(getStatus(state.playerParty[0], StatusType.LightStance)?.stacks).toBe(1);
        expect(getStatus(state.playerParty[0], StatusType.DarkStance)).toBeUndefined();
    });

    it('a None-element card commits to NO stance, and does not clear the one she holds', () => {
        // Designed third option: Tackle / water_slap / hamstring are how she acts without
        // committing. The hooks are element-gated, so a None card simply never fires one.
        let state = makeState(
            { activeOS: 'hel_v1' },
            [card('c1', 'water_slap', 0), card('c2', 'shadow_claw', 0), card('c3', 'water_slap', 0)]
        );
        state = play(state, 'c1');
        expect(getStatus(state.playerParty[0], StatusType.DarkStance)).toBeUndefined();
        expect(getStatus(state.playerParty[0], StatusType.LightStance)).toBeUndefined();

        state = play(state, 'c2');
        expect(getStatus(state.playerParty[0], StatusType.DarkStance)?.stacks).toBe(1);

        state = play(state, 'c3');
        expect(getStatus(state.playerParty[0], StatusType.DarkStance)?.stacks).toBe(1);
    });

    it('the card that SETS the stance never benefits from it - only the next one does', () => {
        // This is the whole reason the trigger is onActionEnd rather than onActionStart.
        const fresh = makeState({ activeOS: 'hel_v1' }, [card('c1', 'nights_bite')]);
        const afterFresh = play(fresh, 'c1');
        const openingDamage = 200 - afterFresh.enemyParty[0].currentHp;

        // ...and she is holding Dark Stance once it resolves.
        expect(getStatus(afterFresh.playerParty[0], StatusType.DarkStance)?.stacks).toBe(1);

        const braced = makeState(
            { activeOS: 'hel_v1', statusEffects: [{ id: 's1', type: StatusType.DarkStance, stacks: 1 }] },
            [card('c1', 'nights_bite')]
        );
        const followUpDamage = 200 - play(braced, 'c1').enemyParty[0].currentHp;

        expect(openingDamage).toBeGreaterThan(0);
        expect(followUpDamage).toBe(Math.floor(openingDamage * 1.3));
    });

    it('fires once per PROGRAM, not once per action - a multi-action card cannot flip her mid-card', () => {
        // dawnstrike is Light and has two actions (ATTACK then HEAL). One stance, one apply.
        let state = makeState({ activeOS: 'hel_v1' }, [card('c1', 'dawnstrike')]);
        state = play(state, 'c1');

        const stances = state.playerParty[0].statusEffects.filter(
            s => s.type === StatusType.LightStance || s.type === StatusType.DarkStance
        );
        expect(stances).toHaveLength(1);
        expect(stances[0].type).toBe(StatusType.LightStance);
        expect(stances[0].stacks).toBe(1);
    });
});

describe('hel_v2 UNDERWORLD_GATEWAY', () => {
    it('boosts her healing by 50% through the new onHealCalculated path', () => {
        // dawns_respite: 1e, heals 10 flat. The FIRST cast of a turn pays the base rate -
        // 5% of 200 maxHp x 1 printed Energy = 10 HP - charged at action start; the heal
        // then lands at 10 x 1.5 = 15.
        let state = makeState({ activeOS: 'hel_v2', currentHp: 100 }, [card('c1', 'dawns_respite')]);
        state = play(state, 'c1', PLAYER_ID);

        expect(state.playerParty[0].currentHp).toBe(105); // 100 - 10 toll + 15 boosted heal
        expect(state.logs.some(l => l.includes('UNDERWORLD_GATEWAY pays in blood'))).toBe(true);
    });

    it('escalates: every further card that turn costs 125% more than the last step', () => {
        // Ticket 36 second pass. A FLAT toll cannot brake her - she has no Energy limit, so
        // nothing stopped her emptying and refilling her hand on turn one (6.5 casts on the
        // turn she scored a first-turn kill, and doubling the flat rate moved the FTK count
        // by zero). The multiplier is `1 + 1.25 x plays already made this turn`, so on a 200
        // maxHp frame a 1e card costs 10, then 22, then 35.
        let state = makeState(
            { activeOS: 'hel_v2', currentHp: 200, cardDraw: 4 },
            [card('c1', 'nights_bite'), card('c2', 'nights_bite'), card('c3', 'nights_bite')]
        );

        const tolls: number[] = [];
        for (const id of ['c1', 'c2', 'c3']) {
            const before = state.playerParty[0].currentHp;
            state = play(state, id);
            tolls.push(before - state.playerParty[0].currentHp);
        }

        expect(tolls).toEqual([10, 22, 35]);
    });

    it('charges no toll for a 0-cost card', () => {
        let state = makeState({ activeOS: 'hel_v2', currentHp: 100 }, [card('c1', 'water_slap', 0)]);
        state = play(state, 'c1');

        expect(state.playerParty[0].currentHp).toBe(100);
        expect(state.logs.some(l => l.includes('UNDERWORLD_GATEWAY'))).toBe(false);
    });

    it('lets her cast a 3e card on a 2-Energy frame, and charges 15% of her pool for it', () => {
        let state = makeState(
            { activeOS: 'hel_v2', currentHp: 200, currentEnergy: 2, maxEnergy: 2 },
            [card('c1', 'soul_tithe', 3)]
        );
        const before = state.enemyParty[0].currentHp;
        state = play(state, 'c1');

        expect(state.enemyParty[0].currentHp).toBeLessThan(before); // it actually resolved
        expect(state.playerParty[0].currentHp).toBe(170);           // 3 x 5% of 200 = 30 HP
        expect(state.playerParty[0].currentEnergy).toBe(2);         // and cost her no Energy
    });
});

describe('Stance persistence', () => {
    it('stances survive END_TURN with no decay and no damage', () => {
        let state = makeState({}, [card('c1', 'nightfall_edge')]);
        state = play(state, 'c1');
        const hpBefore = state.playerParty[0].currentHp;

        state = battleReducer(state, { type: 'END_TURN' });          // PLAYER post-turn
        state = battleReducer(state, { type: 'END_TURN' });          // ENEMY post-turn, back to PLAYER

        const player = state.playerParty[0];
        expect(getStatus(player, StatusType.DarkStance)?.stacks).toBe(1);
        expect(player.currentHp).toBe(hpBefore);
    });
});
