export type Element = 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Ice' | 'Light' | 'Dark' | 'None';
export type TargetType = 'Single' | 'Self' | 'Side' | 'All';
export type ProgramCategory = 'Attack' | 'Heal' | 'Status' | 'Special';
export type TurnPhase = 'PRE_TURN' | 'ACTION' | 'POST_TURN';

export interface MingMing {
  id: string;
  name: string;
  level: number;
  stats: {
    hp: number;
    maxHp: number;
    tempHp: number; // Shields/Light barriers - purged during POST_TURN
    attack: number;
    defense: number;
    energy: number;
    maxEnergy: number;
  };
  // Tracking for permanent "Wither/Strengthen" battle modifiers
  baseStats: {
    attack: number;
    defense: number;
  };
  primaryElement: Element;
  secondaryElement?: Element;
  statusEffects: StatusEffectInstance[];
}

export interface StatusEffectInstance {
    id: string; // Unique ID for this instance
    type: string; // 'Burn', 'Poison', etc. make an enum?
    // Start with basic structure
    duration: number;
    stacks: number;
}

export interface Program {
  id: string;
  name: string;
  description: string; // Added from GDD
  element: Element;
  target: TargetType;
  category: ProgramCategory;
  cost: number;
  // ... existing fields
  hits: number; // Default: 1. Support for multi-hit programs.
  constraints: ProgramConstraint[]; // Requirements to play (e.g., HasStatus, MinEnergy).
  logicOverrides?: string; // Reference to custom logic hooks (e.g., extra damage if target is asleep).
}

export interface ProgramConstraint {
  type: 'HAS_STATUS' | 'HEALTH_THRESHOLD' | 'ENERGY_THRESHOLD';
  target: 'SELF' | 'TARGET';
  value: string | number;
}
