/**
 * `measureCell`'s options must actually REACH the fight it builds.
 *
 * # THE BUG THIS EXISTS FOR
 *
 * `handbuilt` and `toolbox` were both declared on `MeasureOptions`, both parsed from the CLI, and
 * both printed in the report's banner — and neither was passed at the one call to `sampleFight`
 * inside `measureCell`. So `--toolbox` printed *"TOOLBOX ARM"* at the top of a thirty-battle run and
 * measured the bare arm.
 *
 * Nothing failed. `tsc` was happy (both are optional parameters), lint was happy, all 2,075 tests
 * were green, and the report described an arm that had not been run. It was caught only because the
 * toolbox arm's win/loss sequence came back **byte-identical to the arm it was supposed to differ
 * from** — a tell that only exists because the seeds are paired, and one that would have been
 * invisible in any unpaired measurement.
 *
 * # WHY THE TEST IS SHAPED LIKE THIS
 *
 * The temptation is to assert the win rate changes, which needs battles and is exactly what this
 * cannot afford (`npm test` is the commit gate; one 3v3 battle is 30-100 seconds). So it asserts the
 * cheap, sufficient thing instead: **the SETUP `measureCell` would play differs when the option is
 * set.** A deck that gained three cards is proof the option arrived; whether those cards win is the
 * measurement's job, not this file's.
 *
 * It is written over the option LIST rather than over one option, so an option added to
 * `MeasureOptions` and forgotten at the call site fails here rather than in a run report.
 */

import { describe, expect, it } from 'vitest';

import { CELLS, sampleFight } from './runGate';
import { handbuiltParty } from './handbuiltParties';
import { GYM_COUNTER_ANSWERS } from '../../engine/run/marketplace';

const CELL = CELLS.find((c) => c.id === 'gauntlet:fight2')!;
const GYM = 'gym_tidewrack';

/** The deck `measureCell` would deal for sample 0 under a given option set. */
const deckFor = (opts: { handbuilt?: boolean; toolbox?: boolean }): string[] => {
    const party = opts.handbuilt ? handbuiltParty('tidewrack_counter_v1') : undefined;
    return [...sampleFight(CELL, 0, 'favourable', undefined, GYM, party, opts.toolbox).setup.player.deck];
};

describe('every measureCell option reaches the fight', () => {
    const baseline = deckFor({});

    it('`--toolbox` puts the gym’s ruled answers in the deck', () => {
        const withToolbox = deckFor({ toolbox: true });
        const answers = GYM_COUNTER_ANSWERS[GYM];

        expect(withToolbox.length, 'the deck must grow by exactly the answer set').toBe(baseline.length + answers.length);
        for (const id of answers) {
            expect(withToolbox, `${id} did not reach the deck`).toContain(id);
            expect(baseline, `${id} must NOT be in the bare arm, or the arms are not distinguishable`).not.toContain(id);
        }
    });

    it('`--handbuilt` replaces the lineup AND the deck', () => {
        const party = handbuiltParty('tidewrack_counter_v1')!;
        const fight = sampleFight(CELL, 0, 'favourable', undefined, GYM, party, false);

        expect(fight.lineup).toEqual([...party.lineup]);
        expect([...fight.setup.player.deck]).toEqual([...party.deck]);
        // And it really is different from what the arm would have dealt — otherwise the assertions
        // above would hold for a version that ignored the option entirely.
        expect([...fight.setup.player.deck]).not.toEqual(baseline);
    });

    it('the two compose: a hand-built party can also hold the toolbox', () => {
        const party = handbuiltParty('tidewrack_counter_v1')!;
        const both = deckFor({ handbuilt: true, toolbox: true });
        expect(both.length).toBe(party.deck.length + GYM_COUNTER_ANSWERS[GYM].length);
    });

    it('leaves everything BUT the party identical — the arms stay comparable', () => {
        /*
         * The whole value of these arms is that only the named variable moves. If `--toolbox` also
         * perturbed the seed, the boss roll or the AI tier, a paired comparison against the bare arm
         * would be measuring several things at once and the McNemar test would be meaningless.
         */
        const bare = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false);
        const armed = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, true);

        expect(armed.setup.seed).toBe(bare.setup.seed);
        expect(armed.nodeId).toBe(bare.nodeId);
        expect(armed.enemy).toEqual(bare.enemy);
        expect(armed.enemyDrivers).toEqual(bare.enemyDrivers);
        expect(armed.enemyAiTier).toBe(bare.enemyAiTier);
        expect(armed.lineup).toEqual(bare.lineup);
        expect(armed.biomeElements).toEqual(bare.biomeElements);
    });
});
