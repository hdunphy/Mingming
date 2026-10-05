// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { useBattleVfx, type BattleVfx } from './useBattleVfx';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { IBattleState } from '../../engine/types';
import * as audioEngine from '../audio/AudioEngine';
import { emitStageMoment } from '../vfx/impact/stageMoments';
import { damageSeverity } from '../vfx/impact/impactMath';
import { activeProfile } from '../vfx/tiers/activeTier';

/**
 * TICKET 194k-4 — Henry: *"Damage numbers seem thin."* The float carries the size
 * `damageNumberPx(s)` gives for the hit, instead of a fixed 1.6rem.
 */

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STATE: IBattleState = createSparseBattleState({
    activeSide: 'PLAYER',
    phase: 'ACTION',
    playerParty: [createSparseEntity({ id: 'p1', name: 'Ally 1' })],
    enemyParty: [createSparseEntity({ id: 'e1', name: 'Enemy 1' })],
});

let host: HTMLDivElement;
let root: Root;
const seen: { vfx: BattleVfx | null } = { vfx: null };

function Probe(): null {
    const vfx = useBattleVfx(STATE);
    useEffect(() => { seen.vfx = vfx; });
    return null;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => { root.render(<Probe />); });
});

afterEach(() => {
    act(() => { root.unmount(); });
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const hit = (applied: number, maxHp: number): void => {
    act(() => {
        emitStageMoment({
            kind: 'hit', targetId: 'p1', applied, absorbed: 0, element: 'Fire', maxHp,
            isLethal: false, definitionId: undefined, sourceId: undefined, isCritical: false,
            effectiveness: 1, step: 0, targets: 1,
        });
    });
    act(() => { vi.advanceTimersByTime(10); });
};

describe('194k-4 — the damage float\'s size is the profile\'s', () => {
    it('a median hit (50 of 1,150) is damageNumberPx(s) for its own s, between 30 and 60', () => {
        hit(50, 1150);
        const [float] = seen.vfx!.unitFx['p1'].floats.filter((f) => f.kind === 'damage');
        expect(float.px).toBe(activeProfile().damageNumberPx(damageSeverity(50, 1150)));
        expect(float.px).toBeGreaterThan(30);
        expect(float.px).toBeLessThan(60);
    });

    it('a bigger hit has a bigger number', () => {
        hit(20, 1150);
        hit(120, 1150);
        const px = seen.vfx!.unitFx['p1'].floats.filter((f) => f.kind === 'damage').map((f) => f.px ?? 0);
        expect(px).toHaveLength(2);
        expect(px[1]).toBeGreaterThan(px[0]);
    });

    it('a label float carries no size of its own (it is 20 px by kind)', () => {
        hit(50, 1150);
        const tags = seen.vfx!.unitFx['p1'].floats.filter((f) => f.kind !== 'damage' && f.kind !== 'crit');
        expect(tags.every((f) => f.px === undefined)).toBe(true);
    });
});
