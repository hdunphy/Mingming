/**
 * EXPERIMENTAL TWEAKS — one named knob, applied for the length of a measurement, never committed.
 *
 * **ONE LIVE KNOB: `rootfall-rat-v2`** (ticket 76 arm 4). Every other knob this module has carried
 * was ruled on and DELETED, and re-running one now throws with the ruling that retired it. That is
 * the module working, not the module rotting — read on before adding one.
 *
 * # WHY THIS EXISTS RATHER THAN EDITING `programs.json`
 *
 * A card edited in `programs.json` is SHIPPED: it moves the pin tests, the start kits, the market,
 * every other arm's baseline and anything anyone measures afterwards. Candidate printings edited in
 * and out of that file across a two-hour run is how a tree ends up carrying a knob nobody ruled on.
 *
 * So a candidate lives here, off by default, named on the command line, and printed in the report
 * banner under a NOT-A-BASELINE header. When Henry rules, the printing moves into `programs.json`
 * and the knob is deleted from this file.
 *
 * # A RULED KNOB IS A DELETED KNOB, AND THE DELETION IS LOUD
 *
 * A retired knob is not left switched off "in case". It is removed, and `validateTweaks` grows a
 * case that THROWS with the ruling that retired it.
 *
 * The reason is specific rather than tidy-minded. Retired knob names survive in committed research
 * docs — `research/73-the-tidewrack-nerf-arms.md` §6 still prints the command lines that used them —
 * and in shell history. A flag that parses, prints a banner naming a nerf, and changes nothing
 * produces a report describing an arm that was never run, and it reads as *"the nerf did nothing"*:
 * the most expensive wrong conclusion this harness can manufacture. That exact bug cost a
 * ninety-minute run once already (`--toolbox`, threaded nowhere, caught only because paired seeds
 * came back byte-identical). The throw is the cheap version of that lesson.
 *
 * # THE RETIREMENTS, AND WHAT REPLACED EACH
 *
 *  - **`boss-cantrips`, `boss-cantrips-<N>`, `ink-power-<N>`** — ticket 74. They measured Tidewrack's
 *    OLD composition. The ruling took the composition route instead (`kraken_v1` → `kraken_v2`,
 *    removing the second draw engine), so the pile no longer holds what they claimed to remove, and
 *    `ink_stream` stays at 33. research/73 §7.
 *  - **`thorn-target`** — ticket 74. Graduated into the printing: `thorn_tithe` applies its 3
 *    Weakened to the TARGET.
 *  - **`thorn-power-<N>`** — ticket 74 follow-up, Henry 2026-08-31: *"thorn_tithe should be 30 with 3
 *    weakened to the enemy"*. The reprice arm did its job and the answer is printed. `thorn_tithe`
 *    is 1 energy, 30 power, 3 Weakened on the target — measured at that exact printing (75.0%,
 *    p = 1.00 paired against 40, i.e. free), which is the happy case for a knob: the card shipped
 *    was the card measured.
 *
 * # WHY THE SEAM SURVIVES WITH ZERO KNOBS
 *
 * `sampleFight` still threads one `tweaks` parameter and `optionsThreading.test.ts` still asserts
 * over it. That is deliberate: the threading guarantee was earned by a bug, and deleting the seam
 * would make the next knob re-earn it from scratch. The live logic here is a few lines; the rest is
 * the record of what was ruled and where the answer went, which is the part that stops a future
 * session re-running a retired flag and believing the result.
 *
 * # MECHANICS, FOR WHOEVER ADDS THE NEXT KNOB
 *
 * `applyRegistryTweaks` MUTATES `ProgramRegistry` in place, once, at script start. That is a
 * process-global change and it is why this module is `src/debug` and why the caller prints a banner.
 * It is safe only because `GetProgramData` reads the registry live on every call — but
 * `getInflatedProgramRegistry` memoises, so it must run BEFORE any battle, party or run is built.
 *
 * Replace a card as a WHOLE registry entry rather than mutating its fields: `ProgramData`'s fields
 * are readonly under `tsconfig.app.json` (the strict config the gate runs, and the one that catches
 * this — the default config does not). The registry's VALUES are writable, which is the single seam
 * this module needs and the reason it exists without loosening the card type for everyone else.
 */

import { AUTHORED_BOSSES, type IAuthoredBoss } from '../../engine/run/bosses';

/**
 * `rootfall-rat-v2` — ticket 76 arm 4, the one comp-swap candidate.
 *
 * Rootfall's authored trio is `huldra_v2 + ratatoskr_v1 + jormungandr_v2` under ROOT ROT. The
 * ticket proposes swapping `ratatoskr_v1` for `ratatoskr_v2` — trading the sustain body for tempo —
 * *"so the session starts with a comp datum the way Tidewrack's did"*.
 *
 * It is a KNOB rather than an edit because ticket 76 is explicit: **no lever moves before Henry's
 * session**, and he may substitute a different candidate when it is held. Ticket 74's comp swap was
 * an edit because it had already been ruled; this one has not been.
 *
 * Mutates `AUTHORED_BOSSES` rather than the program registry, so it needs its own cast: the table is
 * `Readonly<Record<...>>` for every real consumer and this is the one place that is allowed to write
 * to it. Same discipline as the registry knobs — process-global, applied once at script start,
 * announced in the banner, never committed.
 */
