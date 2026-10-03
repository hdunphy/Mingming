/**
 * TICKET 189d — the sprites' shudder: vibrate during the freeze (real time), shake after it (game time).
 */
import { describe, expect, it } from 'vitest';

import { SHAKE_MS, SpriteShakes, type ShakeTarget } from './SpriteShakes';

const el = (): ShakeTarget => ({ style: { translate: '' } });
const px = (target: ShakeTarget): number => (target.style.translate === '' ? 0 : Number.parseFloat(target.style.translate));

function make() {
    const state = { freeze: 0 };
    const shakes = new SpriteShakes(() => state.freeze);
    return { shakes, state };
}

describe('189d — the shake after the freeze', () => {
    it('jolts the target and drains over 260 ms of game time, ending exactly at rest', () => {
        const { shakes } = make();
        const a = el();
        shakes.attach('a', a);
        shakes.shake('a', 10);
        let peak = 0;
        for (let t = 0; t < SHAKE_MS; t += 8) {
            shakes.step({ realDt: 8, gameDt: 8, frozen: false });
            peak = Math.max(peak, Math.abs(px(a)));
        }
        expect(peak).toBeGreaterThan(2);
        expect(peak).toBeLessThanOrEqual(10);
        shakes.step({ realDt: 16, gameDt: 16, frozen: false });
        expect(a.style.translate).toBe('');
        expect(shakes.active).toBe(false);
    });

    it('holds under a freeze and carries on after it', () => {
        const { shakes, state } = make();
        const a = el();
        shakes.attach('a', a);
        shakes.shake('a', 10);
        shakes.step({ realDt: 40, gameDt: 40, frozen: false });
        const before = a.style.translate;
        state.freeze = 100;
        for (let i = 0; i < 5; i += 1) shakes.step({ realDt: 16, gameDt: 0, frozen: true });
        // The shake did not age: the same pose is held.
        expect(a.style.translate).toBe(before);
    });
});

describe('189d — the shudder during the freeze', () => {
    it('target and attacker both vibrate while game time is stopped', () => {
        const { shakes, state } = make();
        const target = el();
        const attacker = el();
        shakes.attach('t', target);
        shakes.attach('s', attacker);
        state.freeze = 100;
        shakes.vibrate(['t', 's', undefined], 6);
        let moved = 0;
        for (let i = 0; i < 6; i += 1) {
            state.freeze -= 16;
            shakes.step({ realDt: 16, gameDt: 0, frozen: true });
            moved += Math.abs(px(target)) + Math.abs(px(attacker));
        }
        expect(moved).toBeGreaterThan(0);
        expect(Math.abs(px(target))).toBeLessThanOrEqual(6);
    });

    it('fades as the freeze runs out and is gone when game time moves', () => {
        const { shakes, state } = make();
        const target = el();
        shakes.attach('t', target);
        state.freeze = 100;
        shakes.vibrate(['t'], 6);
        state.freeze = 4;
        shakes.step({ realDt: 16, gameDt: 0, frozen: true });
        expect(Math.abs(px(target))).toBeLessThanOrEqual(6 * (4 / 100) * 1.0001 + 1e-9);
        state.freeze = 0;
        shakes.step({ realDt: 16, gameDt: 16, frozen: false });
        expect(target.style.translate).toBe('');
        expect(shakes.active).toBe(false);
    });

    it('does nothing for a hit that froze nothing (Instant)', () => {
        const { shakes, state } = make();
        const target = el();
        shakes.attach('t', target);
        state.freeze = 0;
        shakes.vibrate(['t'], 6);
        expect(shakes.active).toBe(false);
    });
});

describe('189d — attach and reset', () => {
    it('detach clears the offset and reset clears every body', () => {
        const { shakes } = make();
        const a = el();
        const detach = shakes.attach('a', a);
        shakes.shake('a', 10);
        shakes.step({ realDt: 16, gameDt: 16, frozen: false });
        detach();
        expect(a.style.translate).toBe('');

        const b = el();
        shakes.attach('b', b);
        shakes.shake('b', 10);
        shakes.step({ realDt: 16, gameDt: 16, frozen: false });
        shakes.reset();
        expect(b.style.translate).toBe('');
        expect(shakes.active).toBe(false);
    });
});
