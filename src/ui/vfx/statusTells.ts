/**
 * STATUS TELLS — ticket 146f.
 *
 * Ruling 3 decides the shape of this whole row: *"For now no persistent status emitters; it was the
 * apply status or remove status that should get an emitter."* The plaque badge is the STANDING read
 * — it says a unit is poisoned for as long as it is — and these are the MOMENTS: it landed, it
 * left, it just hurt someone.
 *
 * That split is why a burning unit is not on fire all the time. It also means every effect here is
 * one burst with an end, which is what keeps the layer idle for most of a fight.
 *
 * # THE TICK IS NOT A HIT
 *
 * Ruling 7, and §2f says it in bold: *"**not a hit.** No hit-stop, no shake, no flash."* A Poison
 * deck ticks on every unit every turn; giving each tick the impact treatment would make the game
 * feel like it was being attacked by its own status effects. 146e enforces the hit-stop half by
 * refusing any `cause` that is not `attack`; this file supplies what a tick gets INSTEAD, per
 * status, so the player can still tell Poison from Burn without reading the log.
 */

import { STATUS_COLORS } from '../../engine/data/statusGlossary';
import type { StatusType } from '../../engine/types';
import { anchorFor, emit, plaqueFor, type EmitAt } from './emit';

interface Rgb { r: number; g: number; b: number }

const hexToRgb = (hex: string): Rgb => {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

/** The status's own colour, the one the plaque badge already uses. */
export const statusColor = (status: StatusType): Rgb => hexToRgb(STATUS_COLORS[status] ?? '#cccccc');

/** What a removal looks like: grey, because the thing that had a colour is gone. */
const GREY: Rgb = { r: 150, g: 155, b: 162 };

/**
 * APPLY — §2f: *"a `ring` in `STATUS_COLORS[status]` expanding from the target's sprite anchor + the
 * plaque badge popping in + a 6-particle `puff` in the status colour."*
 *
 * The ring is on the SPRITE and the puff drifts off it, while the badge pop (owned by the plaque,
 * not by this file) happens on the plaque at the same moment. Two places at once is deliberate: it
 * ties the thing that happened to the body it happened to AND to the row where the player will read
 * it for the next five turns.
 */
export function emitStatusApplied(status: StatusType, targetId: string, stacksAdded = false): void {
    const at = anchorFor(targetId);
    if (!at) return;
    const color = statusColor(status);

    /*
     * §2f: *"Stacks added to an existing status: the badge pulses and the count ticks; no ring."*
     * The ring means SOMETHING NEW IS ON YOU, and spending it on the fourth stack of a Poison the
     * player has been watching for three turns is how a signal stops meaning anything.
     */
    if (!stacksAdded) emit('ring', at, { color, intensity: 1 });
    emit('puff', at, { color, intensity: stacksAdded ? 3 : 6 });
}

/**
 * REMOVE — §2f: *"the badge shrinks out and a small grey `puff` leaves the sprite."*
 *
 * Grey rather than the status's colour, and smaller than the apply. A removal is good news for
 * whoever owned the status and bad news for whoever applied it, and neither of those is worth a
 * ring — the information is "that is over", which is an absence and should read as one.
 */
export function emitStatusRemoved(targetId: string): void {
    const at = anchorFor(targetId);
    if (!at) return;
    emit('puff', at, { color: GREY, intensity: 4 });
}

/**
 * THE TICK — §2f's per-status table, the part that keeps a damage-over-time deck legible.
 *
 * Each one is the status's own particle doing the status's own thing, small:
 *
 *   Poison  two drops falling off the sprite, in Poison green
 *   Burn    three flames rising, in Burn orange
 *   Regen   a mote rising, green (a heal, not damage — the only one that goes up gently)
 *   other   a short puff in the status colour, so an unnamed DoT still says something
 *
 * `flame` here is the same tongue 146a tuned, fired three times and gone — which is exactly the
 * relationship ruling 3 wanted between the moment and the standing read.
 */
export function emitStatusTick(status: StatusType, targetId: string): void {
    const at = anchorFor(targetId);
    if (!at) return;
    const color = statusColor(status);

    switch (status) {
        case 'Poison':
            emit('drop', at, { color, intensity: 2 });
            return;
        case 'Burn':
            emit('flame', at, { intensity: 3 });
            return;
        case 'Regen':
            emit('puff', at, { color, intensity: 3 });
            return;
        default:
            emit('puff', at, { color, intensity: 3 });
    }
}

/**
 * A SHIELD ABSORB — §2f: *"the existing absorbed float plus a `ring` in Sharp/BarkShield colour."*
 *
 * On the PLAQUE rather than the sprite, because the thing that absorbed it is a number on the
 * plaque. The float is `useBattleVfx`'s and is untouched.
 */
export function emitShieldAbsorb(targetId: string): void {
    const at = plaqueFor(targetId) ?? anchorFor(targetId);
    if (!at) return;
    emit('ring', at, { color: statusColor('BarkShield'), intensity: 1 });
}

/**
 * RECOIL AND hel's TOLL — §2f: *"a red pulse on the *caster*, no trail."*
 *
 * No trail is the whole point. A recoil has no attacker and no flight: the damage starts and ends
 * on the same body, and drawing a streak would invent a source for something that came from inside.
 */
export function emitSelfCost(casterId: string): void {
    const at = anchorFor(casterId);
    if (!at) return;
    emit('puff', at, { color: { r: 220, g: 60, b: 60 }, intensity: 5 });
}

/** Convenience for a caller that has an anchor already resolved. */
export function emitAt(kind: 'ring' | 'puff', at: EmitAt, color: Rgb): void {
    emit(kind, at, { color, intensity: kind === 'ring' ? 1 : 5 });
}
