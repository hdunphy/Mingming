/**
 * TICKET 189e — the enemy's next action waits for the last one's sequence.
 *
 * The clock is driven by hand and the presenter is a stand-in whose idleness the test controls, so
 * each claim is read at an exact millisecond.
 */
import { describe, expect, it, vi } from 'vitest';

import { BattleClock } from '../clock/BattleClock';
import { HitStop } from '../clock/HitStop';
import { INSTANT } from '../clock/speedPolicy';
import { AI_DEBOUNCE_MS, TURN_OPEN_PAUSE_MS, paceEnemyAction } from './enemyActionPacer';

const flush = async (): Promise<void> => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
const noDebounce = (): Promise<void> => Promise.resolve();

function setup(speed = 1) {
    const clock = new BattleClock({ speed: () => speed, hitStop: new HitStop() });
    let release: () => void = () => undefined;
    let idleNow = true;
    const presenter = {
        whenIdle: vi.fn(() => (idleNow ? Promise.resolve() : new Promise<void>((resolve) => { release = () => { idleNow = true; resolve(); }; }))),
        busy: () => { idleNow = false; },
        finish: () => release(),
    };
    return { clock, presenter };
}

describe('189e — an action is dispatched only after the presenter is idle', () => {
    it('action N+1 is not dispatched before action N\'s sequence has finished', async () => {
        const { clock, presenter } = setup();
        presenter.busy();                                   // action N's sequence is playing
        let dispatched: string | null = null;
        void paceEnemyAction({
            firstOfTurn: false, think: async () => 'next', idle: presenter.whenIdle, clock,
            cancelled: () => false, debounce: noDebounce,
        }).then((action) => { dispatched = action; });

        await flush();
        clock.advance(10_000);                              // a long time passes; the sequence has not ended
        await flush();
        expect(dispatched).toBeNull();

        presenter.finish();
        await flush();
        expect(dispatched).toBe('next');
    });

    it('thinks while it waits: the think is not serial with the wait', async () => {
        const { clock, presenter } = setup();
        presenter.busy();
        const think = vi.fn(async () => 'decided');
        void paceEnemyAction({
            firstOfTurn: false, think, idle: presenter.whenIdle, clock, cancelled: () => false, debounce: noDebounce,
        });
        await flush();
        expect(think).toHaveBeenCalledTimes(1);             // started at once, under the hover
    });

    it('a decision that takes longer than the sequence costs only what is left', async () => {
        const { clock, presenter } = setup();
        let thought: () => void = () => undefined;
        let dispatched: string | null = null;
        void paceEnemyAction({
            firstOfTurn: false, think: () => new Promise<string>((resolve) => { thought = () => resolve('slow'); }),
            idle: presenter.whenIdle, clock, cancelled: () => false, debounce: noDebounce,
        }).then((action) => { dispatched = action; });
        await flush();
        expect(dispatched).toBeNull();                      // idle already, still thinking
        thought();
        await flush();
        expect(dispatched).toBe('slow');
    });
});

describe('189e — the opening pause', () => {
    it('the first action of a turn waits the opening pause in game time, thinking meanwhile', async () => {
        const { clock, presenter } = setup();
        let dispatched: string | null = null;
        void paceEnemyAction({
            firstOfTurn: true, think: async () => 'first', idle: presenter.whenIdle, clock, cancelled: () => false, debounce: noDebounce,
        }).then((action) => { dispatched = action; });

        await flush();
        clock.advance(TURN_OPEN_PAUSE_MS - AI_DEBOUNCE_MS - 1);
        await flush();
        expect(dispatched).toBeNull();
        clock.advance(1);
        await flush();
        expect(dispatched).toBe('first');
    });

    it('a later action of the turn has no opening pause', async () => {
        const { clock, presenter } = setup();
        let dispatched: string | null = null;
        void paceEnemyAction({
            firstOfTurn: false, think: async () => 'again', idle: presenter.whenIdle, clock, cancelled: () => false, debounce: noDebounce,
        }).then((action) => { dispatched = action; });
        await flush();
        expect(dispatched).toBe('again');
    });
});

describe('189e — cancelling', () => {
    it('returns null when cancelled while waiting for the presenter', async () => {
        const { clock, presenter } = setup();
        presenter.busy();
        let cancelled = false;
        let result: string | null | undefined;
        void paceEnemyAction({
            firstOfTurn: false, think: async () => 'x', idle: presenter.whenIdle, clock, cancelled: () => cancelled, debounce: noDebounce,
        }).then((action) => { result = action; });
        await flush();
        cancelled = true;
        presenter.finish();
        await flush();
        expect(result).toBeNull();
    });

    it('never thinks when cancelled during the debounce', async () => {
        const { clock, presenter } = setup();
        const think = vi.fn(async () => 'x');
        let result: string | null | undefined;
        void paceEnemyAction({
            firstOfTurn: false, think, idle: presenter.whenIdle, clock, cancelled: () => true, debounce: noDebounce,
        }).then((action) => { result = action; });
        await flush();
        expect(think).not.toHaveBeenCalled();
        expect(result).toBeNull();
    });
});

describe('189e — under Instant a whole AI turn completes with no waiting', () => {
    it('seven actions in a row, the opening pause included, wait on nothing but a zero-length debounce', async () => {
        vi.useFakeTimers();
        try {
            const { clock, presenter } = setup(INSTANT);
            const seen: string[] = [];
            const turn = (async () => {
                for (let i = 0; i < 7; i += 1) {
                    const action = await paceEnemyAction({
                        firstOfTurn: i === 0, think: async () => `a${i}`, idle: presenter.whenIdle, clock,
                        cancelled: () => false,   // the real debounce, on fake timers
                    });
                    seen.push(String(action));
                }
            })();
            // A zero-length debounce is a 0 ms timeout (the fake timers make one set mid-tick 1 ms): if the
            // opening pause or the 50 ms debounce applied, seven actions would need over a second of it.
            let finished = false;
            void turn.then(() => { finished = true; });
            const startedAt = Date.now();
            for (let i = 0; i < 200 && !finished; i += 1) await vi.advanceTimersByTimeAsync(1);
            expect(finished).toBe(true);
            expect(Date.now() - startedAt).toBeLessThanOrEqual(10);
            await turn;
            expect(seen).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });

    it('at normal speed the same debounce is 50 ms and the opening pause is real game time', async () => {
        vi.useFakeTimers();
        try {
            const { clock, presenter } = setup(1);
            let done = false;
            void paceEnemyAction({
                firstOfTurn: false, think: async () => 'x', idle: presenter.whenIdle, clock, cancelled: () => false,
            }).then(() => { done = true; });
            await vi.advanceTimersByTimeAsync(AI_DEBOUNCE_MS - 1);
            expect(done).toBe(false);
            await vi.advanceTimersByTimeAsync(1);
            expect(done).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });
});
