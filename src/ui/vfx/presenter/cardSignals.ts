/**
 * THE CARD'S LIFE ON THE STAGE — ticket 189e. Three signals the presenter sends as a cast plays:
 *
 * - `in`: the card flies to the lane (`PlayedCardReveal` shows it, the whoosh plays);
 * - `launch`: the element leaves the caster (the caster lunges, the cast sound plays);
 * - `out`: its sequence is over and it goes (the reveal leaves).
 *
 * They used to ride the engine's `PROGRAM_PLAYED`, so a burst of seven enemy casts showed only the
 * last card, all seven casters lunged at once, and the player's card left on a fixed 1.5 s timer
 * whatever it was doing. Now each cast sends its own, in its own turn in the line.
 */

import type { PlayedCardAnnouncement } from '../../hooks/useBattleVfx';

export type CardSignal =
    | { readonly kind: 'in'; readonly card: PlayedCardAnnouncement }
    | { readonly kind: 'launch'; readonly card: PlayedCardAnnouncement }
    | { readonly kind: 'out'; readonly card: PlayedCardAnnouncement };

type Listener = (signal: CardSignal) => void;
const listeners = new Set<Listener>();

export function onCardSignal(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function emitCardSignal(signal: CardSignal): void {
    for (const listener of [...listeners]) listener(signal);
}

let nextKey = 1;
/** Monotonic, so two casts of the same card in one turn are two distinct reveals. */
export const nextCardKey = (): number => nextKey++;
