/**
 * TICKET 177a — THE SHIPPED AI PLAYS EXACTLY AS IT DID.
 *
 * Twenty fixed fights, both sides on `full`, each reduced to a short hash of the whole result. The
 * expected hashes below were computed on the parent commit BEFORE the enumeration was moved into
 * `legalActions.ts`; a refactor that changes any decision in any of these fights changes a hash.
 *
 * If a LATER ticket changes the AI on purpose (an eval retune, a new status price), these hashes
 * move, and the right response is to say so in that ticket and re-pin them — not to loosen this.
 *
 * The fights are named in `aiDeterminismFights.ts`. 10 × 1v1 and 10 × 2v2 against gym-boss members
 * run in a few seconds; the real-size 3v3 set is too slow for a gate and was checked by hand.
 */
import { describe, it, expect } from 'vitest';
import { determinismFights, hashOfFight } from './aiDeterminismFights';

const EXPECTED: ReadonlyArray<string> = [
    '4250cca4', '55457196', 'fbc0942a', '899c7f5b', '3cecc5b0',
    '5781866a', 'c9c7121e', '8239b8e9', '94dea59d', '306eb1fb',
    '92686876', 'a257050a', '6e46de2c', '4cdecdef', 'bd34728e',
    'f3e7ce8c', 'ba65bd3c', '4ad363e0', 'a26679b1', 'ce42103a',
];

describe('177a — the AI is byte-identical on twenty fixed fights', () => {
    const fights = determinismFights();

    it('names twenty fights', () => {
        expect(fights).toHaveLength(20);
        expect(EXPECTED).toHaveLength(20);
    });

    it.each(fights.map((fight, i) => [i, fight.name] as const))('fight %i: %s', (i) => {
        expect(hashOfFight(fights[i])).toBe(EXPECTED[i]);
    }, 60_000);
});
