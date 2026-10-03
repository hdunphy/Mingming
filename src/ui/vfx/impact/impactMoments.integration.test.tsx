// @vitest-environment jsdom
/**
 * TICKET 189d — "the hit lands where it is drawn", against the REAL reducer.
 *
 * The reducer says a hit at play. These tests read WHEN the screen says it: the damage float and the
 * impact sound at the impact (where the tier's attack plan puts it, 190c), the hit-stop and the camera trauma
 * with it, and nothing at arrival. The real path: reducer, bus, collector, presenter queue, battle
 * clock, stage moments, `useBattleVfx` (floats and sounds) and `useImpactFeedback` (freeze and shake).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, useEffect, useRef } from 'react';

import { battleReducer, type BattleAction } from '../../../engine/battleReducer';
import { STANDARD_CONSTRAINTS } from '../../../engine/data/programRegistry';
import { TestProgramRegistry } from '../../../engine/data/testProgramRegistry';
import type { IBattleEntity, IBattleState } from '../../../engine/types';
import type { StageAnchors } from '../../hooks/useStageAnchors';
import { type BattleVfx, useBattleVfx } from '../../hooks/useBattleVfx';
import { DEFAULT_SETTINGS, saveSettings } from '../../settings/settings';
import { battleClock, resetBattleClock } from '../clock/battleClockRuntime';
import { setParticleSink, setStageAnchors } from '../emit';
import { isHitStopped } from '../hitStop';
import { useDisplayedBoardSync } from '../displayed/useDisplayedBoard';
import { useCastSequence } from '../useCastSequence';
import { useImpactFeedback } from '../useImpactFeedback';
import { cameraPunch, cameraShake } from './impactRuntime';
import { emitStageMoment } from './stageMoments';
import { resetActiveTier, setActiveTier } from '../tiers/activeTier';
import { playSfx } from '../../audio/AudioEngine';
import { planAttack } from '../tiers/attackPlan';
import { TIER_PROFILES } from '../tiers/tierProfiles';

vi.mock('../../../engine/data/programRegistry', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../engine/data/programRegistry')>();
    return {
        ...original,
        GetProgramData: vi.fn((id: string) => TestProgramRegistry[id] || original.GetProgramData(id)),
    };
});
vi.mock('../../audio/AudioEngine', () => ({ playSfx: vi.fn(), primeSfxSamples: vi.fn() }));

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

TestProgramRegistry.card_test_single = {
    id: 'card_test_single', name: 'Jab', description: 'One hit.',
    element: 'Fire', target: 'Single', category: 'Attack', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
    actions: [{ type: 'ATTACK', power: 20, target: 'TARGET' }],
    rarity: 'Common',
} as never;

const body = (id: string, over: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id, name: id, nickname: id, definitionId: 'fenrir', blueprintsCollected: 0,
    attackIV: 0, defenseIV: 0, hpIV: 0,
    maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
    currentHp: 100, currentEnergy: 10,
    primaryElement: 'Fire', statusEffects: [],
    tempHp: 0, speed: 10, hooks: [], daemons: [],
    ...over,
}) as IBattleEntity;

const fat = (id: string, maxHp: number): IBattleEntity =>
    body(id, { primaryElement: 'Nature', maxHp, currentHp: maxHp });

function frame(enemies: IBattleEntity[], dataId = 'card_test_single'): IBattleState {
    return {
        sessionId: 'test', seed: '123', turn: 1, phase: 'ACTION', activeSide: 'PLAYER', activeDrivers: [],
        playerParty: [body('a1'), body('a2'), body('a3')],
        enemyParty: enemies,
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
            hand: [{ id: 'c1', dataId, currentCost: 1, isPlayable: true }],
        },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
        logs: [], osLogs: [], procs: [], cardsPlayedThisTurn: 0, cardsDrawnThisTurn: 0, lastProgramPlayed: null, counters: {},
    } as unknown as IBattleState;
}

let vfx: BattleVfx;
const Harness: React.FC<{ state: IBattleState }> = ({ state }) => {
    const handle = useCastSequence(state);
    useDisplayedBoardSync(state, handle);
    const result = useBattleVfx(state);
    const camera = useRef<HTMLDivElement>(null);
    useImpactFeedback(camera);
    useEffect(() => { vfx = result; });
    return <div ref={camera} />;
};

const rect = (x: number) => ({ x, y: 100, w: 190, h: 190 });
const ANCHORS = {
    slots: { a1: rect(100), a2: rect(120), a3: rect(140), e1: rect(900), e2: rect(920), e3: rect(940) },
    plaques: { a1: rect(20), a2: rect(30), a3: rect(40), e1: rect(1100), e2: rect(1110), e3: rect(1120) },
    reveal: rect(500), hand: rect(500), discard: rect(800), scale: 1,
} as unknown as StageAnchors;

let container: HTMLDivElement;
let root: Root;
let current: IBattleState;
const sfx = playSfx as unknown as ReturnType<typeof vi.fn>;

const mount = (state: IBattleState): void => {
    current = state;
    act(() => { root.render(<Harness state={current} />); });
};
const play = (targetId = 'e1', programId = 'c1'): void => {
    act(() => {
        current = battleReducer(current, { type: 'PLAY_PROGRAM', payload: { sourceId: 'a1', targetId, programId } } as BattleAction);
        root.render(<Harness state={current} />);
    });
};
const settle = async (ms: number): Promise<void> => {
    await act(async () => {
        vi.advanceTimersByTime(0);
        for (let left = ms; left > 0; left -= 8) {
            const f = battleClock.advance(Math.min(8, left));
            cameraShake.step(f);
        }
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });
};
// The numbers and readouts on a body; the matchup tag has its own helper (190e).
const floatsOn = (id: string): string[] => (vfx.unitFx[id]?.floats ?? []).filter((f) => f.kind !== 'tag').map((f) => f.text);
const tagsOn = (id: string): string[] => (vfx.unitFx[id]?.floats ?? []).filter((f) => f.kind === 'tag').map((f) => f.text);
const impactSounds = (): number => sfx.mock.calls.filter(([name]) => String(name).startsWith('impact')).length;

beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
    setStageAnchors(ANCHORS);
    setParticleSink({ spawn: () => undefined, wake: () => undefined });
    vi.useFakeTimers();
    sfx.mockClear();
    container = document.createElement('div');
    root = createRoot(container);
});

afterEach(() => {
    act(() => { root.unmount(); });
    resetBattleClock();
    cameraShake.reset();
    cameraPunch.reset();
    resetActiveTier();
    vi.useRealTimers();
    setParticleSink(null);
    setStageAnchors(null);
    localStorage.clear();
});

/** What one Jab does to a 100,000 HP body, so a test can size a target to a share of it. */
function jabDamage(): number {
    const state = frame([fat('e1', 100_000), fat('e2', 100_000), fat('e3', 100_000)]);
    const next = battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'a1', targetId: 'e1', programId: 'c1' } } as BattleAction);
    return 100_000 - next.enemyParty[0].currentHp;
}

