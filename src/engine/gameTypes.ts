/**
 * Epic 3: Global Game State Types
 * Persistent data structures for the player's save file.
 */

import type { IMingmingState } from "./types";

// --- Card Inventory ---

export interface IOwnedProgram {
    readonly instanceId: string;    // Unique UUID per owned copy
    readonly dataId: string;        // Ref to ProgramData.id
}

// --- Active Deck ---

export interface IActiveDeck {
    readonly id: string;
    readonly name: string;
    readonly cards: ReadonlyArray<string>; // Array of IOwnedProgram.instanceId
}

export const DECK_SIZE = 40;

// --- Blueprint ---

export interface IBlueprint {
    readonly architectureId: string; // Ref to IMingmingDefinition.id
    readonly name: string;
    readonly compileCost: number;     // Scrap cost to compile
}

// --- Reward Bundle (returned by RewardSystem) ---

export interface IRewardBundle {
    readonly scraps: number;
    readonly blueprints: ReadonlyArray<IBlueprint>;
    readonly cards: ReadonlyArray<IOwnedProgram>;
}

// --- Drop Table ---

export interface IDropTableEntry {
    readonly architectureId: string;
    readonly blueprintDropRate: number;   // 0–1, e.g. 0.05 = 5%
    readonly scrapMin: number;
    readonly scrapMax: number;
    readonly cardPool: ReadonlyArray<string>; // ProgramData IDs from this element
}

// --- Root Save Object ---

export interface IPlayerSave {
    readonly version: number;               // Schema version for migration
    readonly roster: ReadonlyArray<IMingmingState>;
    readonly activeParty: ReadonlyArray<string>; // Max 3 IMingmingInstance.id refs
    readonly cardInventory: ReadonlyArray<IOwnedProgram>;
    readonly activeDeck: IActiveDeck | null;
    readonly scrapCount: number;
    readonly blueprints: ReadonlyArray<IBlueprint>;
}

// --- Factory Helpers ---

export function createDefaultSave(): IPlayerSave {
    return {
        version: 1,
        roster: [],
        activeParty: [],
        cardInventory: [],
        activeDeck: null,
        scrapCount: 0,
        blueprints: []
    };
}

export function createStarterSave(): IPlayerSave {
    // Starter MingMings
    const starter1: IMingmingState = {
        id: 'starter-mm-1', definitionId: 'def_fire_1', nickname: 'Ember',
        level: 5, experience: 0, attackIV: 8, defenseIV: 6, hpIV: 10
    };
    const starter2: IMingmingState = {
        id: 'starter-mm-2', definitionId: 'def_fire_2', nickname: 'Blaze',
        level: 5, experience: 0, attackIV: 10, defenseIV: 4, hpIV: 7
    };
    const starter3: IMingmingState = {
        id: 'starter-mm-3', definitionId: 'def_fire_3', nickname: 'Scorch',
        level: 5, experience: 0, attackIV: 6, defenseIV: 9, hpIV: 8
    };

    // Starter deck cards (Fire-themed)
    const starterCardIds = [
        'reckless', 'flamethrower', 'erupt', 'rage', 'charge',
        'radiate', 'fired_up', 'toats', 'roast', 'spicy_breath',
        'preheat', 'flash', 'fire_punch'
    ];
    const starterCards: IOwnedProgram[] = starterCardIds.map(dataId => ({
        instanceId: `starter-card-${dataId}`,
        dataId
    }));

    return {
        version: 1,
        roster: [starter1, starter2, starter3],
        activeParty: [starter1.id, starter2.id, starter3.id],
        cardInventory: starterCards,
        activeDeck: {
            id: 'starter-deck',
            name: 'Starter Deck',
            cards: starterCards.map(c => c.instanceId)
        },
        scrapCount: 50,
        blueprints: []
    };
}

export function createMingmingInstance(
    definitionId: string,
    level: number = 1
): IMingmingState {
    return {
        id: crypto.randomUUID(),
        definitionId,
        level,
        experience: 0,
        attackIV: Math.floor(Math.random() * 16),
        defenseIV: Math.floor(Math.random() * 16),
        hpIV: Math.floor(Math.random() * 16)
    };
}

export function createOwnedProgram(dataId: string): IOwnedProgram {
    return {
        instanceId: crypto.randomUUID(),
        dataId
    };
}
