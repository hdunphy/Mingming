/**
 * Headless batch simulator - the real one.
 *
 * Specified by `docs/wayfinder/debug-toolkit/tickets/08-batch-sim-auditor-design.md`
 * sections 1-3, built as `20-batch-sim-runner.md`. Replaces `engine/SimRunner.ts`'s
 * zero-argument, hardcoded kraken-vs-fenrir smoke run.
 *
 * WHY THIS LIVES UNDER `src/debug/`
 * ---------------------------------
 * The gate invariant is that nothing outside `src/debug/` may import into it. A batch
 * runner *must* consume composed scenarios (`ComposedSetup`) and materialize them with
 * `buildScenarioState`, and both of those live in `src/debug/scenarios/`. Putting the
 * runner in `src/engine/` would mean either an engine -> debug import (breaks the gate)
 * or hoisting the scenario schema + materializer into the engine (drags zod, the
 * registry-hash drift policy and the normalizer into shipped code to serve a tool that
 * never ships). So the runner sits on the debug side of the line and imports the engine
 * downwards, which is the direction the gate allows.
 *
 * DETERMINISM
 * -----------
 * A run is a pure function of `(setup, seed)`. `buildScenarioState` threads one
 * `SeedStream` through creation and the reducer is seeded end to end, so replaying a
 * seed replays the battle action for action. Batch seeds are themselves derived from the
 * scenario's own seed by iterating the engine LCG, so `runBatch(setup, { iterations })`
 * is reproducible without the caller having to pin a seed list.
 *
 * BOTH SIDES ARE PLAYED BY `TacticalAI`
 * -------------------------------------
 * Which is why every scenario handed to this runner needs `enemyMode: 'CARDS'`:
 * `getBestAction` short-circuits to `END_TURN` for a `MOVES` enemy once its telegraphed
 * intents have fired, so a "mirror" against a MOVES enemy would not be a mirror at all.
 * The runner rejects `MOVES` setups rather than silently producing that asymmetry.
 */

import { battleReducer, type BattleAction } from '../../engine/battleReducer';
import { getBestAction } from '../../engine/ai/TacticalAI';
import { PRNG } from '../../engine/core/PRNG';
import type { IBattleEntity, IBattleState } from '../../engine/types';
import { buildScenarioState } from '../scenarios/buildScenarioState';
import type { ComposedSetup } from '../scenarios/scenarioSchema';

/** Default battle length cap. A battle still running at turn 60 is a stall, not a game. */
export const DEFAULT_MAX_TURNS = 60;

/**
 * Per-turn action cap. The turn counter only advances when the turn is handed back to
 * PLAYER, so a side that can keep producing state-changing plays forever (an energy loop,
 * say) would never trip `maxTurns`. This bounds a single side's turn instead.
 */
const MAX_ACTIONS_PER_TURN = 250;

export type BattleOutcome = 'PLAYER' | 'ENEMY' | 'DRAW';

export type Side = 'PLAYER' | 'ENEMY';

export interface BatchOptions {
    /** Explicit seed list. Wins over `iterations` when both are given. */
    seeds?: ReadonlyArray<string>;
    /** Number of runs; seeds are derived from `setup.seed`. Defaults to 100. */
    iterations?: number;
    /** Battle length cap, in turns. Reaching it scores the run a DRAW. */
    maxTurns?: number;
    /**
     * Which side takes the first action. `buildScenarioState` always hands the opening
     * turn to PLAYER (that is what a real battle does), so this flips `activeSide` on the
     * materialized state and nothing else.
     *
     * It exists because moving first is a large, measurable edge in this engine - battles
     * between base decks are decided in 2-3 turns - and every win rate a batch reports is
     * therefore a mix of "is this deck stronger" and "did it move first". Running the same
     * seeds under both orientations and pooling separates the two. The Mirror Test depends
     * on it: identical decks cannot both win 50% when only one of them moves first.
     *
     * Caveat: `IBattleState.turn` only advances when the turn passes back to PLAYER, so an
     * ENEMY-first battle records one extra half-turn. Turn counts from the two orientations
     * are comparable to within 1.
     */
    startingSide?: Side;
}