/** Game time at which Showy's plan lands a hit of `dealt` on a body of `maxHp` (190c). */
const impactAt = (dealt: number, maxHp: number): number =>
    planAttack(TIER_PROFILES.showy, { damage: dealt, maxHp, isKill: false, contact: false }).game.impactMs;

/** Run the clock to the first frozen frame: the hit has landed, whatever its size. */
async function settleToImpact(): Promise<void> {
    for (let ms = 0; ms < 4_000 && !(battleClock.frozen || isHitStopped()); ms += 8) await settle(8);
}

describe('189d — the number and the sound happen at the impact, not at play', () => {
    it('the damage float and the impact sound wait for the trail to land', async () => {
        mount(frame([fat('e1', 1000), fat('e2', 1000), fat('e3', 1000)]));
        play();
        const dealt = 1000 - current.enemyParty[0].currentHp;
        expect(dealt).toBeGreaterThan(0);

        const at = impactAt(dealt, 1000);

        await settle(0);
        expect(floatsOn('e1')).toEqual([]);
        expect(impactSounds()).toBe(0);

        await settle(at - 1);
        expect(floatsOn('e1')).toEqual([]);
        expect(impactSounds()).toBe(0);

        await settle(1);
        expect(floatsOn('e1')).toEqual([`-${dealt}`]);
        expect(impactSounds()).toBe(1);
    });

    it('the HP bar, the float and the sound move on the same instant', async () => {
        const at = impactAt(jabDamage(), 1000);
        mount(frame([fat('e1', 1000), fat('e2', 1000), fat('e3', 1000)]));
        play();
        await settle(at - 1);
        const before = vfx.unitFx.e1?.hitKey ?? 0;
        await settle(1);
        expect(vfx.unitFx.e1?.hitKey).toBe(before + 1);
    });

    it('the hit-stop lands with the impact: nothing is frozen at play', async () => {
        mount(frame([fat('e1', 1000), fat('e2', 1000), fat('e3', 1000)]));
        play();
        await settle(0);
        expect(isHitStopped()).toBe(false);
        const at = impactAt(jabDamage(), 1000);
        await settle(at - 1);
        expect(isHitStopped()).toBe(false);
        await settle(1);
        expect(isHitStopped()).toBe(true);
    });
});

