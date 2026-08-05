import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { StatusType } from './types';
import { calculateHeal } from './combatUtils';

/**
 * Stance system (Hel / EQUINOX_TOGGLE):
 * - DarkStance / LightStance are mutually exclusive, cap at 1 stack, never decay.
 * - DarkStance: +30% outgoing damage. LightStance: +50% healing.
 * - SHIFT_STANCE card actions shift the SOURCE's stance (Watcher model).
 * - hel_v1 OS draws 1 card whenever its owner gains a stance.
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
        // shadow_claw: plain 10-power Dark attack, cost 0, no side effects.
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

describe('Light Stance: +50% healing', () => {
    it('boosts healOverride-based heals by 50% through the real reducer', () => {
        // Dawn's Respite heals BEFORE it shifts (Watcher ordering), so the first
        // play heals the base 10 and the second play (already in Light Stance)
        // heals the boosted 15.
        let state = makeState({ currentHp: 100 }, [card('c1', 'dawns_respite'), card('c2', 'dawns_respite')]);

        state = play(state, 'c1', PLAYER_ID);
        expect(state.playerParty[0].currentHp).toBe(110); // base 10, shift happens after

        state = play(state, 'c2', PLAYER_ID);
        expect(state.playerParty[0].currentHp).toBe(125); // 10 * 1.5 = 15 while in Light Stance
    });

    it('boosts power-based heals in calculateHeal by exactly 1.5x', () => {
        const healer = makeEntity(PLAYER_ID, 'Healer');
        const stancedHealer = makeEntity(PLAYER_ID, 'Healer', {
            statusEffects: [{ id: 's1', type: StatusType.LightStance, stacks: 1 }]
        });
        const wounded = makeEntity(ENEMY_ID, 'Wounded', { currentHp: 1 }); // plenty of missing HP

        const base = calculateHeal(healer, wounded, 10);
        const boosted = calculateHeal(stancedHealer, wounded, 10);

        expect(base).toBeGreaterThan(0);
        // docs/power_curve_spec.md rev 3: calculateHeal is now a flat % of the RECEIVING
        // entity's maxHp (`maxHp * power / 400`), not scaled by the healer's level/attack -
        // the healer's own stats no longer matter here at all.
        expect(base).toBe(Math.floor((wounded.maxHp * 10) / 400));
        expect(boosted).toBe(Math.floor(((wounded.maxHp * 10) / 400) * 1.5));
        expect(boosted).toBeGreaterThan(base);
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

describe('hel_v1 EQUINOX_TOGGLE OS', () => {
    it('draws 1 card when the owner shifts stance', () => {
        let state = makeState(
            { activeOS: 'hel_v1' },
            [card('c1', 'nightfall_edge')],
            [card('d1', 'shadow_claw', 0), card('d2', 'shadow_claw', 0)]
        );

        state = play(state, 'c1');

        expect(state.playerDeck.hand).toHaveLength(1); // played card left the hand, 1 drawn
        expect(state.playerDeck.drawpile).toHaveLength(1);
        expect(state.logs.some(l => l.includes('EQUINOX: stance shift synchronized — drew 1'))).toBe(true);
    });

    it('does NOT draw again when re-entering the same stance (no actual shift)', () => {
        let state = makeState(
            { activeOS: 'hel_v1' },
            [card('c1', 'nightfall_edge'), card('c2', 'nightfall_edge')],
            [card('d1', 'shadow_claw', 0), card('d2', 'shadow_claw', 0)]
        );

        state = play(state, 'c1'); // shift: draws 1 → hand = [c2, d1]
        expect(state.playerDeck.hand).toHaveLength(2);

        state = play(state, 'c2'); // already in Dark Stance: no shift, no draw → hand = [d1]
        expect(state.playerDeck.hand).toHaveLength(1);
        expect(state.playerDeck.drawpile).toHaveLength(1);
    });

    it('draws on every real shift (Dark → Light → Dark)', () => {
        let state = makeState(
            { activeOS: 'hel_v1' },
            [card('c1', 'nightfall_edge'), card('c2', 'dawns_respite'), card('c3', 'nightfall_edge')],
            [card('d1', 'shadow_claw', 0), card('d2', 'shadow_claw', 0), card('d3', 'shadow_claw', 0)]
        );

        state = play(state, 'c1');
        state = play(state, 'c2', PLAYER_ID);
        state = play(state, 'c3');

        // 3 plays left the hand, 3 shifts drew 3 cards.
        expect(state.playerDeck.hand).toHaveLength(3);
        expect(state.playerDeck.drawpile).toHaveLength(0);
        expect(state.logs.filter(l => l.includes('EQUINOX: stance shift synchronized')).length).toBe(3);
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
