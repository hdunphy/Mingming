/**
 * TICKET 190c — WHICH CARDS DASH ALL THE WAY IN. Henry (2026-10-02, *"Yes good call"*): a hit that is
 * a body blow rather than a thrown element is a contact hit, so the attacker runs to the target and
 * hits it. That is every single-target Attack card with element None: `tackle`, `tackle+`,
 * `zealots_edge`, `genesis_surge`, `feedback_token` and the enemy `baseline_*` cards.
 *
 * Henry can exempt any card by putting its id in `CONTACT_EXEMPT`; it then lunges and fires like any
 * other card.
 */

export const CONTACT_EXEMPT: ReadonlySet<string> = new Set<string>();

/** The four facts about a card that decide it. */
export interface ContactCandidate {
    readonly id: string;
    readonly category: string;
    readonly target: string;
    readonly element: string;
}

export function isContactCard(card: ContactCandidate, exempt: ReadonlySet<string> = CONTACT_EXEMPT): boolean {
    if (exempt.has(card.id)) return false;
    return card.category === 'Attack' && card.target === 'Single' && card.element === 'None';
}