export interface RunResult {
    seed: string;
    /** Which side moved first in this run. */
    startingSide: Side;
    winner: BattleOutcome;
    /** The turn the battle ended on (1-based, as `IBattleState.turn`). */
    turns: number;
    /**
     * `docs/balance_testing.md` §3's zero-interaction win: the side that moved first won
     * on turn 1, so the opponent never played a card.
     *
     * The `startingSide` clause is what makes it zero-*interaction* rather than merely
     * fast. `IBattleState.turn` covers both half-turns, so a run can also end on turn 1
     * with the *second* mover winning - a one-turn kill, but one the loser got to answer.
     */
    ftk: boolean;
    /** Hit `maxTurns` or the per-turn action cap instead of reaching a decision. */
    truncated: boolean;
    /** Fraction of card instances that reached a hand and were never played, per side. */
    deadCards: { player: number; enemy: number };
    /** Card instances that reached a hand at all, per side - the ratio's denominator. */
    cardsSeen: { player: number; enemy: number };
}

export interface BatchResult {
    runs: RunResult[];
    iterations: number;
    playerWins: number;
    enemyWins: number;
    draws: number;
    /** Runs that reached a kill: `playerWins + enemyWins`. */
    decisive: number;
    /** Player wins / total runs. Draws count against it. */
    winRate: number;
    /**
     * Player wins / *decisive* runs, or 0 when nothing was decided.
     *
     * This is the number the §2 redlines should be read against. A draw is symmetric -
     * neither deck won - so counting it as a loss for the player side manufactures a bias
     * that is not there. It matters: several base-deck mirrors here stall out at 20-40%
     * of runs, and `winRate` reads those as a lopsided matchup while `decisiveWinRate`
     * correctly reads them as an even one with a stalling problem (which `averageTurns`
     * and `truncatedCount` are the metrics for).
     */
    decisiveWinRate: number;
    averageTurns: number;
    /** Player-side dead-card ratio, pooled over the batch (not a mean of ratios). */
    deadCardRatio: number;
    /** Enemy-side equivalent - the mirror test wants both. */
    enemyDeadCardRatio: number;
    ftkCount: number;
    ftkRate: number;
    truncatedCount: number;
}

/**
 * Derive `count` decorrelated seeds from a base seed by iterating the engine LCG.
 * Exported so a caller can log or pin the exact seed list a batch used.
 */
export function deriveSeeds(baseSeed: string, count: number): string[] {
    const seeds: string[] = [];
    let current: string = baseSeed;
    for (let i = 0; i < count; i++) {
        current = String(new PRNG(current).next().nextSeed);
        seeds.push(current);
    }
    return seeds;
}

function anyAlive(party: ReadonlyArray<IBattleEntity>): boolean {
    return party.some(e => e.currentHp > 0);
}

function decideOutcome(state: IBattleState): BattleOutcome | null {
    const playerAlive = anyAlive(state.playerParty);
    const enemyAlive = anyAlive(state.enemyParty);
    if (!playerAlive && !enemyAlive) return 'DRAW';
    if (!playerAlive) return 'ENEMY';
    if (!enemyAlive) return 'PLAYER';
    return null;
}

/**
 * Ticket 19: per-seed IV jitter. One roll per stat per SEED, applied identically to
 * every unit on BOTH sides - each game stays fair while the absolute HP/damage
 * numbers vary across the batch, decorrelating the kill-threshold seed families
 * that made single power points flip 37-point cliffs (ticket 18's coil sweep).
 * Deterministic: the roll is derived from the run seed, nothing else.
 */
export function applyStatJitter(setup: ComposedSetup, seed: string): ComposedSetup {
    const magnitude = setup.statJitter ?? 0;
    if (magnitude <= 0) return setup;

    const roll = (tag: string): number =>
        new PRNG(`ivjitter|${tag}|${seed}`).nextInt(-magnitude, magnitude).value;
    const dAtk = roll('atk');
    const dDef = roll('def');
    const dHp = roll('hp');

    const clampIV = (iv: number): number => Math.max(0, Math.min(31, iv));
    const jitterUnit = <T extends { attackIV: number; defenseIV: number; hpIV: number }>(unit: T): T => ({
        ...unit,
        attackIV: clampIV(unit.attackIV + dAtk),
        defenseIV: clampIV(unit.defenseIV + dDef),
        hpIV: clampIV(unit.hpIV + dHp),
    });

    return {
        ...setup,
        player: { ...setup.player, party: setup.player.party.map(jitterUnit) },
        enemies: setup.enemies.map(jitterUnit),
    };
}

/** Card-instance ids currently held by a side. */
function handIds(state: IBattleState, side: 'PLAYER' | 'ENEMY'): ReadonlyArray<string> {
    const deck = side === 'PLAYER' ? state.playerDeck : state.enemyDeck;
    return deck.hand.map(card => card.id);
}

/**
 * Play one battle to a decision.
 *
 * Pure: no Redux, no event-bus subscription, no console output. `TacticalAI` drives
 * whichever side `state.activeSide` names, so the same call site plays both.
 */
