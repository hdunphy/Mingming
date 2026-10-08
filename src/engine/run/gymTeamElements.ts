/**
 * TICKET 202j - WHAT TO EXPECT AT THE GYM, said from the map.
 *
 * Henry, 2026-10-07: *"We do need somewhere visible what to expect at the gym. Maybe the gym has the
 * element icons visible below it on the map so you can see its going to be WWN for example."*
 *
 * This is the data half: the leader's team as ELEMENTS, in `gymCompElementPlan` order, and the
 * sentence the hover reads. It shows types and never species (the "types visible, contents hidden"
 * rule), and it changes nothing about how encounters are made: it only reads the plan the approach
 * and the gauntlet already read, so the map and the fight cannot disagree.
 *
 * The off-type body is the gym's own design and stays. Showing it at every party size on the
 * approach was vetoed (2026-10-07): the 2026-09-11 rule stands, and this module does not touch it.
 */

import { GYM_REGISTRY, gymCompElementPlan } from './gyms';

/** The leader's team, one element per body, in plan order. Empty for a gym id nobody knows. */
export function gymTeamElements(gymId: string): ReadonlyArray<string> {
    const gym = GYM_REGISTRY[gymId];
    return gym ? gymCompElementPlan(gym) : [];
}

const COUNT_WORDS: ReadonlyArray<string> = [
    'none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
];

/** A count in words; past ten, the digits. */
const countWord = (count: number): string => COUNT_WORDS[count] ?? String(count);

/**
 * "The leader fields three: two Nature, one Water." Groups come in the order each element first
 * appears in the plan. An empty team says nothing.
 */
export function gymTeamSentence(elements: ReadonlyArray<string>): string {
    if (elements.length === 0) return '';
    const counts = new Map<string, number>();
    for (const element of elements) counts.set(element, (counts.get(element) ?? 0) + 1);
    const groups = [...counts].map(([element, count]) => `${countWord(count)} ${element}`);
    return `The leader fields ${countWord(elements.length)}: ${groups.join(', ')}.`;
}

/** The elements one by one in plan order ("Nature, Nature, Water"), for the playtest tool's line. */
export function gymTeamWords(elements: ReadonlyArray<string>): string {
    return elements.join(', ');
}
