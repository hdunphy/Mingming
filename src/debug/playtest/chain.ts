/**
 * TICKET 195i — A `moves` LIST, AND WHEN IT STOPS.
 *
 * Numbers in a list mean the screen as it was when the list was sent, so they are turned into keys up
 * front. That keeps a later number pointing at the move the agent saw. What it cannot do is protect
 * the agent from a move that changes what the screen offers: Sonnet r16 bought a Rune, the Skoll
 * blueprint line vanished, and the agent's next number (counted on the new screen in its head) sold
 * Brand. So a list stops at the first move after which the screen's other moves changed, says which
 * numbers it did not take, and shows the renumbered screen. A sale (one keypress, no undo) is never
 * taken inside a list at all. In a battle the hand changes with every card played and a whole turn
 * is meant to go as one list, so battles are left alone. The game itself is unchanged.
 */
import { currentScreen } from './screen';
import type { LoggedMove, Screen, World } from './types';
import { enforceBudget, applyMove, IllegalMoveError } from './world';

const SELL_PREFIX = 'market:sell:';

/** A sale is one keypress with no undo: it is made with `move`, one at a time, on the screen as it is. */
export const isSale = (key: string): boolean => key.startsWith(SELL_PREFIX);

const saleStop = (label: string, at: number, total: number, applied: number): string =>
    `${applied === 0 ? '' : `Stopped at move ${at} of ${total}: `}Selling is one keypress with no undo, so it is not taken inside a "moves" list (${label}). Make each sale with "move <n>", on the screen as it is. ${applied === 0 ? 'Nothing was changed.' : `The ${applied} before it were applied.`}`;

/** Whether a move left the other moves of the same screen different: a line gone, or a new one. */
export function shapeChanged(before: Screen, after: Screen, ownKey: string): boolean {
    if (before.id !== after.id) return false;
    const others = (screen: Screen): string => screen.moves.map((m) => m.key).filter((k) => k !== ownKey).join('\n');
    return others(before) !== others(after);
}

export interface ChainResult {
    readonly applied: LoggedMove[];
    /** Why the list did not run to its end, or null. */
    readonly stop: string | null;
    /** The stop was a move that was not legal (the command fails), as opposed to a reshuffle (it does not). */
    readonly failed: boolean;
}

export function applyKeys(world: World, screen: Screen, numbers: ReadonlyArray<number>, why: string, expect?: unknown, viaMoves = false): ChainResult {
    const keys = numbers.map((n) => screen.moves[n - 1].key);
    const applied: LoggedMove[] = [];
    for (const [i, key] of keys.entries()) {
        const more = i < keys.length - 1;
        const move: LoggedMove = { key, why, ...(expect !== undefined && i === 0 ? { expect } : {}), ...(i > 0 ? { chained: true as const } : {}) };
        if (viaMoves && isSale(key)) {
            if (applied.length > 0) enforceBudget(world);
            return { applied, stop: saleStop(`${numbers[i]}: ${screen.moves[numbers[i] - 1].label}`, i + 1, keys.length, applied.length), failed: true };
        }
        const before = more && world.view.battle === null ? currentScreen(world) : null;
        try {
            applyMove(world, move, more);
        } catch (error) {
            if (!(error instanceof IllegalMoveError)) throw error;
            if (applied.length === 0) return { applied, stop: `${error.message}. Nothing was changed.`, failed: true };
            // The list stopped at the first illegal move; what came before it stands.
            enforceBudget(world);
            return { applied, stop: `Stopped at move ${i + 1} of ${keys.length}: ${error.message}. The ${applied.length} before it were applied.`, failed: true };
        }
        applied.push(move);
        if (before && shapeChanged(before, currentScreen(world), key)) {
            enforceBudget(world);
            const left = numbers.slice(i + 1).map((n) => `${n} (${screen.moves[n - 1].label})`).join(', ');
            return {
                applied,
                stop: `Stopped after move ${i + 1} of ${keys.length}: that move changed what the screen offers, so the numbers you counted on the old screen no longer mean the same moves. Not taken: ${left}. The screen is numbered afresh below; send them again if you still want them.`,
                failed: false,
            };
        }
    }
    return { applied, stop: null, failed: false };
}