export function runOne(
    setup: ComposedSetup,
    seed: string,
    maxTurns: number = DEFAULT_MAX_TURNS,
    startingSide: Side = 'PLAYER',
): RunResult {
    const built = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
    let state: IBattleState = startingSide === 'PLAYER' ? built : { ...built, activeSide: 'ENEMY' };

    // Dead-card bookkeeping. `seen` accumulates every card instance that has ever been in
    // hand; `played` the ones a PLAY_PROGRAM actually consumed. A card discarded or
    // exhausted by an effect stays in `seen` and out of `played` - it sat in hand
    // unplayed, which is the metric. Ids are stable across reshuffles (they are assigned
    // once by `instantiateDeck`), so a card drawn twice is counted once.
    const seen = { PLAYER: new Set<string>(), ENEMY: new Set<string>() };
    const played = { PLAYER: new Set<string>(), ENEMY: new Set<string>() };

    const observeHands = (s: IBattleState) => {
        for (const id of handIds(s, 'PLAYER')) seen.PLAYER.add(id);
        for (const id of handIds(s, 'ENEMY')) seen.ENEMY.add(id);
    };

    observeHands(state);

    let winner: BattleOutcome | null = decideOutcome(state);
    let truncated = false;
    let actionsThisTurn = 0;
    let turnFingerprint = `${state.turn}:${state.activeSide}`;

    while (winner === null) {
        if (state.turn > maxTurns) {
            truncated = true;
            break;
        }

        const action: BattleAction = getBestAction(state);
        const side = state.activeSide;
        const nextState = battleReducer(state, action);

        if (nextState === state) {
            // The reducer rejected the AI's choice (a stale constraint, an unplayable
            // card). Ending the turn is the only move guaranteed to advance the battle;
            // if even that is a no-op the state machine is wedged and the run is void.
            const forced = battleReducer(state, { type: 'END_TURN' });
            if (forced === state) {
                truncated = true;
                break;
            }
            state = forced;
        } else {
            if (action.type === 'PLAY_PROGRAM') {
                played[side].add(action.payload.programId);
            }
            state = nextState;
        }

        observeHands(state);

        const fingerprint = `${state.turn}:${state.activeSide}`;
        if (fingerprint === turnFingerprint) {
            actionsThisTurn++;
            if (actionsThisTurn > MAX_ACTIONS_PER_TURN) {
                truncated = true;
                break;
            }
        } else {
            turnFingerprint = fingerprint;
            actionsThisTurn = 0;
        }

        winner = decideOutcome(state);
    }

    const deadRatio = (s: 'PLAYER' | 'ENEMY'): number => {
        const total = seen[s].size;
        if (total === 0) return 0;
        let dead = 0;
        for (const id of seen[s]) if (!played[s].has(id)) dead++;
        return dead / total;
    };

    const resolved: BattleOutcome = winner ?? 'DRAW';

    return {
        seed,
        startingSide,
        winner: resolved,
        turns: state.turn,
        ftk: resolved === startingSide && state.turn === 1,
        truncated,
        deadCards: { player: deadRatio('PLAYER'), enemy: deadRatio('ENEMY') },
        cardsSeen: { player: seen.PLAYER.size, enemy: seen.ENEMY.size },
    };
}

/** Aggregate an arbitrary set of runs. Exported so callers can pool across batches. */
export function aggregate(runs: ReadonlyArray<RunResult>): BatchResult {
    if (runs.length === 0) {
        throw new Error('[aggregate] No runs to aggregate.');
    }

    const playerWins = runs.filter(r => r.winner === 'PLAYER').length;
    const enemyWins = runs.filter(r => r.winner === 'ENEMY').length;
    const draws = runs.filter(r => r.winner === 'DRAW').length;
    const ftkCount = runs.filter(r => r.ftk).length;

    // Pooled, not a mean of per-run ratios: a run that only ever saw 3 cards should not
    // weigh as much as one that cycled 30.
    const pooledDead = (pick: (r: RunResult) => { dead: number; seenCount: number }) => {
        let dead = 0;
        let total = 0;
        for (const run of runs) {
            const { dead: d, seenCount } = pick(run);
            dead += d;
            total += seenCount;
        }
        return total === 0 ? 0 : dead / total;
    };

    return {
        runs: [...runs],
        iterations: runs.length,
        playerWins,
        enemyWins,
        draws,
        decisive: playerWins + enemyWins,
        winRate: playerWins / runs.length,
        decisiveWinRate: playerWins + enemyWins === 0 ? 0 : playerWins / (playerWins + enemyWins),
        averageTurns: runs.reduce((sum, r) => sum + r.turns, 0) / runs.length,
        deadCardRatio: pooledDead(r => ({
            dead: r.deadCards.player * r.cardsSeen.player,
            seenCount: r.cardsSeen.player,
        })),
        enemyDeadCardRatio: pooledDead(r => ({
            dead: r.deadCards.enemy * r.cardsSeen.enemy,
            seenCount: r.cardsSeen.enemy,
        })),
        ftkCount,
        ftkRate: ftkCount / runs.length,
        truncatedCount: runs.filter(r => r.truncated).length,
    };
}

