/**
 * TICKET 70's ARITHMETIC, PINNED — because a real batch cannot be given a known answer.
 *
 * `measureSnowball` runs hundreds of 3v3 battles and produces four ratios. Nothing about that
 * output can be checked by inspection: if `winAfterScoringFirstKo` came back at 78% there is no way
 * to tell a correct 78% from an off-by-one denominator. So the reduction is separated from the
 * running (`summarizeSnowball` takes runs, not comps) and gets fabricated inputs with answers
 * worked out by hand.
 *
 * The cases here are the ones where a plausible implementation is wrong rather than absent — the
 * DRAW that must not count as a comeback, the simultaneous KO that belongs to neither side, the
 * equal-HP battle that line 4 cannot speak to. Each is a way to report a confident number that
 * quietly means something else, which is exactly the failure mode the merge report's *"a dead arm
 * reads exactly like a null result"* is about.
 */

import { describe, expect, it } from 'vitest';

import { pairsOf, summarizeSnowball } from './snowball';
import type { RunResult } from './runBatch';
import type { Comp } from './teamComps';

type Snow = NonNullable<RunResult['snowball']>;

// `Omit` first: intersecting `Partial<RunResult>` with a looser `snowball` would AND the two
// together into `Snow & Partial<Snow>`, which still demands every field — the opposite of a
// fixture helper.
function run(partial: Omit<Partial<RunResult>, 'snowball'> & { snowball?: Partial<Snow> }): RunResult {
    const snowball: Snow = {
        firstKoBy: 'PLAYER',
        firstKoTurn: 3,
        turnsAfterFirstKo: 2,
        overkillWasted: 0,
        startingHp: { player: 200, enemy: 200 },
        losses: { player: 0, enemy: 3 },
        energizedGranted: 0,
        ...partial.snowball,
    };
    return {
        seed: 's',
        startingSide: 'PLAYER',
        winner: 'PLAYER',
        turns: 5,
        ftk: false,
        truncated: false,
        deadCards: { player: 0, enemy: 0 },
        cardsSeen: { player: 9, enemy: 9 },
        ...partial,
        snowball,
    };
}

describe('line 1 — P(win | scored first KO)', () => {
    it('counts the killer winning, both ways round', () => {
        const r = summarizeSnowball([
            run({ winner: 'PLAYER', snowball: { firstKoBy: 'PLAYER' } }),
            run({ winner: 'ENEMY', snowball: { firstKoBy: 'ENEMY' } }),
            run({ winner: 'ENEMY', snowball: { firstKoBy: 'PLAYER' } }),
            run({ winner: 'PLAYER', snowball: { firstKoBy: 'PLAYER' } }),
        ]);
        expect(r.line1Samples).toBe(4);
        expect(r.winAfterScoringFirstKo).toBeCloseTo(0.75);
        // The complement IS the comeback rate — the number Q3 is about — so it is asserted rather
        // than left implied.
        expect(r.winAfterConcedingFirstKo).toBeCloseTo(0.25);
    });

    it('EXCLUDES draws rather than scoring them against the killer', () => {
        // A draw says nothing about whether the first KO decided the fight. Counting it as a loss
        // for the killer would manufacture a comeback rate out of stalls — `decisiveWinRate` in
        // `runBatch` makes exactly this argument for exactly this reason.
        const r = summarizeSnowball([
            run({ winner: 'PLAYER', snowball: { firstKoBy: 'PLAYER' } }),
            run({ winner: 'DRAW', snowball: { firstKoBy: 'PLAYER' } }),
        ]);
        expect(r.line1Samples).toBe(1);
        expect(r.winAfterScoringFirstKo).toBe(1);
    });

    it('EXCLUDES a simultaneous first KO, and says how many there were', () => {
        const r = summarizeSnowball([
            run({ winner: 'PLAYER', snowball: { firstKoBy: 'PLAYER' } }),
            run({ winner: 'PLAYER', snowball: { firstKoBy: null, firstKoTurn: 2 } }),
        ]);
        expect(r.simultaneousKo).toBe(1);
        expect(r.line1Samples).toBe(1);
        // Still a battle, and still counted in lines 2 and 3.
        expect(r.battles).toBe(2);
        expect(r.decisiveKo).toBe(2);
    });

    it('a battle where nobody died is not in the KO denominator at all', () => {
        const r = summarizeSnowball([
            run({ winner: 'DRAW', truncated: true, snowball: { firstKoBy: null, firstKoTurn: null, turnsAfterFirstKo: null, losses: { player: 0, enemy: 0 } } }),
        ]);
        expect(r.decisiveKo).toBe(0);
        expect(r.line1Samples).toBe(0);
        expect(r.winAfterScoringFirstKo).toBe(0);
        expect(r.truncated).toBe(1);
    });
});

