
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

export function initializeBattleEntity(instance: IMingmingState, definition: IMingmingDefinition): IBattleEntity {
  // Formula: Base + ((Base * 0.02) * Level) - Standard Pokemon-ish scaling or Unity formula?
  // User requested: "Base + Modifier * Level" where modifier is implicit or IV?
  // Let's assume a simple linear scaling for now as per "Base + Modifier * Level" prompt implies 
  // maybe "Modifier" means the "2L/5" part of the damage formula? 
  // Actually the prompt says: "Unity formula: Base + Modifier * Level". 
  // Since we don't have explicit "Modifiers" in Definition, I will assume a default scalar or use IVs if present.
  // For MVP, lets do: Stat = Base + (Base * 0.05 * Level)

  // Actually, looking at the GDD damage formula: damage = ... (2L/5 + 2) ...
  // It doesn't explicitly define *stat* growth, just damage. 
  // I will implement a standard linear growth for now: Base + (Base * 0.1 * Level) generic.

  const growthRate = 0.1;

  const calcStat = (base: number, level: number) => Math.floor(base + (base * growthRate * level));

  return {
    ...instance,
    maxHp: calcStat(definition.baseStats.hp, instance.level),
    maxEnergy: definition.baseStats.energy, // Energy usually doesn't scale with level?
    attack: calcStat(definition.baseStats.attack, instance.level),
    defense: calcStat(definition.baseStats.defense, instance.level),
    speed: 10, // Placeholder

    currentHp: calcStat(definition.baseStats.hp, instance.level),
    currentEnergy: definition.baseStats.energy,
    tempHp: 0,
    statusEffects: []
  };
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
