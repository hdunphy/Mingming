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

    it('leaves heals alone in either stance', () => {
        // Dawn's Respite heals and then shifts. Ticket 43 made it power-based: 200 maxHp * 25
        // power / 400 = 12 a cast, the same in or out of stance.
        let state = makeState({ currentHp: 100 }, [card('c1', 'dawns_respite'), card('c2', 'dawns_respite')]);

        state = play(state, 'c1', PLAYER_ID);
        expect(state.playerParty[0].currentHp).toBe(112);

        state = play(state, 'c2', PLAYER_ID); // already in Light Stance
        expect(state.playerParty[0].currentHp).toBe(124);
    });

    it('does not boost heals while in Dark Stance', () => {
        let state = makeState(
            { currentHp: 100, statusEffects: [{ id: 's1', type: StatusType.DarkStance, stacks: 1 }] },
            [card('c1', 'leech_strike')]
        );
        // leech_strike: attack + a power-30 heal on SELF (ticket 39 moved it off healOverride);
        // Dark Stance must not touch the heal. calculateHeal = maxHp * power / 400 = 200*30/400.
        state = play(state, 'c1');
        expect(state.playerParty[0].currentHp).toBe(115);
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

describe('hel_v2 UNDERWORLD_GATEWAY (ticket 57: throttled blood, %-denominated)', () => {
    // Ticket 57 replaced the two data hooks with the firmware in CustomFirmware.ts. Three things
    // changed and all three are pinned below: the toll is scoped to DARK spells (it used to zero
    // and tax every card she played), the ticket-36 `escalatePerPlay: 1.25` escalation is GONE,
    // and a per-turn budget of 20% of max HP now makes further blood casts UNAFFORDABLE rather
    // than merely expensive.

    it('boosts her healing by 50% through the onHealCalculated path, and charges the flat blood rate', () => {
        // dawns_respite: 1e DARK, a power-25 heal (ticket 43). 5% of 200 maxHp x 1 printed
        // Energy = 10 HP at action start; the heal is 200*25/400 = 12, boosted to 18 by the OS.
        let state = makeState({ activeOS: 'hel_v2', currentHp: 100 }, [card('c1', 'dawns_respite')]);
        state = play(state, 'c1', PLAYER_ID);

        expect(state.playerParty[0].currentHp).toBe(108); // 100 - 10 toll + 18 boosted heal
        expect(state.logs.some(l => l.includes('UNDERWORLD_GATEWAY pays'))).toBe(true);
    });

    it('NO LONGER escalates - the toll is a flat 5% of max HP per printed Energy', () => {
        // Ticket 36 made every further card that turn cost 125% more, because a flat toll could
        // not brake a deck with no Energy limit. Ticket 57 removes the escalation and brakes it
        // with a budget instead: on a 200-maxHp frame every `nights_bite` (1e Dark) costs 10,
        // where the escalating version charged 10, then 22, then 35.
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

        expect(tolls).toEqual([10, 10, 10]);
    });

    it('caps the turn at 20% of max HP - the 5th Energy-point of blood is UNAFFORDABLE, not just costly', () => {
        // 20% / 5% = four Energy-points of Dark per turn. Knob round 1 took the cap to 15% and
        // amendment 1 put it back at 20 - Henry's call, texture over the field number: at 20 the
        // 3-Energy `soul_tithe` and the 1-Energy `venom_shade` fit in the same turn, which is the
        // decision the OS is supposed to be about. Four 1e casts fit exactly; the fifth is
        // refused, and refused by PRICE - the cost hook returns a cost she cannot pay - which is
        // what makes the reducer and the AI agree without a third code path (HANDOFF 8d).
        let state = makeState(
            { activeOS: 'hel_v2', currentHp: 200, cardDraw: 6 },
            ['c1', 'c2', 'c3', 'c4', 'c5'].map(id => card(id, 'nights_bite'))
        );

        for (const id of ['c1', 'c2', 'c3', 'c4']) state = play(state, id);
        expect(state.playerParty[0].currentHp).toBe(160);        // 4 x 10 HP spent
        expect(state.counters['hel_blood_spent:' + PLAYER_ID]).toBe(20);

        const before = state.playerParty[0].currentHp;
        const after = play(state, 'c5');
        expect(after.playerParty[0].currentHp).toBe(before);      // no blood paid
        expect(after.playerDeck.hand.some(c => c.id === 'c5')).toBe(true); // and never left hand
    });

    it('refuses a cast that would OVERSHOOT the cap, not merely one that starts past it', () => {
        // soul_tithe is 3 Energy = 15%. At 10% already spent it is refused even though 10 < 20,
        // because 10 + 15 > 20. A "block only once you are over" rule would have let it through.
        // (At the 20% cap it DOES fit alongside one `venom_shade` - that pairing is the whole
        // reason amendment 1 reverted the knob.)
        let state = makeState(
            { activeOS: 'hel_v2', currentHp: 200, cardDraw: 6 },
            [card('c1', 'nights_bite'), card('c2', 'nights_bite'), card('c3', 'soul_tithe', 3)]
        );
        state = play(state, 'c1');
        state = play(state, 'c2');
        expect(state.counters['hel_blood_spent:' + PLAYER_ID]).toBe(10);

        const after = play(state, 'c3');
        expect(after.playerDeck.hand.some(c => c.id === 'c3')).toBe(true);
        expect(after.playerParty[0].currentHp).toBe(state.playerParty[0].currentHp);
    });

    it('the budget resets at the end of her turn', () => {
        let state = makeState({ activeOS: 'hel_v2', currentHp: 200 }, [card('c1', 'nights_bite')]);
        state = play(state, 'c1');
        expect(state.counters['hel_blood_spent:' + PLAYER_ID]).toBe(5);

        state = battleReducer(state, { type: 'END_TURN' });
        expect(state.counters['hel_blood_spent:' + PLAYER_ID]).toBe(0);
    });

    it('charges no toll for a 0-cost card', () => {
        let state = makeState({ activeOS: 'hel_v2', currentHp: 100 }, [card('c1', 'water_slap', 0)]);
        state = play(state, 'c1');

        expect(state.playerParty[0].currentHp).toBe(100);
        expect(state.logs.some(l => l.includes('UNDERWORLD_GATEWAY'))).toBe(false);
    });

    it('a NON-Dark card pays Energy, not blood - the scope narrowed in ticket 57', () => {
        // The approved OS text is "Hel's DARK spells". The old implementation zeroed the cost of
        // every card she played, which is what made Energy a dead stat on this frame.
        let state = makeState(
            { activeOS: 'hel_v2', currentHp: 200, currentEnergy: 2, maxEnergy: 2 },
            [card('c1', 'dawnstrike')]
        );
        state = play(state, 'c1');

        expect(state.playerParty[0].currentEnergy).toBe(1);   // Energy WAS spent
        expect(state.counters['hel_blood_spent:' + PLAYER_ID] ?? 0).toBe(0); // no blood
    });

    it('lets her cast a 3e Dark card on a 2-Energy frame, and charges 15% of her pool for it', () => {
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
