/**
 * TICKET 171f — **A HOOK'S STATUS GETS ITS OWN BEAT, AFTER THE CARD.**
 *
 * Henry, 2026-09-29 playtest: *"I don't think skoll v2 works. I don't see the burn getting added."*
 * It did work (EMBER_FUSE fired 4, 4 and 2 times in the three fights Sköll played), but its Burn
 * landed in the same reducer burst as the card's own Burn, and ticket 166b merges one burst into one
 * float per body per status. Ember Jab on a Burning target read "Burn ×2" — the card's 1 and the
 * fuse's 1 — with nothing to say that half of it was the firmware.
 *
 * Henry, 2026-09-30: *"Its own animation that shows the status being added after the card maybe?"*
 * So a status the engine tags with a `hookId` (`StatusSource.hookId`, set by `HookFactory`) is held
 * out of the card's burst and played as a second beat: the firmware's tell, then a float that names
 * the firmware ("+1 Burn · EMBER_FUSE"), with the hook's sound moved to the same moment.
 *
 * The pure half lives here so the two hooks that play it (`useBattleVfx` for floats and sound,
 * `useCastSequence` for particles) share one clock and one wording.
 */

import type { StatusSource } from '../../engine/events';
import type { StatusType } from '../../engine/types';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { instinctName } from '../labels/labels';
import { GetProgramData } from '../../engine/data/programRegistry';

/**
 * When the float and sound land, measured from the reducer burst. The cast's own statuses land at
 * flight 180 + trail 220 + 60 per status (`useCastSequence`), so 700 ms is just after a card with
 * a couple of statuses has finished — "after the card", and still close enough to read as its
 * consequence.
 */
export const HOOK_BEAT_DELAY_MS = 700;

/** In the particle sequence: this long after the card's last status tell. */
export const HOOK_BEAT_GAP_MS = 200;

/** True for a status a hook applied (as opposed to the card, or the engine). */
export function isHookStatus(source: StatusSource | undefined): source is StatusSource & { hookId: string } {
    return typeof source?.hookId === 'string';
}

/** The name the float carries: the OS's name (EMBER_FUSE), or the daemon card's. */
export function hookBeatLabel(osId: string | undefined, daemonId: string | undefined): string | undefined {
    if (osId) { const name = getOSBehavior(osId)?.name; return name === undefined ? undefined : instinctName(name); }
    if (daemonId) return GetProgramData(daemonId)?.name;
    return undefined;
}

/**
 * "+1 Burn · EMBER_FUSE". The plus says it was ADDED — this float is about the delta, where the
 * card's float is about the status arriving — and the name says who added it.
 */
export function hookFloatText(status: StatusType, stacks: number, label: string | undefined): string {
    const name = String(status).replace(/([a-z])([A-Z])/g, '$1 $2');
    const shown = Math.max(1, Math.round(stacks));
    return label ? `+${shown} ${name} · ${label}` : `+${shown} ${name}`;
}
