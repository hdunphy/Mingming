import type { IBattleState, IBattleEntity, Element, AttackActionData } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getModifierBreakdown } from '../../engine/combatUtils';
import { getConstraintBehavior } from '../../engine/ConstraintBehavior';
import { getEffectiveAttackPower, getDamageScalingMultiplier } from '../../engine/actions/ActionExecutors';
import { battleReducer } from '../../engine/battleReducer';
import { globalBattleEventBus } from '../../engine/events';

/** Result of the on-hover damage preview, with the breakdown chips that explain the number. */
export interface DamagePreview {
    /**
     * TICKET 104: the HP the target will actually lose, measured by playing the card through the
     * real reducer on a throwaway copy of the state. 0 means "no preview".
     *
     * DEFINITION, per the ticket's "pick one and document it": this is HP LOST, not raw damage,
     * and it is the TOTAL across every hit the card lands on this target. A three-hit card shows
     * one number; a lethal blow shows the target's remaining HP and sets `lethal`. Both halves of
     * that choice are what make the number checkable - `previewParity.test.ts` asserts it against
     * the executor for every attack card in the registry across five sampled battle states.
     */
    damage: number;
    /** True when the simulated play leaves the target at 0 HP. */
    lethal: boolean;
    /** How many ATTACK actions the card aims at a target - the "x3" chip on a multi-hit card. */
    hitCount: number;
    /** True when the card's element matches the source's primary/secondary element (×1.5 STAB). */
    stab: boolean;
    /** ElementalMatrix product vs the target (with secondary mitigation); 1 when neutral. */
    effectiveness: number;
    /** The card's element — used to color the STAB chip. */
    element: Element;
    /** Extra POWER granted by action scaling (SHARP_STACKS etc.); 0 when inactive. */
    sharpBonus: number;
    /**
     * Ticket 90: the POST-damage multiplier this card is riding right now - cards played this
     * turn, Energy spent, the target's Burn stacks. 1 when the card has no such scaling.
     * Surfaced separately so the UI can say WHY the number is what it is: a `stampede` at x1
     * and the same card at x4 are the same card having a very different turn.
     */
    scalingMultiplier: number;
    /** The scaling key driving `scalingMultiplier`, for labelling. Undefined when there is none. */
    scalingKind?: string;
}

const NO_PREVIEW: DamagePreview = {
    damage: 0, lethal: false, hitCount: 0, stab: false, effectiveness: 1,
    element: 'None', sharpBonus: 0, scalingMultiplier: 1,
};

/** HP plus shield, because absorbed damage is still damage the player watches happen. */
function pool(state: IBattleState, id: string): number {
    const e = state.playerParty.find(x => x.id === id) ?? state.enemyParty.find(x => x.id === id);
    return (e?.currentHp ?? 0) + (e?.tempHp ?? 0);
}

function currentHpOf(state: IBattleState, id: string): number {
    const e = state.playerParty.find(x => x.id === id) ?? state.enemyParty.find(x => x.id === id);
    return e?.currentHp ?? 0;
}

/**
 * The on-hover damage preview.
 *
 * TICKET 104 - WHY THIS SIMULATES INSTEAD OF RE-DERIVING. The previous implementation predicted
 * the card's FIRST `ATTACK` action analytically and multiplied it by the scalings it knew about.
 * Every mechanic living outside that one action was invisible, and Henry hit three of them in a
 * single playtest: a conditional branch (`blood_rite` previewed 4, dealt 5+5), a firmware
 * multiplier (`deep_vein` previewed 9, dealt 36), and multi-hit cards previewed as one hit. A
 * parity sweep of the whole registry found 52 mismatches across 13 cards in five distinct classes.
 *
 * Re-deriving each class here would have been five more places to drift out of sync - the same
 * trap ticket 90 fell into when it fixed the scalings only. So the preview now plays the card
 * through the REAL reducer on a throwaway copy of the state and reports what happened. It cannot
 * drift, because there is no second implementation to drift from.
 *
 * This is not a novel risk: `TacticalAI.getBestAction` already pushes whole candidate sequences
 * through the reducer under a muted event bus, which is exactly the discipline used here. The
 * returned state is discarded, so the simulation's RNG draws never reach the real game.
 *
 * Returns the zero preview when:
 * - no source is selected, or the selected source is dead,
 * - the card is not in hand, or the target does not exist or is already defeated,
 * - the source cannot play the card (energy / SELF-side constraints),
 * - the reducer refuses the play, or the play costs the target no HP at all (a pure buff, or a
 *   card like `forage` whose only ATTACK is aimed at its own caster).
 */
