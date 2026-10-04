import type { Element, ProgramData } from '../types';

/**
 * The program an attack is dealt under when no card is behind it (TICKET 193a).
 *
 * Feedback Loop's zap and Short Circuit's fire from an `onCardDraw` hook, so the attack executor has no
 * card to hand the damage modifiers. Damage still needs a program (its element decides STAB and the
 * type chart), so it gets this one. It is not a card and not an attack: its action list is empty, so
 * every `actionType` condition on a Driver or firmware hook is simply false and a zap neither earns
 * nor counts toward FIRST BLOOD, TENTH STRIKE or an element Driver (Henry, 2026-10-04: *"It's not an
 * attack."*). Keeping the shape in one place is what stops a half-built program reaching a hook.
 */
export function standInProgram(element?: Element): ProgramData {
    return { element, actions: [] } as unknown as ProgramData;
}
