// @vitest-environment jsdom
/**
 * TICKET 189b — one ordered line for everything the board shows.
 *
 * The bus events of a card arrive in one synchronous burst; the screen shows them a beat at a time.
 * These tests drive the whole path (bus -> collector -> queue -> battle clock) and read WHEN each
 * thing plays in game time, which is the only thing 189b changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, useEffect } from 'react';

import { globalBattleEventBus } from '../../engine/events';
import { DEFAULT_SETTINGS, saveSettings } from '../settings/settings';
import { setParticleSink, setStageAnchors } from './emit';
import { battleClock, resetBattleClock } from './clock/battleClockRuntime';
import { type CastPresenter, useCastSequence } from './useCastSequence';
import { onCardSignal, type CardSignal } from './presenter/cardSignals';
import { useBattleEndGate } from './pacing/useBattleEndGate';
import * as emitModule from './emit';
import * as statusTellsModule from './statusTells';
import * as osTellsModule from './osTells';
import type { IBattleState } from '../../engine/types';
import type { StageAnchors } from '../hooks/useStageAnchors';
import { planAttack } from './tiers/attackPlan';
import { TIER_PROFILES } from './tiers/tierProfiles';
import { onAttackPose, type AttackPoseSignal } from './choreo/poseSignals';

/**
 * The Showy plan of a hit of `damage` on a 100-HP body: ticket 190c moved every beat of a cast onto
 * the tier's plan, so these tests read their numbers off it instead of pinning 400 ms.
 */
const showyPlan = (damage: number) =>
    planAttack(TIER_PROFILES.showy, { damage, maxHp: 100, isKill: damage >= 100, contact: false });
/** `play()`'s default hit is 20 of 100. */
const CHIP = showyPlan(20);

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STATE = {
    playerParty: [{ id: 'ally', name: 'Ally', maxHp: 100, currentHp: 100, primaryElement: 'Fire', secondaryElement: 'None', statusEffects: [], daemons: [] }],
    enemyParty: [{ id: 'foe', name: 'Foe', maxHp: 100, currentHp: 100, primaryElement: 'Nature', secondaryElement: 'None', statusEffects: [], daemons: [] }],
} as unknown as IBattleState;

const rect = (x: number) => ({ x, y: 100, w: 190, h: 190 });
const ANCHORS = {
    slots: { ally: rect(100), foe: rect(900) },
    plaques: { ally: rect(20), foe: rect(1100) },
    reveal: rect(500), hand: rect(500), discard: rect(800), scale: 1,
} as unknown as StageAnchors;

let presenter: CastPresenter;
const Harness: React.FC = () => {
    const handle = useCastSequence({ ...STATE } as unknown as IBattleState);
    // Handed to the tests from an effect: the render itself must stay free of side effects.
    useEffect(() => { presenter = handle; });
    return null;
};

let container: HTMLDivElement;
let root: Root;
/** Every beat of the stage, as `label@gameTime`. */
let log: string[] = [];

beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
    log = [];
    setStageAnchors(ANCHORS);
    setParticleSink({ spawn: () => undefined, wake: () => undefined });
    vi.useFakeTimers();
    vi.spyOn(emitModule, 'emitImpact').mockImplementation(() => { log.push(`impact@${battleClock.now}`); });
    vi.spyOn(emitModule, 'emitTrail').mockImplementation(() => { log.push(`trail@${battleClock.now}`); });
    // 190d: Fire, Water and Nature send an authored attack instead of the streak; either way it is "the element leaves".
    vi.spyOn(emitModule, 'emitEffect').mockImplementation(() => { log.push(`trail@${battleClock.now}`); });
    vi.spyOn(statusTellsModule, 'emitStatusTick').mockImplementation((status) => { log.push(`tick:${status}@${battleClock.now}`); });
    vi.spyOn(statusTellsModule, 'emitStatusRemoved').mockImplementation(() => { log.push(`removed@${battleClock.now}`); });
    vi.spyOn(statusTellsModule, 'emitDeath').mockImplementation((id) => { log.push(`death:${id}@${battleClock.now}`); });
    vi.spyOn(statusTellsModule, 'emitSelfCost').mockImplementation((id) => { log.push(`self-cost:${id}@${battleClock.now}`); });
    vi.spyOn(statusTellsModule, 'emitShieldAbsorb').mockImplementation((id) => { log.push(`shield:${id}@${battleClock.now}`); });
    vi.spyOn(osTellsModule, 'emitHookTell').mockImplementation((_owner, osId) => { log.push(`hook:${osId}@${battleClock.now}`); });
    container = document.createElement('div');
    root = createRoot(container);
    act(() => { root.render(<Harness />); });
});