describe('189d — a kill is heavier than a chip, and shakes the camera', () => {
    it('a kill freezes longer than a chip', async () => {
        const dealt = jabDamage();
        mount(frame([fat('e1', 100_000), fat('e2', 100_000), fat('e3', 100_000)]));
        play();
        await settleToImpact();
        let chip = 0;
        for (; battleClock.frozen && chip < 1000; chip += 1) battleClock.advance(1);

        resetBattleClock();
        act(() => { root.unmount(); });
        root = createRoot(container);
        mount(frame([body('e1', { primaryElement: 'Nature', currentHp: Math.max(1, dealt - 1), maxHp: 100_000 }), fat('e2', 100), fat('e3', 100)]));
        play();
        expect(current.enemyParty[0].currentHp).toBe(0);
        await settleToImpact();
        let kill = 0;
        for (; battleClock.frozen && kill < 1000; kill += 1) battleClock.advance(1);

        expect(kill).toBeGreaterThan(chip);
    });

    it('a 6%-of-max-HP hit adds no camera trauma; a 20% hit does', async () => {
        const dealt = jabDamage();
        mount(frame([fat('e1', Math.round(dealt / 0.06)), fat('e2', 100), fat('e3', 100)]));
        play();
        await settleToImpact();
        expect(cameraShake.level).toBe(0);

        resetBattleClock();
        act(() => { root.unmount(); });
        root = createRoot(container);
        mount(frame([fat('e1', Math.round(dealt / 0.2)), fat('e2', 100), fat('e3', 100)]));
        play();
        await settleToImpact();
        expect(cameraShake.level).toBeGreaterThan(0);
    });

    it('no camera offset is non-zero during a freeze, and it moves once the freeze lifts', async () => {
        const dealt = jabDamage();
        mount(frame([fat('e1', Math.round(dealt / 0.2)), fat('e2', 100), fat('e3', 100)]));
        play();
        await settleToImpact();
        expect(battleClock.frozen || isHitStopped()).toBe(true);

        const offsets: Array<{ frozen: boolean; x: number; y: number; degrees: number }> = [];
        await act(async () => {
            for (let i = 0; i < 60; i += 1) {
                const f = battleClock.advance(8);
                const o = cameraShake.step(f);
                offsets.push({ frozen: f.frozen, ...o });
            }
        });
        const frozenFrames = offsets.filter((o) => o.frozen);
        expect(frozenFrames.length).toBeGreaterThan(0);
        for (const o of frozenFrames) expect(o).toMatchObject({ x: 0, y: 0, degrees: 0 });
        const moved = offsets.filter((o) => !o.frozen && (o.x !== 0 || o.y !== 0));
        expect(moved.length).toBeGreaterThan(0);
    });
});

describe('189d — the sounds of a multi-target hit are spaced by the cast, not by the clock', () => {
    it('a lone hit is step 0', async () => {
        mount(frame([fat('e1', 1000), fat('e2', 1000), fat('e3', 1000)]));
        play();
        await settleToImpact();
        const call = sfx.mock.calls.find(([name]) => String(name).startsWith('impact'));
        expect(call?.[1]).toMatchObject({ step: 0 });
    });
});

