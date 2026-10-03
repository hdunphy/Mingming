/**
 * TICKET 189c — when, on a cast's timeline, the displayed board moves.
 *
 * The spy stands in for the board and logs each change with the game time it was asked for, so the
 * claim is read straight off the beat's own timeline.
 */
import { describe, expect, it } from 'vitest';

import type { BoardSink } from '../displayed/boardOps';
import { buildCastBeat, buildLooseBeat, emptyCast, emptyLoose } from './castBeat';

function spyBoard() {
    const calls: string[] = [];
    let now = 0;
    const board: BoardSink = {
        damage: (id, applied, absorbed) => { calls.push(`damage:${id}:${applied}/${absorbed}@${now}`); },
        heal: (id, amount) => { calls.push(`heal:${id}:${amount}@${now}`); },
        gainBark: (id, points) => { calls.push(`bark:${id}:${points}@${now}`); },
    };
    /** Run every board action of a beat at its own time, in time order. */
    const play = (beat: ReturnType<typeof buildCastBeat>): string[] => {
        for (const action of [...beat.actions].sort((a, b) => a.at - b.at)) {
            if (action.label !== 'board') continue;
            now = action.at;
            action.run();
        }
        return calls;
    };
    return { board, play };
}

const base = { element: 'Fire' as const, sourceId: 'a1', targetIds: ['e1', 'e2'], doubled: false, resisted: false };

describe('189c — a cast moves the board with the thing that moves it', () => {
    it('a hit lands with the impact on ITS body, 40 ms apart across targets', () => {
        const cast = emptyCast(base);
        cast.ops.push({ when: 'impact', op: { kind: 'damage', id: 'e1', applied: 10, absorbed: 0 } });
        cast.ops.push({ when: 'impact', op: { kind: 'damage', id: 'e2', applied: 12, absorbed: 3 } });
        const { board, play } = spyBoard();
        expect(play(buildCastBeat(cast, board))).toEqual(['damage:e1:10/0@400', 'damage:e2:12/3@440']);
    });

    it('a body the card did not name is hit with the last impact', () => {
        const cast = emptyCast(base);
        cast.ops.push({ when: 'impact', op: { kind: 'damage', id: 'a3', applied: 4, absorbed: 0 } });
        const { board, play } = spyBoard();
        expect(play(buildCastBeat(cast, board))).toEqual(['damage:a3:4/0@440']);
    });

    it('the price of the cast lands with the FIRST impact', () => {
        const cast = emptyCast(base);
        cast.ops.push({ when: 'first', op: { kind: 'damage', id: 'a1', applied: 5, absorbed: 0 } });
        const { board, play } = spyBoard();
        expect(play(buildCastBeat(cast, board))).toEqual(['damage:a1:5/0@400']);
    });

    it('a tick and a Bark Shield land after the last impact, with the statuses', () => {
        const cast = emptyCast(base);
        cast.ops.push({ when: 'after', op: { kind: 'damage', id: 'e1', applied: 3, absorbed: 0 } });
        cast.ops.push({ when: 'after', op: { kind: 'bark', id: 'a1', points: 20 } });
        const { board, play } = spyBoard();
        expect(play(buildCastBeat(cast, board))).toEqual(['damage:e1:3/0@440', 'bark:a1:20@440']);
    });

    it('a heal lands with the card on the body it heals', () => {
        const cast = emptyCast({ ...base, sourceId: 'a1', targetIds: ['a2'] });
        cast.ops.push({ when: 'impact', op: { kind: 'heal', id: 'a2', amount: 25 } });
        const { board, play } = spyBoard();
        expect(play(buildCastBeat(cast, board))).toEqual(['heal:a2:25@400']);
    });

    it('a loose burst moves the board as the burst plays, and is not empty because of it', () => {
        const burst = emptyLoose();
        burst.ops.push({ op: { kind: 'damage', id: 'a1', applied: 7, absorbed: 0 } });
        const { board, play } = spyBoard();
        expect(play(buildLooseBeat(burst, board))).toEqual(['damage:a1:7/0@0']);
    });
});


describe('189d — what the screen says as a hit lands', () => {
    const hitDraft = (targetId: string) => ({
        kind: 'hit' as const, targetId, applied: 10, absorbed: 0, element: 'Fire' as const, maxHp: 100,
        isLethal: false, definitionId: undefined, isCritical: false, effectiveness: 1,
    });

    it('hands the screen a moment at the impact, naming the caster, the target\'s place in the card and the card\'s size', () => {
        const cast = emptyCast(base);
        cast.ops.push({ when: 'impact', op: { kind: 'damage', id: 'e1', applied: 10, absorbed: 0 }, moment: hitDraft('e1') });
        cast.ops.push({ when: 'impact', op: { kind: 'damage', id: 'e2', applied: 10, absorbed: 0 }, moment: hitDraft('e2') });
        const said: Array<{ at: number; targetId?: string; step?: number; targets?: number; sourceId?: string }> = [];
        let now = 0;
        const beat = buildCastBeat(cast, spyBoard().board, (m) => {
            if (m.kind === 'hit') said.push({ at: now, targetId: m.targetId, step: m.step, targets: m.targets, sourceId: m.sourceId });
        });
        for (const action of [...beat.actions].sort((a, b) => a.at - b.at)) {
            if (action.label !== 'board') continue;
            now = action.at;
            action.run();
        }
        expect(said).toEqual([
            { at: 400, targetId: 'e1', step: 0, targets: 2, sourceId: 'a1' },
            { at: 440, targetId: 'e2', step: 1, targets: 2, sourceId: 'a1' },
        ]);
    });

    it('moves the board and says the moment in that order, on the same action', () => {
        const cast = emptyCast({ ...base, targetIds: ['e1'] });
        cast.ops.push({ when: 'impact', op: { kind: 'damage', id: 'e1', applied: 10, absorbed: 0 }, moment: hitDraft('e1') });
        const order: string[] = [];
        const board: BoardSink = { damage: () => order.push('board'), heal: () => undefined, gainBark: () => undefined };
        const beat = buildCastBeat(cast, board, () => order.push('moment'));
        for (const action of beat.actions) if (action.label === 'board') action.run();
        expect(order).toEqual(['board', 'moment']);
    });

    it('a loose burst has no caster and counts its hits as a series', () => {
        const burst = emptyLoose();
        burst.ops.push({ op: { kind: 'damage', id: 'e1', applied: 10, absorbed: 0 }, moment: hitDraft('e1') });
        burst.ops.push({ op: { kind: 'damage', id: 'e2', applied: 10, absorbed: 0 }, moment: hitDraft('e2') });
        const said: Array<{ step: number; sourceId: string | undefined }> = [];
        const beat = buildLooseBeat(burst, spyBoard().board, (m) => {
            if (m.kind === 'hit') said.push({ step: m.step, sourceId: m.sourceId });
        });
        for (const action of beat.actions) if (action.label === 'board') action.run();
        expect(said).toEqual([{ step: 0, sourceId: undefined }, { step: 1, sourceId: undefined }]);
    });
});
