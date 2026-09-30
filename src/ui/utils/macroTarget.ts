/**
 * TICKET 172 — **WHO A MACRO LANDS ON, IN ONE PLACE.**
 *
 * Henry, 2026-09-30 playtest: *"I can't revive, because I can't select my terminated mingming. So
 * the revive macro doesn't work."* Revive targets a DOWNED ally (`MacroTargeting.DOWNED_ALLY`), and
 * the stage refuses every click on a unit at 0 HP (`handleEntityClick` returns early, and an ally
 * click selects a CASTER, not a target). So the one legal target of Revive was the one thing the
 * player could not pick, and the rack greyed the button with nothing to be done about it.
 *
 * The rack (`MacroRack`) and the fire handler (`BattleArena`) each worked out the target inline and
 * had to agree by hand; they now both call this.
 *
 * - `ALLY`: the picked unit, or the firing unit when nobody is picked (unchanged).
 * - `DOWNED_ALLY`: the picked unit when it is a downed ally, otherwise the FIRST downed ally in
 *   party order. With one ally down there is no choice to make; with two, clicking a downed ally
 *   picks it (`BattleArena`), and the default is the first.
 * - everything else: the picked unit, with no default, so an enemy-facing macro is never guessed.
 */

import type { IMacroDefinition } from '../../engine/data/macroRegistry';
import type { IBattleState } from '../../engine/types';

export function macroTargetId(
    state: IBattleState | null | undefined,
    macro: Pick<IMacroDefinition, 'targeting'>,
    selectedSourceId: string | null | undefined,
    selectedTargetId: string | null | undefined,
): string {
    switch (macro.targeting) {
        case 'ALLY':
            return selectedTargetId ?? selectedSourceId ?? '';
        case 'DOWNED_ALLY': {
            const downed = (state?.playerParty ?? []).filter((unit) => unit.currentHp <= 0);
            const picked = downed.find((unit) => unit.id === selectedTargetId);
            return (picked ?? downed[0])?.id ?? '';
        }
        default:
            return selectedTargetId ?? '';
    }
}
