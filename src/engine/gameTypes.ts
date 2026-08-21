/**
 * Epic 3: Global Game State Types
 * Persistent data structures for the player's save file.
 */

import type { IMingmingState } from "./types";
import { MingmingRegistry, getDeckForOS } from "./data/mingmingRegistry";
import { SeedStream, rollSeed } from "./core/SeedStream";

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
export const MIN_DECK_SIZE = 8; // ticket 13: deck template allows 8-12 card starting decks

// Ticket 15 (OS-swap rules): swapping firmware costs 1 blueprint (spent) + scrap,
// and the FIRST swap to an OS grants a pick of its starting cards - once ever.
// The pick count is deliberately a tunable constant (playtesting may raise it).
export const OS_SWAP_SCRAP_COST = 25;
export const OS_SWAP_PICK_COUNT = 2;

/** baseDecksGranted key: which (species, OS) starting kits have been granted. */
export const deckGrantKey = (definitionId: string, osId: string): string => `${definitionId}:${osId}`;

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
    /**
     * Gym-clear mini-draft: three sequential "pick 1 of 3" rounds presented
     * before the normal report. Picks accumulate into `cards` at claim time,
     * so applyRewardBundle needs no special handling. Absent for regular battles.
     */
    readonly draftRounds?: ReadonlyArray<ICardChoice>;
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
    readonly persistedStats: Record<string, { hp: number }>;
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
    readonly baseDecksGranted: ReadonlyArray<string>; // deckGrantKey(species, os) entries - which starting kits were granted (ticket 15; legacy saves held bare species ids, migrated in SaveSystem v3)
}

// --- Factory Helpers ---

export function createDefaultSave(): IPlayerSave {
    return {
        version: 3, // keep in sync with SaveSystem.CURRENT_SAVE_VERSION
        roster: [],
        activeParty: [],
        cardInventory: [],
        activeDeck: null,
        scrapCount: 0,
        blueprints: [],
        relics: [],
        gauntlet: null,
        unlockedSectors: ['Fire', 'Water', 'Nature'],
        baseDecksGranted: []
    };
}

//TODO does this get used? or does the battle factory get used?
export function createStarterSave(
    starterId: 'kraken' | 'fenrir' | 'ratatoskr' = 'kraken',
    seed?: string
): IPlayerSave {
    // One seed, threaded through every random decision below (roster id, IVs,
    // card instance ids). When no seed is supplied we roll exactly once - the
    // same contract createBattleState uses - so existing callers are unaffected
    // while a scenario can start from a reproducible save.
    const rng = new SeedStream(seed ?? rollSeed());

    const isFire = starterId === 'fenrir';
    const isNature = starterId === 'ratatoskr';

    // Starter MingMing. Ticket 21: no level — every unit is built at CALIBRATION_LEVEL.
    let nickname = 'Bubbles';
    if (isFire) nickname = 'Iggy';
    if (isNature) nickname = 'Nutty';

    const starter: IMingmingState = {
        id: rng.nextId('mm'),
        definitionId: starterId,
        nickname: nickname,
        blueprintsCollected: 0,
        // Starters keep their old 10-15 band (PlayerSaveSchema allows 0-31).
        attackIV: 10 + rng.nextInt(0, 5),
        defenseIV: 10 + rng.nextInt(0, 5),
        hpIV: 10 + rng.nextInt(0, 5)
    };

    // Starter deck cards come from the species' per-OS starting deck (ticket 13:
    // starters carry no activeOS, so this resolves to the availableOS[0] slot).
    // Grant the FULL deck (8-12 cards per the template) - never truncate; pad
    // only if a deck somehow comes in under the minimum.
    const baseCards = getDeckForOS(starterId);
    let starterCardIds: string[] = [...baseCards];
    while (starterCardIds.length < MIN_DECK_SIZE && baseCards.length > 0) {
        starterCardIds.push(baseCards[starterCardIds.length % baseCards.length]);
    }

    // Same stream, so instance ids are unique within the save and reproducible
    // across two calls with the same seed.
    const starterCards: IOwnedProgram[] = starterCardIds.map(dataId => createOwnedProgram(dataId, rng));

    return {
        version: 3, // keep in sync with SaveSystem.CURRENT_SAVE_VERSION
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
        unlockedSectors: ['Fire', 'Water', 'Nature'],
        baseDecksGranted: [deckGrantKey(starterId, MingmingRegistry[starterId].availableOS[0])]
    };
}

/**
 * Ticket 21: the `level` parameter is gone, not defaulted. Every assembled individual is built at
 * `CALIBRATION_LEVEL`; the only thing that differs between two individuals of a species is the
 * stat roll, which is exactly the collection depth `vision.md` asks for ("two krakens are not the
 * same kraken").
 */
export function createMingmingInstance(
    definitionId: string,
    rng: SeedStream = new SeedStream(rollSeed())
): IMingmingState {
    return {
        id: rng.nextId('mm'),
        definitionId: definitionId,
        blueprintsCollected: 0,
        // PlayerSaveSchema bounds IVs at int 0-31.
        attackIV: rng.nextInt(0, 31),
        defenseIV: rng.nextInt(0, 31),
        hpIV: rng.nextInt(0, 31),
    };
}

/**
 * @param rng Stream to mint the instance id from; omitted, one is rolled.
 *   The `number` arm exists only because this factory is passed straight to
 *   `Array.prototype.map` (RewardSystem does), which supplies the element
 *   index as a second argument - that is ignored, not used as a seed.
 */
export function createOwnedProgram(dataId: string, rng?: SeedStream | number): IOwnedProgram {
    const stream = rng instanceof SeedStream ? rng : new SeedStream(rollSeed());
    return {
        instanceId: stream.nextId('card'),
        dataId
    };
}
