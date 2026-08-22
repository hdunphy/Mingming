/**
 * Scenario schema v1 — the envelope every debug surface consumes.
 *
 * Locked in `docs/wayfinder/debug-toolkit/tickets/02-scenario-schema.md` (§1, §2).
 * One zod schema, discriminated on `kind`:
 *   - `composed`  — a battle-start setup the launcher/sims can build a battle from.
 *   - `snapshot`  — a full mid-battle `IBattleState`, normalized per §3.
 *
 * Validation mirrors `src/engine/SaveSystem.ts`, with IV bounds (int 0..31) and the max-3 party
 * cap copied from `RanchMemberSchema` / `engine/party.ts`'s `PARTY_SIZE`.
 *
 * Nothing outside `src/debug/` may import this module.
 */

import { z } from 'zod';
import { ELEMENTS, StatusType } from '../../engine/types';
import type {
    EnemyCombatMode,
    IBattleState,
    IMove,
    StatusEffectInstance,
} from '../../engine/types';

/** Bumped only when a shape change cannot be expressed as an optional field. */
export const CURRENT_SCENARIO_VERSION = 1;

/** One extension, one loader, one migration path. */
export const SCENARIO_FILE_EXTENSION = '.scenario.json';

// --- Shared leaf schemas -----------------------------------------------------

/** Same bounds as `MingmingInstanceSchema` (SaveSystem.ts:21-23). */
const IVSchema = z.number().int().min(0).max(31);

const ElementSchema = z.enum(ELEMENTS);

const StatusEffectInstanceSchema = z.object({
    id: z.string(),
    type: z.enum(StatusType),
    stacks: z.number(),
});

/**
 * `ProgramAction` is a flat JSON bag (`readonly [key: string]: any`), so unknown keys
 * must survive validation rather than being stripped.
 */
const ProgramActionSchema = z.looseObject({
    id: z.string().optional(),
    type: z.string(),
});

const MoveSchema = z.object({
    id: z.string(),
    name: z.string(),
    intentType: z.enum(['Attack', 'Defend', 'Debuff', 'Buff', 'Special', 'Unknown']),
    priority: z.number(),
    actions: z.array(ProgramActionSchema),
});

const ProgramEntitySchema = z.object({
    id: z.string(),
    dataId: z.string(),
    currentCost: z.number(),
    isPlayable: z.boolean(),
});

const DeckStateSchema = z.object({
    ownerId: z.string(),
    deck: z.array(z.string()),
    drawpile: z.array(ProgramEntitySchema),
    hand: z.array(ProgramEntitySchema),
    discard: z.array(ProgramEntitySchema),
    exhaust: z.array(ProgramEntitySchema),
});

const RelicBonusesSchema = z.object({
    draw: z.number(),
    energy: z.number(),
    attackMod: z.number(),
});

const NextProgramModifierSchema = z.object({
    multiplier: z.number().optional(),
    flatBonus: z.number().optional(),
    costReduction: z.number().optional(),
    appliesTo: z.enum(['Attack', 'Skill', 'Daemon', 'Status', 'Heal']).optional(),
});

// --- Snapshot: IBattleState --------------------------------------------------

const BattleEntitySchema = z.object({
    // IMingmingState
    id: z.string(),
    definitionId: z.string(),
    nickname: z.string().optional(),
    activeOS: z.string().optional(),
    blueprintsCollected: z.number().int().min(0),
    attackIV: IVSchema,
    defenseIV: IVSchema,
    hpIV: IVSchema,

    // Derived combat stats
    name: z.string(),
    maxHp: z.number(),
    cardDraw: z.number(),
    maxEnergy: z.number(),
    attack: z.number(),
    defense: z.number(),
    speed: z.number(),

    primaryElement: ElementSchema,
    secondaryElement: ElementSchema.optional(),

    // Transient state
    currentHp: z.number(),
    currentEnergy: z.number(),
    tempHp: z.number(),
    relicBonuses: RelicBonusesSchema.optional(),
    statusEffects: z.array(StatusEffectInstanceSchema),
    hooks: z.array(z.string()).optional(),
    daemons: z.array(ProgramEntitySchema),
    currentIntent: MoveSchema.nullable().optional(),
    artReference: z.string().optional(),
    forcedTargetId: z.string().optional(),
    nextProgramModifier: NextProgramModifierSchema.optional(),
    playsThisTurn: z.number().optional(),
    moves: z.array(MoveSchema).optional(),
});

