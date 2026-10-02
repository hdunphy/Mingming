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

/**
 * TICKET 171c — **the name of a flat power bonus, by what it reads.**
 *
 * The preview chip for bonus power used to print "+N SHARP" for EVERY power scaling, because Sharp
 * was the first one. Henry, 2026-09-29 playtest: *"I had a hover over preview say +30 sharp, but no
 * sharp was added, it was a damage ability, Flashover."* Flashover is +15 power per Burn on the
 * target, so 2 Burn read "+30 SHARP". The number was right; the word was not.
 *
 * Each entry names the thing the bonus counts, so the chip explains its own number. A scaling this
 * table does not know reads "POWER" rather than borrowing another's name.
 */
export const POWER_BONUS_LABEL: Record<string, string> = {
    SHARP_STACKS: 'SHARP',
    STRENGTH_STACKS: 'STRENGTH',
    DAZED_STACKS: 'DAZED',
    DISTINCT_STATUS: 'DEBUFFS',
    ANY_STATUS: 'STATUSES',
    SELF_ANY_STATUS: 'OWN STATUSES',
    BARKSHIELD_STACKS: 'BARK SHIELD',
    MISSING_HP: 'MISSING HP',
};

/**
 * The words after "+N" on the bonus chip. A target-status scaler names the status and how many
 * stacks it is reading ("· 2 BURN"), because the count on the target is the whole reason the
 * number moves from one target to the next.
 */
export function powerBonusLabel(scaling: string | undefined, scalingStatus?: string, targetStacks = 0): string {
    if (scaling === 'TARGET_STATUS_STACKS' && scalingStatus) {
        return `· ${Math.floor(targetStacks)} ${scalingStatus.toUpperCase()}`;
    }
    return POWER_BONUS_LABEL[scaling ?? ''] ?? 'POWER';
}
