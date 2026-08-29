/**
 * THE FIRST-KO SNOWBALL — steam-release [ticket 70](../../../docs/wayfinder/steam-release/tickets/70-first-ko-snowball.md)'s
 * measurement step.
 *
 * The ticket is a **grilling**, and it says so explicitly: *"These four numbers frame every option
 * below; the grilling should not run without them."* This file is those four numbers and nothing
 * else. It rules nothing, changes no constant, and writes no file — the questions it feeds are
 * Henry's to answer.
 *
 * # THE FOUR NUMBERS, AND WHY EACH IS THE ONE ASKED FOR
 *
 * 1. **P(win | scored first KO).** Henry's felt answer is *"the first mingming defeated causes a
 *    massive advantage"*, and the round-5 playtest said *"the first KO usually means a win"*. Twice
 *    observed, never counted. The complement matters as much: P(win | conceded first KO) is the
 *    comeback rate, and it is the number Q3 is really about.
 * 2. **Turns from first KO to the end.** Whether the rest of the fight is play or a formality. A
 *    game that is decided at turn 4 and takes until turn 9 to admit it is a different design
 *    problem from one that ends at turn 5.
 * 3. **Overkill wasted.** Henry declined a second Stampede because it would have overkilled by 40
 *    and then lost the game. The question is how big that incentive is in damage. Read off the
 *    damage ledger, because the HP floor makes it invisible to any HP-based measure — see
 *    `SnowballRecord`.
 * 4. **P(win | higher starting HP).** Henry's second, explicitly unconfirmed issue: *"I'm not sold
 *    on this second part."* If the bigger team still wins often, that half of the ticket closes
 *    with no change, and the ticket says to rule it only after the numbers.
 *
 * # THE POPULATION, AND THE ONE THING IT IS NOT
 *
 * `REFERENCE_PANEL` round-robin — six comps, every ordered pair, both turn orders. That is the
 * repo's standing 3v3 reference set (ticket 109), which is what the ticket means by *"the existing
 * 3v3 cells"*, and it is deliberately **role-diverse rather than launch-scoped**: the snowball is a
 * mechanism question, not a balance one, so restricting it to the EA elements would measure the
 * same effect through a smaller and more lopsided sample.
 *
 * **It is not a run.** These are standalone battles, so nothing here carries HP between fights and
 * no result speaks to the gauntlet's attrition. The run gate (`runGate.ts`) is where that lives.
 *
 * # WHY MIRRORS ARE EXCLUDED
 *
 * A comp against itself is 50% by construction, and both "sides" have identical starting HP — so
 * every mirror would contribute a coin flip to line 1 and an undefined case to line 4. Including
 * them would drag both estimates toward 50% with samples that carry no information about either.
 */

import { quietly } from './balanceReporting';
import { teamScenario } from './balanceScenarios';
import { runPairedBatch, type BereavementDraw, type BereavementEnergy, type RunResult } from './runBatch';
import { REFERENCE_PANEL, type Comp } from './teamComps';

/** A battle length cap above the 30-turn stall redline, for `gauntlet-boss.balance.ts`'s reason. */
export const SNOWBALL_MAX_TURNS = 40;

export interface SnowballOptions {
    /** Paired seeds per ordered comp pair. Each yields 2 battles (both turn orders). */
    iterations?: number;
    maxTurns?: number;
    /** Defaults to the reference panel. Injectable so a test can pass two cheap comps. */
    comps?: readonly Comp[];
    /** Called after each pair, for progress on a run measured in minutes. */
    onPair?: (label: string, done: number, total: number) => void;
    /** EXPERIMENTAL arm, ticket 70 Q2b. Undefined is the baseline. */
    bereavementEnergy?: BereavementEnergy;
    /** EXPERIMENTAL arm, ticket 70 Q3b — the card half. Composes with the energy arm. */
    bereavementDraw?: BereavementDraw;
}

export interface SnowballReport {
    battles: number;
    /** Battles in which some member died — the denominator for lines 1 and 2. */
    decisiveKo: number;
    /** Battles where the first KO was simultaneous, so no side scored it. */
    simultaneousKo: number;
    /** Battles that never resolved. Reported, never silently dropped. */
    truncated: number;

