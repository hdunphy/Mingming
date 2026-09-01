import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { StatusType } from './types';
import { calculateHeal } from './combatUtils';
import { STANCE_BONUS } from './core/Hooks';
import { OS_KNOBS } from './core/CustomFirmware';

/**
 * Stance system (Hel / TWILIGHT_CADENCE):
 * - DarkStance / LightStance are mutually exclusive, cap at 1 stack, never decay.
 * - DarkStance: +STANCE_BONUS.dark outgoing damage. LightStance: -STANCE_BONUS.light damage
 *   TAKEN. Ticket 78 raised both from 30% to 50% and made them a knob; these tests read the
 *   knob for the arithmetic AND pin the shipped value separately, so a config change cannot
 *   leave a green test asserting a number nobody ships (the ticket-62 burn lesson). (Ticket 36 - it
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
    blueprintsCollected: 0,
    attackIV: 0,
    defenseIV: 0,
    hpIV: 0,
    maxHp: 2000,
    currentHp: 2000,
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
});

const card = (id: string, dataId: string, cost = 1): ProgramEntity => ({ id, dataId, currentCost: cost, isPlayable: true });

const play = (state: IBattleState, programId: string, targetId: string = ENEMY_ID): IBattleState =>
    battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: PLAYER_ID, targetId, programId } });

const getStatus = (entity: IBattleEntity, type: StatusType) => entity.statusEffects.find(s => s.type === type);

/**
 * TICKET 131c: the frame these tests read damage against, named rather than repeated.
 *
 * Every damage reading in this file was `200 - enemy.currentHp`, where the 200 was the fixture's
 * maxHp written out by hand. When the x10 presentation scale moved the frame to 2000 those readings
 * went NEGATIVE and the comparisons turned into "-1712 is not greater than 0". A named constant
 * that sits next to the fixture cannot drift from it the way a repeated literal did.
 */
const ENEMY_FRAME = 2000;

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

describe('the shipped stance percentages', () => {
    it("are 35% both ways", () => {
        expect(STANCE_BONUS.dark).toBe(0.35);
        expect(STANCE_BONUS.light).toBe(0.35);
    });
});

describe('Dark Stance: outgoing damage bonus', () => {
    it('an identical attack deals exactly the bonus (floored) while in Dark Stance, through the real reducer', () => {
        // shadow_claw: 0-cost Dark poke, 5 power + 1 Weakened (ticket 36 redesign). The
        // Weakened lands on the TARGET after the hit, so it cannot skew this measurement.
        const baseState = makeState({}, [card('c1', 'shadow_claw', 0)]);
        const afterBase = play(baseState, 'c1');
        const baseDamage = ENEMY_FRAME - afterBase.enemyParty[0].currentHp;
        expect(baseDamage).toBeGreaterThan(0);

        const stancedState = makeState(
            { statusEffects: [{ id: 's1', type: StatusType.DarkStance, stacks: 1 }] },
            [card('c1', 'shadow_claw', 0)]
        );
        const afterStanced = play(stancedState, 'c1');
        const stancedDamage = ENEMY_FRAME - afterStanced.enemyParty[0].currentHp;

        expect(stancedDamage).toBe(Math.floor(baseDamage * (1 + STANCE_BONUS.dark)));
        expect(stancedDamage).toBeGreaterThan(baseDamage);
    });

    it('does not boost damage while in Light Stance', () => {
        const baseState = makeState({}, [card('c1', 'shadow_claw', 0)]);
        const baseDamage = ENEMY_FRAME - play(baseState, 'c1').enemyParty[0].currentHp;

        const lightState = makeState(
            { statusEffects: [{ id: 's1', type: StatusType.LightStance, stacks: 1 }] },
            [card('c1', 'shadow_claw', 0)]
        );
        const lightDamage = ENEMY_FRAME - play(lightState, 'c1').enemyParty[0].currentHp;

        expect(lightDamage).toBe(baseDamage);
    });
});

