import type { IBattleState, IBattleEntity, IDamageRecord, Element, AttackActionData } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getModifierBreakdown } from '../../engine/combatUtils';
import { getConstraintBehavior } from '../../engine/ConstraintBehavior';
import { getEffectiveAttackPower, getDamageScalingMultiplier } from '../../engine/actions/ActionExecutors';
import { battleReducer } from '../../engine/battleReducer';
import { globalBattleEventBus } from '../../engine/events';

/** Result of the on-hover damage preview, with the breakdown chips that explain the number. */
export interface DamagePreview {
    /**
     * **WHAT THE CARD HITS FOR**, totalled across every hit it lands on this target. 0 means "no
     * preview".
     *
     * DEFINITION CHANGED 2026-08-24 (Henry, playtest): this used to be *HP lost*, measured by
     * diffing the target's HP pool after a simulated cast — so a lethal blow read as the target's
     * remaining HP (*"if my target only has 5 HP left, all my cards show 5"*) and a hit fully eaten
     * by BarkShield read as nothing at all. It is now the engine's own `raw` figure, read off
     * `IBattleState.damageLedger`, which `handleAttack` writes at the one line where the number
     * still exists — before the shield and before `Math.max(0, …)`.
     *
     * Still one calculation, still no re-derivation: the card is cast through the real reducer
     * exactly as ticket 104 built it. The preview stopped *inferring* the number from the
     * side effects and started *reading* what the engine recorded.
     */
    damage: number;
    /** Of `damage`, how much a shield status ate. 0 when the target has no shield. */
    absorbed: number;
    /** Of `damage`, how much HP will actually be lost — after shields, after the floor at 0. */
    hpDamage: number;
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
    /**
     * TICKET 125: statuses this card will put on, or take off, the target - read out of the
     * same simulation that produces `damage`.
     *
     * Henry, ticket-118 playtest: *"Hexbloom has no indication what it will do. There should
     * be some preview."* `hexbloom` applies Poison scaled by the target's Weakened and deals
     * no direct HP damage, so it failed BOTH of this function's old gates - no ATTACK action,
     * and zero HP lost - and returned no preview at all.
     *
     * DIFFED, not re-derived, for the ticket-104 reason: an analytic prediction of a scaled
     * status application would be a second implementation to drift from. Empty when the card
     * changes no status on this target.
     */
    statusChanges: Array<{ status: string; delta: number }>;
}

const NO_PREVIEW: DamagePreview = {
    damage: 0, absorbed: 0, hpDamage: 0, lethal: false, hitCount: 0, stab: false, effectiveness: 1,
    element: 'None', sharpBonus: 0, scalingMultiplier: 1, statusChanges: [],
};

/** HP plus shield, because absorbed damage is still damage the player watches happen. */
function pool(state: IBattleState, id: string): number {
    const e = state.playerParty.find(x => x.id === id) ?? state.enemyParty.find(x => x.id === id);
    return (e?.currentHp ?? 0) + (e?.tempHp ?? 0);
}

/** Stacks by status type for one unit, so before and after can be diffed. */
function statusMap(state: IBattleState, id: string): Record<string, number> {
    const e = state.playerParty.find(x => x.id === id) ?? state.enemyParty.find(x => x.id === id);
    const out: Record<string, number> = {};
    for (const s of e?.statusEffects ?? []) out[s.type] = (out[s.type] ?? 0) + s.stacks;
    return out;
}

/** What the simulated play changed about the target's statuses, biggest movement first. */
function statusDiff(before: Record<string, number>, after: Record<string, number>) {
    const changes: Array<{ status: string; delta: number }> = [];
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        const delta = (after[key] ?? 0) - (before[key] ?? 0);
        if (delta !== 0) changes.push({ status: key, delta });
    }
    return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function currentHpOf(state: IBattleState, id: string): number {
    const e = state.playerParty.find(x => x.id === id) ?? state.enemyParty.find(x => x.id === id);
    return e?.currentHp ?? 0;
}

/** What one simulated cast did: the resulting throwaway state, the pool delta, and the ledger. */
export interface SimulatedPlay {
    /** The state the reducer produced. Discarded by every caller; never dispatched. */
    readonly after: IBattleState;
    /**
     * Signed pool delta at the measured target: negative is damage taken, positive is HP gained.
     *
     * Still here, and still the right measure for a HEAL — healing has no shield to hide behind and
     * no floor that lies (the cap at `maxHp` is a thing the player wants to see). Damage reads
     * `hits` below instead; see `DamagePreview.damage` for why.
     */
    readonly delta: number;
    /**
     * Every hit this cast landed **on the measured target**, as the engine recorded it.
     *
     * `handleAttack` appends to `IBattleState.damageLedger` and every committed action clears it
     * first, so this is exactly the damage this one cast did — no diffing, no accumulation from
     * earlier plays.
     */
    readonly hits: ReadonlyArray<IDamageRecord>;
}

