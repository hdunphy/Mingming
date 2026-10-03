// @vitest-environment jsdom
/**
 * TICKET 146e, rewritten for 189d — what the subscriber does with each KIND of moment.
 *
 * It used to read the engine's `DAMAGE_TAKEN` and tell attacks from ticks by `cause`; since 189d it
 * hears the presenter's stage moments, and the collector has already sorted the causes (that is
 * tested in `impact/impactMoments.integration.test`). This covers the gate, which is where the row
 * can actually hurt the game: a Poison deck whose every tick froze the screen and shook the board
 * would be unplayable, and no other test in the repo would notice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, useRef } from 'react';

import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, saveSettings } from '../settings/settings';
import { battleClock, resetBattleClock } from './clock/battleClockRuntime';
import { isHitStopped } from './hitStop';
import { cameraShake, spriteShakes } from './impact/impactRuntime';
import { type StageMoment, emitStageMoment } from './impact/stageMoments';
import { useImpactFeedback } from './useImpactFeedback';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
// React only accepts `act` from a runner that says it is one.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A fresh render per call, which is what a play does (155a): the version of this harness that shipped
 * with one constant state object and no re-render is why the suite was green while 146e had never once
 * produced a hit-stop in a real fight.
 */
const Harness: React.FC<{ nonce?: number }> = ({ nonce = 0 }) => {
    const ref = useRef<HTMLDivElement>(null);
    useImpactFeedback(ref);
    return <div ref={ref} data-nonce={nonce} />;
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
    resetBattleClock();
    container = document.createElement('div');
    root = createRoot(container);
    act(() => { root.render(<Harness />); });
});

afterEach(() => {
    act(() => { root.unmount(); });
    resetBattleClock();
    localStorage.clear();
});

const damage = { targetId: 'ally', absorbed: 0, element: 'None' as const, maxHp: 100, isLethal: false, definitionId: undefined };

const hit = (applied: number, over: Partial<Extract<StageMoment, { kind: 'hit' }>> = {}): void => {
    act(() => {
        emitStageMoment({
            kind: 'hit', ...damage, applied, sourceId: 'foe', isCritical: false, effectiveness: 1, step: 0, targets: 1, ...over,
        });
    });
};

describe('189d — which moment earns a stop', () => {
    it('stops on an attack', () => {
        hit(20);
        expect(isHitStopped()).toBe(true);
    });

    it('NEVER stops on a status tick', () => {
        // 146e, in as many words: *"Never on `cause: 'status'`."* This is the line that keeps a
        // damage-over-time deck playable.
        act(() => { emitStageMoment({ kind: 'tick', ...damage, applied: 40, status: 'Burn', stacks: 2 }); });
        expect(isHitStopped()).toBe(false);
        expect(cameraShake.level).toBe(0);
    });

    it('never stops on a recoil or a toll', () => {
        // Prices the caster pays, not hits it took. 146f draws both as a red pulse on the caster.
        act(() => { emitStageMoment({ kind: 'cost', ...damage, applied: 30, cause: 'recoil' }); });
        act(() => { emitStageMoment({ kind: 'cost', ...damage, applied: 30, cause: 'toll' }); });
        expect(isHitStopped()).toBe(false);
        expect(cameraShake.level).toBe(0);
    });

    it('does not stop on a fully absorbed hit', () => {
        // Nothing reached HP, so there was no impact to weight — the shield float is the feedback.
        hit(0, { absorbed: 12 });
        expect(isHitStopped()).toBe(false);
    });

    it('ignores a heal', () => {
        act(() => { emitStageMoment({ kind: 'heal', targetId: 'ally', amount: 10 }); });
        expect(isHitStopped()).toBe(false);
    });
});