afterEach(() => {
    act(() => { root.unmount(); });
    resetBattleClock();
    vi.restoreAllMocks();
    vi.useRealTimers();
    setParticleSink(null);
    setStageAnchors(null);
    localStorage.clear();
});

const advance = (ms: number): void => {
    act(() => {
        vi.advanceTimersByTime(0);
        // Frames, as the driver would deliver them, so beats that start mid-advance land correctly.
        for (let left = ms; left > 0; left -= 16) battleClock.advance(Math.min(16, left));
    });
};

const play = (programId = 'cinder_slash', damage: Array<{ target: string; applied: number }> = [{ target: 'foe', applied: 20 }]) => {
    globalBattleEventBus.emit({ type: 'PROGRAM_PLAYED', sourceId: 'ally', targetId: 'foe', programId, timestamp: Date.now() });
    for (const hit of damage) {
        globalBattleEventBus.emit({
            type: 'DAMAGE_TAKEN', targetId: hit.target, amount: hit.applied, element: 'Fire', cause: 'attack',
            damage: { raw: hit.applied, absorbed: 0, applied: hit.applied } as never, timestamp: Date.now(),
        });
    }
};

const tick = (status: 'Burn' | 'Poison', applied: number, targetId = 'foe') => {
    globalBattleEventBus.emit({
        type: 'DAMAGE_TAKEN', targetId, amount: applied, element: 'Fire', cause: 'status', status,
        damage: { raw: applied, absorbed: 0, applied } as never, timestamp: Date.now(),
    });
};