describe('line 2 — how much fight is left after the first KO', () => {
    it('means and medians only the battles that HAD a KO', () => {
        const r = summarizeSnowball([
            run({ turns: 10, snowball: { firstKoTurn: 4, turnsAfterFirstKo: 6 } }),
            run({ turns: 10, snowball: { firstKoTurn: 8, turnsAfterFirstKo: 2 } }),
            // No KO: contributes to mean battle length, not to the after-KO average.
            run({ turns: 10, winner: 'DRAW', snowball: { firstKoBy: null, firstKoTurn: null, turnsAfterFirstKo: null } }),
        ]);
        expect(r.meanTurnsAfterFirstKo).toBeCloseTo(4);
        expect(r.medianTurnsAfterFirstKo).toBeCloseTo(4);
        expect(r.meanTurnsTotal).toBeCloseTo(10);
        expect(r.fractionOfFightAfterFirstKo).toBeCloseTo(0.4);
    });
});

describe('line 3 — overkill', () => {
    it('averages over every battle, and normalises by one side\'s starting pool', () => {
        const r = summarizeSnowball([
            run({ snowball: { overkillWasted: 30, startingHp: { player: 200, enemy: 200 } } }),
            run({ snowball: { overkillWasted: 10, startingHp: { player: 200, enemy: 200 } } }),
        ]);
        expect(r.meanOverkillPerBattle).toBeCloseTo(20);
        expect(r.medianOverkillPerBattle).toBeCloseTo(20);
        // 20 wasted against a 200 HP side.
        expect(r.overkillAsShareOfStartingHp).toBeCloseTo(0.1);
    });
});

describe('line 4 — does the bigger team still win', () => {
    it('counts only battles whose sides started on DIFFERENT HP', () => {
        const r = summarizeSnowball([
            run({ winner: 'PLAYER', snowball: { startingHp: { player: 250, enemy: 200 } } }), // bigger won
            run({ winner: 'PLAYER', snowball: { startingHp: { player: 180, enemy: 200 } } }), // bigger lost
            run({ winner: 'ENEMY', snowball: { startingHp: { player: 200, enemy: 200 } } }),  // equal — excluded
        ]);
        expect(r.line4Samples).toBe(2);
        expect(r.equalHpBattles).toBe(1);
        expect(r.winWithHigherStartingHp).toBeCloseTo(0.5);
    });

    it('does not fold equal-HP battles in at 50%, which would bias it toward "no effect"', () => {
        const r = summarizeSnowball([
            run({ winner: 'PLAYER', snowball: { startingHp: { player: 250, enemy: 200 } } }),
            ...Array.from({ length: 20 }, () =>
                run({ winner: 'ENEMY', snowball: { startingHp: { player: 200, enemy: 200 } } })),
        ]);
        expect(r.line4Samples).toBe(1);
        expect(r.winWithHigherStartingHp).toBe(1);
    });
});

describe('depth', () => {
    it('reports the loser\'s and the winner\'s losses from the winner\'s point of view', () => {
        const r = summarizeSnowball([
            run({ winner: 'PLAYER', snowball: { losses: { player: 1, enemy: 3 } } }),
            run({ winner: 'ENEMY', snowball: { losses: { player: 3, enemy: 2 } } }),
        ]);
        expect(r.meanLossesLoser).toBeCloseTo(3);
        expect(r.meanLossesWinner).toBeCloseTo(1.5);
    });
});

describe('the population', () => {
    it('is every ORDERED pair with mirrors excluded', () => {
        const comps = ['a', 'b', 'c'].map(id => ({ id, members: [], intent: '' } as unknown as Comp));
        const pairs = pairsOf(comps);
        expect(pairs).toHaveLength(6);
        expect(pairs.some(([x, y]) => x.id === y.id)).toBe(false);
        // Ordered, not unordered: a-vs-b and b-vs-a are different measurements because the report
        // is always about the PLAYER side.
        expect(pairs.filter(([x, y]) => x.id === 'a' && y.id === 'b')).toHaveLength(1);
        expect(pairs.filter(([x, y]) => x.id === 'b' && y.id === 'a')).toHaveLength(1);
    });
});
