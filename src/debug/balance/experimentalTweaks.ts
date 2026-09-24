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
import { FIRMWARE_REGISTRY, getOSBehavior } from '../../engine/data/firmwareRegistry';
import { DRIVER_ROOT_ROT } from '../../engine/data/driverRegistry';
import { HookLibraryItemSchema } from '../../engine/data/HookSchema';
import { HookFactory } from '../../engine/core/HookFactory';
import { registerHook } from '../../engine/core/HookRegistry';
import type { DataHookDefinition } from '../../engine/core/HookTypes';

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

/**
 * `root-rot-c1` / `root-rot-c3` — ticket 77 Track C, ROOT ROT RESHAPED. **A NEW KNOB SHAPE.**
 *
 * The two knobs above swap a registry CARD or a boss BODY. This one swaps a Driver's HOOKS: for the
 * length of the run, `driver_root_rot` keeps its id, its name and its place on Rootfall's trio, and
 * resolves to a different trigger geometry. Nothing in `hooks.json` moves — the shipped ROOT ROT is
 * exactly what `rootRot.test.ts` pins — and `applyDriver` picks the substitute up because it reads
 * `getDriver` live at battle creation. Applied ONCE at script start, before any battle is built.
 *
 * # THE STANDING RULE THIS SERVES: NO CAPS, CHANGE THE SHAPE (Henry, 2026-09-01)
 *
 * ROOT ROT's weight is price-curve arbitrage: Poison is priced quadratically, so "+1 per
 * application" lands on the pile being built and the boss trio applies Poison 5-8 times a turn.
 * Each candidate stays proc-visible and UNCAPPED and moves the trigger instead:
 *
 *  - **C1 CREEPING ROT** — `onTurnEnd`: every Poisoned enemy gains 1 Poison. Per turn per BODY, not
 *    per application, so the value scales with how many enemies the boss has touched and not with
 *    how many Poison cards it chained. A Driver's hooks sit on every member, and three members each
 *    firing "every Poisoned enemy +1" is three stacks a turn, not one — so the hook carries a
 *    SIDE-scoped once-per-turn flag, reset at the side's `onTurnStart`, exactly DEEP CACHE's shape.
 *    That flag is the mechanics of "the SIDE does this once", not a design cap: WAR FOOTING gets the
 *    same effect for free by targeting SELF.
 *  - **C2 SPREADING ROT** — *"another enemy gains 1 Poison"* — **NOT BUILT.** The hook targets are
 *    `SELF | TARGET | SOURCE | ALLIES | ENEMIES | RANDOM_ENEMY`, and `RANDOM_ENEMY` may pick the
 *    context target itself; there is no "a living enemy OTHER than the target". Ticket 77 says to
 *    STOP rather than approximate, and an approximation here (RANDOM_ENEMY) would land on the pile
 *    being built about a third of the time at 3v3 — the exact quadratic case the candidate exists
 *    to avoid. Expressing it needs a new hook target in `HookFactory.resolveTarget`, which is engine
 *    work and not a knob. Asking for `root-rot-c2` throws with this paragraph.
 *  - **C3 FESTERING** — `onPostDamage`, source SELF, the program has an ATTACK action and the target
 *    was already Poisoned: the target gains 1 Poison. Fires on hits, so the boss has to MIX attacking
 *    with poisoning and cannot double-dip its own Poison cards (a card with no ATTACK never
 *    qualifies). One caveat the log will show: `onPostDamage` fires once per ACTION of a card, and
 *    `actionType` is a property of the PROGRAM, so an attack card that also applies a status fires
 *    this once per action. Uncapped on purpose; the proc count reports it.
 *
 * Neither built candidate applies Poison inside an `onStatusApplied` hook, so neither needs ROOT
 * ROT's re-entry guard (HANDOFF: an unguarded status-applying `onStatusApplied` hook re-enters ~12
 * deep). C1 fires from `onTurnEnd` and C3 from `onPostDamage`; a Poison applied by either raises
 * `onStatusApplied`, which nothing on the substituted Driver listens to.
 *
 * Every hook below is run through `HookLibraryItemSchema` before it is built — a clause zod would
 * strip from `hooks.json` is stripped here too, so a candidate cannot carry a field the shipped
 * loader would silently drop (HANDOFF 8c2).
 */
const ROOT_ROT_KNOB = /^root-rot-c([123])$/;

const ROOT_ROT_CANDIDATES: Readonly<Record<'c1' | 'c3', { description: string; hooks: DataHookDefinition[] }>> = {
    c1: {
        description: "CREEPING ROT (ticket 77 C1): At the end of this side's turn, every Poisoned enemy gains 1 Poison.",
        hooks: [
            {
                id: 'driver_root_rot_c1_creep',
                trigger: 'onTurnEnd',
                priority: 40,
                proc: true,
                when: { source: 'SELF', counter: { key: 'root_rot_c1_fired', operator: 'LT', value: 1, scope: 'SIDE' } },
                do: [
                    { type: 'COUNTER', target: 'SELF', key: 'root_rot_c1_fired', scope: 'SIDE', operator: 'SET', amount: 1 },
                    { type: 'STATUS', target: 'ENEMIES', targetHasStatus: 'Poison', status: 'Poison', stacks: 1 },
                    { type: 'LOG', text: 'CREEPING ROT spreads through every poisoned body.' },
                ],
            },
            {
                id: 'driver_root_rot_c1_reset',
                trigger: 'onTurnStart',
                priority: 90,
                when: { source: 'SELF' },
                do: [{ type: 'COUNTER', target: 'SELF', key: 'root_rot_c1_fired', scope: 'SIDE', operator: 'RESET' }],
            },
        ] as DataHookDefinition[],
    },
    c3: {
        description: "FESTERING (ticket 77 C3): Whenever this side's attack hits a Poisoned enemy, it gains 1 Poison.",
        hooks: [
            {
                id: 'driver_root_rot_c3_fester',
                trigger: 'onPostDamage',
                priority: 40,
                proc: true,
                when: { source: 'SELF', actionType: 'ATTACK', targetStatus: { status: 'Poison', minStacks: 1 } },
                do: [
                    { type: 'STATUS', target: 'TARGET', status: 'Poison', stacks: 1 },
                    { type: 'LOG', text: 'FESTERING: the wound takes the rot deeper.' },
                ],
            },
        ] as DataHookDefinition[],
    },
};

