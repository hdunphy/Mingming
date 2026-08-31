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
import { applyRegistryTweaks, validateTweaks } from './experimentalTweaks';
import { ProgramRegistry } from '../../engine/data/programRegistry';

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
        const declared = party.deck!; // this fixture declares one; `deck` is optional on the type
        const fight = sampleFight(CELL, 0, 'favourable', undefined, GYM, party, false);

        expect(fight.lineup).toEqual([...party.lineup]);
        expect([...fight.setup.player.deck]).toEqual([...declared]);
        // And it really is different from what the arm would have dealt — otherwise the assertions
        // above would hold for a version that ignored the option entirely.
        expect([...fight.setup.player.deck]).not.toEqual(baseline);
    });

    it('the two compose: a hand-built party can also hold the toolbox', () => {
        const party = handbuiltParty('tidewrack_counter_v1')!;
        const both = deckFor({ handbuilt: true, toolbox: true });
        expect(both.length).toBe(party.deck!.length + GYM_COUNTER_ANSWERS[GYM].length);
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

    it('`--tweak` reaches the fight, and moves nothing else', () => {
        /*
         * The tweak knobs are the most dangerous thing on `MeasureOptions` to lose at the call site:
         * unlike `--toolbox`, a dropped tweak produces a report whose banner names a change, whose
         * numbers are the baseline's, and which reads as "the change did nothing" — the most
         * expensive wrong conclusion available in this whole exercise.
         *
         * No knob currently edits the enemy pile (ticket 74 retired `boss-cantrips`), so the seam is
         * asserted on the LIVE knob instead: `thorn-power` is registry-level, and what this proves is
         * that passing tweaks does not perturb any of the quantities a paired arm holds fixed.
         */
        const bare = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, []);
        const tweaked = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, ['thorn-power-25']);

        expect(tweaked.setup.seed).toBe(bare.setup.seed);
        expect(tweaked.enemy).toEqual(bare.enemy);
        expect(tweaked.enemyDrivers).toEqual(bare.enemyDrivers);
        expect(tweaked.lineup).toEqual(bare.lineup);
        expect([...tweaked.setup.player.deck]).toEqual([...bare.setup.player.deck]);
        expect(tweaked.setup.enemies.flatMap((e) => e.deck ?? []))
            .toEqual(bare.setup.enemies.flatMap((e) => e.deck ?? []));
    });
});

describe('the experimental tweak knobs do what their names say', () => {
    it('rejects a misspelled knob rather than measuring the baseline twice', () => {
        expect(() => validateTweaks(['thorn-power'])).toThrow(/unknown tweak/);
        expect(() => validateTweaks(['thorn_power_25'])).toThrow(/unknown tweak/);
        expect(() => validateTweaks(['thorn-power-25', 'thorn-power-30'])).not.toThrow();
    });

    it('names a RETIRED knob as retired, so a stale command line is not read as a null result', () => {
        /*
         * research/73's "Reproducing" block still prints these strings, and so does anyone's shell
         * history. Re-running one after ticket 74 must not quietly measure the baseline and be filed
         * as "the nerf did nothing" — the error says the lever was ruled on and where the answer went.
         */
        for (const retired of ['boss-cantrips', 'boss-cantrips-2', 'ink-power-12']) {
            expect(() => validateTweaks([retired]), retired).toThrow(/RETIRED by ticket 74/);
        }
        expect(() => validateTweaks(['thorn-target'])).toThrow(/COMMITTED as of ticket 74/);
    });

    it('`thorn-power` reprices the committed card and leaves the transfer alone', () => {
        /*
         * `applyRegistryTweaks` mutates a process-global, so this test SNAPSHOTS the card and puts it
         * back. Without that, every test that runs after this one in the same worker would be
         * measuring a card nobody printed — which is exactly the contamination the whole module
         * exists to keep out of `programs.json`.
         */
        const thorn = structuredClone(ProgramRegistry['thorn_tithe']);

        try {
            expect(applyRegistryTweaks(['thorn-power-25'])).toEqual(['thorn-power-25']);

            const card = ProgramRegistry['thorn_tithe'];
            expect(card.actions?.find((a) => a.type === 'ATTACK')?.power).toBe(25);

            const status = card.actions?.find((a) => a.type === 'STATUS');
            expect(status?.target, 'the reprice must NOT disturb the committed transfer').toBe('TARGET');
            expect(status?.stacks, 'the arm prices the 3 stacks, it does not change them').toBe(3);
            expect(card.description, 'a repriced card whose text says 40 is a report that lies').toBe('25 power. Apply 3 Weakened.');
        } finally {
            ProgramRegistry['thorn_tithe'] = thorn;
        }
    });

    it('refuses to reprice if the committed transfer is ever reverted', () => {
        // Otherwise the arm silently prices a SELF-debuff card while the report says it priced the
        // transfer — the same class of lie as a flag that parses and does nothing.
        const thorn = structuredClone(ProgramRegistry['thorn_tithe']);
        try {
            ProgramRegistry['thorn_tithe'] = {
                ...thorn,
                actions: thorn.actions?.map((a) => (a.type === 'STATUS' ? { ...a, target: 'SELF' as const } : a)),
            };
            expect(() => applyRegistryTweaks(['thorn-power-25'])).toThrow(/no longer applies its Weakened to the TARGET/);
        } finally {
            ProgramRegistry['thorn_tithe'] = thorn;
        }
    });
});