describe('190e - the matchup is named on the body that took the hit', () => {
    it('a super-effective hit shows SUPER EFFECTIVE, at the impact and not before', async () => {
        mount(frame([fat('e1', 1000), fat('e2', 1000), fat('e3', 1000)]));      // Fire into Nature
        play();
        const at = impactAt(jabDamage(), 1000);
        await settle(at - 1);
        expect(tagsOn('e1')).toEqual([]);
        await settle(1);
        expect(tagsOn('e1')).toEqual(['SUPER EFFECTIVE']);
    });

    it('a resisted hit shows RESISTED (the chart has no resists today, so the moment is sent by hand)', () => {
        mount(frame([fat('e1', 1000), fat('e2', 1000), fat('e3', 1000)]));
        act(() => {
            emitStageMoment({
                kind: 'hit', targetId: 'e1', applied: 20, absorbed: 0, element: 'Fire', maxHp: 1000, isLethal: false,
                definitionId: 'fenrir', sourceId: 'a1', isCritical: false, effectiveness: 0.5, step: 0, targets: 1,
            });
        });
        expect(tagsOn('e1')).toEqual(['RESISTED']);
    });

    it('a plain hit shows no tag', async () => {
        TestProgramRegistry.card_test_plain = {
            ...TestProgramRegistry.card_test_single, id: 'card_test_plain', element: 'None',
        } as never;
        mount(frame([fat('e1', 1000), fat('e2', 1000), fat('e3', 1000)], 'card_test_plain'));
        play();
        await settleToImpact();
        expect(floatsOn('e1')).not.toEqual([]);
        expect(tagsOn('e1')).toEqual([]);
    });
});

describe('190e - the white hit flash', () => {
    it('flashes on each hit by default', async () => {
        mount(frame([fat('e1', 1000), fat('e2', 1000), fat('e3', 1000)]));
        play();
        await settleToImpact();
        expect(vfx.unitFx.e1?.flashKey).toBe(1);
    });

    it('does not flash with the flashes setting off, but the hit still lands', async () => {
        saveSettings({ ...DEFAULT_SETTINGS, flashes: false });
        mount(frame([fat('e1', 1000), fat('e2', 1000), fat('e3', 1000)]));
        play();
        await settleToImpact();
        expect(vfx.unitFx.e1?.hitKey).toBe(1);
        expect(vfx.unitFx.e1?.flashKey ?? 0).toBe(0);
        expect(floatsOn('e1')).not.toEqual([]);
    });
});

describe('190g - the camera punch', () => {
    /** A 70% hit: big enough to charge on Showy. */
    const bigHit = async (): Promise<void> => {
        const dealt = jabDamage();
        mount(frame([fat('e1', Math.round(dealt / 0.7)), fat('e2', 100), fat('e3', 100)]));
        play();
        await settleToImpact();
    };

    it('zooms the picture on a big hit (after the freeze) and comes back to exactly 1', async () => {
        await bigHit();
        expect(cameraPunch.active).toBe(true);
        // The freeze comes first, like the shake's: the punch starts when it lifts.
        let peak = 1;
        await act(async () => {
            for (let ms = 0; ms < 1200; ms += 4) {
                const f = battleClock.advance(4);
                cameraShake.step(f);
                peak = Math.max(peak, cameraPunch.step(f));
            }
        });
        expect(peak).toBeGreaterThan(1.01);
        expect(peak).toBeLessThanOrEqual(1.03 + 1e-9);
        expect(cameraPunch.scale).toBe(1);
        expect(cameraPunch.active).toBe(false);
    });

    it('does not punch for a small hit', async () => {
        const dealt = jabDamage();
        mount(frame([fat('e1', Math.round(dealt / 0.2)), fat('e2', 100), fat('e3', 100)]));
        play();
        await settleToImpact();
        expect(cameraPunch.active).toBe(false);
        expect(cameraPunch.scale).toBe(1);
    });

    it('does not punch on Snappy or Fast', async () => {
        for (const tier of ['snappy', 'fast'] as const) {
            setActiveTier(tier);
            await bigHit();
            expect(cameraPunch.active, tier).toBe(false);
            resetBattleClock();
            act(() => { root.unmount(); });
            root = createRoot(container);
        }
    });

    it('does not punch with the shake slider at 0', async () => {
        saveSettings({ ...DEFAULT_SETTINGS, screenShake: 0 });
        await bigHit();
        expect(cameraPunch.active).toBe(false);
    });
});
