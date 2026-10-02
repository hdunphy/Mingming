/** TICKET 180c — an event's "pick one macro" step. A full rack asks which slot to replace, as `EventMacroPick` does. */
import { offerMacros } from '../../../../engine/run/events/eventMacros';
import { firstFreeMacroSlot } from '../../../../engine/data/macroRegistry';
import { MACRO_SLOTS } from '../../../../engine/runTypes';
import { macroLine, macroName } from '../../gameText';
import type { Move, Section } from '../../types';
import type { StepInput } from './stepInput';

export function macroPickStep({ ctx, outcome, slot, take }: StepInput): Section {
    if (outcome.type !== 'MACRO_PICK') return { lines: [], moves: [] };
    const choices = offerMacros(ctx, outcome.count, slot);
    const rack = ctx.run.macros;
    const full = firstFreeMacroSlot(rack) === -1;
    const lines = [`PICK ONE MACRO${full ? ' (the rack is full, so it replaces a slot)' : ''}:`, ...choices.map((id) => `  ${macroLine(id)}`)];
    const moves: Move[] = [];
    for (const macroId of choices) {
        if (!full) { moves.push({ key: `event:macro:${macroId}`, label: `Take ${macroName(macroId)}`, apply: () => take({ macroId }) }); continue; }
        for (let slot = 0; slot < MACRO_SLOTS; slot += 1) {
            moves.push({ key: `event:macro:${macroId}:${slot}`, label: `Take ${macroName(macroId)} in place of ${macroName(rack[slot])} (slot ${slot + 1})`, apply: () => take({ macroId, replaceSlot: slot }) });
        }
    }
    return { lines, moves };
}
