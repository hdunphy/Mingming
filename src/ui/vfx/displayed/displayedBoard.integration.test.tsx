// @vitest-environment jsdom
/**
 * TICKET 189c — the displayed board against the REAL reducer.
 *
 * The reducer resolves a card in one synchronous burst and emits its events as it goes; the hook
 * pair under test (`useCastSequence` + `useDisplayedBoardSync`) turns that burst into beats on the
 * battle clock and moves the board at each impact. A probe component reads the board the way the
 * plaque does. Everything here is the real path: reducer, bus, collector, queue, clock, board.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, useEffect } from 'react';

import { battleReducer, type BattleAction } from '../../../engine/battleReducer';
import { TestProgramRegistry } from '../../../engine/data/testProgramRegistry';
import { STANDARD_CONSTRAINTS } from '../../../engine/data/programRegistry';
import type { IBattleEntity, IBattleState } from '../../../engine/types';
import { barkShieldPoints } from '../../components/stage/barkShield';
import type { StageAnchors } from '../../hooks/useStageAnchors';
import { DEFAULT_SETTINGS, saveSettings } from '../../settings/settings';
import { battleClock, resetBattleClock } from '../clock/battleClockRuntime';
import { setParticleSink, setStageAnchors } from '../emit';
import { type CastPresenter, useCastSequence } from '../useCastSequence';
import { displayedBoard } from './displayedBoardRuntime';
import { useDisplayedBoardSync, useDisplayedUnit } from './useDisplayedBoard';
import { planAttack } from '../tiers/attackPlan';
import { TIER_PROFILES } from '../tiers/tierProfiles';

vi.mock('../../../engine/data/programRegistry', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../engine/data/programRegistry')>();
    return {
        ...original,
        GetProgramData: vi.fn((id: string) => TestProgramRegistry[id] || original.GetProgramData(id)),
    };
});

// Two cards the shared fixtures do not have: one with a price (recoil), one that raises Bark Shield.
TestProgramRegistry.card_test_recoil = {
    id: 'card_test_recoil', name: 'Overreach', description: 'Hit hard, hurt yourself.',
    element: 'Fire', target: 'Single', category: 'Attack', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
    actions: [
        { type: 'ATTACK', power: 20, target: 'TARGET' },
        { type: 'ATTACK', power: 0, percentMaxHp: 10, target: 'SELF' },
    ],
    rarity: 'Common',
} as never;
TestProgramRegistry.card_test_bark = {
    id: 'card_test_bark', name: 'Bark', description: 'Gain Bark Shield.',
    element: 'Nature', target: 'Single', category: 'Skill', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
    actions: [{ type: 'STATUS', status: 'BarkShield', stacks: 20, target: 'SELF' }],
    rarity: 'Common',
} as never;

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── a 3v3 frame ───────────────────────────────────────────────────────────────────────────

const body = (id: string, over: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id, name: id, nickname: id, definitionId: 'fenrir', blueprintsCollected: 0,
    attackIV: 0, defenseIV: 0, hpIV: 0,
    maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
    currentHp: 100, currentEnergy: 10,
    primaryElement: 'Fire', statusEffects: [],
    tempHp: 0, speed: 10, hooks: [], daemons: [],
    ...over,
}) as IBattleEntity;

const card = (id: string, dataId: string) => ({ id, dataId, currentCost: 1, isPlayable: true });

function frame(over: { player?: IBattleEntity[]; enemy?: IBattleEntity[]; hand?: ReturnType<typeof card>[]; enemyHand?: ReturnType<typeof card>[]; side?: 'PLAYER' | 'ENEMY' } = {}): IBattleState {
    return {
        sessionId: 'test', seed: '123', turn: 1, phase: 'ACTION', activeSide: over.side ?? 'PLAYER',
        activeDrivers: [],
        playerParty: over.player ?? [body('a1'), body('a2'), body('a3')],
        enemyParty: over.enemy ?? [body('e1', { primaryElement: 'Nature' }), body('e2', { primaryElement: 'Nature' }), body('e3', { primaryElement: 'Nature' })],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: over.hand ?? [], discard: [], exhaust: [] },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: over.enemyHand ?? [], discard: [], exhaust: [] },
        logs: [], osLogs: [], procs: [], cardsPlayedThisTurn: 0, cardsDrawnThisTurn: 0,
        lastProgramPlayed: null, counters: {},
    } as unknown as IBattleState;
}

// ── the harness ───────────────────────────────────────────────────────────────────────────

const Probe: React.FC<{ entity: IBattleEntity }> = ({ entity }) => {
    const shown = useDisplayedUnit(entity);
    return <span data-testid={`shown-${entity.id}`}>{`${shown.hp}|${shown.bark}|${shown.isDown ? 'down' : 'up'}`}</span>;
};

let presenter: CastPresenter;
const Harness: React.FC<{ state: IBattleState }> = ({ state }) => {
    const handle = useCastSequence(state);
    useDisplayedBoardSync(state, handle);
    useEffect(() => { presenter = handle; });
    return <>{[...state.playerParty, ...state.enemyParty].map((e) => <Probe key={e.id} entity={e} />)}</>;
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
/** What the board showed, read the instant before each safety-net check (so the snap cannot hide a miss). */
let beforeSnap: Array<Record<string, { hp: number; bark: number }>> = [];