describe('189b — everything waits its turn', () => {
    it('a Burn tick that arrives DURING a cast plays after that cast\'s impact', () => {
        act(() => { play(); });
        advance(100);                                  // the element has not even left (wind-up + lunge)
        act(() => { tick('Burn', 5); });
        advance(2_000);

        const impact = log.find((entry) => entry.startsWith('impact@'));
        const burn = log.find((entry) => entry.startsWith('tick:Burn@'));
        expect(impact).toBeDefined();
        expect(burn).toBeDefined();
        expect(log.indexOf(burn as string)).toBeGreaterThan(log.indexOf(impact as string));
        expect(Number((burn as string).split('@')[1])).toBeGreaterThanOrEqual(Number((impact as string).split('@')[1]));
    });

    it('an expiry that arrives during a cast also waits', () => {
        act(() => { play(); });
        advance(50);
        act(() => { globalBattleEventBus.emit({ type: 'STATUS_REMOVED', targetId: 'foe', status: 'Burn', timestamp: Date.now() }); });
        advance(2_000);
        const removedAt = Number(log.find((e) => e.startsWith('removed@'))?.split('@')[1]);
        const impactAt = Number(log.find((e) => e.startsWith('impact@'))?.split('@')[1]);
        expect(removedAt).toBeGreaterThanOrEqual(impactAt);
    });

    it('SEVEN casts in one synchronous burst play one after another, never on top of each other', () => {
        act(() => { for (let i = 0; i < 7; i += 1) play(); });
        advance(12_000);
        const impacts = log.filter((e) => e.startsWith('impact@')).map((e) => Number(e.split('@')[1]));
        expect(impacts).toHaveLength(7);
        // Each cast holds the stage until its attacker is home (and its card gone): the next one
        // starts then (189e, now on the 190c plan).
        const apart = CHIP.game.endMs;
        expect(impacts).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => CHIP.game.impactMs + i * apart));
    });

    it('a hook tell plays when ITS cast begins, not when the burst arrives', () => {
        act(() => {
            for (let i = 0; i < 4; i += 1) play();
            play();
            globalBattleEventBus.emit({
                type: 'HOOK_FIRED', osId: 'kraken_v2', hookId: 'some_damage_hook', ownerId: 'ally',
                trigger: 'onPowerCalculated', timestamp: Date.now(),
            });
        });
        advance(8_000);
        // The fifth cast starts after four whole casts.
        expect(log.filter((e) => e.startsWith('hook:'))).toEqual([`hook:kraken_v2@${4 * CHIP.game.endMs}`]);
    });

    it('a death plays AT the impact on that body', () => {
        act(() => { play('cinder_slash', [{ target: 'foe', applied: 100 }]); });
        advance(0);
        expect(log.some((e) => e.startsWith('death:'))).toBe(false);   // not at arrival
        advance(3_000);
        expect(log).toContain(`death:foe@${showyPlan(100).game.impactMs}`);
    });

    it('two hits that kill TOGETHER read as one kill', () => {
        act(() => { play('cinder_slash', [{ target: 'foe', applied: 60 }, { target: 'foe', applied: 60 }]); });
        advance(3_000);
        expect(log.filter((e) => e.startsWith('death:'))).toHaveLength(1);
    });

    it('a body that goes down to a damage-over-time tick gets its death, as its own beat', () => {
        act(() => { tick('Poison', 100); });
        advance(500);
        expect(log).toEqual(['tick:Poison@0', 'death:foe@0']);
    });

    it('recoil lands with the card\'s impact', () => {
        act(() => {
            play();
            globalBattleEventBus.emit({
                type: 'DAMAGE_TAKEN', targetId: 'ally', amount: 5, element: 'None', cause: 'recoil',
                damage: { raw: 5, absorbed: 0, applied: 5 } as never, timestamp: Date.now(),
            });
        });
        advance(3_000);
        expect(log).toContain(`self-cost:ally@${CHIP.game.impactMs}`);
    });

    it('a shield absorbing plays at the impact', () => {
        act(() => {
            globalBattleEventBus.emit({ type: 'PROGRAM_PLAYED', sourceId: 'ally', targetId: 'foe', programId: 'cinder_slash', timestamp: Date.now() });
            globalBattleEventBus.emit({
                type: 'DAMAGE_TAKEN', targetId: 'foe', amount: 0, element: 'Fire', cause: 'attack',
                damage: { raw: 12, absorbed: 12, applied: 0 } as never, timestamp: Date.now(),
            });
        });
        advance(3_000);
        expect(log).toContain(`shield:foe@${showyPlan(0).game.impactMs}`);
    });
});

describe('189b — the handle the screen waits on', () => {
    it('is idle with nothing happening', () => {
        expect(presenter.isIdle()).toBe(true);
    });

    it('is busy as soon as a burst is collected, through the sequence, and idle after it', () => {
        act(() => { play(); });
        expect(presenter.isIdle()).toBe(false);          // the burst has not even closed
        advance(0);
        expect(presenter.isIdle()).toBe(false);          // playing
        advance(CHIP.game.impactMs - 1);
        expect(presenter.isIdle()).toBe(false);
        advance(1);                                      // the impact has landed, the attacker is still there
        expect(presenter.isIdle()).toBe(false);
        advance(CHIP.game.endMs - CHIP.game.impactMs - 1);
        expect(presenter.isIdle()).toBe(false);
        advance(1);                                      // 189e / 190c: idle means the attacker is home and the card has gone
        expect(presenter.isIdle()).toBe(true);
    });

    it('whenIdle resolves after the last impact, not before', async () => {
        vi.useRealTimers();                              // the burst window closes on a real 0 ms timer here
        let done = false;
        act(() => { play(); });
        void presenter.whenIdle().then(() => { done = true; });
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(done).toBe(false);
        act(() => { battleClock.advance(CHIP.game.endMs + 20); });
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(done).toBe(true);
        vi.useFakeTimers();
    });

    it('with vfx off only the card is waited for - never the trails or the impacts', async () => {
        act(() => { root.unmount(); });
        saveSettings({ ...DEFAULT_SETTINGS, battleSpeed: 'instant' });
        container = document.createElement('div');
        root = createRoot(container);
        act(() => { root.render(<Harness />); });
        act(() => { play(); });
        advance(0);
        expect(log.some((e) => e.startsWith('impact@'))).toBe(false);   // no trail was drawn
        advance(500);                                    // a player card: 180 in, 200 out
        expect(presenter.isIdle()).toBe(true);
        await expect(presenter.whenIdle()).resolves.toBeUndefined();
    });
});

