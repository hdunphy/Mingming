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
import { emitStageMoment } from '../vfx/impact/stageMoments';
import { groupStatusTells } from '../vfx/statusBurst';

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

describe('166b / 198b-3 — a status lands as the presenter\'s moment', () => {
    it('one `status` moment per body floats once, with its stacks, and plays sound once', () => {
        const sfxSpy = vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);

        // 198b-3: the presenter has already merged the cast's six STATUS_APPLIED into one tell per
        // body (`groupStatusTells`), and says each as it lands.
        act(() => {
            for (const id of ['p1', 'p2', 'p3']) emitStageMoment({ kind: 'status', targetId: id, status: 'Sharp', stacks: 4 });
        });
        act(() => { vi.advanceTimersByTime(10); });

        const vfx = seen.vfx;
        expect(vfx).not.toBeNull();
        for (const id of ['p1', 'p2', 'p3']) {
            const statusFloats = (vfx!.unitFx[id]?.floats ?? []).filter(f => f.kind === 'status');
            expect(statusFloats).toHaveLength(1);
            expect(statusFloats[0].text).toBe('Sharp ×4');
        }
        expect(sfxSpy).toHaveBeenCalledTimes(3);
        sfxSpy.mockRestore();
    });

    it('a STATUS_APPLIED event by itself floats nothing: the engine says it at play, the presenter at the landing', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            globalBattleEventBus.emit({ type: 'STATUS_APPLIED', targetId: 'p1', status: 'Sharp', stacks: 2, timestamp: Date.now() });
        });
        act(() => { vi.advanceTimersByTime(10); });
        expect(seen.vfx!.unitFx['p1']?.floats ?? []).toHaveLength(0);
    });
});

describe('167h — a float lives long enough to read', () => {
    it('is still on the unit at 1.5 s and gone by 2.1 s (it was 1.15 s)', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            emitStageMoment({ kind: 'status', targetId: 'p1', status: 'Sharp', stacks: 2 });
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
    it('a hit that a Bark Shield eats 13.7 of floats "-14" with the shield icon, not the raw figure', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            // 189d: a hit is said by the presenter's stage moment at the impact, not by the event.
            emitStageMoment({
                kind: 'hit', targetId: 'p1', applied: 5, absorbed: 13.7, element: 'Fire', maxHp: 100,
                isLethal: false, definitionId: undefined, sourceId: undefined, isCritical: false,
                effectiveness: 1, step: 0, targets: 1,
            });
        });
        act(() => { vi.advanceTimersByTime(10); });
        const floats = seen.vfx!.unitFx['p1']?.floats ?? [];
        const texts = floats.map(f => f.text);
        // Ticket 205: the shield is a Tabler icon the float carries by name, no longer a character in its text.
        expect(floats.find(f => f.text === '-14')?.icon).toBe('absorbed');
        expect(texts).toContain('-14');
        expect(texts.some(t => t.includes('13.7'))).toBe(false);
    });
});

describe('171f — a hook\'s status floats on its own, after the card, with its name', () => {
    it('Ember Jab on a Burning target floats "Burn", then "+1 Burn · Sunscorch"', () => {
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
            // 198b-3: the card's own Burn is said by the presenter as it lands.
            emitStageMoment({ kind: 'status', targetId: 'e1', status: 'Burn', stacks: 1 });
        });
        act(() => { vi.advanceTimersByTime(10); });
        const first = (seen.vfx!.unitFx['e1']?.floats ?? []).filter(f => f.kind === 'status').map(f => f.text);
        expect(first).toEqual(['Burn']);
        // The status sound played; the fuse's own sound is held for its float.
        expect(sfxSpy).toHaveBeenCalledTimes(1);

        act(() => { vi.advanceTimersByTime(700); });
        const after = (seen.vfx!.unitFx['e1']?.floats ?? []).filter(f => f.kind === 'status').map(f => f.text);
        expect(after).toEqual(['Burn', '+1 Burn · Sunscorch']);
        expect(sfxSpy).toHaveBeenCalledTimes(2);
        sfxSpy.mockRestore();
    });
});

describe('184b — a Burn overflow floats as an overflow', () => {
    it('4 Burn + 2 floats "OVERFLOW · 2 BURN", not "Burn ×2" on a badge that just dropped', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        act(() => {
            emitStageMoment({ kind: 'status', targetId: 'e1', status: 'Burn', stacks: 2, overflow: 2 });
        });
        act(() => { vi.advanceTimersByTime(10); });
        const texts = (seen.vfx!.unitFx['e1']?.floats ?? []).filter(f => f.kind === 'status').map(f => f.text);
        expect(texts).toEqual(['OVERFLOW · 2 BURN']);
    });

    it('a burst that detonates and then adds more reports the pile it ends on (the presenter folds it)', () => {
        vi.spyOn(audioEngine, 'playSfx').mockImplementation(() => undefined);
        const [tell] = groupStatusTells([
            { targetId: 'e1', status: 'Burn', stacks: 2, overflow: 1 },
            { targetId: 'e1', status: 'Burn', stacks: 1 },
        ]);
        expect(tell.stacks.e1).toBe(3);
        expect(tell.overflow.e1).toBe(2);
        act(() => {
            emitStageMoment({ kind: 'status', targetId: 'e1', status: 'Burn', stacks: tell.stacks.e1, overflow: tell.overflow.e1 });
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
        expect(texts).toEqual(['OVERFLOW · 1 BURN · Sunscorch']);
    });
});
