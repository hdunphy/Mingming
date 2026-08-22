/**
 * THE BATTLE KEYBINDS, AS DATA — ticket 36.
 *
 * # WHY THIS FILE EXISTS
 *
 * Ticket 22 gave the fight a full keyboard path and an on-screen legend, and wrote the legend as a
 * **hardcoded string** in `CardHand` next to a handler that is a straight run of `if (e.key ...)`
 * statements in `BattleArena`. Two hand-written copies of one fact, and the comment above the
 * legend says why it was acceptable at the time: *"a fight has no options screen to hide a key list
 * behind"*. This ticket builds that screen, so there would have been a **third** copy. Three is the
 * point at which the drift stops being hypothetical.
 *
 * So the bindings are a table, and everything that displays or dispatches them reads it:
 *
 * - `CardHand`'s in-fight legend is generated from `KEYBINDS`.
 * - The settings screen renders the same table as rows.
 * - `BattleArena`'s handler compares against the exported key constants rather than literals.
 *
 * # WHAT THIS IS NOT
 *
 * **Not remapping.** The ticket says "keybind display (remap if cheap)", and remap is not cheap:
 * every binding would need a stored override, a conflict checker, a capture UI, and a way to say
 * what `Shift+W/E/R` means when `W` moved. What IS cheap is making the display honest and making a
 * future remap a data change rather than a rewrite — which is what this is. The settings screen says
 * "not remappable yet" in as many words rather than showing controls that do nothing.
 *
 * No React, no Redux — a plain table plus two helpers, so it can be tested directly.
 */

/** A row of the legend and of the settings table: what the keys are, and what they do. */
export interface Keybind {
    readonly id: string;
    /** As printed. `⇧` is the legend's existing shorthand for Shift, kept so nothing re-learns it. */
    readonly keys: string;
    /** Imperative, in the player's terms, short enough for a 0.5rem strip. */
    readonly action: string;
    /** One extra sentence, shown only in the settings screen where there is room for it. */
    readonly detail?: string;
}

// --- The key sets the handler compares against ---------------------------------------------------
//
// Exported one by one rather than dug out of `KEYBINDS` by id, because the handler needs them as
// arrays it can index: the position in the array IS the party slot, the enemy slot or the macro
// slot. A lookup by id returning "W/E/R" would have to be re-split to be useful.

/** Party slots 1-3: select as caster, or with Shift, as the (ally) target. */
export const CASTER_KEYS = ['w', 'e', 'r'] as const;
/** Enemy slots 1-3. */
export const ENEMY_KEYS = ['a', 's', 'd'] as const;
/** The three macro slots, the same three the rack draws. */
export const MACRO_KEYS = ['z', 'x', 'c'] as const;

export const CYCLE_KEY = 'Tab';
export const CAST_KEY = 'Enter';
export const END_TURN_KEY = ' ';
export const CLEAR_KEY = 'Escape';

/** Cards are `1`-`9`, positionally. Not a list, because the digit IS the index. */
export const CARD_KEY_MIN = '1';
export const CARD_KEY_MAX = '9';

/**
 * Every binding, in the order the legend prints them — which is roughly the order of a turn:
 * choose a card, choose who casts it, choose what it hits, commit, end.
 */
export const KEYBINDS: ReadonlyArray<Keybind> = [
    {
        id: 'card',
        keys: '1-9',
        action: 'Select card',
        detail: 'By position in the hand, left to right.',
    },
    {
        id: 'caster',
        keys: 'W/E/R',
        action: 'Select caster',
        detail: 'Your party, in the order it is drawn. The hand re-reads for whoever is selected.',
    },
    {
        id: 'ally',
        keys: '⇧W/E/R',
        action: 'Target ally',
        detail: 'Shift turns the same three keys into targeting, for heals and buffs.',
    },
    { id: 'enemy', keys: 'A/S/D', action: 'Target enemy', detail: 'By slot, whether or not it is alive.' },
    { id: 'cycle', keys: 'Tab', action: 'Cycle enemies', detail: 'Shift+Tab goes the other way. Skips the dead.' },
    {
        id: 'cast',
        keys: 'Enter',
        action: 'Cast',
        detail: 'Through the same validity check the mouse drop uses, so it can never play a card the game would refuse.',
    },
    { id: 'macro', keys: 'Z/X/C', action: 'Fire macro', detail: 'The three slots on the rack beside the hand.' },
    { id: 'endturn', keys: 'Space', action: 'End turn' },
    {
        id: 'clear',
        keys: 'Esc',
        action: 'Clear selection',
        detail: 'With nothing selected, Esc opens settings instead.',
    },
];

/**
 * The one-line legend printed under the hand.
 *
 * Uppercased and joined with the separator ticket 22 chose, so this renders the identical string it
 * used to hardcode — with `SPACE END` becoming `SPACE END TURN`, the one wording that got clearer
 * for being derived from the same row the settings screen shows.
 */
export function keybindLegend(binds: ReadonlyArray<Keybind> = KEYBINDS): string {
    return binds.map((bind) => `${bind.keys} ${bind.action}`).join(' · ').toUpperCase();
}
