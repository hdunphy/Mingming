/**
 * EXPERIMENTAL TWEAKS — one named knob, applied for the length of a measurement, never committed.
 *
 * # WHY THIS EXISTS RATHER THAN EDITING `programs.json`
 *
 * A card edited in `programs.json` is SHIPPED: it moves the pin tests, the start kits, the market,
 * every other arm's baseline and anything anyone measures afterwards. Candidate printings edited in
 * and out of that file across a two-hour run is how a tree ends up carrying a knob nobody ruled on.
 *
 * So a candidate lives here, off by default, named on the command line, and printed in the report
 * banner under a NOT-A-BASELINE header. When Henry rules, the printing moves into `programs.json`
 * and **the knob is deleted from this file** — see below, because that rule has teeth.
 *
 * # A RULED KNOB IS A DELETED KNOB
 *
 * Ticket 74 retired `boss-cantrips`, `boss-cantrips-<N>` and `ink-power-<N>` and they are gone from
 * this file rather than left in place "in case". They were the levers research/73 measured on
 * Tidewrack's OLD composition — the boss's `undertow` cantrips and `ink_stream`'s printed power —
 * and ticket 74 answered that question a different way: it swapped `kraken_v1` (ABYSSAL_INK_SYS,
 * the second engine) for `kraken_v2`, which takes `ink_stream` x2, `whirlpool_v2` x2,
 * `pressure_point` x2 and the third `undertow` out of the boss pile as a composition change. The
 * cards themselves are untouched and stay as printed.
 *
 * Leaving those knobs behind would have left three flags that still parse, still print a banner, and
 * now describe a pile that no longer contains what they claim to remove. A flag that runs and means
 * nothing is the single failure this module and `optionsThreading.test.ts` exist to prevent; keeping
 * a retired one would have been building the trap on purpose.
 *
 * # THE KNOB THAT IS LIVE
 *
 *  - **`thorn-power-<N>`** — `thorn_tithe`'s printed power, 40 by default, for the reprice arm.
 *
 * Ticket 74 committed the half of the `thorn_tithe` fix that was a printing error: its 3 Weakened
 * now land on the TARGET rather than on SELF, which is Henry's *"transfer self weakness to enemy
 * weakness"*. That is in `programs.json` and is no longer a knob.
 *
 * What is still open is the PRICE, and only the price. The card as committed is 1 energy, 40 power,
 * 3 Weakened on the target. `hamstring` — the precedent for this effect — is 1 energy, 20 power,
 * 2 Weakened on the target, so the committed card is strictly better on both halves. That was
 * deliberate: the transfer and the reprice are two variables and the arms move one at a time.
 *
 * `thorn-power-<N>` is the second variable, run report-only for Henry's number. The ruling asks for
 * 25-30; the curve `50 x E - 10` puts an unconditional 1-energy attack at 40, so 25-30 is pricing
 * the 3 stacks at 10-15 power, against hamstring's implied ~20 for 2. Nothing here picks a value —
 * the arm reports and Henry rules.
 *
 * # MECHANICS
 *
 * `applyRegistryTweaks` MUTATES `ProgramRegistry` in place, once, at script start. That is a
 * process-global change and it is why this module is `src/debug` and why the caller prints a banner.
 * It is safe only because `GetProgramData` reads the registry live on every call — but
 * `getInflatedProgramRegistry` memoises, so this must run BEFORE any battle, party or run is built.
 */

import { ProgramRegistry } from '../../engine/data/programRegistry';
import type { ProgramAction } from '../../engine/types';

const THORN_POWER = /^thorn-power-(\d+)$/;

export type TweakName = string;

/**
 * Rejects a misspelled or RETIRED knob loudly instead of silently measuring the baseline twice.
 *
 * This is the same failure class as the `--toolbox` threading bug: an option that parses, prints in
 * the banner and changes nothing produces a report describing an arm that was never run. Paired
 * seeds caught that one by byte-identical sequences; this catches it a step earlier.
 *
 * A retired knob gets its own message rather than the generic one, because someone re-running a
 * command out of research/73's "Reproducing" block deserves to be told the lever was ruled on and
 * where the answer went — not just that the string is unknown.
 */
