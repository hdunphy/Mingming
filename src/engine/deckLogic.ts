
import type { IDeckState, ProgramEntity } from './types';
import { GetProgramData } from './data/programRegistry';
import { globalBattleEventBus } from './events';
import { PRNG } from './core/PRNG';

/** Ticket 32: single source of truth. battleReducer.ts and resolutionEngine.ts import this
 *  rather than re-declaring their own copies (all three previously said 9 independently). */
export const HAND_SIZE_LIMIT = 9;

/**
 * Handles drawing cards from the deck.
 * Automatically shuffles discard into drawpile if drawpile is empty.
 * Emits CARD_DRAWN and DECK_SHUFFLED events.
 */
export function drawCards(deckState: IDeckState, count: number, seed: string): { state: IDeckState; nextSeed: string; shuffled: boolean } {
    const currentHand = [...deckState.hand];
    let currentDrawpile = [...deckState.drawpile];
    let currentDiscard = [...deckState.discard];
    let currentSeed = seed;
    let didShuffle = false;
    const ownerId = deckState.ownerId;

    for (let i = 0; i < count; i++) {
        if (currentHand.length >= HAND_SIZE_LIMIT) break;

        if (currentDrawpile.length === 0) {
            if (currentDiscard.length === 0) break; // No cards left

            // Seeded Fisher-Yates Shuffle
            const prng = new PRNG(currentSeed);
            const { shuffled, nextSeed } = prng.shuffle(currentDiscard);

            currentDrawpile = shuffled;
            currentDiscard = [];
            currentSeed = nextSeed;
            didShuffle = true;

            globalBattleEventBus.emit({ type: 'DECK_SHUFFLED', ownerId, timestamp: Date.now() });
        }

        const drawnCard = currentDrawpile.shift();
        if (drawnCard) {
            currentHand.push(drawnCard);
            globalBattleEventBus.emit({ type: 'CARD_DRAWN', ownerId, cardId: drawnCard.dataId, timestamp: Date.now() });
        }
    }

    return {
        state: {
            ...deckState,
            hand: currentHand,
            drawpile: currentDrawpile,
            discard: currentDiscard
        },
        nextSeed: currentSeed.toString(),
        shuffled: didShuffle
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

/**
 * Discards a specific card from the hand.
 */
export function discardCard(deckState: IDeckState, cardId: string): IDeckState {
    const cardIndex = deckState.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return deckState;
    const card = deckState.hand[cardIndex];
    return {
        ...deckState,
        hand: deckState.hand.filter(c => c.id !== cardId),
        discard: [...deckState.discard, card]
    };
}

/**
 * Exhausts a specific card from a given pile (default: hand).
 */
export function exhaustCard(deckState: IDeckState, cardId: string, fromPile: 'HAND' | 'DISCARD' | 'DRAW' = 'HAND'): IDeckState {
    let card: ProgramEntity | undefined;
    let newHand = deckState.hand;
    let newDiscard = deckState.discard;
    let newDraw = deckState.drawpile;

    if (fromPile === 'HAND') {
        card = deckState.hand.find(c => c.id === cardId);
        if (card) newHand = deckState.hand.filter(c => c.id !== cardId);
    } else if (fromPile === 'DISCARD') {
        card = deckState.discard.find(c => c.id === cardId);
        if (card) newDiscard = deckState.discard.filter(c => c.id !== cardId);
    } else if (fromPile === 'DRAW') {
        card = deckState.drawpile.find(c => c.id === cardId);
        if (card) newDraw = deckState.drawpile.filter(c => c.id !== cardId);
    }

    if (!card) return deckState; // Card not found

    return {
        ...deckState,
        hand: newHand,
        discard: newDiscard,
        drawpile: newDraw,
        exhaust: [...deckState.exhaust, card]
    };
}

/**
 * Returns a specific card from discarded or exhausted pile back to hand or draw pile.
 */
export function returnCard(deckState: IDeckState, cardId: string, fromPile: 'DISCARD' | 'EXHAUST', toPile: 'HAND' | 'DRAW'): IDeckState {
    let card: ProgramEntity | undefined;
    let newDiscard = deckState.discard;
    let newExhaust = deckState.exhaust;

    if (fromPile === 'DISCARD') {
        card = deckState.discard.find(c => c.id === cardId);
        if (card) newDiscard = deckState.discard.filter(c => c.id !== cardId);
    } else {
        card = deckState.exhaust.find(c => c.id === cardId);
        if (card) newExhaust = deckState.exhaust.filter(c => c.id !== cardId);
    }

    if (!card) return deckState;

    let newHand = deckState.hand;
    let newDraw = deckState.drawpile;

    if (toPile === 'HAND') {
        if (newHand.length < HAND_SIZE_LIMIT) {
            newHand = [...newHand, card];
        } else {
            // Hand full, failed to return to hand, toss it to discard instead
            newDiscard = [...newDiscard, card];
        }
    } else {
        newDraw = [...newDraw, card];
    }

    return {
        ...deckState,
        discard: newDiscard,
        exhaust: newExhaust,
        hand: newHand,
        drawpile: newDraw
    };
}

/**
 * Searches the drawpile (and optionally discard) for cards matching a criteria and moves them to hand.
 */
export function searchCard(deckState: IDeckState, amount: number, criteria?: { element?: string; category?: string; }, includeDiscard = false): IDeckState {
    const newDraw = [...deckState.drawpile];
    const newDiscard = [...deckState.discard];
    const newHand = [...deckState.hand];
    let cardsFound = 0;

    const matchesCriteria = (card: ProgramEntity) => {
        if (!criteria) return true;
        const data = GetProgramData(card.dataId);
        if (criteria.element && data.element !== criteria.element) return false;
        if (criteria.category && data.category !== criteria.category) return false;
        return true;
    };

    // Search drawpile first
    for (let i = newDraw.length - 1; i >= 0 && cardsFound < amount; i--) {
        if (matchesCriteria(newDraw[i])) {
            const card = newDraw.splice(i, 1)[0];
            if (newHand.length < HAND_SIZE_LIMIT) {
                newHand.push(card);
                cardsFound++;
            } else {
                newDraw.splice(i, 0, card); // Put back if hand full
                break;
            }
        }
    }

    // Optional search in discard
    if (includeDiscard && cardsFound < amount) {
        for (let i = newDiscard.length - 1; i >= 0 && cardsFound < amount; i--) {
            if (matchesCriteria(newDiscard[i])) {
                const card = newDiscard.splice(i, 1)[0];
                if (newHand.length < HAND_SIZE_LIMIT) {
                    newHand.push(card);
                    cardsFound++;
                } else {
                    newDiscard.splice(i, 0, card); // Put back if hand full
                    break;
                }
            }
        }
    }

    return {
        ...deckState,
        drawpile: newDraw,
        discard: newDiscard,
        hand: newHand
    };
}