/** The enemy's card at the player: `foe` casts, `ally` is hit. */
const playEnemy = (programId = 'cinder_slash', applied = 20) => {
    globalBattleEventBus.emit({ type: 'PROGRAM_PLAYED', sourceId: 'foe', targetId: 'ally', programId, timestamp: Date.now() });
    globalBattleEventBus.emit({
        type: 'DAMAGE_TAKEN', targetId: 'ally', amount: applied, element: 'Fire', cause: 'attack',
        damage: { raw: applied, absorbed: 0, applied } as never, timestamp: Date.now(),
    });
};

describe('189e — the card hovers, then attacks, then leaves', () => {
    let signals: string[];
    let unsubscribe: () => void;
    beforeEach(() => {
        signals = [];
        unsubscribe = onCardSignal((signal: CardSignal) => { signals.push(`${signal.kind}@${battleClock.now}`); });
    });
    afterEach(() => { unsubscribe(); });

    it('an ENEMY card is on screen 1 s before its first particle', () => {
        act(() => { playEnemy(); });
        advance(2_000);
        const cardAt = Number((signals.find((s) => s.startsWith('in@')) as string).split('@')[1]);
        const trailAt = Number((log.find((e) => e.startsWith('trail@')) as string).split('@')[1]);
        expect(cardAt).toBe(0);
        expect(trailAt - cardAt).toBeGreaterThanOrEqual(1_000);
        // 190c: the card flies in (180), hovers 1 s, THEN the wind-up and the lunge play, and the
        // element leaves when the lunge ends.
        const launch = CHIP.game.lungeEndMs;
        expect(trailAt).toBeLessThanOrEqual(180 + 1_000 + launch + 16);
        expect(trailAt).toBeGreaterThanOrEqual(180 + 1_000 + launch);
    });

    it("a PLAYER card has no hover: the wind-up starts with the card, and the element leaves when the lunge ends", () => {
        act(() => { play(); });
        advance(2_000);
        expect(Number((log.find((e) => e.startsWith('trail@')) as string).split('@')[1])).toBeLessThanOrEqual(CHIP.game.lungeEndMs + 16);
    });

    it('sends in, launch, out in that order, and `out` comes after the impact', () => {
        act(() => { playEnemy(); });
        advance(3_000);
        expect(signals.map((s) => s.split('@')[0])).toEqual(['in', 'launch', 'out']);
        const outAt = Number((signals.find((s) => s.startsWith('out@')) as string).split('@')[1]);
        const impactAt = Number((log.find((e) => e.startsWith('impact@')) as string).split('@')[1]);
        expect(outAt).toBeGreaterThanOrEqual(impactAt);
    });

    it('the next card comes in only once the last one has gone', () => {
        act(() => { playEnemy(); playEnemy(); });
        advance(6_000);
        const kinds = signals.map((s) => s.split('@')[0]);
        expect(kinds).toEqual(['in', 'launch', 'out', 'in', 'launch', 'out']);
        const outAt = Number((signals[2]).split('@')[1]);
        const secondIn = Number((signals[3]).split('@')[1]);
        expect(secondIn).toBeGreaterThanOrEqual(outAt);
    });

    it('with vfx off the card still comes in, hovers and leaves; the trails are not drawn', () => {
        act(() => { root.unmount(); });
        saveSettings({ ...DEFAULT_SETTINGS, battleSpeed: 'instant' });
        container = document.createElement('div');
        root = createRoot(container);
        act(() => { root.render(<Harness />); });
        act(() => { playEnemy(); });
        advance(3_000);
        expect(signals.map((s) => s.split('@')[0])).toEqual(['in', 'launch', 'out']);
        expect(log.some((e) => e.startsWith('trail@') || e.startsWith('impact@'))).toBe(false);
    });
});

