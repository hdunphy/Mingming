
import type { IDeckState, ProgramEntity } from './types';
import { GetProgramData } from './data/programRegistry';
import { globalBattleEventBus } from './events';

const HAND_SIZE_LIMIT = 9;

/**
 * Handles drawing cards from the deck.
 * Automatically shuffles discard into drawpile if drawpile is empty.
 * Emits CARD_DRAWN and DECK_SHUFFLED events.
 */
export function drawCards(deckState: IDeckState, count: number): IDeckState {
    let currentHand = [...deckState.hand];
    let currentDrawpile = [...deckState.drawpile];
    let currentDiscard = [...deckState.discard];
    const ownerId = deckState.ownerId;

    for (let i = 0; i < count; i++) {
        if (currentHand.length >= HAND_SIZE_LIMIT) break;

        if (currentDrawpile.length === 0) {
            if (currentDiscard.length === 0) break; // No cards left

            // Shuffle Discard into Drawpile
            // For now, we simply move the entities. 
            // If we needed to reset them (e.g. cost), we would do it here.
            currentDrawpile = [...currentDiscard];

            // Fisher-Yates shuffle would be better, but simple sort for MVP
            currentDrawpile.sort(() => Math.random() - 0.5);
            currentDiscard = [];

            globalBattleEventBus.emit({ type: 'DECK_SHUFFLED', ownerId, timestamp: Date.now() });
        }

        const drawnCard = currentDrawpile.shift();
        if (drawnCard) {
            // Card is already an entity in the drawpile
            currentHand.push(drawnCard);
            globalBattleEventBus.emit({ type: 'CARD_DRAWN', ownerId, cardId: drawnCard.dataId, timestamp: Date.now() });
        }
    }

    return {
        ...deckState,
        hand: currentHand,
        drawpile: currentDrawpile,
        discard: currentDiscard
    };
}

/**
 * Discards the entire hand.
 * Emits PROGRAM_DISCARDED events (if we want to track individual discards, otherwise just moves them).
 * For now, mostly used in Phase End.
 */
export function discardHand(deckState: IDeckState): IDeckState {
    // Optional: Emit discard events for each card?
    // events.ts has PROGRAM_DISCARDED.
    deckState.hand.forEach(card => {
        globalBattleEventBus.emit({
            type: 'PROGRAM_DISCARDED',
            ownerId: deckState.ownerId,
            cardId: card.id,
            manual: false,
            timestamp: Date.now()
        });
    });

    return {
        ...deckState,
        discard: [...deckState.discard, ...deckState.hand],
        hand: []
    };
}