/** Resolve a batch's seed list without running it - `seeds` wins over `iterations`. */
function resolveSeeds(setup: ComposedSetup, options: BatchOptions): string[] {
    const seeds =
        options.seeds && options.seeds.length > 0
            ? [...options.seeds]
            : deriveSeeds(setup.seed, options.iterations ?? 100);

    if (seeds.length === 0) {
        throw new Error('[runBatch] Nothing to run: pass a non-empty `seeds` or `iterations` >= 1.');
    }
    return seeds;
}

/**
 * Run a composed scenario `iterations` times (or once per supplied seed) and aggregate.
 *
 * Throws on `enemyMode: 'MOVES'` - see the module header. A MOVES enemy is not played by
 * `TacticalAI`, so every metric out of such a batch would describe a different game than
 * the one the caller asked about.
 */
export function runBatch(setup: ComposedSetup, options: BatchOptions = {}): BatchResult {
    if (setup.enemyMode !== 'CARDS') {
        throw new Error(
            "[runBatch] Scenario must set enemyMode: 'CARDS'. TacticalAI drives both sides; " +
                'a MOVES enemy plays telegraphed intents instead of cards, so the batch would ' +
                'not measure the matchup it claims to.',
        );
    }

    const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    const startingSide = options.startingSide ?? 'PLAYER';

    return aggregate(
        resolveSeeds(setup, options).map(seed => runOne(setup, seed, maxTurns, startingSide)),
    );
}

export interface PairedBatchResult {
    playerFirst: BatchResult;
    enemyFirst: BatchResult;
    /** Both orientations pooled: a win rate with the first-mover edge averaged out. */
    pooled: BatchResult;
    /**
     * How much of the result is "who moved first" rather than "whose deck is better":
     * the first mover's share of *decided* games across both orientations, minus 0.5.
     * Positive = moving first wins. Between base decks this runs to ±0.12.
     */
    firstMoverEdge: number;
    /**
     * The harness's own self-check: `|P(first mover wins | PLAYER moves first) −
     * P(first mover wins | ENEMY moves first)|`, over decided games.
     *
     * In a *mirror* this must be ~0. The two numbers describe the same game seen from
     * opposite ends, so a gap means the engine or the AI treats one *side* differently,
     * independent of turn order - the exact failure `docs/balance_testing.md` §2.1 exists
     * to catch. Outside a mirror it is not a bias measure at all: it just restates how
     * asymmetric the two decks are, so only the Mirror Test should assert on it.
     *
     * (When both orientations decide the same number of games this is algebraically
     * `2 × |pooled.decisiveWinRate − 0.5|`. They diverge when draws are lopsided.)
     */
    sideBias: number;
}

/**
 * Run the same seeds twice, once with each side moving first.
 *
 * This is the only way to read a win rate in this engine as a statement about decks.
 * Moving first is worth roughly 10 points between base decks (battles last 2-3 turns), so
 * a single-orientation batch cannot distinguish "stronger deck" from "went first".
 */
export function runPairedBatch(setup: ComposedSetup, options: BatchOptions = {}): PairedBatchResult {
    const seeds = resolveSeeds(setup, options);
    const playerFirst = runBatch(setup, { ...options, seeds, startingSide: 'PLAYER' });
    const enemyFirst = runBatch(setup, { ...options, seeds, startingSide: 'ENEMY' });

    const firstMoverWins = playerFirst.playerWins + enemyFirst.enemyWins;
    const decided = playerFirst.decisive + enemyFirst.decisive;

    // A share of nothing is 0.5, not NaN: a scenario that never resolves has no
    // first-mover edge and no side bias to report, and callers assert on stalling
    // separately (`truncatedCount` / `averageTurns`).
    const share = (wins: number, of: number) => (of === 0 ? 0.5 : wins / of);

    return {
        playerFirst,
        enemyFirst,
        pooled: aggregate([...playerFirst.runs, ...enemyFirst.runs]),
        firstMoverEdge: share(firstMoverWins, decided) - 0.5,
        sideBias: Math.abs(
            share(playerFirst.playerWins, playerFirst.decisive) -
                share(enemyFirst.enemyWins, enemyFirst.decisive),
        ),
    };
}