describe('189e — the victory banner waits for the last impact', () => {
    const shown: { value: boolean } = { value: false };
    const Gate: React.FC<{ over: boolean }> = ({ over }) => {
        const handle = useCastSequence({ ...STATE } as unknown as IBattleState);
        const open = useBattleEndGate(over, 'battle-1', handle);
        useEffect(() => { presenter = handle; shown.value = open; });
        return null;
    };

    it('opens only after the killing blow has landed and the card has gone', async () => {
        vi.useRealTimers();               // the burst window closes on a real 0 ms timer here
        act(() => { root.unmount(); });
        container = document.createElement('div');
        root = createRoot(container);
        act(() => { root.render(<Gate over={false} />); });
        act(() => { play('cinder_slash', [{ target: 'foe', applied: 100 }]); });
        act(() => { root.render(<Gate over />); });               // the engine already says: over
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
        const kill = showyPlan(100).game;
        expect(shown.value).toBe(false);                          // the element has not even left
        await act(async () => { battleClock.advance(kill.impactMs - 1); await new Promise((resolve) => setTimeout(resolve, 5)); });
        expect(shown.value).toBe(false);                          // not at the impact either...
        await act(async () => { battleClock.advance(1); await new Promise((resolve) => setTimeout(resolve, 5)); });
        expect(shown.value).toBe(false);                          // ...nor while the attacker walks back and the card leaves
        await act(async () => { battleClock.advance(kill.endMs - kill.impactMs + 20); await new Promise((resolve) => setTimeout(resolve, 5)); });
        expect(shown.value).toBe(true);
        vi.useFakeTimers();
    });

    it('does not open while the battle is not over', async () => {
        vi.useRealTimers();
        act(() => { root.unmount(); });
        container = document.createElement('div');
        root = createRoot(container);
        act(() => { root.render(<Gate over={false} />); });
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
        expect(shown.value).toBe(false);
        vi.useFakeTimers();
    });
});