/**
 * `elementPlays` / `counters` use a plain string key rather than the `Element` enum:
 * an enum key in zod v4 demands every member be present, which would reject a
 * legitimately partial snapshot *before* `normalizeBattleState` gets to zero-fill it.
 * This also mirrors `GauntletStateSchema`'s `z.record(z.string(), ...)`.
 */
export const BattleStateSchema = z.object({
    sessionId: z.string(),
    seed: z.string(),
    turn: z.number(),
    phase: z.enum(['PRE_TURN', 'ACTION', 'POST_TURN']),
    activeSide: z.enum(['PLAYER', 'ENEMY']),
    activeRelics: z.array(z.string()),

    playerParty: z.array(BattleEntitySchema),
    enemyParty: z.array(BattleEntitySchema),

    playerDeck: DeckStateSchema,
    enemyDeck: DeckStateSchema,

    logs: z.array(z.string()),
    osLogs: z.array(z.string()),
    procs: z.array(z.object({ id: z.number(), entityId: z.string(), text: z.string() })),
    cardsPlayedThisTurn: z.number(),
    cardsDrawnThisTurn: z.number(),
    lastProgramPlayed: z.string().nullable(),
    enemyMode: z.enum(['MOVES', 'CARDS']).optional(),
    lastStatusConsumed: z.number().optional(),
    elementPlays: z.record(z.string(), z.number()).optional(),
    counters: z.record(z.string(), z.number()),
});

// --- Composed: ComposedSetup -------------------------------------------------

/**
 * Gauntlet context — **reconciled with `IGauntletProgress` by ticket 18.**
 *
 * This used to mirror v3's `GauntletStateSchema`: `type: 'Gym' | 'Sector'`, `element`,
 * `currentBattleIndex`, `totalBattles`, `persistedStats: { [id]: { hp } }`. Every one of those five
 * fields is now wrong about the game:
 *
 * - **`type`** — v3's 'Sector' arm had no caller and ticket 11 deleted the last of it. A gauntlet is
 *   a gym's, and there is no second kind.
 * - **`element`** — `IGauntletProgress` deliberately carries none (ticket 06): in a run the gauntlet
 *   is always `GYM_REGISTRY[run.gymId]`'s, so a second copy could only drift from the first.
 * - **`currentBattleIndex` / `totalBattles`** — renamed to `fightIndex` / `totalFights` in the
 *   ratified type, and the schema following the ratified name is the point of reconciling at all.
 * - **`persistedStats: { hp }`** — the per-member object was a place for a second carried stat to be
 *   added quietly. Ticket 06 flattened it to `persistedHp: Record<string, number>` precisely because
 *   only HP persists: *"Energy, statuses and everything else reset fresh each battle."*
 *
 * And one field is added: **`downedMemberIds`**, which `economy-session.md`'s "revivable, never
 * gone-for-gauntlet" needs and v3 had nowhere to put.
 *
 * # WHY THIS IS NOT A SCENARIO VERSION BUMP
 *
 * `CURRENT_SCENARIO_VERSION` is bumped "only when a shape change cannot be expressed as an optional
 * field", and the reason to bump is always **stored files that would stop loading**. There are none:
 *
 * - `gauntlet` is a **composed**-only field, and every stored `composed` scenario in the repo (37
 *   `.scenario.json` files) carries `"gauntlet": null` or omits it. Nothing on disk has ever held a
 *   v3-shaped object here.
 * - The 14 files in `playtest-results/` are `kind: "snapshot"` — they have no `setup` at all, so
 *   they cannot be affected by this either way. (They also carry their own `registryHash`, which is
 *   what actually governs their staleness, and this change touches no registry.)
 * - `composeScenario.createDraft` hardcodes `gauntlet: null` and the launcher is the only thing that
 *   writes these files, so a non-null v3 gauntlet is not merely absent — it was unreachable.
 *
 * A bump with no file to migrate would re-stamp every future save as v2 to describe a migration that
 * does nothing, which is worse than useless: it makes the version number stop meaning "the shape
 * changed under stored data". If a hand-written file somewhere does carry the old shape, zod rejects
 * it by name (`fightIndex` required) and `loadScenario` reports it — a visible failure on a field
 * `buildScenarioState` ignores anyway.
 */