const mount = (state: IBattleState): void => {
    current = state;
    act(() => { root.render(<Harness state={current} />); });
};

/** One synchronous burst, as the reducer produces it, then ONE render (as React batches it). */
const dispatchBurst = (...actions: BattleAction[]): void => {
    act(() => {
        for (const action of actions) current = battleReducer(current, action);
        root.render(<Harness state={current} />);
    });
};

const play = (sourceId: string, targetId: string, programId: string): BattleAction =>
    ({ type: 'PLAY_PROGRAM', payload: { sourceId, targetId, programId } }) as BattleAction;

const settle = async (ms: number): Promise<void> => {
    await act(async () => {
        vi.advanceTimersByTime(0);
        for (let left = ms; left > 0; left -= 16) battleClock.advance(Math.min(16, left));
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
        vi.advanceTimersByTime(0);
        for (let i = 0; i < 8; i += 1) await Promise.resolve();
    });
};

/** Game time at which Showy's plan lands a hit of `dealt` on a body of `maxHp` (ticket 190c). */
const impactAt = (dealt: number, maxHp: number): number =>
    planAttack(TIER_PROFILES.showy, { damage: dealt, maxHp, isKill: false, contact: false }).game.impactMs;

const shownText = (id: string): string => container.querySelector(`[data-testid="shown-${id}"]`)?.textContent ?? '';
const realText = (id: string): string => {
    const entity = [...current.playerParty, ...current.enemyParty].find((e) => e.id === id) as IBattleEntity;
    return `${entity.currentHp}|${barkShieldPoints(entity)}|${entity.currentHp <= 0 ? 'down' : 'up'}`;
};
const realOf = (id: string): IBattleEntity =>
    [...current.playerParty, ...current.enemyParty].find((e) => e.id === id) as IBattleEntity;
const everyBodyShowsTheTruth = (): void => {
    for (const entity of [...current.playerParty, ...current.enemyParty]) {
        expect(shownText(entity.id), entity.id).toBe(realText(entity.id));
    }
};