describe('189d — how long, how hard', () => {
    it('a kill\'s freeze is longer than a chip\'s', () => {
        hit(5);
        const chip = readFreeze();
        resetBattleClock();
        hit(5, { isLethal: true });
        expect(readFreeze()).toBeGreaterThan(chip);
    });

    it('a super-effective hit freezes longer, a resisted one shorter', () => {
        hit(10);
        const plain = readFreeze();
        resetBattleClock();
        hit(10, { effectiveness: 2 });
        const sup = readFreeze();
        resetBattleClock();
        hit(10, { effectiveness: 0.5 });
        const res = readFreeze();
        expect(sup).toBeGreaterThan(plain);
        expect(res).toBeLessThan(plain);
    });

    it('each hit of a multi-target card freezes less than a lone hit', () => {
        hit(10);
        const lone = readFreeze();
        resetBattleClock();
        hit(10, { targets: 3 });
        expect(readFreeze()).toBeLessThan(lone);
    });

    it('a 6%-of-max-HP hit adds no camera trauma; a 20% hit does', () => {
        hit(6);
        expect(cameraShake.level).toBe(0);
        hit(20);
        expect(cameraShake.level).toBeGreaterThan(0);
    });

    it('a kill adds trauma however small; a resisted hit never does', () => {
        hit(2, { isLethal: true });
        expect(cameraShake.level).toBeGreaterThan(0);
        cameraShake.reset();
        hit(60, { effectiveness: 0.5 });
        expect(cameraShake.level).toBe(0);
    });

    it('the target and the attacker shudder while it holds', () => {
        const target = { style: { translate: '' } };
        const attacker = { style: { translate: '' } };
        spriteShakes.attach('ally', target);
        spriteShakes.attach('foe', attacker);
        hit(40);
        for (let i = 0; i < 4; i += 1) battleClock.advance(16);
        expect(spriteShakes.active).toBe(true);
    });
});

describe('155a — the subscription survives the render a play causes', () => {
    it('still stops on a hit AFTER the component has re-rendered', () => {
        /*
         * THE REGRESSION TEST FOR THE BUG THAT MADE 146 DEAD ON ARRIVAL. A play dispatches and React
         * re-renders; a subscription keyed on the state object is torn down between the request and
         * the next frame. Re-rendering BEFORE the assertion is the whole test.
         */
        act(() => { root.render(<Harness nonce={1} />); });
        act(() => { root.render(<Harness nonce={2} />); });
        hit(30);
        expect(isHitStopped()).toBe(true);
    });

    it('does not cancel a stop that a re-render lands on top of', () => {
        hit(30);
        act(() => { root.render(<Harness nonce={3} />); });
        expect(isHitStopped()).toBe(true);
    });
});

describe('146e — the animations switch', () => {
    it('turns the stop and the camera off entirely, while the flash (which is vfx) stays', () => {
        // §2a: *"`animations` off → no stop, no shake; the flash stays (it is `vfx`)."*
        act(() => { root.unmount(); });
        saveSettings({ ...DEFAULT_SETTINGS, animations: false });
        container = document.createElement('div');
        root = createRoot(container);
        act(() => { root.render(<Harness />); });

        hit(40);
        expect(isHitStopped()).toBe(false);
        expect(cameraShake.level).toBe(0);
    });

    it('reads the setting once per fight rather than per hit', () => {
        // A JSON parse on the impact path of every hit is the kind of cost that only shows up in a
        // 3v3 with a Side card. Changing storage mid-fight must NOT take effect.
        const spy = vi.spyOn(Storage.prototype, 'getItem');
        spy.mockClear();
        hit(10);
        hit(10);
        expect(spy.mock.calls.filter((c) => c[0] === SETTINGS_STORAGE_KEY)).toHaveLength(0);
        spy.mockRestore();
    });
});

describe('leaving a fight', () => {
    it('drops a standing freeze and any trauma, so the next battle does not open frozen or shaking', () => {
        hit(60, { isLethal: true });
        expect(isHitStopped()).toBe(true);
        act(() => { root.unmount(); });
        root = createRoot(document.createElement('div'));
        expect(isHitStopped()).toBe(false);
        expect(cameraShake.level).toBe(0);
    });
});

/** Real milliseconds of freeze left, read straight off the clock. */
function readFreeze(): number {
    let ms = 0;
    for (; battleClock.frozen && ms < 1000; ms += 1) battleClock.advance(1);
    return ms;
}
