// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { useBattleVfx, type BattleVfx } from './useBattleVfx';
import { globalBattleEventBus } from '../../engine/events';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { IBattleState } from '../../engine/types';
import * as audioEngine from '../audio/AudioEngine';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STATE: IBattleState = createSparseBattleState({
    activeSide: 'PLAYER',
    phase: 'ACTION',
    playerParty: [
        createSparseEntity({ id: 'p1', name: 'Ally 1' }),
        createSparseEntity({ id: 'p2', name: 'Ally 2' }),
        createSparseEntity({ id: 'p3', name: 'Ally 3' }),
    ],
    enemyParty: [createSparseEntity({ id: 'e1', name: 'Enemy 1' })],
});

let host: HTMLDivElement;
let root: Root;
const seen: { vfx: BattleVfx | null } = { vfx: null };

function Probe(): null {
    const vfx = useBattleVfx(STATE);
    useEffect(() => {
        seen.vfx = vfx;
    });
    return null;
}

beforeEach(() => {
    vi.useFakeTimers();
    seen.vfx = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
        root.render(<Probe />);
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.useRealTimers();
});

describe('166b — useBattleVfx status burst handling', () => {
    it('merges 6 STATUS_APPLIED into one float per body with combined stacks, and plays sound once', () => {
        const sfxSpy = vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);

        // 6 STATUS_APPLIED: 2 stacks of Sharp to p1, p2, p3 twice each in one tick
        act(() => {
            const bodies = ['p1', 'p2', 'p3'];
            for (let round = 0; round < 2; round++) {
                for (const id of bodies) {
                    globalBattleEventBus.emit({
                        type: 'STATUS_APPLIED',
                        targetId: id,
                        status: 'Sharp',
                        stacks: 2,
                        timestamp: Date.now(),
                    });
                }
            }
        });

        // Run the 0ms burst flush timer
        act(() => {
            vi.advanceTimersByTime(10);
        });

        const vfx = seen.vfx;
        expect(vfx).not.toBeNull();

        for (const id of ['p1', 'p2', 'p3']) {
            const floats = vfx!.unitFx[id]?.floats ?? [];
            const statusFloats = floats.filter(f => f.kind === 'status');
            expect(statusFloats).toHaveLength(1);
            expect(statusFloats[0].text).toBe('Sharp ×4');
        }

        // Only one sound was played for the Sharp burst
        expect(sfxSpy).toHaveBeenCalledTimes(1);

        sfxSpy.mockRestore();
    });
});

describe('167h — a float lives long enough to read', () => {
    it('is still on the unit at 1.5 s and gone by 2.1 s (it was 1.15 s)', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({ type: 'STATUS_APPLIED', targetId: 'p1', status: 'Sharp', stacks: 2, timestamp: Date.now() });
        });
        act(() => { vi.advanceTimersByTime(10); });
        expect(seen.vfx!.unitFx['p1']?.floats ?? []).toHaveLength(1);

        act(() => { vi.advanceTimersByTime(1500); });
        expect(seen.vfx!.unitFx['p1']?.floats ?? []).toHaveLength(1);

        act(() => { vi.advanceTimersByTime(600); });
        expect(seen.vfx!.unitFx['p1']?.floats ?? []).toHaveLength(0);
    });
});

describe('167i — the absorbed float shows a whole number', () => {
    it('a hit that a Bark Shield eats 13.7 of floats "-14 🛡", not the raw figure', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({
                type: 'DAMAGE_TAKEN', targetId: 'p1', amount: 5, element: 'Fire', timestamp: Date.now(),
                damage: { absorbed: 13.7 },
            } as never);
        });
        act(() => { vi.advanceTimersByTime(10); });
        const texts = (seen.vfx!.unitFx['p1']?.floats ?? []).map(f => f.text);
        expect(texts).toContain('-14 🛡');
        expect(texts.some(t => t.includes('13.7'))).toBe(false);
    });
});

