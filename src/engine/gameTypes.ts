/**
 * Epic 3: Global Game State Types
 * Persistent data structures for the player's save file.
 */

import { z } from "zod";

import type { IMingmingState } from "./types";
import { MingmingRegistry, getDeckForOS } from "./data/mingmingRegistry";
import { SeedStream, rollSeed } from "./core/SeedStream";
import { SAVE_VERSION_V4 } from "./runTypes";

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

/**
 * Ticket 15 gave the first swap to an OS a one-time pick from that OS's starting kit. Ticket 20
 * left the pick count in place but the grant itself is on its way out: cards are **run-scoped**
 * now, so the ranch has no business handing them out. Ticket 09 grants the start kit at run start
 * from ticket 08's `startKit` tags instead.
 */
export const OS_SWAP_PICK_COUNT = 2;

/** baseDecksGranted key: which (species, OS) starting kits have been granted. */
export const deckGrantKey = (definitionId: string, osId: string): string => `${definitionId}:${osId}`;

// --- Blueprints ---

/**
 * **Counts per species, not objects** (ticket 20, from ticket 06's ratified ranch).
 *
 * v3 held `IBlueprint[]` deduplicated on `architectureId` — an object carrying a `name` and a
 * `compileCost`, of which you could own at most one. That is the exact opposite of a consumable,
 * and `vision.md` (Henry, 2026-08-19) rules blueprints consumable: one is SPENT to assemble a
 * mingming, and reflashing an individual's OS spends one too.
 *
 * So the only thing worth storing is *how many of this species you hold*. The `name` was
 * `${definition.name} Blueprint` — derivable — and `compileCost` was a flat 100 scrap that ticket
 * 20 deletes outright: **assembly costs a blueprint at the ranch, full stop.** (A blueprint PLUS
 * scrap is the *workshop* price, mid-run, and ticket 14 owns that number.)
 */
export type BlueprintCounts = Readonly<Record<string, number>>;

export interface ICardChoice {
    readonly sourceEntityName: string;
    readonly options: ReadonlyArray<IOwnedProgram>;
}

// --- Reward Bundle (returned by RewardSystem) ---

