/**
 * THE MACRO RACK — ticket 15.
 *
 * Three slots beside the hand. `macros-and-drivers.md`, RULED: *"MACROS (3 slots, single-use, fired
 * free on your turn)."* Every word of that is visible here: the slots are drawn empty as well as
 * full so the player can see there are three; firing costs nothing and the slot empties; and the
 * button is dead outside the player's turn.
 *
 * # POWER DIES AT THE SURFACE
 *
 * Standing law (map § Notes), tested in `MacroRack.test.tsx` the same way `MarketplaceNode.test.tsx`
 * tests it: **the rendered markup must not contain the word "power" at all.** So nothing here reads
 * an action's `power` field, and nothing here reuses `CardHand.formatAction` — that helper prints
 * `action.power` straight out of the data, which is exactly the leak the law exists to stop. The
 * number on a Surge slot is the HP the target will actually lose, measured by
 * `macroPreview.computeMacroPreview` running the macro through the real reducer.
 *
 * # WHY THE PARENT FIRES IT
 *
 * Firing is a two-slice write — `battleSlice.fireMacro` resolves it, `runSlice.consumeMacro` spends
 * the slot — and no reducer can do both. `BattleArena` owns that pair (and the ordering argument
 * lives on `consumeMacro`), so this component reports *which slot was clicked* and nothing else.
 * That also keeps it renderable in a test with no run in the store.
 */

import type { ReactNode } from 'react';

import { getMacro } from '../../engine/data/macroRegistry';
import type { MacroSlots } from '../../engine/runTypes';
import type { IBattleState } from '../../engine/types';
import { computeMacroPreview } from '../utils/macroPreview';
import { playSfx } from '../audio/AudioEngine';
import './MacroRack.css';

export interface MacroRackProps {
    readonly macros: MacroSlots;
    readonly battleState: IBattleState;
    readonly selectedSourceId: string | null;
    readonly selectedTargetId: string | null;
    /** Called with the slot index only when the shot will actually land. */
    readonly onFire: (slot: number, macroId: string) => void;
}

export default function MacroRack({
    macros,
    battleState,
    selectedSourceId,
    selectedTargetId,
    onFire,
}: MacroRackProps): ReactNode {
    return (
        <div className="macro-rack" aria-label="Macros">
            <div className="macro-rack-head">MACROS</div>
            {macros.map((macroId, slot) => {
                const macro = getMacro(macroId);
                if (!macro) {
                    return (
                        <div key={slot} className="macro-slot empty">
                            <span className="macro-slot-index">{slot + 1}</span>
                            <span className="macro-slot-empty">empty</span>
                        </div>
                    );
                }

                /**
                 * A macro aimed at an ally with nobody picked defaults to the firing unit, which is
                 * what a player reaching for Mend or Salve in a hurry means. An enemy-facing macro
                 * gets no such default: guessing a target for Surge would let a mis-click spend a
                 * consumable on the wrong enemy, so it stays dead until one is chosen.
                 */
                const targetId = macro.targeting === 'ALLY'
                    ? (selectedTargetId ?? selectedSourceId ?? '')
                    : (selectedTargetId ?? '');

                const preview = computeMacroPreview(battleState, macro.id, selectedSourceId, targetId);

                return (
                    <button
                        key={slot}
                        type="button"
                        className={`macro-slot ${macro.rarity === 'Rare' ? 'rare' : ''} ${preview.ok ? '' : 'blocked'}`}
                        disabled={!preview.ok}
                        // The tooltip carries the true number and the refusal, for the same reason
                        // `MarketplaceNode` prints what a player is short of: a silently inert
                        // control is indistinguishable from a bug to whoever is holding the pad.
                        title={`${macro.name} — ${preview.line}`}
                        onClick={() => {
                            if (!preview.ok) return;
                            playSfx('rewardClaim');
                            onFire(slot, macro.id);
                        }}
                    >
                        <span className="macro-slot-index">{slot + 1}</span>
                        <span className="macro-slot-name">{macro.name}</span>
                        <span className="macro-slot-line">{preview.line}</span>
                    </button>
                );
            })}
            <div className="macro-rack-foot">free · single use</div>
        </div>
    );
}
