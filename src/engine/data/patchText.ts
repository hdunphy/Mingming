/**
 * TICKET 184d (step 2) — **WHAT EACH PATCH DOES ON EACH LAUNCH FIRMWARE, IN WORDS.**
 *
 * Henry, 2026-10-01: *"For now we hand write them per OS... its mostly the description that is too
 * unclear."* Every screen that shows a patch asks `describePatchOn(osId, patchId)` rather than
 * printing the patch's generic sentence, so the player reads what changes on THIS monster:
 * "Fenrir gains 4 Strengthened per attack instead of 2", not "your firmware's number goes up".
 *
 * Drafted in `docs/balance/patch-text-184.md` from the real transforms and Henry's rulings, then
 * ruled. One line per offerable cell: a cell the game hides (`patchDoesNothing`) has no line, and
 * `patchText.test.ts` fails both ways — a launch cell the game offers with no line, and a line for
 * a cell the game hides — so the table cannot drift from what is offered.
 *
 * A firmware outside this table (post-launch, enemy-only) falls back to the generic sentence.
 */

import { getPatch, type PatchId } from './patchRegistry';

/** OVERCLOCK does not touch the firmware, so its line only names the body. */
const overclock = (name: string): string =>
    `Every stack ${name} holds counts as one more when a card cashes it (3 stacks scale as 4).`;

export const PATCH_TEXT: Readonly<Record<string, Partial<Record<PatchId, string>>>> = {
    fenrir_v1: {
        amplifier: 'Fenrir gains 4 Strengthened per attack instead of 2, and 2 instead of 1 when an ally attacks.',
        splitter: 'Whenever the kernel gives Fenrir Strengthened, the rest of your side gains the same.',
        overclock: overclock('Fenrir'),
        failsafe: 'Fenrir\'s attacks no longer cost him 2% of his max HP.',
    },
    fenrir_v2: {
        amplifier: 'Fenrir gains 2 Sharp instead of 1 whenever an ally applies Burn.',
        splitter: 'Whenever an ally applies Burn, the rest of your side gains 1 Sharp too.',
        overclock: overclock('Fenrir'),
    },
    skoll_v1: {
        amplifier: 'Sköll gains 2 Strengthened instead of 1 whenever an ally loses HP to an enemy.',
        splitter: 'Whenever an ally loses HP to an enemy, the rest of your side gains 1 Strengthened too.',
        overclock: overclock('Sköll'),
    },
    skoll_v2: {
        amplifier: 'Each of Sköll\'s hits on a Burning target applies 2 more Burn instead of 1.',
        relay: 'Every ally\'s hits on a Burning target apply 1 more Burn, not only Sköll\'s.',
        overclock: overclock('Sköll'),
    },
    kraken_v1: {
        amplifier: 'Each bonus draw applies 3 Dazed to a random enemy instead of 2.',
        overclock: overclock('Kraken'),
    },
    kraken_v2: {
        amplifier: 'Kraken\'s Water cards that cost 2 or more deal 45% more damage instead of 30%.',
        relay: 'Any ally\'s Water cards that cost 2 or more deal 30% more damage, not only Kraken\'s.',
        overclock: overclock('Kraken'),
    },
    jormungandr_v1: {
        amplifier: 'The 5th Water card each turn draws 2 cards instead of 1.',
        repeater: 'The 3rd and the 5th Water card each turn both draw a card.',
        splitter: 'Any card counts, not just Water: the 5th card your side plays each turn draws a card.',
        overclock: overclock('Jörmungandr'),
    },
    jormungandr_v2: {
        amplifier: 'Jörmungandr\'s attacks deal +6 power per Poison stack on the target instead of +4.',
        relay: 'Every ally\'s attacks deal +4 power per Poison stack on the target, not only Jörmungandr\'s.',
        overclock: overclock('Jörmungandr'),
    },
    ratatoskr_v1: {
        amplifier: 'Each 0-cost card heals its caster 3% of max HP instead of 2.5%.',
        overclock: overclock('Ratatoskr'),
    },
    ratatoskr_v2: {
        amplifier: 'Each 0-cost card an ally plays at an enemy applies 2 Dazed instead of 1.',
        overclock: overclock('Ratatoskr'),
    },
    huldra_v1: {
        amplifier: 'Each buff an ally gives an ally applies 2 Weakened to a random enemy instead of 1.',
        overclock: overclock('Huldra'),
    },
    huldra_v2: {
        overclock: overclock('Huldra'),
    },
};

/**
 * What `patchId` does on the firmware `osId`: its line in the table, else the patch's generic
 * sentence. An unknown patch id reads as the id, rather than as nothing.
 */
export function describePatchOn(osId: string | undefined, patchId: string): string {
    const line = osId ? PATCH_TEXT[osId]?.[patchId as PatchId] : undefined;
    return line ?? getPatch(patchId)?.text ?? patchId;
}
