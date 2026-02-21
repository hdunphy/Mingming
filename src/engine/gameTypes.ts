/**
 * Epic 3: Global Game State Types
 * Persistent data structures for the player's save file.
 */

import type { IMingmingState } from "./types";
import { getExpForLevel } from "./types";

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
export const MIN_DECK_SIZE = 10;

// --- Blueprint ---

export interface IBlueprint {
    readonly architectureId: string; // Ref to IMingmingDefinition.id
    readonly name: string;
    readonly compileCost: number;     // Scrap cost to compile
}

export interface ICardChoice {
    readonly sourceEntityName: string;
    readonly options: ReadonlyArray<IOwnedProgram>;
}

// --- Reward Bundle (returned by RewardSystem) ---

export interface IRewardBundle {
    readonly scraps: number;
    readonly blueprints: ReadonlyArray<IBlueprint>;
    readonly cards: ReadonlyArray<IOwnedProgram>; // Legacy or guaranteed cards
    readonly cardChoices: ReadonlyArray<ICardChoice>; // "Pick 1 of 3" choices
    readonly totalXP: number;
    readonly relicChoices?: ReadonlyArray<string>;
}

// --- Drop Table ---

export interface IDropTableEntry {
    readonly architectureId: string;
    readonly blueprintDropRate: number;   // 0–1, e.g. 0.05 = 5%
    readonly scrapMin: number;
    readonly scrapMax: number;
    readonly cardPool: ReadonlyArray<string>; // ProgramData IDs from this element
}

// --- Gauntlet State ---


export interface IGauntletState {
    readonly type: 'Gym' | 'Sector';
    readonly element: string;
    readonly currentBattleIndex: number;
    readonly totalBattles: number;
    readonly persistedStats: Record<string, { hp: number, energy: number }>;
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
    readonly relics: ReadonlyArray<string>;
    readonly gauntlet: IGauntletState | null;
    readonly unlockedSectors: ReadonlyArray<string>;
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
        blueprints: [],
        relics: [],
        gauntlet: null,
        unlockedSectors: ['Fire', 'Water', 'Nature']
    };
}

//TODO does this get used? or does the battle factory get used?
export function createStarterSave(starterId: 'kraken' | 'fenrir' | 'ratatoskr' = 'kraken'): IPlayerSave {
    const isWater = starterId === 'kraken';
    const isFire = starterId === 'fenrir';
    const isNature = starterId === 'ratatoskr';

    // Starter MingMing (Level 5)
    let nickname = 'Bubbles';
    if (isFire) nickname = 'Iggy';
    if (isNature) nickname = 'Nutty';

    const starter: IMingmingState = {
        id: crypto.randomUUID(),
        definitionId: starterId,
        nickname: nickname,
        level: 5,
        experience: getExpForLevel(5),
        blueprintsCollected: 0,
        attackIV: 10 + Math.floor(Math.random() * 6),
        defenseIV: 10 + Math.floor(Math.random() * 6),
        hpIV: 10 + Math.floor(Math.random() * 6)
    };

    // Starter deck cards (12 cards)
    const waterStarterIds = [
        'squirt', 'recursion_daemon', 'deep_pressure', 'whirlpool', 'renew', 'tidal_crush', 'ebb_and_flow', 'wave', 'hypnosis'
    ];
    const fireStarterIds = [
        'singularity', 'solar_flare', 'thermal_overload', 'ignite_pipeline', 'flash', 'preheat', 'ash_to_ash', 'fire_punch', 'reckless'
    ];
    const natureStarterIds = [
        'gossip', 'echo_chamber_daemon', 'pruning', 'nettle_lash', 'photosynthesis', 'grafting', 'seed_bomb', 'root_bind'
    ];

    let starterCardIds: string[] = [];
    const baseCards = isFire ? fireStarterIds : isWater ? waterStarterIds : natureStarterIds;

    // Fill to 40 cards
    while (starterCardIds.length < MIN_DECK_SIZE) {
        starterCardIds.push(...baseCards);
    }
    starterCardIds = starterCardIds.slice(0, MIN_DECK_SIZE);

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
        blueprints: [],
        relics: [],
        gauntlet: null,
        unlockedSectors: ['Fire', 'Water', 'Nature']
    };
}

export function createMingmingInstance(
    definitionId: string,
    level: number = 5
): IMingmingState {
    return {
        id: Math.random().toString(36).substring(7),
        definitionId: definitionId,
        level: level,
        experience: getExpForLevel(level),
        blueprintsCollected: 0,
        attackIV: Math.floor(Math.random() * 32),
        defenseIV: Math.floor(Math.random() * 32),
        hpIV: Math.floor(Math.random() * 32),
    };
}

export function createOwnedProgram(dataId: string): IOwnedProgram {
    return {
        instanceId: crypto.randomUUID(),
        dataId
    };
}
