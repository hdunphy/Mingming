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

import { CELLS, batchOptionsFor, sampleFight, sampleFightFor } from './runGate';
import { runBatch } from './runBatch';
import { buildScenarioState } from '../scenarios/buildScenarioState';
import { DRIVER_ROOT_ROT, getDriver } from '../../engine/data/driverRegistry';
import { FIRMWARE_REGISTRY } from '../../engine/data/firmwareRegistry';
import { handbuiltParty } from './handbuiltParties';
import { GYM_COUNTER_ANSWERS, GYM_SELECTIVE_ANSWERS } from '../../engine/run/marketplace';
import { applyRegistryTweaks, describeTweaks, tweakEnemyDeck, validateTweaks } from './experimentalTweaks';
import { AUTHORED_BOSSES } from '../../engine/run/bosses';
import { getDeckForOS } from '../../engine/data/mingmingRegistry';

const ROOT_KNOB = 'rootfall-rat-v2';

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

    it('`--tweak` threads, and does not perturb what a paired arm holds fixed', () => {
        /*
         * The live knob (`rootfall-rat-v2`) is applied process-wide before any fight is built, so
         * what `sampleFight` must guarantee is the NEGATIVE: passing the list changes nothing about
         * the seed, the roll or the deck. The seam is kept even when no knob reads it here, because
         * the threading guarantee was earned by a bug — `--toolbox` declared, parsed, banner-printed
         * and passed nowhere, measuring the bare arm for thirty battles — and deleting it would make
         * the next knob re-earn it from scratch.
         */
        const none = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false);
        const empty = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, []);

        expect(empty.setup.seed).toBe(none.setup.seed);
        expect(empty.enemy).toEqual(none.enemy);
        expect([...empty.setup.player.deck]).toEqual([...none.setup.player.deck]);
        expect(empty.setup.enemies.flatMap((e) => e.deck ?? []))
            .toEqual(none.setup.enemies.flatMap((e) => e.deck ?? []));
    });

    it('`--toolbox selective` buys the ruled TWO, not the basket', () => {
        // Ticket 75 ruling 1a. The whole diagnosis rests on these arms being distinguishable, and a
        // `selective` that quietly bought all three would read as "shopping policy is not the cause".
        const all = [...sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, 'all').setup.player.deck];
        const two = [...sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, 'selective').setup.player.deck];

        expect(two.length).toBe(baseline.length + GYM_SELECTIVE_ANSWERS[GYM].length);
        expect(two.length).toBeLessThan(all.length);
        for (const id of GYM_SELECTIVE_ANSWERS[GYM]) expect(two).toContain(id);
        // and the dropped one really is dropped
        for (const id of GYM_COUNTER_ANSWERS[GYM]) {
            if (!GYM_SELECTIVE_ANSWERS[GYM].includes(id)) expect(two, `${id} should not be bought`).not.toContain(id);
        }
    });

    it('`--toolbox card:<id>` buys exactly that one card', () => {
        // Ticket 75 ruling 1b: a reprice must be ruled on a card's own number, not the basket's.
        const one = [...sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, 'card:riptide').setup.player.deck];
        expect(one.length).toBe(baseline.length + 1);
        expect(one).toContain('riptide');
        expect(one).not.toContain('short_circuit');
    });

    it('`--deck` changes the deck and nothing else — ticket 77 Track A', () => {
        /*
         * The whole of ticket 77 rests on this option arriving. Every gym number in the project's
         * history was taken with the 18-card run-start deck; an arm that printed "DECK PROGRESSION:
         * full" and dealt the bare deck anyway would read as "kit completion is worth nothing",
         * which is the conclusion the ticket exists to test rather than assume.
         */
        const bare = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, [], undefined, 'bare');
        const full = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, [], undefined, 'full');
        const plus3 = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, [], undefined, 'engine-plus-3');
        const blanks = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, [], undefined, 'bare-plus-generics');

        const size = (f: typeof bare): number => f.setup.player.deck.length;
        expect(size(bare), 'the baseline is the 18-card run-start deck').toBe(18);
        expect(size(full), 'three full tuned lists, no generics').toBeGreaterThan(size(bare));
        expect(size(plus3), '3 members x (5 kit + 3) + 3 generics').toBe(27);
        expect(size(blanks), 'exactly the buy-everything toolbox arm size, with blanks').toBe(21);

        // A3 must be the SAME cards plus generics, or it is not a control for the toolbox arm.
        expect([...blanks.setup.player.deck].slice(0, 18)).toEqual([...bare.setup.player.deck]);
        expect([...blanks.setup.player.deck].slice(18)).toEqual(['water_slap', 'water_slap', 'water_slap']);

        // Nothing a paired arm holds fixed may move.
        for (const armed of [full, plus3, blanks]) {
            expect(armed.setup.seed).toBe(bare.setup.seed);
            expect(armed.enemy).toEqual(bare.enemy);
            expect(armed.lineup).toEqual(bare.lineup);
            expect(armed.nodeId).toBe(bare.nodeId);
        }
    });

    it('`--deck engine-plus-3` adds cards from the member\'s OWN tuned list', () => {
        // "the next three of its own tuned list" is the ticket's wording, and the arm is meaningless
        // if the extras come from anywhere else — it would be measuring a deck nobody could build.
        const f = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, [], undefined, 'engine-plus-3');
        const bare = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, [], undefined, 'bare');

        const tuned = new Set(f.lineup.flatMap((os) => getDeckForOS(os.replace(/_v\d+$/, ''), os)));
        const extras = [...f.setup.player.deck].filter((id) => id !== 'water_slap');
        for (const id of extras) {
            expect(tuned.has(id), `${id} is not in any member's tuned list`).toBe(true);
        }
        expect(f.setup.player.deck.length).toBeGreaterThan(bare.setup.player.deck.length);
    });

    it('`--lean` moves the PARTY and nothing else', () => {
        /*
         * Ticket 76 arm 3. The bracket is only worth having if the leaned arm pairs against the
         * unleaned one — same seed, same enemies, same node — so the lean must reach the lineup
         * picker and stop there.
         */
        const plain = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, [], undefined);
        const leaned = sampleFight(CELL, 0, 'favourable', undefined, GYM, undefined, false, [], 'Water');

        expect(leaned.lineup, 'the lean must actually change the party').not.toEqual(plain.lineup);
        expect(leaned.setup.seed).toBe(plain.setup.seed);
        expect(leaned.enemy).toEqual(plain.enemy);
        expect(leaned.nodeId).toBe(plain.nodeId);
        expect(leaned.enemyDrivers).toEqual(plain.enemyDrivers);
        expect(leaned.biomeElements).toEqual(plain.biomeElements);
        expect(leaned.targetElement, 'targetElement reports the GYM, which the lean does not move')
            .toBe(plain.targetElement);
    });
});

