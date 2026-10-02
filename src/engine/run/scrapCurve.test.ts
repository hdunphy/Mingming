/**
 * The per-biome scrap curve — ticket 174a.
 *
 * Logs here are hand-built with `appendRunEvent`, each row stamped with the scrap the player held
 * AFTER it, which is how the game stamps them. The numbers are small enough to check by eye.
 */

import { describe, expect, it } from 'vitest';

import { appendRunEvent, emptyRunLog, type IRunLog, type RunEventInput } from './runLog';
import { scrapCurve, sumByReason } from './scrapCurve';

/** Build a log from `[row, scrapAfterIt]` pairs. */
function logOf(rows: ReadonlyArray<readonly [RunEventInput, number]>): IRunLog {
    let log = emptyRunLog('seed', 1);
    rows.forEach(([input, scrap], i) => {
        log = appendRunEvent(log, input, { seq: i + 1, fightIndex: 0, deckSize: 8, scrap });
    });
    return log;
}

const enter = (biome: number, layer: number, nodeKind: 'wild' | 'marketplace' | 'workshop' | 'elite'): RunEventInput =>
    ({ kind: 'NODE_ENTERED', nodeKind, biome, layer });
const won = (): RunEventInput => ({ kind: 'FIGHT_ENDED', turns: 3, won: true, partyHp: {} });
const gain = (delta: number, reason: string): RunEventInput => ({ kind: 'SCRAP', delta, reason });

/** Two biomes: a squeeze in the first, a surplus in the second. */
const TWO_BIOMES: IRunLog = logOf([
    [{ kind: 'RUN_STARTED', gymId: 'g', tier: 0, party: ['m1'], modifiers: [] }, 20],
    [enter(0, 1, 'wild'), 20],
    [won(), 20],
    [gain(10, 'addRunScrap'), 30],
    [enter(0, 2, 'workshop'), 30],
    [gain(-25, 'recruitIntoParty'), 5],
    [enter(0, 1, 'wild'), 5],
    [won(), 5],
    [gain(10, 'addRunScrap'), 15],
    [enter(0, 4, 'elite'), 15],
    [won(), 15],
    [gain(45, 'addRunScrap'), 60],
    [enter(1, 0, 'wild'), 60],
    [won(), 60],
    [gain(20, 'addRunScrap'), 80],
    [gain(10, 'sellRunCard'), 90],
    [enter(1, 1, 'marketplace'), 90],
    [gain(-30, 'upgradeDeckCard'), 60],
]);

describe('scrapCurve', () => {
    it('gives one row per biome reached, in order', () => {
        expect(scrapCurve(TWO_BIOMES).map((row) => row.biome)).toEqual([0, 1]);
    });

    it('counts fights per biome', () => {
        expect(scrapCurve(TWO_BIOMES).map((row) => row.fights)).toEqual([3, 1]);
    });

    it('splits scrap into income and spend by reason, both as positive amounts', () => {
        const [first, second] = scrapCurve(TWO_BIOMES);
        expect(first.income).toEqual({ addRunScrap: 65 });
        expect(first.spent).toEqual({ recruitIntoParty: 25 });
        expect(second.income).toEqual({ addRunScrap: 20, sellRunCard: 10 });
        expect(second.spent).toEqual({ upgradeDeckCard: 30 });
        expect(sumByReason(second.income)).toBe(30);
    });

    it('reads the low point off every row stamped inside the biome', () => {
        const [first, second] = scrapCurve(TWO_BIOMES);
        expect(first.lowPoint).toBe(5);
        // Biome 1 opens on the NODE_ENTERED row stamped 60, and the upgrade ends it at 60: the
        // floor of the biome is 60, not the 5 the player was at back in biome 0.
        expect(second.lowPoint).toBe(60);
    });

    it('reads scrap at the end of a biome off the first row of the next, and of the last row for the final biome', () => {
        const [first, second] = scrapCurve(TWO_BIOMES);
        expect(first.scrapAtEnd).toBe(60);
        expect(second.scrapAtEnd).toBe(60);
    });

    it('counts a revisit once per re-entry of a node already entered', () => {
        const [first, second] = scrapCurve(TWO_BIOMES);
        // (0, 1, wild) is entered twice: one revisit.
        expect(first.revisits).toBe(1);
        expect(second.revisits).toBe(0);

        const loop = logOf([
            [enter(0, 1, 'wild'), 20], [won(), 20],
            [enter(0, 1, 'wild'), 20], [won(), 20],
            [enter(0, 1, 'wild'), 20], [won(), 20],
        ]);
        expect(scrapCurve(loop)[0].revisits).toBe(2);
    });

    it('does not mistake the same layer in another biome, or another kind on the layer, for a revisit', () => {
        const log = logOf([
            [enter(0, 1, 'wild'), 20], [won(), 20],
            [enter(0, 1, 'marketplace'), 20],
            [enter(1, 1, 'wild'), 20], [won(), 20],
        ]);
        expect(scrapCurve(log).map((row) => row.revisits)).toEqual([0, 0]);
    });

    it('puts rows before the first node into biome 0', () => {
        const log = logOf([
            [{ kind: 'RUN_STARTED', gymId: 'g', tier: 0, party: ['m1'], modifiers: [] }, 45],
            [enter(0, 1, 'wild'), 45], [won(), 45], [gain(10, 'addRunScrap'), 55],
        ]);
        const rows = scrapCurve(log);
        expect(rows).toHaveLength(1);
        expect(rows[0].lowPoint).toBe(45);
    });

    it('gives no rows for a log with no fights', () => {
        const log = logOf([
            [{ kind: 'RUN_STARTED', gymId: 'g', tier: 0, party: ['m1'], modifiers: [] }, 20],
            [enter(0, 1, 'marketplace'), 20],
        ]);
        expect(scrapCurve(log)).toEqual([]);
        expect(scrapCurve(emptyRunLog('empty', 1))).toEqual([]);
    });
});