    /** LINE 1. */
    winAfterScoringFirstKo: number;
    /** LINE 1's complement — the comeback rate. */
    winAfterConcedingFirstKo: number;
    /** Sample behind line 1: battles with an attributable first KO AND a decided winner. */
    line1Samples: number;

    /** LINE 2. */
    meanTurnsAfterFirstKo: number;
    medianTurnsAfterFirstKo: number;
    meanTurnsTotal: number;
    /** How much of the average fight happens after the first KO. */
    fractionOfFightAfterFirstKo: number;

    /** LINE 3. */
    meanOverkillPerBattle: number;
    medianOverkillPerBattle: number;
    /** Overkill as a share of one side's starting HP pool — the number that is comparable. */
    overkillAsShareOfStartingHp: number;

    /** LINE 4. */
    winWithHigherStartingHp: number;
    /** Sample behind line 4: battles where the two sides' starting HP differed at all. */
    line4Samples: number;
    /** Battles where both sides started on exactly equal HP — line 4 cannot speak to these. */
    equalHpBattles: number;

    /** Depth, not just onset: mean members lost by the loser and by the winner. */
    meanLossesLoser: number;
    meanLossesWinner: number;

    /**
     * Total Energized stacks the experimental arm granted across every battle.
     *
     * **Zero here means the arm did nothing and the run is void, not null.** The merge report's
     * costliest lesson is that *"a dead arm reads exactly like a null result"* — a mutation applied
     * to a discarded copy, an edit on an unreached path, a filter excluding the very thing it meant
     * to change. All four produced numbers indistinguishable from "this lever does nothing". Any
     * report of this experiment must state this figure next to its conclusion.
     */
    energizedGranted: number;
    /** Extra cards the draw arm drew. Same liveness rule: zero means VOID, not null. */
    cardsGranted: number;
}

const mean = (xs: readonly number[]): number =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

