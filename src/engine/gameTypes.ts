/**
 * Epic 3: Global Game State Types
 * Persistent data structures for the player's save file.
 */

import type { Element } from './types';

// --- MingMing Instance (in roster) ---

export interface IMingmingInstance {
    readonly id: string;            // Unique UUID
    readonly definitionId: string;  // Ref to IMingmingDefinition
    readonly nickname?: string;
    readonly level: number;
    readonly experience: number;
    readonly attackIV: number;
    readonly defenseIV: number;
    readonly hpIV: number;
}

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
    readonly roster: ReadonlyArray<IMingmingInstance>;
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

export function createMingmingInstance(
    definitionId: string,
    level: number = 1
): IMingmingInstance {
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
