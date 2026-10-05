/**
 * WHICH UNITS THE HELD CARD IS AIMED AT, AS DATA — ticket 194h.
 *
 * Henry, 2026-10-04: *"I can't tell which enemy is being targeted for the preview of my card."*
 * `TargetFlag` stays the cursor and the effectiveness words; this answers one question for
 * `StageSlot`: of the six bodies on the stage, which get the STRONG mark (the unit the preview
 * numbers are computed for, or the unit a card that picks for you will hit) and which get the SOFT
 * outline (the other legal choices).
 *
 * The rule that makes it trustworthy is that the strong mark and the preview can never disagree:
 * both come from the same hovered id, and a unit the card cannot land on is neither.
 */
import type { ProgramData } from '../../../engine/types';

export interface HighlightUnit {
    readonly id: string;
    /** `targetVerdict(...).ok`: may the held card land here. */
    readonly legal: boolean;
    /** Which side it is on: an attack's soft outline is for the enemies (an ally is legal but not the point). */
    readonly isEnemy: boolean;
}

export interface TargetHighlight {
    /** The unit(s) the preview is for, or that the card will hit without being aimed. */
    readonly strong: ReadonlySet<string>;
    /** The other units the card could be aimed at. */
    readonly soft: ReadonlySet<string>;
}

const NOTHING: TargetHighlight = { strong: new Set(), soft: new Set() };

/** A card whose own actions pick a random enemy: every candidate is soft and none is strong. */
const picksAtRandom = (card: ProgramData): boolean =>
    (card.actions ?? []).some((action) => (action as { target?: string }).target === 'RANDOM_ENEMY');

export function targetHighlight(input: {
    /** The held or selected card; null when none is. */
    readonly card: ProgramData | null;
    readonly units: ReadonlyArray<HighlightUnit>;
    /** The caster, for a card that lands on itself. */
    readonly casterId: string | null;
    /** The unit the pointer is on (the preview's target), if any. */
    readonly hoveredId: string | null;
}): TargetHighlight {
    const { card, units, casterId, hoveredId } = input;
    if (!card) return NOTHING;
    const legal = units.filter((unit) => unit.legal).map((unit) => unit.id);
    if (legal.length === 0) return NOTHING;

    if (picksAtRandom(card)) return { strong: new Set(), soft: new Set(legal) };

    // A card that is not aimed - it lands on its caster, or on a whole side - names its own units.
    if (card.target === 'Self') {
        return casterId && legal.includes(casterId)
            ? { strong: new Set([casterId]), soft: new Set() }
            : NOTHING;
    }
    if (card.target === 'Side' || card.target === 'All') {
        return { strong: new Set(legal), soft: new Set() };
    }

    // An aimed card: the legal units are the choices, and the hovered one is THE target. An ATTACK
    // may legally be pointed at an ally (Henry, 2026-09-26), but outlining the whole friendly row
    // every time an attack is held would be noise: allies are outlined for attacks only when hovered.
    const damaging = (card.actions ?? []).some((action) => action.type === 'ATTACK');
    const strongId = hoveredId !== null && legal.includes(hoveredId) ? hoveredId : null;
    const choices = units.filter((unit) => unit.legal && (unit.isEnemy || !damaging)).map((unit) => unit.id);
    return {
        strong: strongId === null ? new Set() : new Set([strongId]),
        soft: new Set(choices.filter((id) => id !== strongId)),
    };
}
