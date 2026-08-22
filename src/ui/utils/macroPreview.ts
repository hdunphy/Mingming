/**
 * WHAT A MACRO WILL ACTUALLY DO, IN TRUE NUMBERS — ticket 15.
 *
 * # WHY THIS SIMULATES INSTEAD OF RE-DERIVING
 *
 * "Power dies at the surface" is formal UI law (map § Notes) and ticket 13 has tests behind it:
 * *"true numbers in UI; `power` is internal pricing only."* `macros-and-drivers.md` says the same in
 * its own words — *"previews show true damage everywhere, power remains the pricing currency."*
 *
 * Surge is printed at a power figure and Mend at a heal figure, and neither is a number the player
 * may see. What they must see instead is the HP that moves — which depends on the firing unit's
 * attack, the target's defense, the /45 divisor, the frozen level-15 calibration, any firmware
 * multiplier, and the target's shields. Re-deriving that here would be a second damage formula, and
 * ticket 104 already paid for that mistake once: the old analytic card preview drifted from the
 * reducer on 52 casts across 13 cards.
 *
 * So this does exactly what `damagePreview.computeDamagePreview` does — **fires the macro through the
 * real reducer on a throwaway copy of the state, under a muted event bus, and reports what happened.**
 * It cannot drift, because there is no second implementation to drift from. The simulated state is
 * discarded, so the simulation's RNG draws (Cache Pull's draw, for instance) never reach the real
 * game.
 */

import { canFireMacro, battleReducer, type MacroFireBlock } from '../../engine/battleReducer';
import { getMacro } from '../../engine/data/macroRegistry';
import { globalBattleEventBus } from '../../engine/events';
import type { IBattleState } from '../../engine/types';

export interface MacroPreview {
    /** True when the shot will land. When false, `block` says why and nothing else is meaningful. */
    readonly ok: boolean;
    readonly block: MacroFireBlock | null;
    /**
     * HP the target actually gains (positive) or loses (negative), measured against the target's
     * HP-plus-shield pool exactly as the card preview measures it. 0 for a macro that moves no HP.
     */
    readonly hpDelta: number;
    /**
     * The one line the rack's tooltip prints. **Contains no power figure and never the word.** For a
     * macro whose effect is a fixed count (3 Poison, draw 2, +1 Energy) that count IS the true
     * number and comes straight from the registry's description; for Surge, Mend and Revive it is
     * the simulated HP.
     */
    readonly line: string;
}

/** HP plus shield, because absorbed damage is still HP the player watches move. */
function pool(state: IBattleState, id: string): number {
    const e = state.playerParty.find((x) => x.id === id) ?? state.enemyParty.find((x) => x.id === id);
    return (e?.currentHp ?? 0) + (e?.tempHp ?? 0);
}

/** What the rack prints on a dead slot. One sentence each, in the player's terms, never a code. */
export const MACRO_BLOCK_LABEL: Readonly<Record<MacroFireBlock, string>> = {
    'wrong-phase': 'Not right now',
    'not-your-turn': 'Only on your turn',
    'battle-over': 'The fight is over',
    'unknown-macro': 'Unknown macro',
    'map-only': 'Fires from the map, not in a fight',
    'no-source': 'Pick one of your units first',
    'bad-target': 'Pick a valid target first',
    'nothing-to-echo': 'You have not played a card yet',
};

export function computeMacroPreview(
    state: IBattleState | null | undefined,
    macroId: string | null | undefined,
    sourceId: string | null | undefined,
    targetId: string | null | undefined,
): MacroPreview {
    const macro = getMacro(macroId);
    if (!state || !macro) {
        return { ok: false, block: 'unknown-macro', hpDelta: 0, line: MACRO_BLOCK_LABEL['unknown-macro'] };
    }

    const payload = { macroId: macro.id, sourceId: sourceId ?? '', targetId: targetId ?? '' };
    const block = canFireMacro(state, payload);
    if (block !== null) {
        return { ok: false, block, hpDelta: 0, line: MACRO_BLOCK_LABEL[block] };
    }

    // A SELF macro resolves onto the firing unit whatever the player last clicked, so the pool being
    // measured has to follow the same rule the reducer uses or a Recharge would be measured against
    // an enemy that never changed.
    const measuredId = macro.targeting === 'SELF' ? payload.sourceId : payload.targetId;

    const before = pool(state, measuredId);
    const after = globalBattleEventBus.runMuted(() => battleReducer(state, {
        type: 'FIRE_MACRO',
        payload,
    }));
    const hpDelta = pool(after, measuredId) - before;

    /**
     * **A macro that MOVES HP always prints a number, even when that number is zero.**
     *
     * The distinction is between "this macro does not move HP" (Venom Shot, Cache Pull — whose own
     * description already carries the true count, and restating it from a simulation would be a
     * worse sentence, not a truer one) and "this macro moves HP, and right now it would move none"
     * (a Mend aimed at an ally already at full health). Falling back to prose in the second case
     * would read as an endorsement of a wasted consumable, which is the one thing a single-use item
     * preview must never do.
     */
    const movesHp = macro.actions.some((a) => a.type === 'ATTACK' || a.type === 'HEAL' || a.type === 'REVIVE');
    const line = hpDelta < 0
        ? `${-hpDelta} damage`
        : movesHp
            ? `${hpDelta} HP restored`
            : macro.description;

    return { ok: true, block: null, hpDelta, line };
}
