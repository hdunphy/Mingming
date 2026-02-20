import { object } from "zod";

export type Element = 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Ice' | 'Light' | 'Dark' | 'None';
export const ELEMENTS: Element[] = ['Fire', 'Water', 'Earth', 'Air', 'Nature', 'Ice', 'Light', 'Dark', 'None'];

export type TargetType = 'Single' | 'Self' | 'Side' | 'All';
export const TARGET_TYPES: TargetType[] = ['Single', 'Self', 'Side', 'All'];

export type ProgramCategory = 'Attack' | 'Skill' | 'Daemon';
export const PROGRAM_CATEGORIES: ProgramCategory[] = ['Attack', 'Skill', 'Daemon'];

export type TurnPhase = 'PRE_TURN' | 'ACTION' | 'POST_TURN';

export const StatusType = {
  Burn: 'Burn',
  Poison: 'Poison',
  Asleep: 'Asleep',
  Weakened: 'Weakened',
  Strengthened: 'Strengthened',
  Dazed: 'Dazed',
  Sharp: 'Sharp',
  Stunned: 'Stunned',
  Regen: 'Regen',
  Awoken: 'Awoken',
  Energized: 'Energized'
} as const;
export const Statuses: StatusType[] = Object.values(StatusType);

export type StatusType = typeof StatusType[keyof typeof StatusType];

export interface StatusEffectInstance {
  readonly id: string;
  readonly type: StatusType;
  readonly stacks: number;
}


export const ProgramConstraintType = {
  HasStatus: 'HAS_STATUS',
  NotStatus: 'NOT_STATUS',
  HealthThreshold: 'HEALTH_THRESHOLD',
  Base: 'BASE'
} as const;

export type ProgramConstraintType = typeof ProgramConstraintType[keyof typeof ProgramConstraintType];

export interface ProgramConstraint {
  readonly id?: string;
  readonly type: ProgramConstraintType;
  readonly target: 'SELF' | 'TARGET';
  readonly value: string | number;
  readonly error?: string; // Validation error
}

// --- MingMing Definitions (Nested Immutable Pattern) ---

/**
 * Static Data: Loaded from JSON/ScriptableObject. Read-only.
 */
export interface IMingmingDefinition {
  readonly id: string;
  readonly name: string;
  readonly baseStats: {
    readonly hp: number;
    readonly attack: number;
    readonly defense: number;
    readonly energy: number; // Base energy
  };
  readonly primaryElement: Element;
  readonly secondaryElement?: Element;
  readonly cardDraw: number; // Base contribution
  readonly availableOS: string[]; // IDs of OS variants
  readonly artReference?: string;
}

/**
 * Persistent Instance: The unit in the player's save file.
 */
export interface IMingmingState {
  id: string; // instance ID
  definitionId: string; // architecture name (e.g. 'fenrir')
  nickname?: string;
  level: number;
  experience: number;
  activeOS?: string;
  blueprintsCollected: number; // For OS swapping
  attackIV: number;
  defenseIV: number;
  hpIV: number;
}

// --- System Deemons / Relics ---

export interface IRelic {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly effect: string; // Internal ID for logic
}

/**
 * Volatile Combat State: Existing only during battle.
 */
export interface IBattleEntity extends IMingmingState {
  // Derived Stats (Calculated at start of battle from Definition + Level)
  readonly name: string;
  readonly maxHp: number;
  readonly cardDraw: number;
  readonly maxEnergy: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number; // Derived from something? Or base?

  // Element caching for combat
  readonly primaryElement: Element;
  readonly secondaryElement?: Element;

  // Transient State (Mutable via Redux/Zustand, but defined as readonly here to enforce immutable updates)
  readonly currentHp: number;
  readonly currentEnergy: number;
  readonly tempHp: number; // Shields
  readonly relicBonuses?: { draw: number; energy: number; attackMod: number };
  readonly statusEffects: ReadonlyArray<StatusEffectInstance>;
  readonly hooks?: ReadonlyArray<string>; // IDs of active hooks (Relics, Passives)
  readonly activeOS?: string; // Current Operating System ID
  readonly daemons: ReadonlyArray<ProgramEntity>; // Persistent "installed" software
  readonly artReference?: string;
}

// --- Transformation Logic ---

/**
 * Calculates a standard stat (Attack/Defense) using the Unity Legacy Formula.
 */
export function calculateStandardStat(base: number, modifier: number, level: number): number {
  return Math.floor(((2 * base) + modifier + 25) * level / 100) + 5;
}

/**
 * Calculates Health using the Unity Legacy Formula.
 */
export function calculateHealth(base: number, modifier: number, level: number): number {
  return calculateStandardStat(base, modifier, level) + level + 30;
}

