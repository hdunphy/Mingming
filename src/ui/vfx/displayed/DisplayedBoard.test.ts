/**
 * TICKET 189c — the displayed board: what the player sees, moved only by the presenter.
 *
 * Driven by hand on a battle clock (`advance`), so the ghost's hold lands on an exact millisecond.
 */
import { describe, expect, it, vi } from 'vitest';

import type { IBattleState } from '../../../engine/types';
import { BattleClock } from '../clock/BattleClock';
import { HitStop } from '../clock/HitStop';
import { INSTANT } from '../clock/speedPolicy';
import { DisplayedBoard, GHOST_HOLD_MS } from './DisplayedBoard';

const body = (id: string, hp: number, maxHp = 100, bark = 0) => ({
    id, name: id, maxHp, currentHp: hp, primaryElement: 'Fire', secondaryElement: 'None',
    statusEffects: bark > 0 ? [{ type: 'BarkShield', stacks: bark }] : [], daemons: [],
});
const stateOf = (...bodies: ReturnType<typeof body>[]): IBattleState => ({
    playerParty: bodies.filter((b) => b.id.startsWith('a')),
    enemyParty: bodies.filter((b) => !b.id.startsWith('a')),
}) as unknown as IBattleState;

function make(speed = 1) {
    const clock = new BattleClock({ speed: () => speed, hitStop: new HitStop() });
    const board = new DisplayedBoard(clock);
    return { clock, board };
}

describe('189c — the board starts equal to the real state', () => {
    it('copies HP and Bark points from the real bodies', () => {
        const { board } = make();
        board.reset(stateOf(body('a1', 80), body('e1', 60, 100, 20)));
        expect(board.unit('a1')).toEqual({ hp: 80, ghost: 80, bark: 0 });
        expect(board.unit('e1')).toEqual({ hp: 60, ghost: 60, bark: 20 });
    });

    it('tells a fight in progress from a new battle: nobody in common is a new battle', () => {
        const { board } = make();
        board.reset(stateOf(body('a1', 80), body('e1', 60)));
        expect(board.sharesBody(stateOf(body('a1', 10), body('e1', 5)))).toBe(true);
        // One body joining a fight in progress is still that fight.
        expect(board.sharesBody(stateOf(body('a1', 80), body('e2', 60)))).toBe(true);
        expect(board.sharesBody(stateOf(body('a9', 80), body('e9', 60)))).toBe(false);
    });
});

describe('189c — a hit moves the board, and leaves a ghost', () => {
    it('takes the applied damage off HP and the absorbed off the Bark band', () => {
        const { board } = make();
        board.reset(stateOf(body('e1', 100, 100, 20)));
        board.damage('e1', 30, 20);
        expect(board.unit('e1')).toMatchObject({ hp: 70, bark: 0 });
    });

    it('leaves the pale chunk where the HP was, holds it, then lets it go', () => {
        const { board, clock } = make();
        board.reset(stateOf(body('e1', 100)));
        board.damage('e1', 30, 0);
        expect(board.unit('e1')).toEqual({ hp: 70, ghost: 100, bark: 0 });

        clock.advance(GHOST_HOLD_MS - 1);
        expect(board.unit('e1')?.ghost).toBe(100);
        clock.advance(1);
        expect(board.unit('e1')?.ghost).toBe(70);
    });

    it('keeps the highest mark through a run of hits and drains once, after the last', () => {
        const { board, clock } = make();
        board.reset(stateOf(body('e1', 100)));
        board.damage('e1', 20, 0);
        clock.advance(200);
        board.damage('e1', 20, 0);
        expect(board.unit('e1')).toMatchObject({ hp: 60, ghost: 100 });

        // The first hit's hold would end here; the second hit moved it.
        clock.advance(GHOST_HOLD_MS - 200);
        expect(board.unit('e1')?.ghost).toBe(100);
        clock.advance(200);
        expect(board.unit('e1')?.ghost).toBe(60);
    });

    it('a hit-stop holds the ghost, because its hold is game time', () => {
        const { board, clock } = make();
        board.reset(stateOf(body('e1', 100)));
        board.damage('e1', 30, 0);
        clock.freeze(100);
        // 450 real ms: 100 of them frozen, so only 350 of game time (the hold is 380).
        clock.advance(450);
        expect(board.unit('e1')?.ghost).toBe(100);
        clock.advance(30);
        expect(board.unit('e1')?.ghost).toBe(70);
    });

    it('never goes below zero', () => {
        const { board } = make();
        board.reset(stateOf(body('e1', 10)));
        board.damage('e1', 50, 0);
        expect(board.unit('e1')?.hp).toBe(0);
    });

    it('a fully absorbed hit moves the Bark band and leaves no ghost', () => {
        const { board } = make();
        board.reset(stateOf(body('e1', 100, 100, 30)));
        board.damage('e1', 0, 10);
        expect(board.unit('e1')).toEqual({ hp: 100, ghost: 100, bark: 20 });
    });

    it('Instant has no hold: the ghost is gone at once', () => {
        const { board } = make(INSTANT);
        board.reset(stateOf(body('e1', 100)));
        board.damage('e1', 30, 0);
        expect(board.unit('e1')).toEqual({ hp: 70, ghost: 70, bark: 0 });
    });
});