describe('the tweak mechanism rejects every retired knob by name', () => {
    /*
     * research/73's "Reproducing" block still prints these strings, and so does anyone's shell
     * history. Re-running one after it was ruled on must not quietly measure the baseline and get
     * filed as "the change did nothing" — each error names the ruling and where the answer went.
     */
    const RETIRED: ReadonlyArray<readonly [string, RegExp]> = [
        ['boss-cantrips', /RETIRED by ticket 74/],
        ['boss-cantrips-2', /RETIRED by ticket 74/],
        ['ink-power-12', /ink_stream stays at 33/],
        ['thorn-target', /COMMITTED by ticket 74/],
        ['thorn-power-25', /printed at 30 power/],
        ['thorn-power-30', /printed at 30 power/],
    ];

    for (const [name, message] of RETIRED) {
        it(`"${name}" throws, naming the ruling`, () => {
            expect(() => validateTweaks([name])).toThrow(message);
            // Every entry point, not just the validator — a knob that slipped past `describeTweaks`
            // would print a banner line for an arm that never ran.
            expect(() => describeTweaks([name])).toThrow();
            expect(() => applyRegistryTweaks([name])).toThrow();
        });
    }

    it('an unknown knob names the live ones rather than failing vaguely', () => {
        expect(() => validateTweaks(['nonsense'])).toThrow(/live knobs are "rootfall-rat-v2"/);
    });

    it('the empty list is accepted and does nothing', () => {
        expect(() => validateTweaks([])).not.toThrow();
        expect(applyRegistryTweaks([])).toEqual([]);
        expect(describeTweaks([])).toEqual([]);
    });

    it('`rootfall-rat-v2` swaps exactly one body of the authored trio', () => {
        /*
         * Ticket 76 arm 4. Snapshotted and restored because this mutates a process-global — without
         * that, every test after this one in the same worker would fight a Rootfall boss nobody
         * authored, which is the contamination this whole module exists to keep out of the tree.
         */
        const before = structuredClone(AUTHORED_BOSSES['gym_rootfall']);
        try {
            expect(applyRegistryTweaks([ROOT_KNOB])).toEqual([ROOT_KNOB]);

            const after = AUTHORED_BOSSES['gym_rootfall'];
            expect(after.members.map((m) => m.os))
                .toEqual(before.members.map((m) => (m.os === 'ratatoskr_v1' ? 'ratatoskr_v2' : m.os)));
            expect(after.members).toHaveLength(before.members.length);
            expect(after.members.map((m) => m.species), 'the SPECIES must not move — only the firmware')
                .toEqual(before.members.map((m) => m.species));
            expect(after.driver, 'ROOT ROT is a separate arm and must not ride along').toBe(before.driver);
        } finally {
            (AUTHORED_BOSSES as Record<string, typeof before>)['gym_rootfall'] = before;
        }
    });

    it('refuses if the trio no longer fields the body it means to swap', () => {
        const before = structuredClone(AUTHORED_BOSSES['gym_rootfall']);
        try {
            (AUTHORED_BOSSES as Record<string, typeof before>)['gym_rootfall'] = {
                ...before,
                members: before.members.map((m) => (m.os === 'ratatoskr_v1' ? { ...m, os: 'ratatoskr_v2' } : m)),
            };
            expect(() => applyRegistryTweaks([ROOT_KNOB])).toThrow(/no longer fields ratatoskr_v1/);
        } finally {
            (AUTHORED_BOSSES as Record<string, typeof before>)['gym_rootfall'] = before;
        }
    });

    it('`tweakEnemyDeck` returns the pile untouched', () => {
        const pile = ['undertow', 'ink_stream', 'serpents_coil'];
        expect(tweakEnemyDeck(pile, [])).toEqual(pile);
    });
});

