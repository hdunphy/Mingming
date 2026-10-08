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
 *
 * RE-PINNED ON PURPOSE, TICKET 195a (a game change): Bark Smash deals 5 a point and Bark Smash+ 8, so fights 4, 13, 15
 * and 18 are played differently (4, 13 and 15 have a huldra_v2, whose kit holds Bark Smash). The other sixteen did not move.
 * RE-PINNED ON PURPOSE, TICKET 194 (two game rulings, found by taking the hashes on each commit):
 *   - 194a (an enemy Huldra v2 no longer shields before she acts): fights 4, 12, 13, 15, 18 and 19 have a
 *     huldra_v2 or a Rootfall/Emberfall boss that fields one. Fights 0, 9, 10, 14 and 16 did not move at 194a.
 *   - 194b (Ragnarok Edge loses its cap, Ragnarok Edge+ scales 1.5 per 1%): fights 0, 9, 10, 14 and 16 have
 *     a fenrir fighting past 50% missing HP. Fights 4, 12, 13, 15, 18 and 19 are unchanged by it.
 * No later 194 row moved any of the twenty.
 *
 * AFTER MERGING 195a AND 194 the list below is measured with both applied. It is 194's list with three fights moved
 * again by 195a (Bark Smash 5 a point, Bark Smash+ 8): 4 (06aceb8d -> 5bcf5e37), 12 (28926034 -> 71b31120) and
 * 15 (3a4b479b -> 7a0b1c1b). Fights 13 and 18 moved at 195a on its own, but with 194a in they match 194's values.
 *
 * RE-PINNED ON PURPOSE, TICKET 207 (Henry's authored gym teams, decks and Totems): every 2v2 against the Tidewrack
 * or Rootfall boss fields a new team under a moved Totem, so fights 11 (a257050a -> cc9585c9), 12 (71b31120 ->
 * 86fff187), 14 (aeb81c7b -> 4c7ac0cb), 15 (7a0b1c1b -> 509142eb), 17 (4ad363e0 -> b8f2bea2) and 18 (6c709cc6 ->
 * 7f0d8a8b) moved. The Emberfall fights (10, 13, 16, 19) did not: their first two members are unchanged.
 */
import { describe, it, expect } from 'vitest';
import { determinismFights, hashOfFight } from './aiDeterminismFights';

const EXPECTED: ReadonlyArray<string> = [
    '379cb0f9', '55457196', '112193f2', '899c7f5b', '5bcf5e37',
    '5781866a', 'c9c7121e', '8e7423ec', '94dea59d', '725bee70',
    '0362db14', 'cc9585c9', '86fff187', '734ec7a5', '4c7ac0cb',
    '509142eb', 'f4a902bf', 'b8f2bea2', '7f0d8a8b', '2135677b',
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
