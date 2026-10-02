/**
 * TICKET 180c — an event's card-row steps: give cards up (`GIVE_CARD`), trade one up (`TRADE_UP`),
 * recompile one (`TRANSFORM`) and copy one (`DUPLICATE`). The rows, the deck-floor rule and the
 * "nothing to trade it for" reasons are `EventCardPicker`'s: `heldCards`, `deckCardStillGivable`,
 * `tradeUpTarget`, `recompileTarget`. A one-card step is answered by choosing the card; a
 * several-card step ticks cards one move at a time and is confirmed when the count is met.
 */
import { deckCardStillGivable, heldCards } from '../../../../engine/run/events/eventGive';
import { recompileTarget, tradeUpTarget } from '../../../../engine/run/events/eventTrade';
import { cardLine, cardName } from '../../gameText';
import type { Move, Section } from '../../types';
import { toggleSelected } from '../flow';
import type { StepInput } from './stepInput';

export type CardRowsMode = 'give' | 'trade' | 'recompile' | 'copy';

export function cardRowsStep(input: StepInput, mode: CardRowsMode, count: number, rarity?: string): Section {
    const { world, ctx, flow, take } = input;
    const rows = heldCards(ctx.run, rarity);
    const selected = flow.selected;
    const selectedInDeck = rows.filter((r) => r.pile === 'deck' && selected.includes(r.card.instanceId)).length;

    const reasonFor = (instanceId: string): string | null => {
        const row = rows.find((r) => r.card.instanceId === instanceId)!;
        if (mode === 'copy' || selected.includes(instanceId)) return null;
        if (row.pile === 'deck' && !deckCardStillGivable(ctx.run, selectedInDeck)) return 'your deck is at its minimum';
        if (mode === 'trade' && tradeUpTarget(ctx, row.card) === null) return 'nothing to trade it for';
        if (mode === 'recompile' && recompileTarget(ctx, row.card) === null) return 'nothing to recompile it into';
        return null;
    };

    const lines = [`CHOOSE ${count > 1 ? `${count} CARDS (${selected.length} chosen)` : 'A CARD'} (${mode}):`];
    const moves: Move[] = [];
    for (const { card, pile } of rows) {
        const reason = reasonFor(card.instanceId);
        const on = selected.includes(card.instanceId);
        lines.push(`  ${cardLine(card.dataId)} [${pile}]${on ? ' [chosen]' : ''}${reason ? ` [no: ${reason}]` : ''}`);
        if (reason !== null) continue;
        moves.push(count === 1
            ? { key: `event:card:${card.instanceId}`, label: `Choose ${cardName(card.dataId)} (${pile})`, apply: () => take({ instanceIds: [card.instanceId] }) }
            : { key: `event:card:${card.instanceId}`, label: `${on ? 'Untick' : 'Tick'} ${cardName(card.dataId)} (${pile})`, apply: () => toggleSelected(world, card.instanceId, count, selected) });
    }
    if (count > 1 && selected.length === count) {
        moves.push({ key: 'event:confirm', label: `Confirm the ${count} cards`, apply: () => take({ instanceIds: selected }) });
    }
    if (rows.length === 0) lines.push('  nothing to choose');
    return { lines, moves };
}
