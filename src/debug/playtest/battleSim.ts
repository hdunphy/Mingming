/**
 * TICKET 180a — THE PLAYTESTER'S BATTLE LOOP.
 *
 * `runOne` (the walker's fight) returns a summary and keeps the damage ledger to itself. The
 * playtester needs two things it cannot give: the biggest hits of a fight, for the fight screen, and
 * a battle that can STOP between moves, for `turn` and `card` mode (180d).
 *
 * **This is not a second opinion about how a fight goes.** It builds the state the way `runOne`
 * builds it (`buildScenarioState` over the jittered setup, the same enemy tier and beam fields) and
 * steps it with the same two functions, `getBestAction` and `battleReducer`, including `runOne`'s
 * rule that a move the reducer refuses becomes END TURN. `battleSim.test.ts` plays the same fights
 * through both and compares winner, turns and the HP left on both sides.
 *
 * No macros: the walker's fights fire none, and the macro moves belong to 180d's battle screen.
 */
import { battleReducer, type BattleAction } from '../../engine/battleReducer';
import { battleOutcome, type BattleOutcome } from '../../engine/battleOutcome';
import { getBestAction, type AiTier } from '../../engine/ai/TacticalAI';
import { getMacro } from '../../engine/data/macroRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import type { IBattleState } from '../../engine/types';
import { buildScenarioState } from '../scenarios/buildScenarioState';
import type { ComposedSetup } from '../scenarios/scenarioSchema';
import { applyStatJitter } from '../balance/runBatch';
import { fightName } from './sideTag';

/**
 * The walker's turn cap. `runWalker.ts` keeps it in a private `const WALK_MAX_TURNS`, and this
 * ticket may not edit that file, so the number is held here and `battleSim.test.ts` reads the
 * walker's source and fails if the two differ.
 */
export const PLAYTEST_MAX_TURNS = 60;

/** `runBatch`'s own guard against a turn that never ends. */
export const MAX_ACTIONS_PER_TURN = 250;

export interface OpenBattleInput {
    readonly setup: ComposedSetup;
    readonly seed: string;
    readonly enemyAiTier?: AiTier;
    readonly aiBeam?: number;
    readonly playerAiTier?: AiTier;
}

/** The opening state, built exactly as `runOne` builds it. The player moves first. */
export function openBattle(input: OpenBattleInput): IBattleState {
    const built = buildScenarioState({ ...applyStatJitter(input.setup, input.seed), seed: input.seed }, 'PLAYER');
    return {
        ...built,
        ...(input.enemyAiTier === undefined ? {} : { enemyAiTier: input.enemyAiTier }),
        ...(input.playerAiTier === undefined ? {} : { playerAiTier: input.playerAiTier }),
        ...(input.aiBeam === undefined ? {} : { aiBeam: input.aiBeam }),
    };
}

/** One line of the damage summary: what one source did to one target with one card or effect. */
export interface HitTotal {
    readonly side: 'PLAYER' | 'ENEMY';
    readonly source: string;
    readonly target: string;
    /** The card's printed name, or the effect's cause when no card was played (a status ticking). */
    readonly label: string;
    /** Damage before shields and the HP floor: what the card hit for. */
    readonly total: number;
    readonly times: number;
}

export interface StepResult {
    readonly state: IBattleState;
    /** False when the reducer refused the action and nothing changed. */
    readonly changed: boolean;
    readonly hits: ReadonlyArray<HitTotal>;
}

const nameOf = fightName;

const sideOf = (state: IBattleState, id: string): 'PLAYER' | 'ENEMY' =>
    state.playerParty.some((e) => e.id === id) ? 'PLAYER' : 'ENEMY';

/**
 * Who dealt a ledger record. The engine writes the literal `'SYSTEM'` as the source of card attacks
 * as well as of ticking statuses (an engine quirk, noted in the ticket's report), so a record from
 * `SYSTEM` during a card play is attributed to the card's caster, and one outside a play to the
 * side that was acting.
 */
