/**
 * TICKET 182a — one line of flavour per starter, eight words at most.
 *
 * The starter card already shows each firmware's rule (ticket 172). This is the one line that says
 * what the animal is like, so a player choosing by feel has something to feel. Wording is Henry's to
 * change; the length is tested (`MainMenuView.cut.test.tsx`).
 */
export const STARTER_FLAVOUR = {
    kraken: 'Patient depths, sudden storms.',
    fenrir: 'Chained fury that bites back.',
    ratatoskr: 'Quick little squirrel, quicker gossip.',
} as const;
