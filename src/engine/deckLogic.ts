
import type { IDeckState, ProgramEntity } from './types';
import { GetProgramData } from './data/programRegistry';
import { globalBattleEventBus } from './events';
import { PRNG } from './core/PRNG';

/**
 * Ticket 32: single source of truth. battleReducer.ts and resolutionEngine.ts import this
 * rather than re-declaring their own copies (all three previously said 9 independently).
 *
 * TICKET 131b: 9 -> 12, and `effectHandlers.ts` — which ticket 32 MISSED, and which held a fourth
 * private copy of the 9 — now imports this one. Raising it is not optional beside the `+1 cardDraw`
 * in this commit: the refill is `min(sum(cardDraw) - alive + 1, LIMIT - hand.length)`, and at 3v3
 * +1 a body is +3 to that sum. Measured (`scratch/handeconomy.ts`): the cap clipped **4-9.5%** of
 * refills before the draw change and **~50%** after, eating 1.1 cards a turn — half the extra draw
 * thrown away. 12 is 9 plus the +3 the change adds at full party, so a three-body side gets the
 * cards it is now owed and a solo one is unaffected.
 */
export const HAND_SIZE_LIMIT = 12;

/**
 * Handles drawing cards from the deck.
 * Automatically shuffles discard into drawpile if drawpile is empty.
 * Emits CARD_DRAWN and DECK_SHUFFLED events.
 */
export function drawCards(
    deckState: IDeckState,
    count: number,
    seed: string,
    /**
     * TICKET 111: instance id of the card currently RESOLVING, which is already sitting in the
     * discard because `handlePlayProgram` put it there while paying its cost. It is held out of a
     * reshuffle so a card cannot draw itself. Everything else in the discard shuffles as normal.
     */
    excludeInstanceId?: string | null,
): { state: IDeckState; nextSeed: string; shuffled: boolean } {
    // `const`: steam-release-prep tightened this and the body only pushes, never reassigns.
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

            // Seeded Fisher-Yates Shuffle.
            //
            // TICKET 111: the resolving card is EXCLUDED AFTER the shuffle, not before it. Filtering
            // first would shuffle n-1 cards instead of n and consume a different amount of the PRNG,
            // which re-rolls the drawpile order for every reshuffle in the game - measured, that is
            // most reshuffles on all 32 decks, i.e. a full 1v1 re-baseline for a correctness fix.
            // Shuffling the whole discard first keeps the stream byte-identical to the old behaviour
            // and changes exactly one thing: the card that is mid-resolution is not available to be
            // drawn by its own action. It goes back to the discard and is drawable again next time.
            const prng = new PRNG(currentSeed);
            const { shuffled, nextSeed } = prng.shuffle(currentDiscard);

            currentDrawpile = excludeInstanceId
                ? shuffled.filter(c => c.id !== excludeInstanceId)
                : shuffled;
            currentDiscard = excludeInstanceId
                ? shuffled.filter(c => c.id === excludeInstanceId)
                : [];

            if (currentDrawpile.length === 0) {
                // The discard held nothing but the resolving card: there is genuinely nothing to
                // draw. This is the case that used to loop forever.
                currentSeed = nextSeed;
                break;
            }
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
