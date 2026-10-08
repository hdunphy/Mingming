/**
 * TICKET 180a — THE WORLD: a store, a view, and the log that rebuilds both.
 *
 * `createWorld` is `createRun` into a fresh store. `replayWorld` is that plus every logged move, in
 * order, and it is the only way a session is ever loaded: the CLI never keeps live state between
 * commands. The engine is deterministic, so two replays of one log are identical, and
 * `stateHash` is how the tests say so.
 *
 * The store holds exactly two slices, `run` and `game` (the ranch: roster and blueprints), because
 * those are the two the game's own reducers and screens read. It has no middleware and writes
 * nothing to storage.
 */
import { createHash } from 'node:crypto';
import { configureStore } from '@reduxjs/toolkit';

import gameReducer, { createEmptyRanch } from '../../ui/store/gameSlice';
import runReducer, { endRun, startRun } from '../../ui/store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { withOpeningFight } from '../../engine/run/openingFight';
import { offerGyms, speciesOwningFirmware } from '../../engine/run/gyms';
import { toMingmingState } from '../../engine/run/battleSetup';
import type { IRanchMember, IRanchState, IRunState } from '../../engine/runTypes';
import { BALANCE_IV } from '../balance/balanceScenarios';
import { beforeMove, checkMove } from './afterMove';
import { gymOfferSeed } from './gymOfferSeed';
import { currentScreen } from './screen';
import type { LoggedMove, PlaytestStore, SessionHeader, View, World } from './types';

/** Any fixed number: the run's start time is never read by a rule, but it must not vary between replays. */
const STARTED_AT = 1_700_000_000_000;

/** Modifiers the playtester cannot play yet. Draft Start needs a drafting screen of its own. */
const UNSUPPORTED_MODIFIERS: ReadonlyArray<string> = ['draft_start'];

export const emptyView = (): View => ({ news: [], fight: null, reward: null, closedStall: null, townPart: null, leftEvent: null, event: null, editor: null, battle: null, cutShort: null, engineError: null });

/** The two-slice store every world uses; `run` is null until a run is started. */
export function buildStore(game: IRanchState, run: IRunState | null): PlaytestStore {
    return configureStore({
        reducer: { game: gameReducer, run: runReducer },
        preloadedState: { game, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false }),
    });
}

/** The session's starter, in the ranch's first slot. Run 2 finds it there again, as the game's run start finds a roster member. */
export const STARTER_ID = 'mm1';

/** TICKET 202c: what a second run starts from: the ranch the game's run end leaves, and the session's log so far. */
export interface CarriedSave {
    readonly ranch: IRanchState;
    /** The log run 1 left; run 2's moves are added to it, so a move's index is the same in both runs. */
    readonly log: LoggedMove[];
}

export function createWorld(header: SessionHeader, carried?: CarriedSave): World {
    for (const id of header.modifiers) {
        if (UNSUPPORTED_MODIFIERS.includes(id)) {
            throw new Error(`the playtester cannot play the "${id}" modifier yet (it needs its own screen)`);
        }
    }
    const species = speciesOwningFirmware(header.starter);
    if (!species) throw new Error(`no species owns the instinct "${header.starter}"`);

    const starter: IRanchMember = {
        id: STARTER_ID, definitionId: species, activeOS: header.starter,
        attackIV: BALANCE_IV, defenseIV: BALANCE_IV, hpIV: BALANCE_IV,
    };
    const ranch = carried?.ranch ?? { ...createEmptyRanch(), roster: [starter] };
    const member = ranch.roster.find((m) => m.id === STARTER_ID);
    if (!member) throw new Error(`the save has no member ${STARTER_ID} to start the run with`);
    const store = buildStore(ranch, null);

    const offers = offerGyms(gymOfferSeed(header.seed));
    const offer = offers[header.gymIndex % offers.length];
    store.dispatch(startRun(withOpeningFight(createRun({
        seed: header.seed, offer, party: [toMingmingState(member)], startedAt: STARTED_AT,
        tier: header.tier, modifiers: [...header.modifiers],
    }))));

    return carried === undefined
        ? { header, store, view: emptyView(), log: [], findings: [], lastPlay: null, runNumber: 1, runStart: 0 }
        : { header, store, view: emptyView(), log: carried.log, findings: [], lastPlay: null, runNumber: 2, runStart: carried.log.length };
}