const ROOTFALL_RAT_V2 = 'rootfall-rat-v2';

/** Knobs that once existed, and the one-line reason each is gone. Drives the loud rejection. */
const RETIRED: ReadonlyArray<{ readonly matches: (name: string) => boolean; readonly why: string }> = [
    {
        matches: (n) => n === 'boss-cantrips' || /^boss-cantrips-\d+$/.test(n),
        why: 'RETIRED by ticket 74. It measured Tidewrack\'s old composition (kraken_v1, the second '
            + 'draw engine); the ruling swapped it for kraken_v2 instead, so the pile no longer holds '
            + 'the cantrips it removed. See research/73 §7.',
    },
    {
        matches: (n) => /^ink-power-\d+$/.test(n),
        why: 'RETIRED by ticket 74 ruling 2: ink_stream stays at 33, question CLOSED. Printed power '
            + 'measured as a weak lever on this fight (+13.3pt, p = 0.22). See research/73 §3.',
    },
    {
        matches: (n) => n === 'thorn-target',
        why: 'COMMITTED by ticket 74 — thorn_tithe applies its 3 Weakened to the TARGET in '
            + 'programs.json. Drop the flag; the baseline IS the fix.',
    },
    {
        matches: (n) => /^thorn-power-\d+$/.test(n),
        why: 'COMMITTED by ticket 74 follow-up — thorn_tithe is printed at 30 power. The reprice arm '
            + 'measured 30 as free (75.0%, p = 1.00 paired against 40). See research/73 §7.4.',
    },
];

export type TweakName = string;

/**
 * Rejects an unknown or RETIRED knob loudly instead of silently measuring the baseline twice.
 *
 * Three outcomes: a live knob passes, a RETIRED one throws naming the ruling that retired it, and
 * anything else throws as unknown. The retired case matters most — those names are still printed in
 * committed research docs and shell history.
 */
export function validateTweaks(names: ReadonlyArray<string>): void {
    for (const name of names) {
        const retired = RETIRED.find((entry) => entry.matches(name));
        if (retired) throw new Error(`[tweaks] "${name}" ${retired.why}`);
        if (name === ROOTFALL_RAT_V2) continue;
        throw new Error(
            `[tweaks] unknown tweak "${name}". The only live knob is "${ROOTFALL_RAT_V2}" `
            + '(ticket 76 arm 4). Everything else this module carried has been ruled on and printed.',
        );
    }
}

/** One line per knob for the report banner — a tweaked number must never be pasted as a baseline. */
export function describeTweaks(names: ReadonlyArray<string>): ReadonlyArray<string> {
    validateTweaks(names);
    return names.map((name) => (name === ROOTFALL_RAT_V2
        ? `${ROOTFALL_RAT_V2}: Rootfall's trio fields ratatoskr_v2 in place of ratatoskr_v1 `
          + '(candidate only — ticket 76 moves no lever before Henry\'s session)'
        : name));
}

/**
 * Applies the registry-level knobs. Call ONCE, before anything is built.
 *
 * Returns the knobs it actually applied, so a caller can assert it did something. With no live
 * knobs it validates (which throws on any input) and returns empty.
 */
export function applyRegistryTweaks(names: ReadonlyArray<string>): ReadonlyArray<string> {
    validateTweaks(names);
    const applied: string[] = [];

    for (const name of names) {
        if (name !== ROOTFALL_RAT_V2) continue;

        const gym = AUTHORED_BOSSES['gym_rootfall'];
        if (gym === undefined) throw new Error('[tweaks] gym_rootfall has no authored boss');

        const slot = gym.members.findIndex((m) => m.os === 'ratatoskr_v1');
        if (slot < 0) {
            // The trio changed under the knob — measuring it now would describe the wrong experiment.
            throw new Error(
                '[tweaks] Rootfall no longer fields ratatoskr_v1, so `rootfall-rat-v2` has nothing to '
                + 'swap. The candidate is stale; re-read ticket 76 before running this arm.',
            );
        }

        const members = gym.members.map((m, i) => (i === slot ? { ...m, os: 'ratatoskr_v2' } : m));
        (AUTHORED_BOSSES as Record<string, IAuthoredBoss>)['gym_rootfall'] = { ...gym, members };
        applied.push(name);
    }

    return applied;
}

/**
 * The enemy-pile knob. Pure; applied per fight, after the encounter roll.
 *
 * No knob currently edits the pile. Kept as the seam rather than deleted — see the header.
 */
export function tweakEnemyDeck(
    deck: ReadonlyArray<string>,
    _names: ReadonlyArray<string>,
): ReadonlyArray<string> {
    return deck;
}
