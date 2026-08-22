/**
 * Epic 3: Global Game State Types.
 *
 * **What is left here after ticket 11.** This file used to define `IPlayerSave`, the pre-roguelike
 * save blob, and everything that hung off it — the card inventory, the active deck, the base-deck
 * grant keys, the gauntlet state. Ticket 11 moved the `game` slice onto ticket 06's ratified
 * `IRanchState` (`runTypes.ts`) and the run onto `IRunState`, so none of those shapes has an owner
 * any more: cards and decks are run-scoped (`IRunState.deck`), the gauntlet is `IGauntletProgress`,
 * and the persistent half is `IRanchState` verbatim.
 *
 * What survives is the reward vocabulary — the bundle a won fight produces and the drop table it is
 * rolled from — plus the two factories that mint a rostered individual and an owned card. Those are
 * genuinely shared: `RewardSystem` builds bundles, the ranch and the run both consume them.
 */

import type { IMingmingState } from "./types";
import type { IRanchMember } from "./runTypes";
import { MingmingRegistry } from "./data/mingmingRegistry";
import { SeedStream, rollSeed } from "./core/SeedStream";

// --- Card Inventory ---

export interface IOwnedProgram {
    readonly instanceId: string;    // Unique UUID per owned copy
    readonly dataId: string;        // Ref to ProgramData.id
}

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
 * scrap is the *workshop* price, mid-run; ticket 14 set that number at `WORKSHOP_ASSEMBLY_SCRAP`.)
 */
export type BlueprintCounts = Readonly<Record<string, number>>;

export interface ICardChoice {
    readonly sourceEntityName: string;
    readonly options: ReadonlyArray<IOwnedProgram>;
}

// --- Reward Bundle (returned by RewardSystem) ---

/**
 * What a won fight pays. **There is no `totalXP` and there must not be one again** (ticket 12).
 *
 * Ticket 21 deleted levelling and froze the engine at `CALIBRATION_LEVEL`; the field survived that
 * ticket as a structurally-zero number so the reward path did not have to change in the same
 * commit, and every consumer has been reading a hard 0 ever since. Ticket 12 removes it, so the
 * type no longer has a slot XP could quietly reappear in.
 */
export interface IRewardBundle {
    readonly scraps: number;
    /** Species ids, one entry per blueprint dropped. Duplicates are meaningful — they stack. */
    readonly blueprints: ReadonlyArray<string>;
    readonly cards: ReadonlyArray<IOwnedProgram>; // Legacy or guaranteed cards
    readonly cardChoices: ReadonlyArray<ICardChoice>; // "Pick 1 of 3" choices
    readonly relicChoices?: ReadonlyArray<string>;
    /**
     * Gym-clear mini-draft: three sequential "pick 1 of 3" rounds presented before the normal
     * report. **Nothing sets this since ticket 12** — the gauntlet and its draft belong to ticket
     * 18, which is where the invocation went. `RewardSystem.rollDraftRounds` and `BattleReport`'s
     * draft panel are the other two halves of the same parked feature; all three stay so 18 has
     * something to re-wire rather than rewrite. Absent for regular battles.
     */
    readonly draftRounds?: ReadonlyArray<ICardChoice>;
}

// --- Drop Table ---

/**
 * **Vestigial — nothing constructs or reads this** (checked in ticket 12). It describes a
 * per-architecture drop table from before rewards were keyed by node kind; the live knobs are
 * `RewardSystem.BLUEPRINT_DROP_RATE` and `RewardSystem.SCRAP_PER_ENEMY`, and the card pool comes
 * from `RewardSystem.rewardCardPool`. Left in place rather than deleted in this ticket because it
 * is inert and deleting types nobody imports is repo hygiene (ticket 02), not a rewards refit.
 */
export interface IDropTableEntry {
    readonly architectureId: string;
    readonly blueprintDropRate: number;   // 0–1, e.g. 0.05 = 5%
    readonly scrapMin: number;
    readonly scrapMax: number;
    readonly cardPool: ReadonlyArray<string>; // ProgramData IDs from this element
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
        // `RanchMemberSchema` bounds IVs at int 0-31 and every roster member has to survive it.
        attackIV: rng.nextInt(0, 31),
        defenseIV: rng.nextInt(0, 31),
        hpIV: rng.nextInt(0, 31),
    };
}

/**
 * Mint a **ranch** member — the persistent shape (ticket 06's `IRanchMember`), which is what the
 * roster holds after ticket 11 moved the `game` slice off `IPlayerSave`.
 *
 * The one difference from `createMingmingInstance` that matters is `activeOS`: it is *optional* on
 * `IMingmingState` and *required* here, because "which firmware is this individual running" has no
 * meaningful absent state once reflashing costs a blueprint (ticket 15). An omitted `activeOS`
 * resolves to the definition's first OS — deliberately the same fallback `getDeckForOS`,
 * `initializeBattleEntity` and `createRun`'s kit resolution already use, so a member with no
 * explicit choice runs the same firmware in every subsystem rather than a different one per
 * caller. A species that is not in the registry keeps a synthesised `${definitionId}_v1` rather
 * than being refused: `RanchMemberSchema` only asks that the field *be* a string, and losing an
 * individual to a renamed species id would be worse than carrying an unresolvable OS.
 */
export function createRanchMember(
    definitionId: string,
    activeOS?: string,
    rng: SeedStream = new SeedStream(rollSeed())
): IRanchMember {
    const instance = createMingmingInstance(definitionId, rng);
    return {
        id: instance.id,
        definitionId,
        activeOS:
            activeOS
            ?? MingmingRegistry[definitionId]?.availableOS[0]
            ?? `${definitionId}_v1`,
        attackIV: instance.attackIV,
        defenseIV: instance.defenseIV,
        hpIV: instance.hpIV,
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
