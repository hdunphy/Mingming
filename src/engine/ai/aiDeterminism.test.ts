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
 *
 * RE-PINNED ON PURPOSE, TICKET 185 (a game change, not a refactor):
 *   - 185a (only Attack cards feed UNBOUND_KERNEL): fights 0, 9, 10 and 14 have a fenrir_v1 in them,
 *     and a Skill that used to feed it no longer does.
 *   - 185b (Sköll's TREACHERY fires only on real HP loss): fights 2 and 7 have a skoll_v1 in them.
 * Nothing else moved: 185c (Sun Devourer) and 185d (Core Overclock) touch no card these fights play.
 */
import { describe, it, expect } from 'vitest';
import { determinismFights, hashOfFight } from './aiDeterminismFights';

const EXPECTED: ReadonlyArray<string> = [
    'a5afe12b', '55457196', '112193f2', '899c7f5b', '3cecc5b0',
    '5781866a', 'c9c7121e', '8e7423ec', '94dea59d', 'c82ee87b',
    'c1a2bbe6', 'a257050a', '6e46de2c', '4cdecdef', 'dea86e21',
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