describe('171f — a hook\'s status floats on its own, after the card, with its name', () => {
    it('Ember Jab on a Burning target floats "Burn", then "+1 Burn · Ember Fuse"', () => {
        // Henry, 2026-09-29: "I don't see the burn getting added." It read "Burn ×2".
        const sfxSpy = vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({
                type: 'STATUS_APPLIED', targetId: 'e1', status: 'Burn', stacks: 1, timestamp: Date.now(),
                source: { kind: 'os', id: 'skoll_v2', ownerId: 'p1', hookId: 'skoll_v2_ember_fuse' },
            });
            globalBattleEventBus.emit({
                type: 'HOOK_FIRED', osId: 'skoll_v2', hookId: 'skoll_v2_ember_fuse', ownerId: 'p1',
                trigger: 'onPostDamage', timestamp: Date.now(),
            });
            globalBattleEventBus.emit({
                type: 'STATUS_APPLIED', targetId: 'e1', status: 'Burn', stacks: 1, timestamp: Date.now(),
                source: { kind: 'card', id: 'ember_jab', ownerId: 'p1' },
            });
        });
        act(() => { vi.advanceTimersByTime(10); });
        const first = (seen.vfx!.unitFx['e1']?.floats ?? []).filter(f => f.kind === 'status').map(f => f.text);
        expect(first).toEqual(['Burn']);
        // The status sound played; the fuse's own sound is held for its float.
        expect(sfxSpy).toHaveBeenCalledTimes(1);

        act(() => { vi.advanceTimersByTime(700); });
        const after = (seen.vfx!.unitFx['e1']?.floats ?? []).filter(f => f.kind === 'status').map(f => f.text);
        expect(after).toEqual(['Burn', '+1 Burn · Ember Fuse']);
        expect(sfxSpy).toHaveBeenCalledTimes(2);
        sfxSpy.mockRestore();
    });
});

describe('184b — a Burn overflow floats as an overflow', () => {
    it('4 Burn + 2 floats "OVERFLOW · 2 BURN", not "Burn ×2" on a badge that just dropped', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({
                type: 'STATUS_APPLIED', targetId: 'e1', status: 'Burn', stacks: 2, overflowRemaining: 2, timestamp: Date.now(),
            });
        });
        act(() => { vi.advanceTimersByTime(10); });
        const texts = (seen.vfx!.unitFx['e1']?.floats ?? []).filter(f => f.kind === 'status').map(f => f.text);
        expect(texts).toEqual(['OVERFLOW · 2 BURN']);
    });

    it('a burst that detonates and then adds more reports the pile it ends on', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({ type: 'STATUS_APPLIED', targetId: 'e1', status: 'Burn', stacks: 2, overflowRemaining: 1, timestamp: Date.now() });
            globalBattleEventBus.emit({ type: 'STATUS_APPLIED', targetId: 'e1', status: 'Burn', stacks: 1, timestamp: Date.now() });
        });
        act(() => { vi.advanceTimersByTime(10); });
        const texts = (seen.vfx!.unitFx['e1']?.floats ?? []).filter(f => f.kind === 'status').map(f => f.text);
        expect(texts).toEqual(['OVERFLOW · 2 BURN']);
    });

    it('a hook that sets the pile off names itself after the overflow', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({
                type: 'STATUS_APPLIED', targetId: 'e1', status: 'Burn', stacks: 1, overflowRemaining: 1, timestamp: Date.now(),
                source: { kind: 'os', id: 'skoll_v2', ownerId: 'p1', hookId: 'skoll_v2_ember_fuse' },
            });
            globalBattleEventBus.emit({
                type: 'HOOK_FIRED', osId: 'skoll_v2', hookId: 'skoll_v2_ember_fuse', ownerId: 'p1',
                trigger: 'onPostDamage', timestamp: Date.now(),
            });
        });
        act(() => { vi.advanceTimersByTime(710); });
        const texts = (seen.vfx!.unitFx['e1']?.floats ?? []).filter(f => f.kind === 'status').map(f => f.text);
        expect(texts).toEqual(['OVERFLOW · 1 BURN · Ember Fuse']);
    });
});