/*
 * TICKET 77 TRACK B + C — three new flags, three threading cases, all through `sampleFightFor` /
 * `batchOptionsFor`: the two functions `measureCell` ACTUALLY calls. The cases above call
 * `sampleFight` by hand with the right arguments, which is a test of `sampleFight` and not of the
 * arm; the `--toolbox` bug lived precisely in the gap between the two. These close it for the new
 * flags, and each one was proven to FAIL with the threading line commented out (research/77 §B.0).
 */
describe('ticket 77: the player-side flags reach the fight through measureCell\'s own seams', () => {
    const ROOTFALL = 'gym_rootfall';
    const base = { iterations: 1, matchup: 'favourable' as const, gymId: ROOTFALL };

    it('`--player-driver` lands on setup.player.drivers, and on the built player entities', () => {
        const bare = sampleFightFor(CELL, 0, base);
        const armed = sampleFightFor(CELL, 0, { ...base, playerDriver: 'driver_antivenom' });

        expect([...bare.setup.player.drivers], 'the bare arm holds no Driver').toEqual([]);
        expect([...armed.setup.player.drivers]).toEqual(['driver_antivenom']);

        // Nothing a paired arm holds fixed may move.
        expect(armed.setup.seed).toBe(bare.setup.seed);
        expect(armed.enemy).toEqual(bare.enemy);
        expect(armed.lineup).toEqual(bare.lineup);
        expect([...armed.setup.player.deck]).toEqual([...bare.setup.player.deck]);
        expect(armed.enemyDrivers).toEqual(bare.enemyDrivers);

        // And the Driver is really ON the fighters, not merely on the setup — `createBattleState`
        // applies it through the same `applyDrivers` the game uses.
        const built = buildScenarioState({ ...armed.setup, seed: armed.setup.seed });
        for (const member of built.playerParty) {
            expect(member.hooks, `${member.id} did not receive the Driver's hook`).toContain('driver_antivenom_purge');
        }
        for (const enemy of built.enemyParty) {
            expect(enemy.hooks ?? []).not.toContain('driver_antivenom_purge');
        }
    });

    it('`--player-driver` with an unknown id throws rather than measuring the bare arm', () => {
        expect(() => sampleFightFor(CELL, 0, { ...base, playerDriver: 'driver_nonsense' })).toThrow(/unknown --player-driver/);
    });

    it('`--macros` hands runBatch a policy, and the policy fires on turn 1 of the boss fight', () => {
        const fight = sampleFightFor(CELL, 0, base);
        const bareOptions = batchOptionsFor(CELL, fight, base);
        const armedOptions = batchOptionsFor(CELL, fight, { ...base, macros: 'mixed' });

        expect(bareOptions.playerPolicy, 'the bare arm must carry NO policy').toBeUndefined();
        expect(armedOptions.playerPolicy).toBeDefined();
        expect(armedOptions.playerPolicy!.held).toEqual(['surge', 'cripple', 'mend']);

        // One turn of a real 3v3 is enough: rule 2 empties the rack before the first card. A
        // zero-fire result here would be the VOID arm ticket 77 says to STOP on. The search is
        // narrowed to its cheapest setting because the CARD AI's quality is not what is under test
        // — only that the policy is consulted and fires — and a full-lookahead turn is ~70 s.
        const batch = runBatch(fight.setup, { ...armedOptions, maxTurns: 1, aiBeam: 1, enemyAiTier: 'greedy' });
        const fired = batch.runs[0].macrosFired ?? [];
        expect(fired.length, 'the boss-turn-1 rule fires every held macro').toBe(3);
        expect(fired.map((f) => f.macroId).sort()).toEqual(['cripple', 'mend', 'surge']);
        for (const f of fired) {
            expect(f.turn).toBe(1);
            expect(['boss-turn-1', 'lethal']).toContain(f.rule);
        }
        expect(armedOptions.playerPolicy!.held, 'the rack is spent').toEqual([]);
    });

    it('`--macros` on a LEAD-IN cell builds a policy whose boss rule is off', () => {
        const fight0 = CELLS.find((c) => c.id === 'gauntlet:fight0')!;
        const fight = sampleFightFor(fight0, 0, base);
        const options = batchOptionsFor(fight0, fight, { ...base, macros: 'surge3' });
        expect(options.playerPolicy).toBeDefined();
        // Turn 1 of a lead-in: no lethal on a full-HP enemy from a 30-power Surge, no boss rule,
        // and surge3 holds no Mend — so the policy must yield to the card AI.
        const built = buildScenarioState({ ...fight.setup, seed: fight.setup.seed });
        expect(options.playerPolicy!.next(built)).toBeNull();
        expect(options.playerPolicy!.held).toHaveLength(3);
    });

    it('`--tweak root-rot-c1` reshapes the Driver the Rootfall boss actually fields', () => {
        const before = FIRMWARE_REGISTRY[DRIVER_ROOT_ROT];
        try {
            expect(applyRegistryTweaks(['root-rot-c1'])).toEqual(['root-rot-c1']);

            const fight = sampleFightFor(CELL, 0, base);
            expect(fight.enemyDrivers, 'Rootfall\'s boss still runs ROOT ROT by id').toEqual([DRIVER_ROOT_ROT]);

            const driver = getDriver(DRIVER_ROOT_ROT)!;
            expect(driver.hooks.map((h) => h.id)).toEqual(['driver_root_rot_c1_creep', 'driver_root_rot_c1_reset']);
            expect(driver.hooks.map((h) => h.id)).not.toContain('driver_root_rot_spread');

            const built = buildScenarioState({ ...fight.setup, seed: fight.setup.seed });
            for (const enemy of built.enemyParty) {
                expect(enemy.hooks).toContain('driver_root_rot_c1_creep');
                expect(enemy.hooks).not.toContain('driver_root_rot_spread');
            }
        } finally {
            FIRMWARE_REGISTRY[DRIVER_ROOT_ROT] = before;
        }
    });

    it('`--tweak root-rot-c2` is REFUSED — the target cannot be expressed', () => {
        expect(() => validateTweaks(['root-rot-c2'])).toThrow(/NOT BUILT/);
        expect(() => applyRegistryTweaks(['root-rot-c2'])).toThrow(/RANDOM_ENEMY may pick the context target/);
        expect(() => describeTweaks(['root-rot-c2'])).toThrow();
    });

    it('a ROOT ROT candidate refuses to stack on another', () => {
        const before = FIRMWARE_REGISTRY[DRIVER_ROOT_ROT];
        try {
            applyRegistryTweaks(['root-rot-c3']);
            expect(() => applyRegistryTweaks(['root-rot-c1'])).toThrow(/no longer carries driver_root_rot_spread/);
        } finally {
            FIRMWARE_REGISTRY[DRIVER_ROOT_ROT] = before;
        }
    });
});
