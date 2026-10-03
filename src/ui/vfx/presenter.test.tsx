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
        advance(100);                                  // the trail has not even left (180)
        act(() => { tick('Burn', 5); });
        advance(1_000);

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
        advance(1_000);
        const removedAt = Number(log.find((e) => e.startsWith('removed@'))?.split('@')[1]);
        const impactAt = Number(log.find((e) => e.startsWith('impact@'))?.split('@')[1]);
        expect(removedAt).toBeGreaterThanOrEqual(impactAt);
    });

    it('SEVEN casts in one synchronous burst play one after another, never on top of each other', () => {
        act(() => { for (let i = 0; i < 7; i += 1) play(); });
        advance(5_000);
        const impacts = log.filter((e) => e.startsWith('impact@')).map((e) => Number(e.split('@')[1]));
        expect(impacts).toHaveLength(7);
        // 180 flight + 220 trail = 400 to the impact, then the card takes CARD_LEAVE_MS (200) to go;
        // the next cast starts when the last one's sequence has ended (189e): 600 apart.
        expect(impacts).toEqual([400, 1_000, 1_600, 2_200, 2_800, 3_400, 4_000]);
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
        advance(3_000);
        // The fifth cast starts after four casts of 600 ms (400 to the impact + 200 for the card to leave).
        expect(log.filter((e) => e.startsWith('hook:'))).toEqual(['hook:kraken_v2@2400']);
    });

    it('a death plays AT the impact on that body', () => {
        act(() => { play('cinder_slash', [{ target: 'foe', applied: 100 }]); });
        advance(0);
        expect(log.some((e) => e.startsWith('death:'))).toBe(false);   // not at arrival
        advance(1_000);
        expect(log).toContain('death:foe@400');
    });

    it('two hits that kill TOGETHER read as one kill', () => {
        act(() => { play('cinder_slash', [{ target: 'foe', applied: 60 }, { target: 'foe', applied: 60 }]); });
        advance(1_000);
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
        advance(1_000);
        expect(log).toContain('self-cost:ally@400');
    });

    it('a shield absorbing plays at the impact', () => {
        act(() => {
            globalBattleEventBus.emit({ type: 'PROGRAM_PLAYED', sourceId: 'ally', targetId: 'foe', programId: 'cinder_slash', timestamp: Date.now() });
            globalBattleEventBus.emit({
                type: 'DAMAGE_TAKEN', targetId: 'foe', amount: 0, element: 'Fire', cause: 'attack',
                damage: { raw: 12, absorbed: 12, applied: 0 } as never, timestamp: Date.now(),
            });
        });
        advance(1_000);
        expect(log).toContain('shield:foe@400');
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
        advance(399);
        expect(presenter.isIdle()).toBe(false);
        advance(1);                                      // the impact has landed, the card is still leaving
        expect(presenter.isIdle()).toBe(false);
        advance(199);
        expect(presenter.isIdle()).toBe(false);
        advance(1);                                      // 189e: idle means the card has gone, too
        expect(presenter.isIdle()).toBe(true);
    });

    it('whenIdle resolves after the last impact, not before', async () => {
        vi.useRealTimers();                              // the burst window closes on a real 0 ms timer here
        let done = false;
        act(() => { play(); });
        void presenter.whenIdle().then(() => { done = true; });
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(done).toBe(false);
        act(() => { battleClock.advance(700); });
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
        expect(trailAt).toBeLessThanOrEqual(1_000 + 180 + 16);   // 1 s hover + the card's 180 ms flight in
    });

    it("a PLAYER card has no hover: the trail leaves once the card has flown in", () => {
        act(() => { play(); });
        advance(1_000);
        expect(Number((log.find((e) => e.startsWith('trail@')) as string).split('@')[1])).toBeLessThanOrEqual(180 + 16);
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
        expect(shown.value).toBe(false);                          // the trail has not even left
        await act(async () => { battleClock.advance(399); await new Promise((resolve) => setTimeout(resolve, 5)); });
        expect(shown.value).toBe(false);                          // not at the impact either...
        await act(async () => { battleClock.advance(1); await new Promise((resolve) => setTimeout(resolve, 5)); });
        expect(shown.value).toBe(false);                          // ...nor while the card is leaving
        await act(async () => { battleClock.advance(250); await new Promise((resolve) => setTimeout(resolve, 5)); });
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
