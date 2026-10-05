// @vitest-environment jsdom
/**
 * TICKET 190f - WHEN a status lands. A status a card adds after its damage (a "rider") lands while the
 * attacker walks back, as its own beat inside the cast; it overlaps the return and does not lengthen
 * the sequence by its own length. A status-only card lands it when its orb arrives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StageAnchors } from '../../hooks/useStageAnchors';
import { setParticleSink, setStageAnchors } from '../emit';
import type { ParticleSeed } from '../particles';
import { castTimes } from '../choreo/castTimes';
import { buildCastBeat, emptyCast } from '../presenter/castBeat';
import { activeProfile, resetActiveTier } from '../tiers/activeTier';
import * as statusTellsModule from '../statusTells';
import { BARK_SETTLE_MS } from './barkLanding';
import { onSpriteReaction, type SpriteReactionSignal } from './reactionSignals';

const rect = (x: number) => ({ x, y: 100, w: 190, h: 190 });
const ANCHORS = {
    slots: { a1: rect(100), e1: rect(900), e2: rect(920) },
    plaques: { a1: rect(20), e1: rect(1100), e2: rect(1110) },
    reveal: rect(500), hand: rect(500), discard: rect(800), scale: 1,
} as unknown as StageAnchors;

let spawned: ParticleSeed[][];

beforeEach(() => {
    spawned = [];
    setStageAnchors(ANCHORS);
    setParticleSink({ spawn: (seeds) => { spawned.push([...seeds]); }, wake: () => undefined });
    resetActiveTier();
});
afterEach(() => {
    setParticleSink(null);
    setStageAnchors(null);
    vi.restoreAllMocks();
});

const attackWithRider = (statuses: Array<{ targetId: string; status: 'Poison' | 'Burn' | 'Sharp'; stacks?: number }>) => {
    const cast = emptyCast({ element: 'Nature', sourceId: 'a1', targetIds: ['e1'], doubled: false, resisted: false });
    cast.hits.push({ targetId: 'e1', applied: 30, maxHp: 100, isKill: false });
    cast.statuses.push(...statuses);
    return cast;
};
const timesOf = (cast: ReturnType<typeof attackWithRider>) => {
    const biggest = cast.hits[0];
    return castTimes(activeProfile(), { kind: 'attack', fromPlayer: true, damage: biggest.applied, maxHp: biggest.maxHp, isKill: false });
};
const tells = (cast: ReturnType<typeof attackWithRider>) =>
    buildCastBeat(cast).actions.filter((action) => action.label === 'status-tell');
const impactAt = (cast: ReturnType<typeof attackWithRider>) =>
    buildCastBeat(cast).actions.filter((action) => action.label === 'impact').map((action) => action.at);

describe('190f - a rider lands while the attacker walks back', () => {
    it('plays at the start of the walk back, after the impact', () => {
        const cast = attackWithRider([{ targetId: 'e1', status: 'Poison' }]);
        const [tell] = tells(cast);
        expect(tell.at).toBe(timesOf(cast).returnAtMs);
        expect(tell.at).toBeGreaterThan(impactAt(cast)[0]);
    });

    it('a second status follows 60 ms later, one landing per status', () => {
        const cast = attackWithRider([
            { targetId: 'e1', status: 'Poison' }, { targetId: 'e1', status: 'Burn' },
        ]);
        const at = tells(cast).map((tell) => tell.at);
        const start = timesOf(cast).returnAtMs;
        expect(at).toEqual([start, start + 60]);
    });

    it('does not add its own length to the sequence', () => {
        const without = buildCastBeat(attackWithRider([])).durationMs;
        const withRider = buildCastBeat(attackWithRider([{ targetId: 'e1', status: 'Poison' }])).durationMs;
        expect(withRider).toBe(without);
        expect(withRider).toBeLessThan(timesOf(attackWithRider([])).returnAtMs + 520);
    });

    it('the card still leaves with the walk back, rider or not', () => {
        const card = { key: 1, dataId: 'x', sourceId: 'a1', targetId: 'e1', fromPlayer: true, sourceName: 'A', targetName: 'E' };
        const withCard = (statuses: Array<{ targetId: string; status: 'Poison' }>) => {
            const cast = emptyCast({ element: 'Nature', sourceId: 'a1', targetIds: ['e1'], doubled: false, resisted: false, card });
            cast.hits.push({ targetId: 'e1', applied: 30, maxHp: 100, isKill: false });
            cast.statuses.push(...statuses);
            return buildCastBeat(cast);
        };
        const leaves = (beat: ReturnType<typeof withCard>) => beat.actions.find((action) => action.label === 'card-out')!.at;
        expect(leaves(withCard([{ targetId: 'e1', status: 'Poison' }]))).toBe(leaves(withCard([])));
        expect(withCard([{ targetId: 'e1', status: 'Poison' }]).durationMs).toBe(withCard([]).durationMs);
    });
});

describe('190f - a landing plays once per status, on every body at the same instant', () => {
    it('calls the landing with the stacks that body got', () => {
        const spy = vi.spyOn(statusTellsModule, 'emitStatusApplied').mockImplementation(() => undefined);
        const cast = emptyCast({ element: 'Nature', sourceId: 'a1', targetIds: ['e1', 'e2'], doubled: false, resisted: false });
        cast.hits.push({ targetId: 'e1', applied: 10, maxHp: 100, isKill: false }, { targetId: 'e2', applied: 10, maxHp: 100, isKill: false });
        cast.statuses.push(
            { targetId: 'e1', status: 'Poison', stacks: 2 },
            { targetId: 'e2', status: 'Poison', stacks: 3 },
            { targetId: 'e1', status: 'Poison', stacks: 1 },
        );
        const actions = buildCastBeat(cast).actions.filter((action) => action.label === 'status-tell');
        expect(actions).toHaveLength(1);
        actions[0].run();
        expect(spy).toHaveBeenCalledTimes(2);
        expect(spy).toHaveBeenCalledWith('Poison', 'e1', false, 3);
        expect(spy).toHaveBeenCalledWith('Poison', 'e2', false, 3);
    });
});

describe('190f - a status-only card lands it when the orb arrives', () => {
    it('at the impact of the orb', () => {
        const cast = emptyCast({ element: 'None', sourceId: 'a1', targetIds: ['e1'], doubled: false, resisted: false, attack: false });
        cast.statuses.push({ targetId: 'e1', status: 'Poison' });
        const beat = buildCastBeat(cast);
        const orb = beat.actions.find((action) => action.label === 'orb');
        const tell = beat.actions.find((action) => action.label === 'status-tell');
        expect(orb).toBeDefined();
        expect(tell!.at).toBeGreaterThanOrEqual(orb!.at);
        const times = castTimes(activeProfile(), { kind: 'status', fromPlayer: true, damage: 0, maxHp: 0, isKill: false });
        expect(tell!.at).toBe(times.impactAtMs);
    });
});

describe('190f - the Bark band grows when the planks settle', () => {
    it('the board op marked "landing" lands a settle-time after the Bark Shield tell', () => {
        const cast = emptyCast({ element: 'None', sourceId: 'a1', targetIds: ['a1'], doubled: false, resisted: false, attack: false });
        cast.statuses.push({ targetId: 'a1', status: 'BarkShield' });
        cast.ops.push({ when: 'landing', op: { kind: 'bark', id: 'a1', points: 20 } });
        const ran: number[] = [];
        const board = {
            damage: () => undefined, heal: () => undefined,
            gainBark: () => { ran.push(0); },
        };
        const beat = buildCastBeat(cast, board);
        const tell = beat.actions.find((action) => action.label === 'status-tell')!;
        const op = beat.actions.find((action) => action.label === 'board')!;
        expect(op.at).toBe(tell.at + Math.min(BARK_SETTLE_MS, activeProfile().statusOnly.landingMs));
        op.run();
        expect(ran).toHaveLength(1);
    });
});

describe('190f - the sprite reaction reaches the body that got the status', () => {
    it('Poison sends a "dull" to the body, with the landing', () => {
        const seen: SpriteReactionSignal[] = [];
        const off = onSpriteReaction((signal) => seen.push(signal));
        statusTellsModule.emitStatusApplied('Poison', 'e1', false, 1);
        off();
        expect(seen).toEqual([{ targetId: 'e1', reaction: 'dull' }]);
        expect(spawned.length).toBeGreaterThan(0);
    });

    it('a status with no reaction sends none', () => {
        const seen: SpriteReactionSignal[] = [];
        const off = onSpriteReaction((signal) => seen.push(signal));
        statusTellsModule.emitStatusApplied('Burn', 'e1', false, 2);
        off();
        expect(seen).toEqual([]);
    });

    it('a status outside the table keeps today\'s ring and puff', () => {
        statusTellsModule.emitStatusApplied('Stunned', 'e1');
        const shapes = new Set(spawned.flat().map((seed) => seed.shape));
        expect(shapes.has('ring')).toBe(true);
        expect(shapes.has('puff')).toBe(true);
    });
});
