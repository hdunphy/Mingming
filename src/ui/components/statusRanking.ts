/**
 * WHICH STATUSES A SURFACE SHOWS — split out of `StatusBadges` in ticket 183b so the plaque's chip
 * row and the HUD card's badge row rank and cut by the same rule.
 *
 * A plain `.ts` file: `react-refresh/only-export-components` allows a constant beside a component
 * but not a function, and two components now call this.
 */

/**
 * The badges a surface shows, deepest pile first, and the ones it hides.
 *
 * Sorted by STACKS rather than by application order. That matters only past the budget — but that
 * is exactly where it matters: `Dazed x7`, the number a player is deciding a `slander` on, must not
 * be the one that fell off the end. Ties keep their original order (`Array.sort` is stable), so a
 * board of 1-stack statuses does not shuffle itself every turn.
 */
export function visibleStatuses<T extends { stacks: number }>(
    all: ReadonlyArray<T>,
    budget: number,
    chipCostsSlot: boolean,
): { shown: T[]; hidden: T[] } {
    const ranked = [...all].sort((a, b) => b.stacks - a.stacks);
    if (ranked.length <= budget) return { shown: ranked, hidden: [] };
    // WHETHER THE CHIP COSTS A SLOT IS PER SURFACE, because it is a width question and the two
    // surfaces are different widths. On the HUD card's 195px row six badges are 185px and fit, but
    // six plus an 18px chip are 203px and do not — so it drops to five. The plaque's four are 118px
    // of its 152px, which leaves room for the chip beside them. Passing this rather than assuming
    // it is what stops one surface's arithmetic quietly governing the other.
    const room = chipCostsSlot ? budget - 1 : budget;
    return { shown: ranked.slice(0, room), hidden: ranked.slice(room) };
}

