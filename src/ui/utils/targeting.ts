/**
 * WHERE A CARD IS ALLOWED TO LAND, AND WHY IT IS NOT — ticket 22.
 *
 * # WHY THIS IS A FILE AND NOT A CLOSURE
 *
 * The predicate below used to be `BattleArena.isValidCardTarget`, a local arrow shared between the
 * sidebar HUD cards and the stage spotlights. That was enough while validity was only ever consulted
 * at the moment of the drop. Ticket 22's Done-when needs it consulted **before** the player commits —
 * on six entities at once, from three different components (`MingmingUnit`, `BattleStage`,
 * `CardHand`) — and a rule that three components each re-implement is a rule that will disagree with
 * the reducer on one of them.
 *
 * So there is one predicate, and everything that draws a target affordance reads it.
 *
 * # AN INVALID TARGET SAYS WHY
 *
 * Tickets 13, 14 and 20 all landed the same convention and `MacroRack` states it plainly: *"a
 * silently inert control is indistinguishable from a bug to whoever is holding the pad."* A dimmed
 * unit that ignores a click teaches the player nothing; a dimmed unit reading "SALVE only lands on
 * your side" teaches them the card. Every refusal here therefore carries a sentence in the player's
 * own vocabulary, never a code and never a bare boolean.
 */

import type { IBattleEntity, ProgramData } from '../../engine/types';

/**
 * The rule, unchanged from the one `BattleArena` has been dropping cards against.
 *
 * Deliberately NOT re-derived from the reducer: the reducer's own targeting is per-ACTION
 * (`'SELF' | 'TARGET'`) and resolves after the play is accepted, whereas this is the card-level
 * question the pointer is asking. Ticket 22 preserved it verbatim rather than tightening it — a
 * silent rules change smuggled in under a UI ticket is how a fight stops matching its tests.
 */
export function isValidCardTarget(data: ProgramData, isEnemy: boolean): boolean {
    const targetType = data.target;
    return (
        (isEnemy && (targetType === 'Single' || targetType === 'Side' || targetType === 'All')) ||
        (!isEnemy && (targetType === 'Self' || targetType === 'Side' || targetType === 'All')) ||
        (!isEnemy && data.actions.some(a => a.type === 'HEAL' || a.type === 'STATUS'))
    );
}

/** Whether a card can be aimed at each side at all, derived from the one predicate above. */
export function legalSides(data: ProgramData): { enemies: boolean; allies: boolean } {
    return { enemies: isValidCardTarget(data, true), allies: isValidCardTarget(data, false) };
}

/**
 * One short phrase naming everything this card may be pointed at — the always-on legend, so the
 * player can see a card's reach without probing six units with the pointer to find out.
 */
export function describeLegalTargets(data: ProgramData): string {
    const { enemies, allies } = legalSides(data);
    if (enemies && allies) return 'ANY LIVING UNIT';
    if (enemies) return data.target === 'Single' ? 'ONE ENEMY' : 'ENEMIES';
    if (allies) return data.target === 'Self' ? 'SELF' : 'YOUR SIDE';
    return 'NO LEGAL TARGET';
}

/** The answer to "may this card land here, and if not, what should the player be told". */
export interface TargetVerdict {
    readonly ok: boolean;
    /** A full sentence for the player when `ok` is false; null when there is nothing to explain. */
    readonly reason: string | null;
}

const OK: TargetVerdict = { ok: true, reason: null };

/**
 * Can `caster` play `data` at `entity` right now — and if not, what does the player need to hear.
 *
 * The three refusals are ordered by what the player should fix first: a dead unit is never a target
 * for anything, then a missing caster (which blocks every card equally, so saying it per-card would
 * be noise), and only then the card's own reach.
 */
export function targetVerdict(
    data: ProgramData | null | undefined,
    entity: IBattleEntity,
    isEnemy: boolean,
    caster: IBattleEntity | null | undefined,
): TargetVerdict {
    if (!data) return OK;                       // nothing selected: there is no refusal to explain

    if (entity.currentHp <= 0) {
        return { ok: false, reason: `${entity.name} is terminated — dead units cannot be targeted.` };
    }
    if (!caster || caster.currentHp <= 0) {
        return { ok: false, reason: 'Pick a living caster first — W, E or R, or click one of your units.' };
    }
    if (!isValidCardTarget(data, isEnemy)) {
        const { enemies, allies } = legalSides(data);
        if (enemies && !allies) {
            return { ok: false, reason: `${data.name} only hits enemies.` };
        }
        if (allies && !enemies) {
            return {
                ok: false,
                reason: data.target === 'Self'
                    ? `${data.name} only lands on its caster.`
                    : `${data.name} only lands on your side.`,
            };
        }
        return { ok: false, reason: `${data.name} has no legal target here.` };
    }
    return OK;
}
