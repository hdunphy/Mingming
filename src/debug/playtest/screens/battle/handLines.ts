/**
 * TICKET 180d — THE HAND, THE PILES AND THE RACK.
 *
 * Each card with its cost and its full rule text exactly as the game prints it (`description`), one
 * line per distinct card with a count for copies, then the pile sizes the draw and discard viewers
 * show, then the macro rack. A macro the battle cannot fire (the map reveal) is marked.
 */
import { getMacro } from '../../../../engine/data/macroRegistry';
import { GetProgramData } from '../../../../engine/data/programRegistry';
import type { IBattleState } from '../../../../engine/types';
import { plain } from '../../../../ui/labels/labels';
import { macroLine } from '../../gameText';

export function handLines(state: IBattleState): string[] {
    const groups = new Map<string, { line: string; count: number }>();
    for (const card of state.playerDeck.hand) {
        const data = GetProgramData(card.dataId);
        const cost = data.baseCost === 'X' ? 'X' : card.currentCost;
        const line = plain(`${data.name || card.dataId} (${cost}e, ${data.element ?? 'None'}): ${data.description ?? ''}`.trimEnd());
        const held = groups.get(line);
        if (held) held.count += 1;
        else groups.set(line, { line, count: 1 });
    }
    const { drawpile, discard, exhaust } = state.playerDeck;
    return [
        `HAND (${state.playerDeck.hand.length}); draw pile ${drawpile.length}, discard ${discard.length}, exhausted ${exhaust.length}:`,
        ...[...groups.values()].map((g) => `  ${g.count > 1 ? `${g.count}x ` : ''}${g.line}`),
    ];
}

export function rackLines(rack: ReadonlyArray<string | null>): string[] {
    const held = rack.map((id, slot) => ({ id, slot })).filter((r) => r.id !== null);
    if (held.length === 0) return ['DRAUGHTS: none in the rack.'];
    return [
        'DRAUGHTS (fire free, once):',
        ...held.map(({ id }) => `  ${macroLine(id!)}${getMacro(id)?.targeting === 'MAP' ? ' [map only]' : ''}`),
    ];
}
