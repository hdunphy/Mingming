/**
 * Deck Suggestion: "fill empty slots" logic for the shared party deck.
 *
 * Pure + headless: given the relevant slices of the save state, returns the
 * instanceIds of owned cards (not already in the deck) that should be added.
 * Never wipes or reorders the existing deck. Deterministic (no randomness).
 */

import { GetProgramData } from './data/programRegistry';
import { MingmingRegistry, getDeckForOS } from './data/mingmingRegistry';
import { DECK_SIZE, MIN_DECK_SIZE } from './gameTypes';
import type { IOwnedProgram, IActiveDeck } from './gameTypes';
import type { IMingmingState, ProgramData } from './types';

export interface DeckSuggestInput {
    readonly cardInventory: ReadonlyArray<IOwnedProgram>;
    readonly activeDeck: IActiveDeck | null;
    readonly roster: ReadonlyArray<IMingmingState>;
    readonly activeParty: ReadonlyArray<string>;
}

const RARITY_ORDER: Record<string, number> = {
    Common: 0,
    Uncommon: 1,
    Rare: 2,
    Epic: 3
};

const isTokenCard = (data: ProgramData): boolean =>
    data.isToken === true || (data.rarity as string) === 'Token';

/**
 * Suggests owned cards to ADD to the active deck (fill-empty-slots semantics).
 *
 * Target size = min(10 * max(1, partySize), DECK_SIZE), where partySize is the
 * number of activeParty ids that resolve to a roster member.
 *
 * Fill priority:
 *  1. Owned copies of the party species' baseDeck cards, in baseDeck order,
 *     respecting how many copies each baseDeck lists vs. copies already in deck.
 *  2. Other owned cards whose element matches a party member's primaryElement
 *     (lower baseCost first, then rarity Common -> Uncommon -> Rare, then name).
 *  3. Element 'None' cards (same ordering).
 *
 * Token cards are never suggested. Never exceeds the target.
 */
export function suggestDeckFill(input: DeckSuggestInput): string[] {
    const { cardInventory, activeDeck, roster, activeParty } = input;

    // Resolve valid party members (ids present in roster), preserving party order
    const partyMembers = activeParty
        .map(id => roster.find(m => m.id === id))
        .filter((m): m is IMingmingState => Boolean(m));

    const partySize = partyMembers.length;
    const target = Math.min(MIN_DECK_SIZE * Math.max(1, partySize), DECK_SIZE);

    const deckCards: ReadonlyArray<string> = activeDeck?.cards ?? [];
    if (deckCards.length >= target) return [];

    let slotsLeft = target - deckCards.length;
    const inDeck = new Set(deckCards);

    // Copies of each dataId already in the deck
    const inDeckCountByDataId: Record<string, number> = {};
    for (const instanceId of deckCards) {
        const owned = cardInventory.find(c => c.instanceId === instanceId);
        if (owned) {
            inDeckCountByDataId[owned.dataId] = (inDeckCountByDataId[owned.dataId] ?? 0) + 1;
        }
    }

    // Available (not-in-deck, non-token) instances grouped by dataId, in inventory order
    const availableByDataId: Record<string, string[]> = {};
    const dataById: Record<string, ProgramData> = {};
    for (const owned of cardInventory) {
        if (inDeck.has(owned.instanceId)) continue;
        const data = dataById[owned.dataId] ?? GetProgramData(owned.dataId);
        dataById[owned.dataId] = data;
        if (isTokenCard(data)) continue;
        (availableByDataId[owned.dataId] ??= []).push(owned.instanceId);
    }

    const picks: string[] = [];
    const addedByDataId: Record<string, number> = {};

    const takeCopy = (dataId: string): boolean => {
        if (slotsLeft <= 0) return false;
        const pool = availableByDataId[dataId];
        if (!pool || pool.length === 0) return false;
        picks.push(pool.shift()!);
        addedByDataId[dataId] = (addedByDataId[dataId] ?? 0) + 1;
        slotsLeft--;
        return true;
    };

    // --- Phase 1: party species' baseDeck cards, in baseDeck order ---
    for (const member of partyMembers) {
        if (slotsLeft <= 0) break;
        const definition = MingmingRegistry[member.definitionId];
        if (!definition) continue;

        // Ticket 13: the member's ACTIVE OS decides which starting deck phase 1
        // walks. Nth listing of a dataId wants >= N copies (existing + filled).
        const memberDeck = getDeckForOS(member.definitionId, member.activeOS);
        const seenInBaseDeck: Record<string, number> = {};
        for (const dataId of memberDeck) {
            if (slotsLeft <= 0) break;
            seenInBaseDeck[dataId] = (seenInBaseDeck[dataId] ?? 0) + 1;
            const wanted = seenInBaseDeck[dataId];
            const have = (inDeckCountByDataId[dataId] ?? 0) + (addedByDataId[dataId] ?? 0);
            if (have >= wanted) continue; // this listing is already satisfied
            takeCopy(dataId);
        }
    }

    // Shared ordering for phases 2 & 3: cost asc, rarity asc, name, then id
    const sortGroupIds = (ids: string[]): string[] =>
        ids.sort((a, b) => {
            const da = dataById[a];
            const db = dataById[b];
            if (da.baseCost !== db.baseCost) return da.baseCost - db.baseCost;
            const ra = RARITY_ORDER[da.rarity] ?? 99;
            const rb = RARITY_ORDER[db.rarity] ?? 99;
            if (ra !== rb) return ra - rb;
            const byName = da.name.localeCompare(db.name);
            if (byName !== 0) return byName;
            return a.localeCompare(b);
        });

    const drainGroups = (dataIds: string[]) => {
        for (const dataId of dataIds) {
            while (slotsLeft > 0 && takeCopy(dataId)) { /* keep taking copies */ }
            if (slotsLeft <= 0) break;
        }
    };

    // --- Phase 2: element matches a party member's primaryElement ---
    if (slotsLeft > 0 && partySize > 0) {
        const partyElements = new Set(
            partyMembers
                .map(m => MingmingRegistry[m.definitionId]?.primaryElement)
                .filter((el): el is NonNullable<typeof el> => Boolean(el))
        );
        const elementMatchIds = sortGroupIds(
            Object.keys(availableByDataId).filter(dataId => {
                const pool = availableByDataId[dataId];
                return pool.length > 0 && partyElements.has(dataById[dataId].element);
            })
        );
        drainGroups(elementMatchIds);
    }

    // --- Phase 3: element 'None' cards ---
    if (slotsLeft > 0) {
        const noneIds = sortGroupIds(
            Object.keys(availableByDataId).filter(dataId => {
                const pool = availableByDataId[dataId];
                return pool.length > 0 && dataById[dataId].element === 'None';
            })
        );
        drainGroups(noneIds);
    }

    return picks;
}
