
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
  Regen = 'Regen' // Implicit support maybe?
}

export interface StatusEffectInstance {
  id: string; // Unique ID for this instance
  type: StatusType;
  duration: number; // Turns remaining
  stacks: number;
}

// --- MingMing Definitions ---

export interface MingmingStatBlock {
  maxHp: number;
  attack: number;
  defense: number;
  maxEnergy: number;
  cardDraw: number; // Contribution to global card draw
}

export interface MingmingData {
  id: string; // Template ID (e.g. "mm_turtwig")
  name: string;
  primaryElement: Element;
  secondaryElement?: Element;
  baseStats: MingmingStatBlock; // Base stats at some standard level
  artReference?: string; // Placeholder for sprite/asset key
}

export interface MingmingEntity {
  id: string; // Instance ID (e.g. "battle_mm_1")
  data: MingmingData; // Reference to immutable template
  level: number;

  // Mutable State
  currentHp: number;
  currentEnergy: number;
  tempHp: number; // Shields

  // Current effective stats (after level scaling, but before temporary buffs?) 
  // Or do we recalculate on fly? Usually good to cache.
  // Let's keep it simple: State tracks current resources.

  statusEffects: StatusEffectInstance[];
}

// --- Program (Card) Definitions ---

export interface ProgramAction {
  type: string; // e.g. "ATTACK", "HEAL" - make generic for now or enum later
  payload: any; // Flexible for now, will tighten later
}

export interface ProgramConstraint {
  type: 'HAS_STATUS' | 'HEALTH_THRESHOLD' | 'ENERGY_THRESHOLD';
  target: 'SELF' | 'TARGET';
  value: string | number;
}

export interface ProgramData {
  id: string; // Template ID (e.g. "prog_fireball")
  name: string;
  description: string;
  element: Element;
  target: TargetType;
  category: ProgramCategory;
  baseCost: number;

  constraints: ProgramConstraint[];
  actions: ProgramAction[]; // The "What it does"

  artReference?: string; // Placeholder
}

export interface ProgramEntity {
  id: string; // Instance ID (e.g. "hand_card_1")
  data: ProgramData; // Reference to immutable template

  // Mutable State for this instance (e.g. cost reduction this turn)
  currentCost: number;
  isPlayable: boolean; // Calculated state
}