const median = (xs: readonly number[]): number => {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Reduce a set of battles to the four numbers.
 *
 * Exported separately from the runner so a test can hand it fabricated `RunResult`s and assert the
 * arithmetic without paying for a single battle — which is the only way the ratios here get
 * checked at all, since a real batch cannot be given a known answer.
 */
export function summarizeSnowball(runs: readonly RunResult[]): SnowballReport {
    const withSnowball = runs.filter(r => r.snowball !== undefined);

    const koRuns = withSnowball.filter(r => r.snowball!.firstKoTurn !== null);
    const simultaneous = koRuns.filter(r => r.snowball!.firstKoBy === null);

    // Line 1 needs BOTH an attributable first KO and a decided battle. A draw tells us nothing
    // about whether the first KO won it, and counting a draw as a loss for the killer would
    // manufacture a comeback rate that is not there — the same argument `decisiveWinRate` makes.
    const line1 = koRuns.filter(r => r.snowball!.firstKoBy !== null && r.winner !== 'DRAW');
    const scoredAndWon = line1.filter(r => r.winner === r.snowball!.firstKoBy).length;

    const afterKo = koRuns.map(r => r.snowball!.turnsAfterFirstKo!);
    const overkill = withSnowball.map(r => r.snowball!.overkillWasted);

    // Line 4 is only defined where the two sides actually started on different HP. Equal-HP
    // battles are counted and reported rather than folded in at 50%, which would bias the ratio
    // toward "no effect" with samples that carry no signal.
    const line4 = withSnowball.filter(r =>
        r.winner !== 'DRAW' && r.snowball!.startingHp.player !== r.snowball!.startingHp.enemy);
    const higherHpWon = line4.filter(r => {
        const { player, enemy } = r.snowball!.startingHp;
        return r.winner === (player > enemy ? 'PLAYER' : 'ENEMY');
    }).length;

    const decided = withSnowball.filter(r => r.winner !== 'DRAW');
    const lossesOf = (r: RunResult, side: 'PLAYER' | 'ENEMY') =>
        side === 'PLAYER' ? r.snowball!.losses.player : r.snowball!.losses.enemy;

    const startingPool = mean(withSnowball.map(r =>
        (r.snowball!.startingHp.player + r.snowball!.startingHp.enemy) / 2));

    return {
        battles: withSnowball.length,
        decisiveKo: koRuns.length,
        simultaneousKo: simultaneous.length,
        truncated: withSnowball.filter(r => r.truncated).length,

        winAfterScoringFirstKo: line1.length === 0 ? 0 : scoredAndWon / line1.length,
        winAfterConcedingFirstKo: line1.length === 0 ? 0 : 1 - scoredAndWon / line1.length,
        line1Samples: line1.length,

        meanTurnsAfterFirstKo: mean(afterKo),
        medianTurnsAfterFirstKo: median(afterKo),
        meanTurnsTotal: mean(withSnowball.map(r => r.turns)),
        fractionOfFightAfterFirstKo:
            mean(withSnowball.map(r => r.turns)) === 0 ? 0 : mean(afterKo) / mean(withSnowball.map(r => r.turns)),

        meanOverkillPerBattle: mean(overkill),
        medianOverkillPerBattle: median(overkill),
        overkillAsShareOfStartingHp: startingPool === 0 ? 0 : mean(overkill) / startingPool,

        winWithHigherStartingHp: line4.length === 0 ? 0 : higherHpWon / line4.length,
        line4Samples: line4.length,
        equalHpBattles: withSnowball.filter(r =>
            r.snowball!.startingHp.player === r.snowball!.startingHp.enemy).length,

        meanLossesLoser: mean(decided.map(r =>
            lossesOf(r, r.winner === 'PLAYER' ? 'ENEMY' : 'PLAYER'))),
        meanLossesWinner: mean(decided.map(r =>
            lossesOf(r, r.winner === 'PLAYER' ? 'PLAYER' : 'ENEMY'))),

        energizedGranted: withSnowball.reduce((a, r) => a + (r.snowball!.energizedGranted ?? 0), 0),
        cardsGranted: withSnowball.reduce((a, r) => a + (r.snowball!.cardsGranted ?? 0), 0),
    };
}

/** Every ordered pair of distinct comps. Mirrors excluded — see the header. */
export function pairsOf(comps: readonly Comp[]): Array<[Comp, Comp]> {
    const out: Array<[Comp, Comp]> = [];
    for (const a of comps) for (const b of comps) if (a.id !== b.id) out.push([a, b]);
    return out;
}

/** Run the panel round-robin and return both the summary and the raw runs, for a per-pair table. */
export function measureSnowball(options: SnowballOptions = {}): {
    report: SnowballReport;
    runs: RunResult[];
    perPair: Array<{ label: string; runs: RunResult[] }>;
} {
    const iterations = options.iterations ?? 3;
    const maxTurns = options.maxTurns ?? SNOWBALL_MAX_TURNS;
    const comps = options.comps ?? REFERENCE_PANEL;
    const pairs = pairsOf(comps);

    const runs: RunResult[] = [];
    const perPair: Array<{ label: string; runs: RunResult[] }> = [];

    pairs.forEach(([player, enemy], i) => {
        const setup = teamScenario({
            player: player.members,
            enemy: enemy.members,
            playerExtras: player.extras,
            enemyExtras: enemy.extras,
            // Seeded off the pair so a rerun reproduces it, and so the two turn orders of one pair
            // share a seed stream rather than being two unrelated samples.
            seed: `snowball:${player.id}-vs-${enemy.id}`,
        });
        /*
         * `quietly`, as every other balance harness does it. The reducer logs a `[checkDefeat]`
         * line per defeat check, which is a few hundred lines per battle — in a smoke run of four
         * battles it produced 2,114 lines and buried the report inside its own output. Progress
         * comes from `onPair` instead, which is the thing a caller actually wants to watch.
         */
        const paired = quietly(() => runPairedBatch(setup, {
            iterations, maxTurns,
            bereavementEnergy: options.bereavementEnergy,
            bereavementDraw: options.bereavementDraw,
        }));
        const label = `${player.id} vs ${enemy.id}`;
        perPair.push({ label, runs: paired.pooled.runs });
        runs.push(...paired.pooled.runs);
        options.onPair?.(label, i + 1, pairs.length);
    });

    return { report: summarizeSnowball(runs), runs, perPair };
}
