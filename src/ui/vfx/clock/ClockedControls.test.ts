/**
 * TICKET 189a — the bridge to framer-motion's playback controls.
 *
 * framer-motion runs its own animations on its own clock. This holds the ones that matter to the
 * battle (the lunge, the card flight, later everything 190 adds) to ours: it sets `.speed` to the
 * clock multiplier, pauses them for a freeze and resumes them after, and at Instant finishes them.
 */
import { describe, expect, it, vi } from 'vitest';

import type { ClockFrame } from './BattleClock';
import { ClockedControls, type PlaybackLike } from './ClockedControls';
import { INSTANT } from './speedPolicy';

const frame = (over: Partial<ClockFrame> = {}): ClockFrame => ({
    realDt: 16, gameDt: 16, frozen: false, multiplier: 1, ...over,
});

function fake(): PlaybackLike & { speed: number; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; complete: ReturnType<typeof vi.fn> } {
    return { speed: 1, pause: vi.fn(), play: vi.fn(), complete: vi.fn() };
}

describe('189a — ClockedControls', () => {
    it('sets .speed to the clock multiplier on the next frame', () => {
        const bridge = new ClockedControls();
        const a = fake();
        bridge.track(a);
        bridge.sync(frame({ multiplier: 2 }));
        expect(a.speed).toBe(2);
        bridge.sync(frame({ multiplier: 0.5 }));
        expect(a.speed).toBe(0.5);
    });

    it('pauses on a freeze and resumes after it, once each', () => {
        const bridge = new ClockedControls();
        const a = fake();
        bridge.track(a);
        bridge.sync(frame({ gameDt: 0, frozen: true }));
        bridge.sync(frame({ gameDt: 0, frozen: true }));
        expect(a.pause).toHaveBeenCalledTimes(1);
        expect(a.play).not.toHaveBeenCalled();

        bridge.sync(frame());
        bridge.sync(frame());
        expect(a.play).toHaveBeenCalledTimes(1);
    });

    it('a control that starts DURING a freeze is paused straight away', () => {
        const bridge = new ClockedControls();
        bridge.sync(frame({ gameDt: 0, frozen: true }));
        const late = fake();
        bridge.track(late);
        expect(late.pause).toHaveBeenCalledTimes(1);
    });

    it('finishes everything at Instant and lets go of it', () => {
        const bridge = new ClockedControls();
        const a = fake();
        bridge.track(a);
        const live = bridge.sync(frame({ multiplier: INSTANT }));
        expect(a.complete).toHaveBeenCalledTimes(1);
        expect(live).toBe(false);
        expect(bridge.size).toBe(0);
    });

    it('a control that starts at Instant is finished at once', () => {
        const bridge = new ClockedControls();
        bridge.sync(frame({ multiplier: INSTANT }));
        const a = fake();
        bridge.track(a);
        expect(a.complete).toHaveBeenCalledTimes(1);
        expect(bridge.size).toBe(0);
    });

    it('release stops touching a control, and sync reports whether anything is still tracked', () => {
        const bridge = new ClockedControls();
        const a = fake();
        const release = bridge.track(a);
        expect(bridge.sync(frame({ multiplier: 3 }))).toBe(true);
        release();
        expect(bridge.sync(frame({ multiplier: 5 }))).toBe(false);
        expect(a.speed).toBe(3);
    });

    it('lets go of a control when its animation finishes by itself', async () => {
        const bridge = new ClockedControls();
        let finish: () => void = () => undefined;
        const a = { ...fake(), then: (resolve: () => void) => { finish = resolve; } } as unknown as PlaybackLike;
        bridge.track(a);
        expect(bridge.size).toBe(1);
        finish();
        expect(bridge.size).toBe(0);
    });

    it('never throws if a control has already been cancelled underneath it', () => {
        const bridge = new ClockedControls();
        const a = fake();
        a.pause.mockImplementation(() => { throw new Error('gone'); });
        bridge.track(a);
        expect(() => bridge.sync(frame({ gameDt: 0, frozen: true }))).not.toThrow();
    });
});