export interface IRewardBundle {
    readonly scraps: number;
    /** Species ids, one entry per blueprint dropped. Duplicates are meaningful — they stack. */
    readonly blueprints: ReadonlyArray<string>;
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

// --- Root game-state object ---

/**
 * **This is the in-memory shape of the `game` slice — it is no longer the save format.**
 *
 * Ticket 23 (steam-release map) made save v4 the persisted format: `IRanchState` under one key and
 * `IRunState` under another (`engine/runTypes.ts`). Only the ranch half of what you see below —
 * `roster`, `blueprints`, and the gym/tier progress derived from `unlockedSectors` — actually
 * reaches storage now. Everything else here (`cardInventory`, `activeDeck`, `scrapCount`,
 * `relics`, `gauntlet`, `baseDecksGranted`) is **run-scoped by ticket 06's ratified model** and
 * deliberately does not survive a reload.
 *
 * That is a real, intended behaviour change, not an oversight: those fields are the ones that
 * move into `IRunState` as tickets 09–15 land the run loop. Until then the pre-roguelike hub
 * screens keep reading them out of this slice, they just start empty each boot.
 *
 * `engine/save/ranchProjection.ts` is the seam between this shape and the v4 ranch, and it is
 * marked for deletion by ticket 09.
 *
 * `version` is vestigial here — kept only because the debug save-editor's import/export files
 * carry it. The authority on save versions is `SAVE_VERSION_V4`.
 */
export interface IPlayerSave {
    readonly version: number;
    readonly roster: ReadonlyArray<IMingmingState>;
    readonly activeParty: ReadonlyArray<string>; // Max 3 IMingmingInstance.id refs
    readonly cardInventory: ReadonlyArray<IOwnedProgram>;
    readonly activeDeck: IActiveDeck | null;
    readonly scrapCount: number;
    /** Ticket 20: counts per species, because blueprints are spent. See `BlueprintCounts`. */
    readonly blueprints: BlueprintCounts;
    readonly relics: ReadonlyArray<string>;
    readonly gauntlet: IGauntletState | null;
    readonly unlockedSectors: ReadonlyArray<string>;
    readonly baseDecksGranted: ReadonlyArray<string>; // deckGrantKey(species, os) entries - which starting kits were granted (ticket 15; legacy saves held bare species ids, migrated in SaveSystem v3)
}

// --- Schemas ---
//
// `PlayerSaveSchema` used to live in `SaveSystem.ts` and *was* the save schema. Ticket 23 moved it
// here because that is no longer what it is: v4 persists `RanchSaveSchema` / `RunSaveSchema`, and
// this one now validates the in-memory slice shape. Its two surviving jobs are the debug
// save-editor's file import (`debug/saveEdit.ts`) and tests that need to assert a legal slice.
//
// **`.default()`, never `.catch()`** (ticket 23, Henry 2026-08-21). The v3 original used
// `.catch([])` on `blueprints`, `relics`, `unlockedSectors` and `baseDecksGranted`. `.catch`
// swallows *malformed* input and lets the parse succeed, so one corrupt blueprint entry silently
// emptied the inventory and the next autosave wrote that emptiness over the good save. `.default()`
// fills a **missing** field and fails a **malformed** one, which is the outcome we want: a failed
// parse is visible and recoverable, silent data loss is neither.

const MingmingInstanceSchema = z.object({
    id: z.string(),
    definitionId: z.string(),
    nickname: z.string().optional(),
    activeOS: z.string().optional(),
    blueprintsCollected: z.number().int().min(0),
    attackIV: z.number().int().min(0).max(31),
    defenseIV: z.number().int().min(0).max(31),
    hpIV: z.number().int().min(0).max(31),
});

const OwnedProgramSchema = z.object({
    instanceId: z.string(),
    dataId: z.string(),
});

const ActiveDeckSchema = z.object({
    id: z.string(),
    name: z.string(),
    cards: z.array(z.string()),
});

// Ticket 20: the same shape `RanchStateSchema` uses, for the same reason — a blueprint is a
// number you spend, not an object you own. A negative or fractional count is a corrupt save and
// must FAIL rather than be swallowed; see the `.default()` note above.
const BlueprintCountsSchema = z.record(z.string(), z.number().int().min(0));

const GauntletStateSchema = z.object({
    type: z.enum(['Gym', 'Sector']),
    element: z.string(),
    currentBattleIndex: z.number(),
    totalBattles: z.number(),
    // Design decision: only HP persists between gauntlet battles (health is the
    // resource you manage across the run). Energy, statuses, and everything else
    // reset fresh each battle, so only `hp` is stored.
    persistedStats: z.record(z.string(), z.object({
        hp: z.number()
    }))
});

export const PlayerSaveSchema = z.object({
    version: z.number().int().min(1),
    roster: z.array(MingmingInstanceSchema),
    activeParty: z.array(z.string()).max(3),
    cardInventory: z.array(OwnedProgramSchema),
    activeDeck: ActiveDeckSchema.nullable(),
    scrapCount: z.number().int().min(0),
    blueprints: BlueprintCountsSchema.default({}),
    relics: z.array(z.string()).default([]),
    gauntlet: GauntletStateSchema.nullable().default(null),
    unlockedSectors: z.array(z.string()).default([]),
    baseDecksGranted: z.array(z.string()).default([])
});

// --- Factory Helpers ---

export function createDefaultSave(): IPlayerSave {
    return {
        version: SAVE_VERSION_V4,
        roster: [],
        activeParty: [],
        cardInventory: [],
        activeDeck: null,
        scrapCount: 0,
        blueprints: {},
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
        version: SAVE_VERSION_V4,
        roster: [starter],
        activeParty: [starter.id],
        cardInventory: starterCards,
        activeDeck: {
            id: 'starter-deck',
            name: 'Starter Deck',
            cards: starterCards.map(c => c.instanceId)
        },
        scrapCount: 50,
        blueprints: {},
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
