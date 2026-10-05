/**
 * TICKET 190d — BUILD THE ELEMENT ATTACK FOR A CAST, from where the bodies are on the stage right now
 * and how big the hit is. `null` means "this cast has no authored attack": an element without one
 * (Earth, Ice, Air, Light, Dark, None), or a stage that is not mounted. The cast sequence then sends
 * the old tinted streak.
 */

import { anchorFor, type EmitAt } from '../emit';
import type { TierProfile } from '../tiers/tierProfiles';
import { type AttackBuild, type Body } from './AttackEffect';
import { attackFor, type AttackShape } from './attackFor';

export interface CastAttackInput {
    readonly element: string;
    readonly spread: boolean;
    readonly sourceId: string;
    readonly targetIds: ReadonlyArray<string>;
    readonly direction: 1 | -1;
    readonly profile: TierProfile;
    /** The damage scale of the biggest hit, 0..1. */
    readonly scale: number;
    readonly tremble?: (targetId: string, px: number) => void;
}

const bodyOf = (id: string, at: EmitAt | null): Body | null =>
    at ? { id, x: at.x, y: at.y, w: at.w ?? 0, h: at.h ?? 0 } : null;

export function buildCastAttack(input: CastAttackInput): AttackBuild | null {
    const shape: AttackShape = input.spread ? 'spread' : 'single';
    const make = attackFor(input.element, shape);
    if (!make || input.targetIds.length === 0) return null;

    const caster = bodyOf(input.sourceId, anchorFor(input.sourceId));
    const targets = input.targetIds.map((id) => bodyOf(id, anchorFor(id)));
    if (!caster || targets.some((target) => target === null)) return null;

    // Whole milliseconds, adding up to the attack plan's own travel (`planAttack` rounds the same way).
    const head = Math.round(input.profile.headMs(input.scale));
    const travel = Math.round(input.profile.headMs(input.scale) + input.profile.sustainMs(input.scale));

    return make({
        caster,
        targets: targets as Body[],
        direction: input.direction,
        headMs: head,
        sustainMs: travel - head,
        s: input.scale,
        particleScale: input.profile.particleScale,
        tremble: input.tremble,
    });
}
