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

export const DECK_SIZE = 12;

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
    readonly xp: number;
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

export function createStarterSave(starterId: 'kraken' | 'fenrir' = 'kraken'): IPlayerSave {
    const isWater = starterId === 'kraken';

    // Starter MingMing (Level 1)
    const starter: IMingmingState = {
        id: crypto.randomUUID(),
        definitionId: starterId,
        nickname: isWater ? 'Bubbles' : 'Iggy',
        level: 1,
        experience: 0,
        attackIV: 10 + Math.floor(Math.random() * 6),
        defenseIV: 10 + Math.floor(Math.random() * 6),
        hpIV: 10 + Math.floor(Math.random() * 6)
    };

    // Starter deck cards (12 cards)
    const waterStarterIds = [
        'squirt', 'water_jet', 'whirlpool', 'bathe', 'scald',
        'toxic_water', 'renew', 'wave', 'hypnosis', 'reguvinate',
        'rain', 'drink_tea'
    ];
    const fireStarterIds = [
        'spicy_breath', 'flamethrower', 'erupt', 'rage', 'charge',
        'toats', 'roast', 'preheat', 'flash', 'fire_punch',
        'ignite_pipeline', 'combustion'
    ];

    const starterCardIds = isWater ? waterStarterIds : fireStarterIds;
    const starterCards: IOwnedProgram[] = starterCardIds.map(dataId => ({
        instanceId: crypto.randomUUID(),
        dataId
    }));

    return {
        version: 1,
        roster: [starter],
        activeParty: [starter.id],
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