/**
 * **THE ONE SIMULATION.** Play `cardId` from `sourceId` at `targetId` on a throwaway copy of the
 * state and report what the target's HP-plus-shield pool did.
 *
 * TICKET 22 lifted this out of `computeDamagePreview` rather than writing a second one beside it.
 * The hand now has to read a heal in true HP as well as an attack in true damage (see
 * `handPreview.ts`), and the failure mode of "a second measurement helper" is precisely the drift
 * ticket 104 paid 52 mismatches to learn about. So there is exactly one place that casts a card
 * into a discarded state and exactly one place that measures the pool; the callers differ only in
 * which SIGN of the delta they are interested in and which chips they hang off it.
 *
 * Returns null when there is nothing to measure: no source/card/target, a dead participant, a
 * SELF-side constraint the caster fails, or a reducer that refused the play outright.
 */
export function simulatePlay(
    state: IBattleState | null | undefined,
    sourceId: string | null | undefined,
    cardId: string | null | undefined,
    targetId: string
): SimulatedPlay | null {
    if (!state || !sourceId || !cardId) return null;

    const card = state.playerDeck.hand.find(c => c.id === cardId);
    if (!card) return null;

    const source = state.playerParty.find(p => p.id === sourceId);
    if (!source || source.currentHp <= 0) return null;

    const target =
        state.playerParty.find(e => e.id === targetId) ||
        state.enemyParty.find(e => e.id === targetId);
    if (!target || target.currentHp <= 0) return null;

    // Source-side playability: energy (BASE constraint) plus any other SELF constraints. Kept as a
    // cheap gate in front of the simulation - the reducer would refuse anyway, but a hover should
    // not pay for a whole card resolution to learn that.
    const data = GetProgramData(card.dataId);
    const selfConstraintsOk = (data.constraints || [])
        .filter(c => c.target === 'SELF')
        .every(c => getConstraintBehavior(c.type).validate(c, { source, cost: card.currentCost }));
    if (!selfConstraintsOk) return null;

    const before = pool(state, targetId);
    const after = globalBattleEventBus.runMuted(() => battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId, targetId, programId: cardId },
    }));
    if (after === state) return null;          // the reducer refused the play

    return {
        after,
        delta: pool(after, targetId) - before,
        hits: (after.damageLedger ?? []).filter((hit) => hit.targetId === targetId),
    };
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
    if (!source) return NO_PREVIEW;

    const target =
        state.playerParty.find(e => e.id === targetId) ||
        state.enemyParty.find(e => e.id === targetId);
    if (!target) return NO_PREVIEW;

    const data = GetProgramData(card.dataId);

    const attackActions = (data.actions ?? []).filter(a => a.type === 'ATTACK');

    // THE NUMBER. Everything below this is chips that explain it. The cast itself, the guards in
    // front of it and the pool measurement all live in `simulatePlay` since ticket 22, so the hand's
    // heal preview measures the identical way rather than approximately the same way.
    const statusBefore = statusMap(state, targetId);
    const sim = simulatePlay(state, sourceId, cardId, targetId);
    if (!sim) return NO_PREVIEW;
    const { after, hits } = sim;
    // Summed rather than taken from the last hit: `hits` is one record per ATTACK landed on this
    // target, so a three-hit card reports one total and a card that hits twice through a shield
    // reports both absorptions.
    const damage = hits.reduce((total, hit) => total + hit.raw, 0);
    const statusChanges = statusDiff(statusBefore, statusMap(after, targetId));

    // TICKET 125: a card earns a preview if it does ANYTHING to this target, HP or statuses.
    // The old gates were `no ATTACK action` and `damage <= 0`, which between them silenced every
    // status-only card, `hexbloom` included. A card that does neither still gets none: a pure
    // self-buff, or an attack aimed at its own caster like `forage`.
    if (damage <= 0 && statusChanges.length === 0) return NO_PREVIEW;

    // The chips below are derived off the first ATTACK action, so a status-only card returns the
    // neutral chip set with its statusChanges filled in.
    if (attackActions.length === 0 || damage <= 0) {
        return { ...NO_PREVIEW, element: data.element, statusChanges };
    }

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
        statusChanges,
        absorbed: hits.reduce((total, hit) => total + hit.absorbed, 0),
        hpDamage: hits.reduce((total, hit) => total + hit.applied, 0),
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
