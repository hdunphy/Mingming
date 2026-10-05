/**
 * THE ENEMY'S PACE — ticket 189e. When may the enemy's next action be dispatched?
 *
 * `BattleArena`'s `runAI` used to sleep a fixed `PLAYED_CARD_REVEAL_MS` (1.2 s) between actions,
 * whatever the last card did. The sequence on screen is now what decides: an action is dispatched
 * only after the presenter has gone idle, i.e. after the previous card hovered, played its attack and
 * left. The think is still overlapped with that wait (ticket 127: *"think during the pause, not after
 * it"*), so a slow search costs nothing extra and a fast one still waits its turn.
 *
 * - The FIRST action of a turn keeps the opening pause (the turn banner has to be read), in game time.
 * - At Instant every wait resolves at once and the presenter is idle as it enqueues, so a whole AI
 *   turn completes with no waiting but the thinking itself.
 *
 * It is a function of its dependencies, not of React: the effect that calls it owns cancellation.
 */

import type { BattleClock } from '../clock/BattleClock';
import { isInstantSpeed } from '../clock/speedPolicy';

/** The pause when the enemy's turn begins, before its first card. Unchanged from ticket 127. */
export const TURN_OPEN_PAUSE_MS = 1200;
/**
 * The short real-time debounce in front. It is load-bearing (ticket 127): the effect re-runs on every
 * battle state change, and this is what lets a superseded run cancel before it spends a search.
 */
export const AI_DEBOUNCE_MS = 50;

export interface PacerDeps<Action> {
    /** True for the first action of the enemy's turn. */
    readonly firstOfTurn: boolean;
    /** Decide the next action (the worker, or the main-thread search). */
    readonly think: () => Promise<Action>;
    /** `presenter.whenIdle`: resolves when nothing is playing, queued or being collected. */
    readonly idle: () => Promise<void>;
    readonly clock: Pick<BattleClock, 'wait' | 'multiplier'>;
    readonly cancelled: () => boolean;
    /** Real-time debounce; a test passes its own. */
    readonly debounce?: (ms: number) => Promise<void>;
}

const realDebounce = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

/** The action to dispatch, or null when the run was cancelled on the way. */
export async function paceEnemyAction<Action>(deps: PacerDeps<Action>): Promise<Action | null> {
    const debounce = deps.debounce ?? realDebounce;
    await debounce(isInstantSpeed(deps.clock.multiplier) ? 0 : AI_DEBOUNCE_MS);
    if (deps.cancelled()) return null;

    // Thinking and the opening pause run together; the longer of the two is what is paid.
    const opening = deps.firstOfTurn
        ? deps.clock.wait(Math.max(0, TURN_OPEN_PAUSE_MS - AI_DEBOUNCE_MS))
        : Promise.resolve();
    const [action] = await Promise.all([deps.think(), opening]);
    if (deps.cancelled()) return null;

    // The previous action's whole sequence (hover, attack, leave) is over before the next goes in.
    await deps.idle();
    if (deps.cancelled()) return null;
    return action;
}
