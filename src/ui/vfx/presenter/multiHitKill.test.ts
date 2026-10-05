/**
 * TICKET 194k-7 — Henry: *"VFX sometimes lag like on a multihit with a kill."*
 *
 * A card that hits one body three times (Flare Burst+, Acorn Toss) has three board ops due at the
 * SAME instant, and each hit asks for a freeze as it lands. `HitStop.request` is written so that
 * overlapping requests EXTEND (*"two hits in the same frame should feel like one heavier impact,
 * not three stops in a row"*), but `BattleClock.moveTo` ended the frame at the first freeze, so the
 * second and third hit only ran after it: three stops in a row, the last one the kill's 170 ms.
 * Same-instant hits now run together and the freeze is the longest of them.
 */
import { describe, expect, it } from 'vitest';

import { BattleClock } from '../clock/BattleClock';
import { HitStop } from '../clock/HitStop';
import type { BoardSink } from '../displayed/boardOps';
import { damageSeverity, hitStopLengthMs } from '../impact/impactMath';
import type { StageMoment } from '../impact/stageMoments';
import { buildCastBeat, emptyCast } from './castBeat';
import { PresenterQueue } from './PresenterQueue';

const FRAME_MS = 16;
const MAX_HP = 1000;

interface Landing { readonly applied: number; readonly gameAt: number; readonly realAt: number }

/** Play a three-hit cast on one body through the real clock, queue and beat, with the freeze useImpactFeedback asks for. */
function playThreeHits(appliedHits: number[], lethalLast: boolean): { landings: Landing[]; frozenRealMs: number; endRealMs: number } {
    const hitStop = new HitStop();
    const clock = new BattleClock({ speed: () => 1, hitStop });
    const queue = new PresenterQueue(clock);
    let realNow = 0;
    const landings: Landing[] = [];

    const board: BoardSink = { damage: () => undefined, heal: () => undefined, gainBark: () => undefined };
    const say = (moment: StageMoment): void => {
        if (moment.kind !== 'hit') return;
        landings.push({ applied: moment.applied, gameAt: clock.now, realAt: realNow });
        // What `useImpactFeedback` does with each hit moment.
        clock.freeze(hitStopLengthMs({
            severity: damageSeverity(moment.applied, moment.maxHp), isKill: moment.isLethal,
            superEffective: false, resisted: false, targets: moment.targets,
        }));
    };

    const cast = emptyCast({ element: 'Fire', sourceId: 'a1', targetIds: ['e1'], doubled: false, resisted: false });
    appliedHits.forEach((applied, i) => {
        const isLast = i === appliedHits.length - 1;
        const lethal = lethalLast && isLast;
        cast.ops.push({
            when: 'impact', op: { kind: 'damage', id: 'e1', applied, absorbed: 0 },
            moment: {
                kind: 'hit', targetId: 'e1', applied, absorbed: 0, element: 'Fire', maxHp: MAX_HP, isLethal: lethal,
                definitionId: undefined, isCritical: false, effectiveness: 1,
            },
        });
        cast.hits.push({ targetId: 'e1', applied, maxHp: MAX_HP, isKill: lethal });
    });
    if (lethalLast) cast.deaths.push('e1');

    queue.enqueue(buildCastBeat(cast, board, say));

    let frozenRealMs = 0;
    for (let guard = 0; !queue.isIdle() && guard < 5000; guard += 1) {
        const frame = clock.advance(FRAME_MS);
        realNow += FRAME_MS;
        if (frame.frozen) frozenRealMs += FRAME_MS;
    }
    return { landings, frozenRealMs, endRealMs: realNow };
}

describe('194k-7 — a multi-hit card that kills', () => {
    const run = playThreeHits([15, 15, 15], true);

    it('lands all three hits and the kill', () => {
        expect(run.landings.map((l) => l.applied)).toEqual([15, 15, 15]);
    });

    it('lands them at the same game instant, not one freeze apart', () => {
        const instants = new Set(run.landings.map((l) => l.gameAt));
        expect(instants.size).toBe(1);
    });

    it('lands them within a frame or two of each other in real time', () => {
        const spread = run.landings[2].realAt - run.landings[0].realAt;
        expect(spread).toBeLessThanOrEqual(FRAME_MS * 2);
    });

    it('freezes once, for the longest of the three (the kill\'s 170 ms), not three stops in a row', () => {
        // The kill is 170; a frame of slack for the freeze that ends mid-frame.
        expect(run.frozenRealMs).toBeLessThanOrEqual(170 + FRAME_MS);
        expect(run.frozenRealMs).toBeGreaterThanOrEqual(170 - FRAME_MS);
    });
});

describe('194k-7 — a multi-hit card that does not kill', () => {
    it('is one merged freeze as well: the longest hit\'s, not the sum', () => {
        const run = playThreeHits([15, 15, 15], false);
        expect(new Set(run.landings.map((l) => l.gameAt)).size).toBe(1);
        const one = hitStopLengthMs({ severity: damageSeverity(15, MAX_HP), isKill: false, superEffective: false, resisted: false, targets: 1 });
        expect(run.frozenRealMs).toBeLessThanOrEqual(one + FRAME_MS);
    });
});