export function initializeBattleEntity(instance: IMingmingState, definition: IMingmingDefinition): IBattleEntity {
  const attackIV = instance.attackIV ?? 0;
  const defenseIV = instance.defenseIV ?? 0;
  const hpIV = instance.hpIV ?? 0;

  const finalHp = calculateHealth(definition.baseStats.hp, hpIV, instance.level);

  return {
    ...instance,
    name: definition.name,
    maxHp: finalHp,
    cardDraw: definition.cardDraw,
    maxEnergy: definition.baseStats.energy,
    attack: calculateStandardStat(definition.baseStats.attack, attackIV, instance.level),
    defense: calculateStandardStat(definition.baseStats.defense, defenseIV, instance.level),
    speed: 10, // Placeholder for future logic

    primaryElement: definition.primaryElement,
    secondaryElement: definition.secondaryElement,

    currentHp: finalHp,
    currentEnergy: definition.baseStats.energy,
    tempHp: 0,
    statusEffects: [],
    hooks: [],
    activeOS: instance.activeOS || definition.availableOS[0], // Default to first available OS
    daemons: [],
    artReference: definition.artReference,
    relicBonuses: { draw: 0, energy: 0, attackMod: 1 }
  };
}

/**
 * Calculates the total XP required to reach a specific level boundary.
 */
export function getExpForLevel(level: number): number {
  return Math.round(0.8 * Math.pow(level, 3));
}

// --- Program (Card) Definitions (Preserving previous work) ---
export type ActionType = 'ATTACK' | 'STATUS' | 'HEAL' | 'DRAW' | 'ENERGY' | 'GENERATE_CARD';

export interface ProgramAction {
  readonly id?: string;
  readonly type: ActionType;
  readonly conditionals?: ReadonlyArray<ProgramConstraint>;
  readonly target?: TargetType | string; // Often target is defined on Action or on Program
  readonly error?: string; // Validation error
  readonly [key: string]: any; // Flat structure for JSON
}

export interface AttackActionData extends ProgramAction {
  readonly type: 'ATTACK';
  readonly power: number;
  readonly element?: Element;
  readonly scaling?: string;
}

export interface StatusActionData extends ProgramAction {
  readonly type: 'STATUS';
  readonly status: StatusType;
  readonly stacks: number; // Negative value means remove stacks
}

export interface HealActionData extends ProgramAction {
  readonly type: 'HEAL';
  readonly power: number;
  readonly healOverride?: number;
}

export interface DrawActionData extends ProgramAction {
  readonly type: 'DRAW';
  readonly amount: number;
}

export interface EnergyActionData extends ProgramAction {
  readonly type: 'ENERGY';
  readonly amount: number;
}

export interface GenerateCardActionData extends ProgramAction {
  readonly type: 'GENERATE_CARD';
  readonly dataId: string; // ID of the ProgramData to generate
}

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic';
export const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic'];

export interface ProgramData {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly element: Element;
  readonly target: TargetType;
  readonly category: ProgramCategory;
  readonly rarity: Rarity;
  readonly baseCost: number;
  readonly constraints: ReadonlyArray<ProgramConstraint>;
  readonly actions: ReadonlyArray<ProgramAction>;
  readonly hooks?: ReadonlyArray<string>; // IDs of active hooks for Daemons
  readonly isToken?: boolean; // If true, this is a generated token card
  readonly exhaust?: boolean; // If true, card is removed from battle after use
  readonly artReference?: string;
}

export interface ProgramEntity {
  readonly id: string;
  readonly dataId: string; // Ref to ProgramData
  readonly currentCost: number;
  readonly isPlayable: boolean;
}

// --- Deck & State Definitions ---

export interface LevelUpEvent {
  readonly entityId: string;
  readonly nickname: string;
  readonly oldLevel: number;
  readonly newLevel: number;
  readonly oldStats: { hp: number; attack: number; defense: number };
  readonly newStats: { hp: number; attack: number; defense: number };
}

export interface IDeckState {
  readonly ownerId: string;
  readonly deck: ReadonlyArray<string>; // Array of ProgramData IDs
  readonly drawpile: ReadonlyArray<ProgramEntity>;
  readonly hand: ReadonlyArray<ProgramEntity>;
  readonly discard: ReadonlyArray<ProgramEntity>;
}

export interface IBattleState {
  readonly sessionId: string;
  readonly seed: string;
  readonly turn: number;
  readonly phase: TurnPhase;
  readonly activeSide: 'PLAYER' | 'ENEMY';
  readonly activeRelics: ReadonlyArray<string>;

  readonly playerParty: ReadonlyArray<IBattleEntity>;
  readonly enemyParty: ReadonlyArray<IBattleEntity>;

  readonly playerDeck: IDeckState;
  readonly enemyDeck: IDeckState;

  readonly logs: ReadonlyArray<string>;
  readonly osLogs: ReadonlyArray<string>;
  readonly procs: ReadonlyArray<{ id: number; entityId: string; text: string }>;
  readonly cardsPlayedThisTurn: number;
  readonly levelUpQueue: ReadonlyArray<LevelUpEvent>;
}
