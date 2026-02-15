
export type Element = 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Ice' | 'Light' | 'Dark' | 'None';
export type TargetType = 'Single' | 'Self' | 'Side' | 'All';
export type ProgramCategory = 'Attack' | 'Heal' | 'Status' | 'Special';
export type TurnPhase = 'PRE_TURN' | 'ACTION' | 'POST_TURN';

export enum StatusType {
  Burn = 'Burn',
  Poison = 'Poison',
  Asleep = 'Asleep',
  Weakened = 'Weakened',
  Strengthened = 'Strengthened',
  Dazed = 'Dazed',
  Sharp = 'Sharp',
  Stunned = 'Stunned',
  Regen = 'Regen'
}

export interface StatusEffectInstance {
  readonly id: string;
  readonly type: StatusType;
  readonly duration: number;
  readonly stacks: number;
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
  readonly artReference?: string;
}

/**
 * Persistent Instance: The unit in the player's save file.
 */
export interface IMingmingState {
  readonly id: string; // Unique Instance UUID
  readonly definitionId: string; // Ref to Definition
  readonly nickname?: string;
  readonly level: number;
  readonly experience: number;
  // IVs or potential modifiers could go here
  readonly attackIV?: number;
  readonly defenseIV?: number;
  readonly hpIV?: number;
}

/**
 * Volatile Combat State: Existing only during battle.
 */
export interface IBattleEntity extends IMingmingState {
  // Derived Stats (Calculated at start of battle from Definition + Level)
  readonly maxHp: number;
  readonly maxEnergy: number;
  readonly attack: number;
  readonly defense: number;
  readonly speed: number; // Derived from something? Or base?

  // Transient State (Mutable via Redux/Zustand, but defined as readonly here to enforce immutable updates)
  readonly currentHp: number;
  readonly currentEnergy: number;
  readonly tempHp: number; // Shields
  readonly statusEffects: ReadonlyArray<StatusEffectInstance>;
}

// --- Transformation Logic ---

/**
 * Calculates a standard stat (Attack/Defense) using the Unity Legacy Formula.
 */
function calculateStandardStat(base: number, modifier: number, level: number): number {
  return Math.floor(((2 * base) + modifier) * level / 100) + 5;
}

/**
 * Calculates Health using the Unity Legacy Formula.
 */
function calculateHealth(base: number, modifier: number, level: number): number {
  return calculateStandardStat(base, modifier, level) + level + 5;
}

export function initializeBattleEntity(instance: IMingmingState, definition: IMingmingDefinition): IBattleEntity {
  const attackIV = instance.attackIV ?? 0;
  const defenseIV = instance.defenseIV ?? 0;
  const hpIV = instance.hpIV ?? 0;

  const finalHp = calculateHealth(definition.baseStats.hp, hpIV, instance.level);

  return {
    ...instance,
    maxHp: finalHp,
    maxEnergy: definition.baseStats.energy,
    attack: calculateStandardStat(definition.baseStats.attack, attackIV, instance.level),
    defense: calculateStandardStat(definition.baseStats.defense, defenseIV, instance.level),
    speed: 10, // Placeholder for future logic

    currentHp: finalHp,
    currentEnergy: definition.baseStats.energy,
    tempHp: 0,
    statusEffects: []
  };
}

/**
 * Calculates the total XP required to reach a specific level boundary.
 */
export function getExpForLevel(level: number): number {
  return Math.round(0.8 * Math.pow(level, 3));
}

// --- Program (Card) Definitions (Preserving previous work) ---

export interface ProgramAction {
  readonly type: string;
  readonly payload: any;
}

export interface ProgramConstraint {
  readonly type: 'HAS_STATUS' | 'HEALTH_THRESHOLD' | 'ENERGY_THRESHOLD';
  readonly target: 'SELF' | 'TARGET';
  readonly value: string | number;
}

export interface ProgramData {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly element: Element;
  readonly target: TargetType;
  readonly category: ProgramCategory;
  readonly baseCost: number;
  readonly constraints: ReadonlyArray<ProgramConstraint>;
  readonly actions: ReadonlyArray<ProgramAction>;
  readonly artReference?: string;
}

export interface ProgramEntity {
  readonly id: string;
  readonly dataId: string; // Ref to ProgramData
  readonly currentCost: number;
  readonly isPlayable: boolean;
}

// --- Deck & State Definitions ---

export interface IDeckState {
  readonly ownerId: string;
  readonly deck: ReadonlyArray<string>; // Array of ProgramData IDs
  readonly hand: ReadonlyArray<ProgramEntity>;
  readonly discard: ReadonlyArray<ProgramEntity>;
}

export interface IBattleState {
  readonly sessionId: string;
  readonly seed: number;
  readonly turn: number;
  readonly phase: TurnPhase;
  readonly activeSide: 'PLAYER' | 'ENEMY';
  
  readonly playerParty: ReadonlyArray<IBattleEntity>;
  readonly enemyParty: ReadonlyArray<IBattleEntity>;
  
  readonly playerDeck: IDeckState;
  readonly enemyDeck: IDeckState;
  
  readonly logs: ReadonlyArray<string>;
}
