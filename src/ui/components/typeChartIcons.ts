/**
 * TICKET 205 - the two icons on the type chart: the DNA on the button that opens it, and the mark in
 * front of the STAB footer.
 *
 * The footer's old symbol was a bolt. The bolt means ENERGY and nothing else (ticket 200, ruled), and
 * the same-element bonus is not energy, so the footer draws a circled plus: a bonus. A pick Henry
 * dislikes is a one-word change plus `npm run icons`.
 */

import type { TablerOutlineName } from '../theme/tabler.generated';

export const TYPE_CHART_ICON: Readonly<Record<'toggle' | 'stab', TablerOutlineName>> = {
    toggle: 'dna',
    stab: 'circle-plus',
};