export function validateTweaks(names: ReadonlyArray<string>): void {
    for (const name of names) {
        if (name === 'boss-cantrips' || /^boss-cantrips-\d+$/.test(name) || /^ink-power-\d+$/.test(name)) {
            throw new Error(
                `[tweaks] "${name}" was RETIRED by ticket 74. Those knobs measured Tidewrack's old `
                + 'composition (kraken_v1, the second draw engine); the ruling swapped it for kraken_v2 '
                + 'instead, so the pile no longer holds what they removed. See research/73 §7.',
            );
        }
        if (name !== 'thorn-target' && !THORN_POWER.test(name)) {
            throw new Error(`[tweaks] unknown tweak "${name}". Known: thorn-power-<N>`);
        }
        if (name === 'thorn-target') {
            throw new Error(
                '[tweaks] "thorn-target" is COMMITTED as of ticket 74 — thorn_tithe applies its 3 '
                + 'Weakened to the TARGET in programs.json. Drop the flag; the baseline is the fix.',
            );
        }
    }
}

/** One line per knob for the report banner — a tweaked number must never be pasted as a baseline. */
export function describeTweaks(names: ReadonlyArray<string>): ReadonlyArray<string> {
    return names.map((name) => {
        const thorn = THORN_POWER.exec(name);
        if (thorn) {
            return `thorn-power-${thorn[1]}: thorn_tithe printed power 40 -> ${thorn[1]} `
                + '(the 3 Weakened on TARGET are COMMITTED and unchanged — this arm prices them)';
        }
        return name;
    });
}

/**
 * Mutates `ProgramRegistry` for the registry-level knobs. Call ONCE, before anything is built.
 *
 * Returns the knobs it actually applied, so a caller can assert it did something.
 */
export function applyRegistryTweaks(names: ReadonlyArray<string>): ReadonlyArray<string> {
    validateTweaks(names);
    const applied: string[] = [];

    for (const name of names) {
        const thorn = THORN_POWER.exec(name);
        if (!thorn) continue;

        const power = Number(thorn[1]);
        const card = ProgramRegistry['thorn_tithe'];
        if (!card) throw new Error('[tweaks] thorn_tithe is not in the registry');

        /*
         * Guarded against the committed printing rather than assumed: if the TARGET transfer is ever
         * reverted, this arm would silently be repricing a self-debuff card and the report would say
         * it was pricing the transfer. Better to stop than to describe the wrong experiment.
         */
        const onTarget = card.actions?.some((a) => a.type === 'STATUS' && a.target === 'TARGET');
        if (!onTarget) {
            throw new Error(
                '[tweaks] thorn_tithe no longer applies its Weakened to the TARGET. `thorn-power` '
                + 'prices the COMMITTED transfer; with the transfer gone the arm measures something else.',
            );
        }

        /*
         * Replaced as a whole entry rather than mutated field-by-field: `ProgramData`'s own fields
         * are readonly under `tsconfig.app.json` (the strict config the gate runs), and rightly so —
         * a card is data. The registry's VALUES are writable, which is the one seam this module
         * needs and the reason it can exist without loosening the card type for everyone else.
         */
        ProgramRegistry['thorn_tithe'] = {
            ...card,
            description: `${power} power. Apply 3 Weakened.`,
            actions: card.actions?.map((action: ProgramAction) => (
                action.type === 'ATTACK' ? { ...action, power } : action
            )),
        };
        applied.push(name);
    }

    return applied;
}

/**
 * The enemy-pile knob. Pure; applied per fight, after the encounter roll.
 *
 * No knob currently edits the pile — `boss-cantrips` was the only one and ticket 74 retired it. Kept
 * as the seam rather than deleted, because `sampleFight` threads exactly one `tweaks` parameter and
 * `optionsThreading.test.ts` asserts over that seam; removing it would mean the next pile knob has
 * to re-earn the threading guarantee instead of inheriting it.
 */
export function tweakEnemyDeck(
    deck: ReadonlyArray<string>,
    _names: ReadonlyArray<string>,
): ReadonlyArray<string> {
    return deck;
}
