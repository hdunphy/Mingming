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
