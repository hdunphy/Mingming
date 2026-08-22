/**
 * WHAT EVERY CARD IN THE HAND WILL ACTUALLY DO, FOR THE CASTER THE PLAYER HAS SELECTED — ticket 22.
 *
 * # THE RULE THIS FILE EXISTS FOR
 *
 * "Power dies at the surface" is formal UI law (map § Notes), given tests by ticket 13 and restated
 * by `macros-and-drivers.md` in its own words: *"with levelling removed, power → damage is
 * deterministic; previews show TRUE DAMAGE everywhere, power remains the pricing currency."*
 *
 * In a 1v1 fight that law was satisfiable by a single number per card, because there was only ever
 * one caster. **3v3 breaks that.** The deck is shared and the hand is shared, so the same card sits
 * in front of three units with different Attack stats and different elements — and the number it
 * will produce is a property of the (caster, card, target) triple, not of the card. A card reading
 * "18" in one caster's hand and dealing 25 from another is exactly the hidden number ticket 22 was
 * opened to close, and it is a WORSE hidden number than a printed power figure would be, because a
 * player has no reason to distrust it.
 *
 * So the hand re-reads in full whenever the selected caster changes. Selecting W/E/R, clicking a
 * party member or spinning the wheel all land on the same Redux field, so all three paths get it.
 *
 * # WHY IT SIMULATES, AND WHAT THAT COSTS
 *
 * It does not re-derive anything: it calls `damagePreview.simulatePlay`, which is the same cast into
 * a discarded state that ticket 104 introduced for the unit face and ticket 15 reused for the macro
 * rack. There is one damage formula in this game and no UI file contains a copy of it.
 *
 * The cost is **one reducer run per card in hand**, and the hand is capped at `HAND_SIZE_LIMIT` (9).
 * A full re-read is therefore at most nine card resolutions. That is far too much to pay per frame —
 * React re-renders the hand on every hover, every drag pixel and every animation tick — so the
 * results are memoised on `(state, caster, target, card)`:
 *
 * - The **state** is the cache's identity, held in a `WeakMap`. `IBattleState` is immutable and the
 *   reducer replaces it wholesale on every action, so a new state is precisely the event that makes
 *   a preview stale, and an old state's entries are collected with it. No invalidation to get wrong.
 * - The **caster, target and card** are the key inside that state, because those are the three
 *   things the number depends on.
 *
 * The practical effect: a caster switch costs up to nine simulations ONCE, and every re-render until
 * the next dispatch costs a map lookup. Cards the player never brings a target near are still
 * computed, because the whole point is that the hand reads correctly *before* they commit.
 */

import type { Element, IBattleEntity, IBattleState, ProgramData } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';
import { computeDamagePreview, simulatePlay, type DamagePreview } from './damagePreview';

/** One card's true numbers, as they stand for the selected caster against the preview target. */
export interface HandCardPreview {
    readonly cardId: string;
    /** TRUE HP the preview target loses. 0 when this card costs them nothing. */
    readonly damage: number;
    /** TRUE HP the measured ally gains. 0 when this card restores nothing. */
    readonly healing: number;
    /** True when the simulated cast leaves the target at 0 HP. */
    readonly lethal: boolean;
    /** Hits the card lands on the target — the "×3" chip on a multi-hit card. */
    readonly hitCount: number;
    /** True when the card's element matches the CASTER's primary/secondary element (×1.5 STAB). */
    readonly stab: boolean;
    /** ElementalMatrix product vs the preview target; 1 when neutral or not an attack. */
    readonly effectiveness: number;
    /** The card's element. */
    readonly element: Element;
    /** Whose HP the two numbers above were measured on — never left implicit on the surface. */
    readonly measuredOn: string | null;
}

const EMPTY: Omit<HandCardPreview, 'cardId'> = {
    damage: 0, healing: 0, lethal: false, hitCount: 0,
    stab: false, effectiveness: 1, element: 'None', measuredOn: null,
};

/**
 * ×1.5 STAB, read off the CASTER rather than the card.
 *
 * 'None' is excluded because every unit carries a 'None' secondary, so a None card would light up
 * for everybody and stop being a differential signal at all. Kept here rather than in the component
 * so the hand, the unit face and any future surface answer the question the same way.
 */
export function hasStab(caster: IBattleEntity | undefined, data: ProgramData): boolean {
    if (!caster || data.element === 'None') return false;
    return caster.primaryElement === data.element || caster.secondaryElement === data.element;
}

/**
 * The entity the hand's numbers are quoted against.
 *
 * Hovered beats selected beats the first living enemy, which is deliberately the SAME precedence
 * `BattleStage` uses to choose which enemy it spotlights. The two must agree: a hand quoting damage
 * against one enemy while the stage shows another is a hidden number wearing a picture.
 *
 * The final fallback is what makes the hand readable at all before the player has picked anything.
 * It is only honest because the surface names whoever it landed on — see `measuredOn`.
 */
