/**
 * TICKET 168e — pick cards the event will take: "give up a card", the Trader's and the
 * Seiðr Cauldron's card, and the card the Loki's Mirror copies.
 *
 * A row per card from the deck and the run collection (junk is never listed). Deck rows that would
 * break the deck floor are greyed with the reason; so are rows the Trader or Seiðr Cauldron has nothing
 * to swap for. Nothing is dispatched here — `applyChoice` takes the cards once the pick is complete.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';

import type { EventContext } from '../../engine/run/events/eventContext';
import { deckCardStillGivable, heldCards } from '../../engine/run/events/eventGive';
import { recompileTarget, tradeUpTarget } from '../../engine/run/events/eventTrade';
import { playSfx } from '../audio/AudioEngine';
import type { GiveCardsResult } from '../events/outcomePicks';
import { ElementMark } from './CardChassis';
import { cardFace } from './runShell';
import { plain } from '../labels/labels';

export type CardPickerMode = 'give' | 'trade' | 'recompile' | 'copy';

const HINT: Readonly<Record<CardPickerMode, string>> = {
    give: 'Choose the cards to give up.',
    trade: 'Choose a card to trade. You get a random card one rarity higher.',
    recompile: 'Choose a card to recompile. You get a random card of the same element and rarity.',
    copy: 'Choose a card to copy. The copy goes where the original is.',
};

export interface EventCardPickerProps {
    readonly ctx: EventContext;
    readonly mode: CardPickerMode;
    readonly count: number;
    readonly rarity?: string;
    readonly onTake: (pick: GiveCardsResult) => void;
    readonly onBack: () => void;
}

export default function EventCardPicker({ ctx, mode, count, rarity, onTake, onBack }: EventCardPickerProps): ReactNode {
    const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
    const { run } = ctx;
    const rows = heldCards(run, rarity);
    const selectedInDeck = rows.filter((row) => row.pile === 'deck' && selected.includes(row.card.instanceId)).length;

    const reasonFor = (instanceId: string): string | null => {
        const row = rows.find((candidate) => candidate.card.instanceId === instanceId)!;
        if (mode === 'copy' || selected.includes(instanceId)) return null;
        if (row.pile === 'deck' && !deckCardStillGivable(run, selectedInDeck)) return 'Your deck is at its minimum.';
        if (mode === 'trade' && tradeUpTarget(ctx, row.card) === null) return 'Nothing to trade it for.';
        if (mode === 'recompile' && recompileTarget(ctx, row.card) === null) return 'Nothing to recompile it into.';
        return null;
    };

    const toggle = (instanceId: string): void => {
        playSfx('uiClick');
        if (selected.includes(instanceId)) { setSelected(selected.filter((id) => id !== instanceId)); return; }
        if (selected.length >= count) {
            // A single-card pick swaps the choice; a multi-card pick asks the player to deselect first.
            if (count === 1) setSelected([instanceId]);
            return;
        }
        setSelected([...selected, instanceId]);
    };

    return (
        <>
            <p className="ev-text">{HINT[mode]}{count > 1 ? ` (${selected.length} of ${count})` : ''}</p>
            <div className="ev-choices ev-cardrows">
                {rows.map(({ card, pile }) => {
                    const face = cardFace(card.dataId);
                    const reason = reasonFor(card.instanceId);
                    const on = selected.includes(card.instanceId);
                    return (
                        <button
                            key={card.instanceId}
                            type="button"
                            className={`rs-btn ev-choice ev-cardrow ${on ? 'picked' : ''}`}
                            aria-pressed={on}
                            disabled={reason !== null}
                            onClick={() => toggle(card.instanceId)}
                        >
                            <span className="ev-label">
                                <span className="rs-g">{face.cost}</span> <ElementMark element={face.element} compact /> {face.name}
                                <span className="rs-t"> {pile}</span>
                            </span>
                            <span className="ev-detail">{plain(reason ?? face.description)}</span>
                        </button>
                    );
                })}
                {rows.length === 0 && <p className="ev-detail">Nothing to choose.</p>}
            </div>
            <div className="ev-choices ev-row">
                <button type="button" className="rs-btn primary" disabled={selected.length !== count} onClick={() => onTake({ instanceIds: selected })}>
                    CONFIRM
                </button>
                <button type="button" className="rs-btn" onClick={() => { playSfx('uiClick'); onBack(); }}>BACK</button>
            </div>
        </>
    );
}
