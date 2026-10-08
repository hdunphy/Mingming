/**
 * TICKET 202j - what the gym's team looks like from the map: its elements in plan order, and the
 * sentence the hover reads. Types only, never species.
 */
import { describe, expect, it } from 'vitest';

import { GYM_REGISTRY, gymCompElementPlan } from './gyms';
import { gymTeamElements, gymTeamSentence, gymTeamWords } from './gymTeamElements';

/** The three gyms in plan order, as ruled (Rootfall 2026-09-11; the other two from the authored teams). */
const EXPECTED: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
    ['gym_rootfall', ['Nature', 'Nature', 'Water']],
    ['gym_emberfall', ['Fire', 'Fire', 'Nature']],
    ['gym_tidewrack', ['Water', 'Water', 'Fire']],
];

describe('202j - gymTeamElements', () => {
    it.each(EXPECTED)('%s fields its plan, in plan order', (gymId, expected) => {
        expect(gymTeamElements(gymId)).toEqual(expected);
        expect(gymTeamElements(gymId)).toEqual(gymCompElementPlan(GYM_REGISTRY[gymId]));
    });

    it('is empty for a gym nobody knows', () => {
        expect(gymTeamElements('gym_nowhere')).toEqual([]);
    });
});

describe('202j - gymTeamSentence', () => {
    it('reads two of one element and one of another as "two Nature, one Water"', () => {
        expect(gymTeamSentence(['Nature', 'Nature', 'Water'])).toBe('The leader fields three: two Nature, one Water.');
    });

    it('reads three of one element as "three Fire"', () => {
        expect(gymTeamSentence(['Fire', 'Fire', 'Fire'])).toBe('The leader fields three: three Fire.');
    });

    it('follows the plan: groups come in the order each element first appears', () => {
        expect(gymTeamSentence(['Water', 'Nature', 'Water'])).toBe('The leader fields three: two Water, one Nature.');
        expect(gymTeamSentence(['Fire', 'Water', 'Nature'])).toBe('The leader fields three: one Fire, one Water, one Nature.');
    });

    it('builds the sentence for every gym from its data', () => {
        expect(gymTeamSentence(gymTeamElements('gym_emberfall'))).toBe('The leader fields three: two Fire, one Nature.');
        expect(gymTeamSentence(gymTeamElements('gym_tidewrack'))).toBe('The leader fields three: two Water, one Fire.');
    });

    it('says nothing for an empty team', () => {
        expect(gymTeamSentence([])).toBe('');
    });
});

describe('202j - gymTeamWords', () => {
    it('lists the elements one by one in plan order, for the tool', () => {
        expect(gymTeamWords(['Nature', 'Nature', 'Water'])).toBe('Nature, Nature, Water');
    });
});