describe('Light Stance: damage-taken reduction', () => {
    it('an identical attack lands for exactly the reduction (floored) into Light Stance, through the real reducer', () => {
        const baseState = makeState({}, [card('c1', 'nights_bite')]);
        const baseDamage = ENEMY_FRAME - play(baseState, 'c1').enemyParty[0].currentHp;
        expect(baseDamage).toBeGreaterThan(0);

        const guardedState: IBattleState = {
            ...baseState,
            enemyParty: [{
                ...baseState.enemyParty[0],
                statusEffects: [{ id: 's1', type: StatusType.LightStance, stacks: 1 }]
            }]
        };
        const guardedDamage = ENEMY_FRAME - play(guardedState, 'c1').enemyParty[0].currentHp;

        expect(guardedDamage).toBe(Math.floor(baseDamage * (1 - STANCE_BONUS.light)));
        expect(guardedDamage).toBeLessThan(baseDamage);
    });

    it('no longer boosts healing at all - the +50% retired to hel_v2 UNDERWORLD_GATEWAY', () => {
        const healer = makeEntity(PLAYER_ID, 'Healer');
        const stancedHealer = makeEntity(PLAYER_ID, 'Healer', {
            statusEffects: [{ id: 's1', type: StatusType.LightStance, stacks: 1 }]
        });
        const wounded = makeEntity(ENEMY_ID, 'Wounded', { currentHp: 10 }); // plenty of missing HP

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
        let state = makeState({ currentHp: 1000 }, [card('c1', 'dawns_respite'), card('c2', 'dawns_respite')]);

        state = play(state, 'c1', PLAYER_ID);
        expect(state.playerParty[0].currentHp).toBe(1125);

        state = play(state, 'c2', PLAYER_ID); // already in Light Stance
        expect(state.playerParty[0].currentHp).toBe(1250);
    });

    it('does not boost heals while in Dark Stance', () => {
        let state = makeState(
            { currentHp: 1000, statusEffects: [{ id: 's1', type: StatusType.DarkStance, stacks: 1 }] },
            [card('c1', 'leech_strike')]
        );
        // leech_strike: attack + a power-30 heal on SELF (ticket 39 moved it off healOverride);
        // Dark Stance must not touch the heal. calculateHeal = maxHp * power / 400 = 200*30/400.
        state = play(state, 'c1');
        expect(state.playerParty[0].currentHp).toBe(1150);
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
        const openingDamage = ENEMY_FRAME - afterFresh.enemyParty[0].currentHp;

        // ...and she is holding Dark Stance once it resolves.
        expect(getStatus(afterFresh.playerParty[0], StatusType.DarkStance)?.stacks).toBe(1);

        const braced = makeState(
            { activeOS: 'hel_v1', statusEffects: [{ id: 's1', type: StatusType.DarkStance, stacks: 1 }] },
            [card('c1', 'nights_bite')]
        );
        const followUpDamage = ENEMY_FRAME - play(braced, 'c1').enemyParty[0].currentHp;

        expect(openingDamage).toBeGreaterThan(0);
        expect(followUpDamage).toBe(Math.floor(openingDamage * (1 + STANCE_BONUS.dark)));
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

describe('hel_v2 UNDERWORLD_GATEWAY (ticket 81: 6% blood, 25% cap, NO healing bonus)', () => {
    // Ticket 57 replaced the two data hooks with the firmware in CustomFirmware.ts. Three things
    // changed and all three are pinned below: the toll is scoped to DARK spells (it used to zero
    // and tax every card she played), the ticket-36 `escalatePerPlay: 1.25` escalation is GONE,
    // and a per-turn budget made further blood casts UNAFFORDABLE rather than merely expensive.
    //
    // TICKET 80 REMOVED THAT BUDGET. Henry: "I really don't like adding arbitrary caps." It
    // was inert anyway - `soul_tithe` costs exactly 15%, so a 20% or even 15% cap never
    // blocked the cast it was aimed at and only ever stopped a rare second Dark card. The
    // price went 5% -> 6% instead, which charges for every cast rather than forbidding one.
    // The cap MACHINERY stays and is pinned below, because Henry's fallback if she is still
    // too strong is a 25% cap, then 20%.

    it('NO LONGER boosts her healing - it charges blood and leaves the heal alone', () => {
        // dawns_respite: 1e DARK, a power-25 heal (ticket 43). 6% of 2000 maxHp x 1 printed
        // Energy = 120 HP at action start; the heal is 2000*25/400 = 125, and ticket 81 removed
        // the +50% that used to make it larger. Henry: the healing bonus is what stopped
        // HP-as-a-cost working - a heal that OUT-EARNS the blood price turns the cost into a loan.
        //
        // TICKET 131c: THIS WAS NEVER "EXACTLY ZERO". The old comment claimed the toll and the heal
        // cancelled precisely, and on a 200 HP frame they appeared to: the toll was 12 and the heal
        // was 200*25/400 = 12.5, which `Math.floor` cut to 12. The heal has always out-earned the
        // toll by half a point; the rounding hid it. On a 2000 frame it is 125 against 120 and the
        // net is +5 - a 4% loan on every cast, exactly the shape ticket 81 was trying to remove.
        // Left as a finding rather than fixed here: changing the blood price or the heal power is a
        // balance decision, not a units one.
        let state = makeState({ activeOS: 'hel_v2', currentHp: 1000 }, [card('c1', 'dawns_respite')]);
        state = play(state, 'c1', PLAYER_ID);

        expect(state.playerParty[0].currentHp).toBe(1005); // 1000 - 120 toll + 125 unboosted heal
        expect(state.logs.some(l => l.includes('UNDERWORLD_GATEWAY pays'))).toBe(true);
    });

    it('NO LONGER escalates - the toll is a flat 6% of max HP per printed Energy', () => {
        // Ticket 36 made every further card that turn cost 125% more, because a flat toll could
        // not brake a deck with no Energy limit. Ticket 57 removes the escalation and brakes it
        // with a price instead: on a 200-maxHp frame every `nights_bite` (1e Dark) costs 12,
        // where the escalating version charged 10, then 22, then 35.
        let state = makeState(
            { activeOS: 'hel_v2', currentHp: 2000, cardDraw: 4 },
            [card('c1', 'nights_bite'), card('c2', 'nights_bite'), card('c3', 'nights_bite')]
        );

        const tolls: number[] = [];
        for (const id of ['c1', 'c2', 'c3']) {
            const before = state.playerParty[0].currentHp;
            state = play(state, id);
            tolls.push(before - state.playerParty[0].currentHp);
        }

        expect(tolls).toEqual([120, 120, 120]);
    });

    it('allows FOUR Energy-points of Dark a turn at the shipped 6% price and 25% cap', () => {
        // Removing the cap outright was tried and made her STRONGER - 81.4% -> 87.0% field -
        // because uncapped she chains Dark casts and the +50% healing refunds the blood faster
        // than the price takes it. 25% at a 6% price allows four Energy-points (24%); the fifth
        // overshoots to 30% and is refused. Note the knob moves in Energy-POINT steps: a cap of
        // 18 behaves identically to 20, because both allow exactly three.
        let state = makeState(
            { activeOS: 'hel_v2', currentHp: 2000, cardDraw: 6 },
            ['c1', 'c2', 'c3', 'c4', 'c5'].map(id => card(id, 'nights_bite'))
        );
        for (const id of ['c1', 'c2', 'c3', 'c4']) state = play(state, id);
        expect(state.playerParty[0].currentHp).toBe(1520);       // 4 x 120 HP paid, 24% of the pool
        const before = state.playerParty[0].currentHp;
        const after = play(state, 'c5');
        expect(after.playerParty[0].currentHp).toBe(before);              // the fifth is refused
        expect(after.playerDeck.hand.some(c => c.id === 'c5')).toBe(true);
    });

    it('the cap MACHINERY still works when a cap is set - Henry\'s 25%/20% fallback', () => {
        // Restoring a cap is a one-value change, not a rebuild, and this is what proves it. At a
        // 20% cap on a 6% price, three 1e casts (18%) fit and the fourth would overshoot to 24%,
        // so it is refused - by PRICE, via the cost hook, which is what makes the reducer and the
        // AI agree without a third code path (HANDOFF 8d).
        const live = OS_KNOBS.hel.capPct;
        OS_KNOBS.hel.capPct = 20;
        try {
            let state = makeState(
                { activeOS: 'hel_v2', currentHp: 2000, cardDraw: 6 },
                ['c1', 'c2', 'c3', 'c4'].map(id => card(id, 'nights_bite'))
            );
            for (const id of ['c1', 'c2', 'c3']) state = play(state, id);
            expect(state.counters['hel_blood_spent:' + PLAYER_ID]).toBe(18);
            const before = state.playerParty[0].currentHp;
            const after = play(state, 'c4');
            expect(after.playerParty[0].currentHp).toBe(before);             // no blood paid
            expect(after.playerDeck.hand.some(c => c.id === 'c4')).toBe(true); // never left hand
        } finally {
            OS_KNOBS.hel.capPct = live;
        }
    });

    it('the shipped price is 6% and the shipped cap is 25%', () => {
        expect(OS_KNOBS.hel.capPct).toBe(25);
        expect(OS_KNOBS.hel.pctPerEnergy).toBe(6);
    });

    it('the budget resets at the end of her turn', () => {
        let state = makeState({ activeOS: 'hel_v2', currentHp: 2000 }, [card('c1', 'nights_bite')]);
        state = play(state, 'c1');
        expect(state.counters['hel_blood_spent:' + PLAYER_ID]).toBe(6);

        state = battleReducer(state, { type: 'END_TURN' });
        expect(state.counters['hel_blood_spent:' + PLAYER_ID]).toBe(0);
    });

    it('charges no toll for a 0-cost card', () => {
        let state = makeState({ activeOS: 'hel_v2', currentHp: 1000 }, [card('c1', 'water_slap', 0)]);
        state = play(state, 'c1');

        expect(state.playerParty[0].currentHp).toBe(1000);   // untouched: a 0-cost card owes no blood
        expect(state.logs.some(l => l.includes('UNDERWORLD_GATEWAY'))).toBe(false);
    });

    it('a NON-Dark card pays Energy, not blood - the scope narrowed in ticket 57', () => {
        // The approved OS text is "Hel's DARK spells". The old implementation zeroed the cost of
        // every card she played, which is what made Energy a dead stat on this frame.
        let state = makeState(
            { activeOS: 'hel_v2', currentHp: 2000, currentEnergy: 2, maxEnergy: 2 },
            [card('c1', 'dawnstrike')]
        );
        state = play(state, 'c1');

        expect(state.playerParty[0].currentEnergy).toBe(1);   // Energy WAS spent
        expect(state.counters['hel_blood_spent:' + PLAYER_ID] ?? 0).toBe(0); // no blood
    });

    it('lets her cast a 3e Dark card on a 2-Energy frame, and charges 18% of her pool for it', () => {
        let state = makeState(
            { activeOS: 'hel_v2', currentHp: 2000, currentEnergy: 2, maxEnergy: 2 },
            [card('c1', 'soul_tithe', 3)]
        );
        const before = state.enemyParty[0].currentHp;
        state = play(state, 'c1');

        expect(state.enemyParty[0].currentHp).toBeLessThan(before); // it actually resolved
        expect(state.playerParty[0].currentHp).toBe(1640);          // 3 x 6% of 2000 = 360 HP
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