export function pickPreviewTarget(
    state: IBattleState | null | undefined,
    hoveredEntityId: string | null | undefined,
    selectedTargetId: string | null | undefined,
): IBattleEntity | null {
    if (!state) return null;
    const all = [...state.playerParty, ...state.enemyParty];
    const hovered = hoveredEntityId ? all.find(e => e.id === hoveredEntityId) : undefined;
    if (hovered && hovered.currentHp > 0) return hovered;
    const selected = selectedTargetId ? all.find(e => e.id === selectedTargetId) : undefined;
    if (selected && selected.currentHp > 0) return selected;
    return state.enemyParty.find(e => e.currentHp > 0) ?? null;
}

/** Cards whose true number is an amount of HP RESTORED rather than an amount taken. */
function healsSomething(data: ProgramData): boolean {
    return (data.actions ?? []).some(a => a.type === 'HEAL' || a.type === 'REVIVE');
}

function previewOne(
    state: IBattleState,
    caster: IBattleEntity | undefined,
    card: { id: string; dataId: string },
    target: IBattleEntity | null,
): HandCardPreview {
    const data = GetProgramData(card.dataId);
    const stab = hasStab(caster, data);
    const base = { ...EMPTY, cardId: card.id, element: data.element, stab };
    if (!caster || caster.currentHp <= 0) return base;

    // An attack card's number is measured on whoever the hand is pointed at, and
    // `computeDamagePreview` carries the whole chip breakdown with it. One simulation.
    if ((data.actions ?? []).some(a => a.type === 'ATTACK')) {
        if (!target) return base;
        const p: DamagePreview = computeDamagePreview(state, caster.id, card.id, target.id);
        return {
            ...base,
            damage: p.damage,
            lethal: p.lethal,
            hitCount: p.hitCount,
            // The card's own element decides STAB, but the MATCHUP is a fact about this target, so
            // it comes from the preview rather than from the card.
            effectiveness: p.damage > 0 ? p.effectiveness : 1,
            measuredOn: p.damage > 0 ? target.name : null,
        };
    }

    /*
     * A heal's true number is just as hidden as a damage figure and the law does not distinguish
     * them, so it is measured the same way — one cast into a discarded state, the pool read before
     * and after. It is NOT a second damage formula: `simulatePlay` is the identical helper the line
     * above uses, and the only difference here is which sign of the delta is interesting.
     *
     * A Self card resolves onto its caster whatever the player last clicked (the reducer's rule), so
     * the measured unit follows that rather than the pointer. An ally-facing heal aimed at an enemy
     * is meaningless, so it falls back to the caster too — which is also the default
     * `MacroRack`/`BattleArena` apply when an ally macro fires with nobody picked.
     */
    if (healsSomething(data)) {
        const targetIsAlly = !!target && state.playerParty.some(p => p.id === target.id);
        const measured = data.target === 'Self' || !targetIsAlly ? caster : target!;
        const sim = simulatePlay(state, caster.id, card.id, measured.id);
        if (!sim || sim.delta <= 0) return { ...base, measuredOn: measured.name };
        return { ...base, healing: sim.delta, measuredOn: measured.name };
    }

    // Buffs, draws, statuses: no HP moves, so there is no true HP number to print and the card's
    // own description already carries whatever counts it has (the same call `macroPreview` makes).
    return base;
}

/** Per-state cache. See the file header for why state identity is the right invalidation key. */
const CACHE = new WeakMap<IBattleState, Map<string, HandCardPreview>>();

/**
 * Every card in hand, previewed for `sourceId` against `targetId`.
 *
 * Memoised per `(state, caster, target, card)`; see the file header for the cost argument.
 */
export function computeHandPreviews(
    state: IBattleState | null | undefined,
    sourceId: string | null | undefined,
    target: IBattleEntity | null,
): ReadonlyMap<string, HandCardPreview> {
    const out = new Map<string, HandCardPreview>();
    if (!state) return out;

    let perState = CACHE.get(state);
    if (!perState) {
        perState = new Map<string, HandCardPreview>();
        CACHE.set(state, perState);
    }

    const caster = sourceId ? state.playerParty.find(p => p.id === sourceId) : undefined;
    for (const card of state.playerDeck.hand) {
        const key = `${sourceId ?? '-'}|${target?.id ?? '-'}|${card.id}`;
        let hit = perState.get(key);
        if (!hit) {
            hit = previewOne(state, caster, card, target);
            perState.set(key, hit);
        }
        out.set(card.id, hit);
    }
    return out;
}
