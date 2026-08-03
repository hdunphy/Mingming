/**
 * The single canonical-form function for IBattleState - see
 * docs/wayfinder/debug-toolkit/tickets/02-scenario-schema.md, section 3.
 *
 * Snapshot export runs it before serializing, the loader runs it after parsing, and the
 * replay assertion normalizes both sides before comparing. It is the only exported entry
 * point for producing a comparable state, which is what closes audit gap #9 (the ~9
 * optional fields JSON.stringify drops).
 *
 * Two classes, because several fields have no meaningful default and filling them would
 * require a type change:
 *
 *   Fill class (canonical form = key PRESENT):
 *     state.enemyMode           -> 'MOVES'
 *     state.lastStatusConsumed  -> 0
 *     state.elementPlays        -> zero-filled for every member of Element
 *     entity.relicBonuses       -> { draw: 0, energy: 0, attackMod: 1 }
 *     entity.hooks              -> []
 *     entity.activeOS           -> GetMingmingData(definitionId).availableOS[0]
 *     entity.currentIntent      -> null
 *     entity.playsThisTurn      -> 0
 *
 *   Strip class (canonical form = key ABSENT; absence is semantically real):
 *     entity.secondaryElement, entity.forcedTargetId,
 *     entity.nextProgramModifier, entity.moves
 *
 * Envelope fields (createdAt, name, description, tags) are never part of a comparison -
 * the diff compares normalized IBattleState only.
 */

import { ELEMENTS } from '../../engine/types';
import type { Element, IBattleEntity, IBattleState } from '../../engine/types';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';

/** Fill-class default for IBattleEntity.relicBonuses. */
export const DEFAULT_RELIC_BONUSES = { draw: 0, energy: 0, attackMod: 1 } as const;

/** Fill-class default for IBattleState.enemyMode - undefined means MOVES everywhere. */
export const DEFAULT_ENEMY_MODE = 'MOVES' as const;

/** Every member of the Element union at 0, plus any counts already present. */
export function zeroFilledElementPlays(
    existing?: Partial<Record<Element, number>>,
): Record<Element, number> {
    const filled = {} as Record<Element, number>;
    for (const element of ELEMENTS) {
        filled[element] = existing?.[element] ?? 0;
    }
    return filled;
}

/**
 * Canonical form for one combat unit. Fill-class keys get defaults; strip-class keys are
 * removed when undefined and passed through untouched when they carry a real value.
 */
export function normalizeBattleEntity(entity: IBattleEntity): IBattleEntity {
    // Destructuring removes the strip-class keys; each is re-added below only if set.
    const { secondaryElement, forcedTargetId, nextProgramModifier, moves, ...rest } = entity;

    // Resolved lazily: GetMingmingData warns on an unknown definitionId, and a snapshot
    // that already carries an activeOS should not pay for that lookup.
    let activeOS = entity.activeOS;
    if (activeOS === undefined) {
        activeOS = GetMingmingData(entity.definitionId).availableOS[0];
    }

    return {
        ...rest,
        relicBonuses: entity.relicBonuses ?? { ...DEFAULT_RELIC_BONUSES },
        hooks: entity.hooks ?? [],
        currentIntent: entity.currentIntent ?? null,
        playsThisTurn: entity.playsThisTurn ?? 0,
        // availableOS is empty for an unresolvable definitionId. An undefined value would
        // be dropped by JSON.stringify anyway, so keep the key absent rather than
        // present-but-undefined, which would break round-trip equality.
        ...(activeOS !== undefined ? { activeOS } : {}),
        ...(secondaryElement !== undefined ? { secondaryElement } : {}),
        ...(forcedTargetId !== undefined ? { forcedTargetId } : {}),
        ...(nextProgramModifier !== undefined ? { nextProgramModifier } : {}),
        ...(moves !== undefined ? { moves } : {}),
    };
}

/** Canonical form for a whole battle state. Pure: the input is not mutated. */
export function normalizeBattleState(state: IBattleState): IBattleState {
    return {
        ...state,
        enemyMode: state.enemyMode ?? DEFAULT_ENEMY_MODE,
        lastStatusConsumed: state.lastStatusConsumed ?? 0,
        elementPlays: zeroFilledElementPlays(state.elementPlays),
        playerParty: state.playerParty.map(normalizeBattleEntity),
        enemyParty: state.enemyParty.map(normalizeBattleEntity),
    };
}
