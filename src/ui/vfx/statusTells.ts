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
import { JS_COLOR } from '../theme/jsColors';
import { anchorFor, emit, emitSeeds, plaqueFor, type EmitAt } from './emit';
import { plainImpact } from './impacts/plainImpact';
import { landingFor } from './landings/landingFor';
import { emitSpriteGlow, emitSpriteReaction } from './landings/reactionSignals';

interface Rgb { r: number; g: number; b: number }

const hexToRgb = (hex: string): Rgb => {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

/** The status's own colour, the one the plaque badge already uses. */
export const statusColor = (status: StatusType): Rgb => hexToRgb(STATUS_COLORS[status] ?? JS_COLOR.textDim);

/** What a removal looks like: grey, because the thing that had a colour is gone. */
const GREY: Rgb = { r: 150, g: 155, b: 162 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
/** The lab's `round((12 + 26 * 1) * 1.4)`. */
export const DEATH_SPARKS = Math.round((12 + 26) * 1.4);

/**
 * APPLY — §2f: *"a `ring` in `STATUS_COLORS[status]` expanding from the target's sprite anchor + the
 * plaque badge popping in + a 6-particle `puff` in the status colour."*
 *
 * The ring is on the SPRITE and the puff drifts off it, while the badge pop (owned by the plaque,
 * not by this file) happens on the plaque at the same moment. Two places at once is deliberate: it
 * ties the thing that happened to the body it happened to AND to the row where the player will read
 * it for the next five turns.
 */
export function emitStatusApplied(status: StatusType, targetId: string, stacksAdded = false, stacks = 1): void {
    const at = anchorFor(targetId);
    if (!at) return;

    /*
     * TICKET 190f: eight statuses have a landing of their own (`landings/`), grown by the stacks that
     * landed (the x N of the float). The rest - Asleep, Stunned, Energized, StableOS, the two Stances -
     * keep the ring and the puff below.
     */
    const landing = landingFor(status);
    if (landing) {
        const built = landing({ at, plaque: plaqueFor(targetId), stacks, stacksAdded });
        emitSeeds(built.seeds);
        if (built.reaction) emitSpriteReaction({ targetId, reaction: built.reaction });
        // 194k-5: and every landing makes the body glow in the status colour for 450 ms.
        emitSpriteGlow({ targetId, color: statusColor(status) });
        return;
    }
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

/**
 * A UNIT DIES — ticket 155, deep dive 9.
 *
 * `BattleStage.test` has said since 145 that *"the anchor must survive the death because 146 plays
 * the death FX AT the slot"*, and 146 shipped without one: no death branch in `useCastSequence`, no
 * recipe here. A ruled behaviour with a test asserting the SCAFFOLD for it and nothing doing it is
 * the same shape as the two dead-on-arrival defects in 155a, so it is closed here rather than left
 * as a comment pointing at a ticket that is finished.
 *
 * A ring and a grey scatter at the slot — not a flame, not the element's colour. A death is the
 * board losing a body, and it should read the same whoever dies and whatever killed them; tying it
 * to the killer's element would make a unit's death look like the last card played.
 *
 * 145b already draws the body as a 40%-brightness silhouette, which is the standing read. This is
 * the moment, on the ruling that has governed every tell in 146.
 */
export function emitDeath(targetId: string, direction: 1 | -1 = 1): void {
    const at = anchorFor(targetId);
    if (!at) return;
    // TICKET 198b-4: the lab's `death()` throws `burst('None', u, 1, 1.4, dir)`: a full-strength
    // white spark burst at 1.4x, flying on from the attacker, with its white ring.
    emitSeeds(plainImpact({ at, s: 1, matchup: 'normal', isKill: true, direction, particleScale: 1, color: WHITE }, DEATH_SPARKS, WHITE));
}

/** Convenience for a caller that has an anchor already resolved. */
export function emitAt(kind: 'ring' | 'puff', at: EmitAt, color: Rgb): void {
    emit(kind, at, { color, intensity: kind === 'ring' ? 1 : 5 });
}