const C2_REFUSAL =
    '[tweaks] "root-rot-c2" (SPREADING ROT) is NOT BUILT: "another enemy than the target gains 1 Poison" has no '
    + 'hook target — RANDOM_ENEMY may pick the context target itself, and there is no "random enemy other than '
    + 'the target" in HookFactory.resolveTarget. Ticket 77 says STOP rather than approximate. Expressing it '
    + 'needs a new hook target in the engine, which is not a knob.';

/** Which ROOT ROT candidate a knob name selects, or undefined for a knob that is not one. */
function rootRotCandidate(name: string): 'c1' | 'c2' | 'c3' | undefined {
    const match = ROOT_ROT_KNOB.exec(name);
    return match ? (`c${match[1]}` as 'c1' | 'c2' | 'c3') : undefined;
}

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
        const candidate = rootRotCandidate(name);
        if (candidate === 'c2') throw new Error(C2_REFUSAL);
        if (candidate !== undefined) continue;
        throw new Error(
            `[tweaks] unknown tweak "${name}". The live knobs are "${ROOTFALL_RAT_V2}" `
            + '(ticket 76 arm 4) and "root-rot-c1" / "root-rot-c3" (ticket 77 Track C). Everything else '
            + 'this module carried has been ruled on and printed.',
        );
    }
}

/** One line per knob for the report banner — a tweaked number must never be pasted as a baseline. */
export function describeTweaks(names: ReadonlyArray<string>): ReadonlyArray<string> {
    validateTweaks(names);
    return names.map((name) => {
        if (name === ROOTFALL_RAT_V2) {
            return `${ROOTFALL_RAT_V2}: Rootfall's trio fields ratatoskr_v2 in place of ratatoskr_v1 `
                + '(candidate only — ticket 76 moves no lever before Henry\'s session)';
        }
        const candidate = rootRotCandidate(name);
        if (candidate === 'c1' || candidate === 'c3') {
            return `${name}: driver_root_rot's hooks REPLACED for this run — ${ROOT_ROT_CANDIDATES[candidate].description} `
                + '(shape candidate only — ticket 77 Track C moves no lever before Henry\'s session; hooks.json untouched)';
        }
        return name;
    });
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
        const candidate = rootRotCandidate(name);
        if (candidate === 'c1' || candidate === 'c3') {
            applyRootRotCandidate(candidate);
            applied.push(name);
            continue;
        }
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
 * Substitute `driver_root_rot`'s hooks with one candidate's. Process-global; see `ROOT_ROT_KNOB`.
 *
 * Refuses to run twice, and refuses if the shipped Driver is not the one it expects to replace — a
 * candidate applied over another candidate, or over a ROOT ROT someone has since reshaped, would
 * describe an experiment nobody asked for.
 */
function applyRootRotCandidate(candidate: 'c1' | 'c3'): void {
    const shipped = getOSBehavior(DRIVER_ROOT_ROT);
    if (shipped === undefined) throw new Error(`[tweaks] ${DRIVER_ROOT_ROT} is not registered; nothing to reshape.`);
    if (!shipped.hooks.some((h) => h.id === 'driver_root_rot_spread')) {
        throw new Error(
            `[tweaks] ${DRIVER_ROOT_ROT} no longer carries driver_root_rot_spread — either a candidate is already `
            + 'applied or the shipped Driver was reshaped. Re-read ticket 77 Track C before running this arm.',
        );
    }

    const spec = ROOT_ROT_CANDIDATES[candidate];
    // Through the SAME schema hooks.json goes through, so a clause zod would strip there is stripped
    // here too and the candidate cannot rely on a field the shipped loader does not know.
    const parsed = HookLibraryItemSchema.parse({ id: DRIVER_ROOT_ROT, name: shipped.name, description: spec.description, hooks: spec.hooks });
    const hooks = (parsed.hooks ?? []).map((h) => HookFactory.createHook(h as unknown as DataHookDefinition, DRIVER_ROOT_ROT));
    if (hooks.length !== spec.hooks.length) throw new Error(`[tweaks] ${candidate}: the schema dropped a hook.`);
    hooks.forEach((hook) => registerHook(hook));

    FIRMWARE_REGISTRY[DRIVER_ROOT_ROT] = { ...shipped, description: spec.description, hooks };
}

/** The candidate's hook DECLARATIONS, for a test to read without applying the knob. */
export function rootRotCandidateHooks(candidate: 'c1' | 'c3'): ReadonlyArray<DataHookDefinition> {
    return ROOT_ROT_CANDIDATES[candidate].hooks;
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