export function computeDamagePreview(
    state: IBattleState | null | undefined,
    sourceId: string | null | undefined,
    cardId: string | null | undefined,
    targetId: string
): DamagePreview {
    if (!state || !sourceId || !cardId) return NO_PREVIEW;

    const card = state.playerDeck.hand.find(c => c.id === cardId);
    if (!card) return NO_PREVIEW;

    const source = state.playerParty.find(p => p.id === sourceId);
    if (!source || source.currentHp <= 0) return NO_PREVIEW;

    const target =
        state.playerParty.find(e => e.id === targetId) ||
        state.enemyParty.find(e => e.id === targetId);
    if (!target || target.currentHp <= 0) return NO_PREVIEW;

    const data = GetProgramData(card.dataId);

    // Source-side playability: energy (BASE constraint) plus any other SELF constraints. Kept as a
    // cheap gate in front of the simulation - the reducer would refuse anyway, but a hover should
    // not pay for a whole card resolution to learn that.
    const selfConstraintsOk = (data.constraints || [])
        .filter(c => c.target === 'SELF')
        .every(c => getConstraintBehavior(c.type).validate(c, { source, cost: card.currentCost }));
    if (!selfConstraintsOk) return NO_PREVIEW;

    const attackActions = (data.actions ?? []).filter(a => a.type === 'ATTACK');
    if (attackActions.length === 0) return NO_PREVIEW;

    // THE NUMBER. Everything below this is chips that explain it.
    const before = pool(state, targetId);
    const after = globalBattleEventBus.runMuted(() => battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId, targetId, programId: cardId },
    }));
    if (after === state) return NO_PREVIEW;          // the reducer refused the play
    const damage = before - pool(after, targetId);
    if (damage <= 0) return NO_PREVIEW;              // pure buff, or the attack was aimed at SELF

    // The explanatory chips, derived analytically off the FIRST attack action. They are LABELS,
    // not the number: `damage` above is authoritative and is the only thing the parity suite pins.
    const first = attackActions[0] as AttackActionData;
    const { stab, effectiveness } = getModifierBreakdown(source, target, data);
    const basePower = first.power || 0;
    const effectivePower = getEffectiveAttackPower(source, first, target);
    // OFF BY ONE, and it is the one that made the numbers feel wrong: `handlePlayProgram`
    // increments `cardsPlayedThisTurn`, `elementPlays` and `lastEnergySpent` BEFORE the actions
    // resolve, so a scaler counts the card being cast. This chip is computed from the pre-play
    // state, so it has to count this card too or it under-reads by exactly one play.
    const asResolved = {
        ...state,
        cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
        lastEnergySpent: card.currentCost,
        elementPlays: {
            ...(state.elementPlays ?? {}),
            [data.element]: (state.elementPlays?.[data.element] ?? 0) + 1,
        },
    } as IBattleState;
    // TICKET 123: the caster's own play count needs the same +1 the state counters get above,
    // or the hover chip under-reads a CARDS_PLAYED scaler by exactly one cast.
    const sourceAsResolved = { ...source, playsThisTurn: (source.playsThisTurn ?? 0) + 1 } as IBattleEntity;
    const multiplier = getDamageScalingMultiplier(asResolved, first.scaling, data.element, target, sourceAsResolved);

    return {
        damage,
        lethal: currentHpOf(after, targetId) <= 0,
        // `count` is the multi-hit field (`stone_flurry`: one ATTACK action with `count: 3`), so a
        // chip that counted actions alone would read "1" on the very cards the multi-hit chip
        // exists for. Self-aimed attacks (`forage`, `desperate_strike`) are recoil, not hits.
        hitCount: attackActions
            .filter(a => a.target !== 'SELF')
            .reduce((n, a) => n + Math.max(1, (a as { count?: number }).count ?? 1), 0),
        stab,
        effectiveness,
        element: data.element,
        sharpBonus: effectivePower - basePower,
        scalingMultiplier: multiplier,
        scalingKind: multiplier === 1 ? undefined : first.scaling,
    };
}