describe('190c — the choreography of a cast, end to end', () => {
    let poses: Array<{ at: number; signal: AttackPoseSignal }>;
    let signals: string[];
    let offPose: () => void;
    let offCard: () => void;
    beforeEach(() => {
        poses = [];
        signals = [];
        offPose = onAttackPose((signal) => { poses.push({ at: battleClock.now, signal }); });
        offCard = onCardSignal((signal: CardSignal) => { signals.push(`${signal.kind}@${battleClock.now}`); });
    });
    afterEach(() => { offPose(); offCard(); });

    it('a player card starts the wind-up with the card, and the pose runs to the walk back', () => {
        act(() => { play(); });
        advance(3_000);
        expect(poses).toHaveLength(1);
        expect(poses[0].at).toBe(0);
        expect(poses[0].signal.sourceId).toBe('ally');
        expect(poses[0].signal.pose.durationMs).toBe(CHIP.game.endMs);
    });

    it('the element leaves when the lunge ends (the card signals launch then)', () => {
        act(() => { play(); });
        advance(3_000);
        expect(signals).toContain(`launch@${CHIP.game.lungeEndMs}`);
    });

    it('the pose holds the lunge until the impact (an ally lunges to the right)', () => {
        act(() => { play(); });
        advance(3_000);
        const { keys } = poses[0].signal.pose;
        const atLunge = keys.find((key) => key.atMs === CHIP.game.lungeEndMs)!;
        const atImpact = keys.find((key) => key.atMs === CHIP.game.impactMs)!;
        expect(atLunge.x).toBe(54);
        expect(atImpact.x).toBe(54);
    });

    it('the card leaves as the attacker starts back, not before the hit', () => {
        act(() => { play(); });
        advance(3_000);
        expect(signals).toContain(`out@${CHIP.game.knockbackEndMs}`);
    });

    it('an enemy card hovers first, and the pose goes the other way (to the left)', () => {
        act(() => { playEnemy(); });
        advance(4_000);
        expect(poses[0].at).toBe(180 + 1_000);
        expect(poses[0].signal.sourceId).toBe('foe');
        expect(poses[0].signal.pose.keys.find((key) => key.atMs === CHIP.game.lungeEndMs)!.x).toBe(-54);
    });

    it('a contact card dashes in: no trail, the hit lands when the dash ends', () => {
        act(() => { play('tackle', [{ target: 'foe', applied: 20 }]); });
        advance(3_000);
        const contact = planAttack(TIER_PROFILES.showy, { damage: 20, maxHp: 100, isKill: false, contact: true });
        expect(log.some((e) => e.startsWith('trail@'))).toBe(false);
        expect(log).toContain(`impact@${contact.game.impactMs}`);
        expect(contact.game.impactMs).toBe(contact.game.lungeEndMs);
        // 800 px apart at scale 1, less the 115 it stops short.
        const arrival = poses[0].signal.pose.keys.find((key) => key.atMs === contact.game.lungeEndMs)!;
        expect(arrival.x).toBe(800 - 115);
    });

    it('a card that deals no damage wiggles and lobs an orb: no lunge, no impact burst', () => {
        act(() => {
            globalBattleEventBus.emit({ type: 'PROGRAM_PLAYED', sourceId: 'ally', targetId: 'foe', programId: 'ignite', timestamp: Date.now() });
            globalBattleEventBus.emit({ type: 'STATUS_APPLIED', targetId: 'foe', status: 'Burn', stacks: 1, timestamp: Date.now() } as never);
        });
        advance(3_000);
        expect(poses).toHaveLength(1);
        for (const key of poses[0].signal.pose.keys) expect(key.x).toBe(0);
        expect(log.some((e) => e.startsWith('impact@') || e.startsWith('trail@'))).toBe(false);
    });

    it('with vfx off no pose is sent at all', () => {
        act(() => { root.unmount(); });
        saveSettings({ ...DEFAULT_SETTINGS, battleSpeed: 'instant' });
        container = document.createElement('div');
        root = createRoot(container);
        act(() => { root.render(<Harness />); });
        act(() => { play(); });
        advance(2_000);
        expect(poses).toHaveLength(0);
    });
});

describe('190d — the element attack of a cast, end to end', () => {
    const effects: Array<{ at: number; durationMs: number }> = [];
    beforeEach(() => {
        effects.length = 0;
        vi.spyOn(emitModule, 'emitEffect').mockImplementation((effect) => {
            effects.push({ at: battleClock.now, durationMs: effect.durationMs });
            log.push(`trail@${battleClock.now}`);
        });
    });

    it('a Fire card sends ONE flame beam when the lunge ends, and hits when the pour is over', () => {
        act(() => { play(); });
        advance(3_000);
        expect(effects).toHaveLength(1);
        expect(effects[0].at).toBe(CHIP.game.lungeEndMs);
        expect(log).toContain(`impact@${CHIP.game.impactMs}`);
        expect(effects[0].durationMs).toBeGreaterThan(CHIP.game.impactMs - CHIP.game.lungeEndMs);
    });

    it('a longer pour for a bigger hit: the beam outlasts a chip\'s', () => {
        act(() => { play('cinder_slash', [{ target: 'foe', applied: 90 }]); });
        advance(4_000);
        const big = effects[0].durationMs;
        effects.length = 0;
        act(() => { play(); });
        advance(8_000);
        expect(big).toBeGreaterThan(effects[effects.length - 1].durationMs);
    });

    it('a Side card (a tidal wave) sends one effect for the whole row, not a streak per body', () => {
        act(() => { play('tidal_wave', [{ target: 'foe', applied: 20 }]); });
        advance(4_000);
        expect(effects).toHaveLength(1);
        expect(log.filter((e) => e.startsWith('trail@'))).toHaveLength(1);
        expect(log.some((e) => e.startsWith('impact@'))).toBe(true);
    });

    it('an element with no attack of its own keeps the tinted streak (no effect)', () => {
        act(() => { play('spike_launch', [{ target: 'foe', applied: 20 }]); });
        advance(4_000);
        expect(effects).toHaveLength(0);
        expect(log.some((e) => e.startsWith('trail@'))).toBe(true);
    });
});