/** How many decisions a run may take before the session is stopped with outcome `budget` (ticket 180d). */
export const DEFAULT_BUDGET = 400;

/** A decision is one call: the first move of a `moves` list, or a lone `move`. The rest of a list are chained to it. */
export const decisionsIn = (log: ReadonlyArray<LoggedMove>): number => log.filter((m) => m.chained !== true).length;

export class IllegalMoveError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'IllegalMoveError';
    }
}

/**
 * Apply one move by key. The key must be one the current screen offers; anything else is refused
 * and changes nothing. The news and the fight report from the previous move are cleared first, so
 * what a screen shows above its body is always about the move that produced it.
 */
export function applyMove(world: World, move: LoggedMove, more = false): void {
    const screen = currentScreen(world);
    const found = screen.moves.find((m) => m.key === move.key);
    if (!found) throw new IllegalMoveError(`"${move.key}" is not a legal move on this screen`);
    world.view.news = [];
    world.view.fight = null;
    world.lastPlay = null;
    const before = beforeMove(world);
    const atMove = world.log.length;
    found.apply(world);
    world.log.push(move);
    checkMove(world, before, move, atMove);
    if (!more) enforceBudget(world);
}

/**
 * Stop the session when its decisions are used up. Called after each call's last move (`more` is
 * false), never in the middle of a `moves` list, so a list is never cut in half by the budget.
 * The run ends as abandoned and `view.cutShort` says why; the end screen reports outcome `budget`.
 */
export function enforceBudget(world: World): void {
    const run = world.store.getState().run.run!;
    if (run.phase === 'ended') return;
    // 202c: the budget is per run, so a second run gets decisions of its own.
    if (decisionsIn(world.log.slice(world.runStart)) < (world.header.budget ?? DEFAULT_BUDGET)) return;
    world.view.battle = null;
    world.view.cutShort = 'budget';
    world.store.dispatch(endRun('abandoned'));
}

/** A world rebuilt from a saved copy of its parts (195m's snapshot), which stands in for replaying the moves that made it. */
export function restoreWorld(header: SessionHeader, parts: { game: IRanchState; run: IRunState; view: View; log: LoggedMove[]; findings: World['findings']; lastPlay: World['lastPlay']; runNumber?: 1 | 2; runStart?: number }): World {
    return {
        header, store: buildStore(parts.game, parts.run), view: parts.view, log: parts.log, findings: parts.findings, lastPlay: parts.lastPlay,
        runNumber: parts.runNumber ?? 1, runStart: parts.runStart ?? 0,
    };
}

/**
 * A run 1 rebuilt from its moves. A session that has a second run (202c) is rebuilt by `replaySession`
 * (playMoves.ts), which opens run 2 where run 1 ended; this one plays every move into a single run.
 */
export function replayWorld(header: SessionHeader, moves: ReadonlyArray<LoggedMove>): World {
    const world = createWorld(header);
    moves.forEach((move, i) => applyMove(world, move, moves[i + 1]?.chained === true));
    return world;
}

/** Key order is fixed so equal states always print equal. */
function canonical(value: unknown): string {
    return JSON.stringify(value, (_key, v: unknown) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const sorted: Record<string, unknown> = {};
            for (const k of Object.keys(v as Record<string, unknown>).sort()) sorted[k] = (v as Record<string, unknown>)[k];
            return sorted;
        }
        return v;
    });
}

/** A hash of everything a replay produces: the run, the ranch and the view. */
export function stateHash(world: World): string {
    const state = world.store.getState();
    return createHash('sha1').update(canonical({ run: state.run.run, game: state.game, view: world.view })).digest('hex');
}
