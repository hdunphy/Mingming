/**
 * TICKET 168d — the macros a `MACRO_PICK` outcome offers (Macro Crate).
 *
 * `rollMacroChoices` is the roll the gauntlet's reward uses (three different battle macros); it is
 * handed the node's own seed, so the same node offers the same three on resume.
 */

import { rollMacroChoices } from '../macroRewards';
import { nodeSeed } from '../nodeSeed';
import type { EventContext } from './eventContext';

export function offerMacros(ctx: EventContext, count: number, slot: string): string[] {
    return rollMacroChoices(`${nodeSeed(ctx.run, ctx.node, 'event-macros')}:${slot}`).slice(0, count);
}
