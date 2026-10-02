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
import runReducer, { startRun } from '../../ui/store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms, speciesOwningFirmware } from '../../engine/run/gyms';
import { toMingmingState } from '../../engine/run/battleSetup';
import type { IRanchMember } from '../../engine/runTypes';
import { BALANCE_IV } from '../balance/balanceScenarios';
import { currentScreen } from './screen';
import type { LoggedMove, SessionHeader, View, World } from './types';

/** Any fixed number: the run's start time is never read by a rule, but it must not vary between replays. */
const STARTED_AT = 1_700_000_000_000;

/** Modifiers the playtester cannot play yet. Draft Start needs a drafting screen of its own. */
const UNSUPPORTED_MODIFIERS: ReadonlyArray<string> = ['draft_start'];

export const emptyView = (): View => ({ news: [], fight: null, reward: null, closedStall: null, leftEvent: null, event: null, editor: null, engineError: null });

export function createWorld(header: SessionHeader): World {
    for (const id of header.modifiers) {
        if (UNSUPPORTED_MODIFIERS.includes(id)) {
            throw new Error(`the playtester cannot play the "${id}" modifier yet (it needs its own screen)`);
        }
    }
    const species = speciesOwningFirmware(header.starter);
    if (!species) throw new Error(`no species owns the firmware "${header.starter}"`);

    const member: IRanchMember = {
        id: 'mm1', definitionId: species, activeOS: header.starter,
        attackIV: BALANCE_IV, defenseIV: BALANCE_IV, hpIV: BALANCE_IV,
    };
    const store = configureStore({
        reducer: { game: gameReducer, run: runReducer },
        preloadedState: { game: { ...createEmptyRanch(), roster: [member] }, run: { run: null } },
        middleware: (getDefault) => getDefault({ serializableCheck: false, immutableCheck: false }),
    });

    const offers = offerGyms(`${header.seed}:gyms`);
    const offer = offers[header.gymIndex % offers.length];
    store.dispatch(startRun(createRun({
        seed: header.seed, offer, party: [toMingmingState(member)], startedAt: STARTED_AT,
        tier: header.tier, modifiers: [...header.modifiers],
    })));

    return { header, store, view: emptyView(), log: [] };
}

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
export function applyMove(world: World, move: LoggedMove): void {
    const screen = currentScreen(world);
    const found = screen.moves.find((m) => m.key === move.key);
    if (!found) throw new IllegalMoveError(`"${move.key}" is not a legal move on this screen`);
    world.view.news = [];
    world.view.fight = null;
    found.apply(world);
    world.log.push(move);
}

export function replayWorld(header: SessionHeader, moves: ReadonlyArray<LoggedMove>): World {
    const world = createWorld(header);
    for (const move of moves) applyMove(world, move);
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
