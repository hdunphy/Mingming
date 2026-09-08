/**
 * The human label for each post-damage scaling, as the preview chip prints it.
 *
 * Its own module since ticket 145b's second pass, because the preview is rendered by BOTH the stage
 * plaque and the HUD card now and a second copy of this table is how one surface ends up reading
 * "SCALING" while the other reads "CARDS PLAYED". Ticket 90 added it for the reason the entries
 * spell out: a `stampede` chip reading "x4 CARDS PLAYED" explains its own number, and before that
 * the preview silently showed the card's printed power.
 */
export const SCALING_LABEL: Record<string, string> = {
    CARDS_PLAYED: 'CARDS PLAYED',
    CARDS_DRAWN: 'CARDS DRAWN',
    CARDS_DRAWN_TRIGGERED: 'TRIGGERED DRAWS',
    CARDS_DISCARDED: 'CARDS DISCARDED',
    ENERGY_SPENT: 'ENERGY SPENT',
    ENERGY_SPENT_SQUARED: 'ENERGY SPENT²',
    ELEMENT_PLAYED: 'ELEMENT PLAYS',
    STATUS_COUNT: 'TARGET STATUSES',
    BURN_TIMES_ENERGY: 'BURN × ENERGY',
};