beforeEach(() => {
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
    setStageAnchors(ANCHORS);
    setParticleSink({ spawn: () => undefined, wake: () => undefined });
    vi.useFakeTimers();
    beforeSnap = [];
    const reconcile = displayedBoard.reconcile.bind(displayedBoard);
    vi.spyOn(displayedBoard, 'reconcile').mockImplementation((state) => {
        const snapshot: Record<string, { hp: number; bark: number }> = {};
        for (const e of [...state.playerParty, ...state.enemyParty]) {
            const u = displayedBoard.unit(e.id);
            if (u) snapshot[e.id] = { hp: u.hp, bark: u.bark };
        }
        beforeSnap.push(snapshot);
        return reconcile(state);
    });
    container = document.createElement('div');
    root = createRoot(container);
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

/** The board must equal the real state with the presenter idle, with NO correction from the net. */
const expectNoSnapNeeded = (): void => {
    expect(beforeSnap.length).toBeGreaterThan(0);
    const last = beforeSnap[beforeSnap.length - 1];
    for (const entity of [...current.playerParty, ...current.enemyParty]) {
        expect(last[entity.id], entity.id).toEqual({ hp: entity.currentHp, bark: barkShieldPoints(entity) });
    }
};

describe('189c — HP reads the old value until the impact', () => {
    it('after a 30-damage cast the plaque shows 100 until the impact, then the new value', async () => {
        // A fat target, so the card hurts without killing.
        const fat = (id: string) => body(id, { primaryElement: 'Nature', maxHp: 1000, currentHp: 1000 });
        const state = frame({ hand: [card('c1', 'card_fireball')], enemy: [fat('e1'), fat('e2'), fat('e3')] });
        mount(state);
        expect(shownText('e1')).toBe('1000|0|up');

        dispatchBurst(play('a1', 'e1', 'c1'));
        const real = realOf('e1').currentHp;
        expect(real).toBeLessThan(1000);                      // the engine already took it

        await settle(0);
        expect(shownText('e1')).toBe('1000|0|up');            // …the screen has not
        const at = impactAt(1000 - real, 1000);
        await settle(at - 1);                                 // the element is still on its way
        expect(shownText('e1')).toBe('1000|0|up');
        await settle(1);
        expect(shownText('e1')).toBe(`${real}|0|up`);
    });

    it('a body looks knocked out only after the killing impact', async () => {
        const state = frame({
            hand: [card('c1', 'card_fireball')],
            enemy: [body('e1', { currentHp: 5, primaryElement: 'Nature' }), body('e2'), body('e3')],
        });
        mount(state);
        dispatchBurst(play('a1', 'e1', 'c1'));
        expect(realOf('e1').currentHp).toBe(0);

        await settle(impactAt(5, 100) - 1);
        expect(shownText('e1')).toBe('5|0|up');
        await settle(1);
        expect(shownText('e1')).toBe('0|0|down');
    });
});

describe('189c — with the presenter idle, displayed equals real', () => {
    it('after a 3v3 enemy turn: three casts from three bodies, in one burst, then the turn ends', async () => {
        const state = frame({
            side: 'ENEMY',
            enemyHand: [card('x1', 'card_fireball'), card('x2', 'prog_drain'), card('x3', 'card_fireball')],
        });
        mount(state);
        dispatchBurst(
            play('e1', 'a1', 'x1'),
            play('e2', 'a2', 'x2'),
            play('e3', 'a3', 'x3'),
            { type: 'END_TURN' } as BattleAction,
        );
        expect(realOf('a1').currentHp).toBeLessThan(100);

        await settle(20_000);
        expect(presenter.isIdle()).toBe(true);
        everyBodyShowsTheTruth();
        expectNoSnapNeeded();
    });

    it('Bark absorbing a hit: the band takes the hit before the HP does, and the end matches', async () => {
        const bark = { id: 'bk', type: 'BarkShield', stacks: 15 } as never;
        const state = frame({
            hand: [card('c1', 'card_fireball')],
            enemy: [body('e1', { primaryElement: 'Nature', statusEffects: [bark] }), body('e2'), body('e3')],
        });
        mount(state);
        expect(shownText('e1')).toBe('100|15|up');

        dispatchBurst(play('a1', 'e1', 'c1'));
        await settle(0);
        expect(shownText('e1')).toBe('100|15|up');
        await settle(20_000);

        everyBodyShowsTheTruth();
        expectNoSnapNeeded();
        expect(shownText('e1').split('|')[1]).toBe('0');       // the 15-point band was spent
    });

    it('a heal', async () => {
        const state = frame({
            hand: [card('c1', 'card_heal_flat')],
            player: [body('a1', { currentHp: 50 }), body('a2'), body('a3')],
        });
        mount(state);
        dispatchBurst(play('a1', 'a1', 'c1'));
        expect(realOf('a1').currentHp).toBeGreaterThan(50);

        await settle(0);
        expect(shownText('a1')).toBe('50|0|up');
        await settle(20_000);
        everyBodyShowsTheTruth();
        expectNoSnapNeeded();
    });

    it('a recoil: the price lands with the impact, not before, and the end matches', async () => {
        const state = frame({ hand: [card('c1', 'card_test_recoil')] });
        mount(state);
        dispatchBurst(play('a1', 'e1', 'c1'));
        expect(realOf('a1').currentHp).toBe(90);              // the engine charged it at once

        await settle(impactAt(100 - realOf('e1').currentHp, 100) - 1);
        expect(shownText('a1')).toBe('100|0|up');
        await settle(1);
        expect(shownText('a1')).toBe('90|0|up');
        await settle(20_000);
        everyBodyShowsTheTruth();
        expectNoSnapNeeded();
    });

    it('a Bark Shield applied: the band grows with the statuses, after the impact', async () => {
        const state = frame({ hand: [card('c1', 'card_test_bark')] });
        mount(state);
        dispatchBurst(play('a1', 'a1', 'c1'));
        expect(barkShieldPoints(realOf('a1'))).toBe(20);

        await settle(0);
        expect(shownText('a1')).toBe('100|0|up');
        await settle(20_000);
        everyBodyShowsTheTruth();
        expectNoSnapNeeded();
    });

    it('a damage-over-time kill at the turn boundary', async () => {
        const poison = { id: 'ps', type: 'Poison', stacks: 5 } as never;
        const burn = { id: 'bn', type: 'Burn', stacks: 3 } as never;
        const state = frame({
            player: [body('a1', { currentHp: 1, statusEffects: [poison, burn] }), body('a2'), body('a3')],
        });
        mount(state);
        dispatchBurst({ type: 'END_TURN' } as BattleAction);
        await settle(0);
        expect(shownText('a1')).toBe('1|0|up');

        await settle(20_000);
        everyBodyShowsTheTruth();
        expectNoSnapNeeded();
    });
});


describe('189d — with the cast sequence off, the board and the screen still move, at once', () => {
    it('vfx off: the HP text moves as the hit arrives, with no safety-net correction', async () => {
        saveSettings({ ...DEFAULT_SETTINGS, battleSpeed: 'instant' });
        const fat = (id: string) => body(id, { primaryElement: 'Nature', maxHp: 1000, currentHp: 1000 });
        mount(frame({ hand: [card('c1', 'card_fireball')], enemy: [fat('e1'), fat('e2'), fat('e3')] }));
        const report = vi.fn();
        displayedBoard.onMismatch = report;

        dispatchBurst(play('a1', 'e1', 'c1'));
        const real = realOf('e1').currentHp;
        expect(real).toBeLessThan(1000);
        // Nothing is queued and nothing waits: the bar already shows it.
        expect(shownText('e1')).toBe(`${real}|0|up`);

        await settle(1_000);
        everyBodyShowsTheTruth();
        expect(report).not.toHaveBeenCalled();
        displayedBoard.onMismatch = () => undefined;
    });
});