describe('189c — heals and Bark', () => {
    it('a heal raises HP, capped at max, with no ghost below the fill', () => {
        const { board } = make();
        board.reset(stateOf(body('a1', 60)));
        board.heal('a1', 30);
        expect(board.unit('a1')).toMatchObject({ hp: 90, ghost: 90 });
        board.heal('a1', 30);
        expect(board.unit('a1')?.hp).toBe(100);
    });

    it('a Bark Shield applied grows the band', () => {
        const { board } = make();
        board.reset(stateOf(body('a1', 100)));
        board.gainBark('a1', 25);
        expect(board.unit('a1')?.bark).toBe(25);
    });

    it('ignores a body it does not know', () => {
        const { board } = make();
        board.reset(stateOf(body('a1', 100)));
        expect(() => { board.damage('ghost', 10, 0); board.heal('ghost', 10); board.gainBark('ghost', 5); }).not.toThrow();
        expect(board.unit('ghost')).toBeUndefined();
    });
});

describe('189c — the safety net', () => {
    it('is silent when the board already equals the real state', () => {
        const { board } = make();
        const state = stateOf(body('a1', 100), body('e1', 70));
        board.reset(stateOf(body('a1', 100), body('e1', 100)));
        board.damage('e1', 30, 0);
        const report = vi.fn();
        board.onMismatch = report;
        expect(board.reconcile(state)).toEqual([]);
        expect(report).not.toHaveBeenCalled();
    });

    it('snaps a wrong number to real state and reports it', () => {
        const { board } = make();
        board.reset(stateOf(body('e1', 100)));
        const report = vi.fn();
        board.onMismatch = report;
        // The engine took 40 and no beat said so.
        const mismatches = board.reconcile(stateOf(body('e1', 60)));
        expect(mismatches).toEqual([{ id: 'e1', shownHp: 100, realHp: 60 }]);
        expect(report).toHaveBeenCalledWith(mismatches);
        expect(board.unit('e1')).toEqual({ hp: 60, ghost: 60, bark: 0 });
    });

    it('snaps Bark without a report: it decays at the turn boundary with no event', () => {
        const { board } = make();
        board.reset(stateOf(body('e1', 100, 100, 40)));
        const report = vi.fn();
        board.onMismatch = report;
        expect(board.reconcile(stateOf(body('e1', 100, 100, 32)))).toEqual([]);
        expect(report).not.toHaveBeenCalled();
        expect(board.unit('e1')?.bark).toBe(32);
    });

    it('lets a ghost that is still draining be: only HP and Bark must match', () => {
        const { board } = make();
        board.reset(stateOf(body('e1', 100)));
        board.damage('e1', 30, 0);
        expect(board.reconcile(stateOf(body('e1', 70)))).toEqual([]);
        expect(board.unit('e1')?.ghost).toBe(100);
    });

    it('picks up a body that joined the fight', () => {
        const { board } = make();
        board.reset(stateOf(body('e1', 100)));
        board.reconcile(stateOf(body('e1', 100), body('e2', 50)));
        expect(board.unit('e2')).toEqual({ hp: 50, ghost: 50, bark: 0 });
    });
});

describe('189c — subscribing', () => {
    it('bumps the version and calls listeners on a change, not on a no-op', () => {
        const { board } = make();
        board.reset(stateOf(body('e1', 100)));
        const listener = vi.fn();
        const stop = board.subscribe(listener);
        const v = board.getVersion();
        board.damage('e1', 10, 0);
        expect(board.getVersion()).toBeGreaterThan(v);
        expect(listener).toHaveBeenCalled();

        listener.mockClear();
        board.heal('e1', 0);
        board.damage('e1', 0, 0);
        expect(listener).not.toHaveBeenCalled();
        stop();
    });

    it('reset drops a pending ghost drain', () => {
        const { board, clock } = make();
        board.reset(stateOf(body('e1', 100)));
        board.damage('e1', 30, 0);
        board.reset(stateOf(body('e1', 100)));
        clock.advance(1000);
        expect(board.unit('e1')).toEqual({ hp: 100, ghost: 100, bark: 0 });
    });
});