const GauntletContextSchema = z.object({
    fightIndex: z.number().int().min(0),
    totalFights: z.number().int().min(1),
    persistedHp: z.record(z.string(), z.number().int().min(0)),
    downedMemberIds: z.array(z.string()).default([]),
});

// Ticket 21: `level` is gone from every setup schema. Existing scenario files still carry it —
// zod strips unknown keys by default (nothing here is `.strict()`), so all 51 committed
// `.scenario.json` files and playtest snapshots keep loading, with the stale field ignored.
const PartyMemberSetupSchema = z.object({
    definitionId: z.string(),
    attackIV: IVSchema,
    defenseIV: IVSchema,
    hpIV: IVSchema,
    activeOS: z.string().optional(),
    /** Omitted = full HP at build time. */
    currentHp: z.number().int().min(0).optional(),
    statusEffects: z.array(StatusEffectInstanceSchema).optional(),
    moves: z.array(MoveSchema).optional(),
});

const EnemySetupSchema = PartyMemberSetupSchema.extend({
    maxHpOverride: z.number().int().min(1).optional(),
    deck: z.array(z.string()).optional(),
});

/**
 * v1 encodes the *shared* deck as `player.deck`. If the pending shared-vs-per-mingming
 * deck decision flips, per-member decks move onto `PartyMemberSetup.deck`,
 * `CURRENT_SCENARIO_VERSION` bumps to 2, and `migrateScenario` lifts this list onto
 * each member. No consumer signature changes.
 */
export const ComposedSetupSchema = z.object({
    seed: z.string(),
    /** Explicit in files; no undefined-means-MOVES on disk. */
    enemyMode: z.enum(['MOVES', 'CARDS']),
    player: z.object({
        /** Max 3, mirroring `engine/party.ts`'s `PARTY_SIZE` and `RunStateSchema.partyIds`. */
        party: z.array(PartyMemberSetupSchema).max(3),
        deck: z.array(z.string()),
        relics: z.array(z.string()),
    }),
    /** Explicit list; never the procedural encounter branch. */
    enemies: z.array(EnemySetupSchema),
    gauntlet: GauntletContextSchema.nullable().optional(),
    /**
     * Ticket 19 (deck-archetypes): per-seed IV jitter magnitude. When set, every unit's
     * atk/def/hp IVs are shifted by the SAME seed-derived roll in [-statJitter, +statJitter]
     * (both sides identical - fair per game) before the state is built. Kills the
     * pinned-stat kill-threshold cliffs the balance suite measured (ticket 18). Applied
     * by `runBatch.applyStatJitter`, not by `buildScenarioState` - a recorded scenario
     * file replays byte-identically; only batch runs jitter.
     */
    statJitter: z.number().int().min(0).max(15).optional(),
});

// --- Envelope ----------------------------------------------------------------

const envelopeShape = {
    version: z.number().int().min(1),
    name: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    /** `<algoVersion>:<8 hex>` — see `computeRegistryHash()`. */
    registryHash: z.string(),
    /** ISO 8601, informational only — never compared. */
    createdAt: z.string().optional(),
};

export const ComposedScenarioSchema = z.object({
    ...envelopeShape,
    kind: z.literal('composed'),
    setup: ComposedSetupSchema,
});

