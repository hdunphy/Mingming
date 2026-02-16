/**
 * Epic 3: Global Game State Types
 * Persistent data structures for the player's save file.
 */

import { createMockEntity } from "./data/battleFactories";
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
    const starter1: IMingmingState = createMockEntity('Squirt', 'kraken');
    const starter2: IMingmingState = createMockEntity('Spikey', 'kraken');
    const starter3: IMingmingState = createMockEntity('Chomper', 'kraken');

    // Starter deck cards (Water-themed)
    const starterCardIds = [
        'squirt', 'water_jet', 'whirlpool', 'bathe', 'scald',
        'toxic_water', 'renew', 'wave', 'hypnosis', 'reguvinate',
        'rain', 'drink_tea', 'hydro_pump', 'cannon_ball', 'hot_springs', 'nightmare'
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