function dealerOf(state: IBattleState, recordSource: string, action: BattleAction): { id: string; name: string; side: 'PLAYER' | 'ENEMY' } {
    const known = [...state.playerParty, ...state.enemyParty].some((e) => e.id === recordSource);
    if (known) return { id: recordSource, name: nameOf(state, recordSource), side: sideOf(state, recordSource) };
    if (action.type === 'PLAY_PROGRAM' || action.type === 'FIRE_MACRO') {
        const caster = action.payload.sourceId;
        return { id: caster, name: nameOf(state, caster), side: sideOf(state, caster) };
    }
    return { id: recordSource, name: 'a status effect', side: state.activeSide };
}

/** The printed name of the card (or macro) an action plays, read from the hand BEFORE the action. */
export function cardNameFor(state: IBattleState, action: BattleAction): string | null {
    if (action.type === 'FIRE_MACRO') return getMacro(action.payload.macroId)?.name ?? action.payload.macroId;
    if (action.type !== 'PLAY_PROGRAM') return null;
    const deck = state.activeSide === 'PLAYER' ? state.playerDeck : state.enemyDeck;
    const card = deck.hand.find((c) => c.id === action.payload.programId);
    if (!card) return null;
    return GetProgramData(card.dataId)?.name || card.dataId;
}

/**
 * One dispatch. The ledger is per-action (`battleReducer` clears it at the top of each), so it is
 * read here, straight after the dispatch, and handed back as hit rows.
 */
export function step(state: IBattleState, action: BattleAction): StepResult {
    const label = cardNameFor(state, action);
    const next = battleReducer(state, action);
    if (next === state) return { state, changed: false, hits: [] };
    const rows = new Map<string, HitTotal>();
    for (const record of next.damageLedger ?? []) {
        if (record.raw <= 0) continue;
        const what = label ?? record.cause ?? 'effect';
        const dealer = dealerOf(next, record.sourceId, action);
        const key = `${dealer.id}|${record.targetId}|${what}`;
        const held = rows.get(key);
        rows.set(key, held
            ? { ...held, total: held.total + record.raw, times: held.times + 1 }
            : {
                side: dealer.side, source: dealer.name,
                target: nameOf(next, record.targetId), label: what, total: record.raw, times: 1,
            });
    }
    return { state: next, changed: true, hits: [...rows.values()] };
}

/** Add one step's hits into a running table, merging rows that name the same source, target and card. */
export function mergeHits(table: Map<string, HitTotal>, hits: ReadonlyArray<HitTotal>): void {
    for (const hit of hits) {
        const key = `${hit.source}|${hit.target}|${hit.label}`;
        const held = table.get(key);
        table.set(key, held ? { ...held, total: held.total + hit.total, times: held.times + hit.times } : hit);
    }
}

export const sortedHits = (table: Map<string, HitTotal>): HitTotal[] =>
    [...table.values()].sort((a, b) => b.total - a.total || (a.label < b.label ? -1 : 1));

export interface AutoResult {
    readonly state: IBattleState;
    readonly winner: BattleOutcome;
    readonly turns: number;
    readonly truncated: boolean;
    /** Every hit of the fight, merged by source, target and card, biggest first. */
    readonly hits: ReadonlyArray<HitTotal>;
}

/**
 * Play a battle to its end with the game's own AI on whichever side is to move: `runOne`'s loop.
 * A refused action becomes END TURN, and a state that will not even end its turn is void.
 */
export function autoPlay(start: IBattleState, maxTurns: number = PLAYTEST_MAX_TURNS): AutoResult {
    let state = start;
    const table = new Map<string, HitTotal>();
    let winner: BattleOutcome | null = battleOutcome(state);
    let truncated = false;
    let actionsThisTurn = 0;
    let fingerprint = `${state.turn}:${state.activeSide}`;

    while (winner === null) {
        if (state.turn > maxTurns) { truncated = true; break; }

        const action = getBestAction(state);
        let moved = step(state, action);
        if (!moved.changed) {
            moved = step(state, { type: 'END_TURN' });
            if (!moved.changed) { truncated = true; break; }
        }
        state = moved.state;
        mergeHits(table, moved.hits);

        const now = `${state.turn}:${state.activeSide}`;
        if (now === fingerprint) {
            actionsThisTurn += 1;
            if (actionsThisTurn > MAX_ACTIONS_PER_TURN) { truncated = true; break; }
        } else {
            fingerprint = now;
            actionsThisTurn = 0;
        }
        winner = battleOutcome(state);
    }

    return { state, winner: winner ?? 'DRAW', turns: state.turn, truncated, hits: sortedHits(table) };
}