export const SnapshotScenarioSchema = z.object({
    ...envelopeShape,
    kind: z.literal('snapshot'),
    state: BattleStateSchema,
    /**
     * Dispatched-action sequence since battle start. Added by
     * `06-battle-snapshot-export.md`; typed loosely on purpose and *optional*, so v1
     * files without it still validate and `migrateScenario` stays a no-op.
     */
    tape: z.array(z.unknown()).optional(),
});

export const ScenarioSchema = z.discriminatedUnion('kind', [
    ComposedScenarioSchema,
    SnapshotScenarioSchema,
]);

// --- Public TypeScript surface ----------------------------------------------
//
// Written by hand rather than inferred so `state` keeps its `IBattleState` identity
// for the materializer and `battleSlice.setBattleState`.

/**
 * Ticket 18: field-for-field `engine/runTypes.IGauntletProgress`, minus its `readonly`s (the rest of
 * this file's public surface is mutable draft state that the launcher edits in place).
 *
 * It is written out rather than imported because `scenarioSchema` is a **file format** and
 * `IGauntletProgress` is a ratified save type: a debug file that silently followed a save-shape
 * change would be a stored file that stops loading without anyone deciding it should. Copying the
 * shape deliberately, with the divergence spelled out above `GauntletContextSchema`, is what keeps
 * the two in step *on purpose*.
 */
export interface GauntletContext {
    fightIndex: number;
    totalFights: number;
    persistedHp: Record<string, number>;
    downedMemberIds: string[];
}

export interface PartyMemberSetup {
    definitionId: string;
    attackIV: number;
    defenseIV: number;
    hpIV: number;
    activeOS?: string;
    currentHp?: number;
    statusEffects?: StatusEffectInstance[];
    moves?: IMove[];
}

export interface EnemySetup extends PartyMemberSetup {
    maxHpOverride?: number;
    deck?: string[];
}

export interface ComposedSetup {
    seed: string;
    enemyMode: EnemyCombatMode;
    player: {
        party: PartyMemberSetup[];
        deck: string[];
        relics: string[];
    };
    enemies: EnemySetup[];
    gauntlet?: GauntletContext | null;
    /** Per-seed IV jitter magnitude (see ComposedSetupSchema.statJitter). */
    statJitter?: number;
}

export interface ScenarioEnvelope {
    version: number;
    name: string;
    description?: string;
    tags?: string[];
    registryHash: string;
    createdAt?: string;
}

export interface ComposedScenario extends ScenarioEnvelope {
    kind: 'composed';
    setup: ComposedSetup;
}

export interface SnapshotScenario extends ScenarioEnvelope {
    kind: 'snapshot';
    state: IBattleState;
    tape?: unknown[];
}

export type Scenario = ComposedScenario | SnapshotScenario;
export type ScenarioKind = Scenario['kind'];

/** `version` and `registryHash` are stamped by `saveScenario`, so drafts may omit them. */
export type ScenarioDraft =
    | (Omit<ComposedScenario, 'version' | 'registryHash'> & {
          version?: number;
          registryHash?: string;
      })
    | (Omit<SnapshotScenario, 'version' | 'registryHash'> & {
          version?: number;
          registryHash?: string;
      });

// --- Migration ---------------------------------------------------------------

/**
 * Version-keyed migration of raw (already JSON-parsed) scenario data. Runs BEFORE
 * schema validation, the same ordering the save layer's own version handling uses.
 *
 * At `CURRENT_SCENARIO_VERSION = 1` there is nothing to migrate: the only change since
 * the schema was locked is the optional `tape` field, which by construction needs no
 * version bump. The single normalization here treats an unversioned file as v1.
 *
 * Note this is scenario versioning, which is INDEPENDENT of save versioning: ticket 23 made save
 * v4 a floor with no upgrade path, while scenarios keep theirs. Battle snapshots are not saves.
 */
export function migrateScenario(raw: unknown): unknown {
    if (raw === null || typeof raw !== 'object') return raw;
    const scenario = { ...(raw as Record<string, unknown>) };

    if (typeof scenario.version !== 'number') scenario.version = 1;

    // v1 is current. Future steps go here, each guarded by `scenario.version < N`.

    return scenario;
}
