
import type { Element, IBattleEntity, ProgramData, IBattleState } from './types';

/**
 * Elemental Advantage Matrix based on legacy Rules.cs
 * Source Element -> Target Element -> Multiplier
 */
export const ElementalMatrix: Record<Element, Partial<Record<Element, number>>> = {
  Fire: { Water: 0.5, Earth: 0.5, Nature: 2.0, Ice: 2.0 },
  Water: { Fire: 2.0, Earth: 2.0, Nature: 0.5, Ice: 0.5 },
  Earth: { Fire: 2.0, Water: 0.5, Earth: 0.5 },
  Air: { Fire: 0.5, Earth: 0.5, Ice: 2.0 },
  Nature: { Fire: 0.5, Water: 2.0, Earth: 2.0, Air: 2.0 },
  Ice: { Water: 2.0, Earth: 2.0, Air: 0.5 },
  Light: { Dark: 2.0 },
  Dark: { Light: 2.0 },
  None: {}
};

const STAB_BONUS = 1.5;
const SECONDARY_MITIGATION = 0.75;

/**
 * Calculates the final elemental modifier including STAB and Resistance.
 * Matches `Rules.GetModifier` and `Rules.GetTypeAdvantage`
 */
export function calculateModifier(attacker: IBattleEntity, target: IBattleEntity, program: ProgramData): number {
  let modifier = 1.0;

  // 1. STAB (Same-Type Attack Bonus)
  // Check if program element matches attacker's primary OR secondary
  if (attacker.primaryElement === program.element || attacker.secondaryElement === program.element) {
    modifier = STAB_BONUS;
  }

  // 2. Primary Type Advantage
  const primaryAdv = ElementalMatrix[program.element]?.[target.primaryElement] ?? 1.0;
  modifier *= primaryAdv;

  // 3. Secondary Type Advantage
  if (target.secondaryElement) {
    // Only apply if the interaction is explicitly defined (Effective/Ineffective)
    const secondaryAdv = ElementalMatrix[program.element]?.[target.secondaryElement];
    if (secondaryAdv !== undefined) {
      modifier *= secondaryAdv * SECONDARY_MITIGATION;
    }
  }

  return modifier;
}

import { applyDamageModifiers } from './core/Hooks';
// ... types ...

export function calculateDamage(attacker: IBattleEntity, target: IBattleEntity, program: ProgramData, power: number, state: IBattleState): number {
  const modifier = calculateModifier(attacker, target, program);

  // Step 1: Base Level Damage
  const levelBase = Math.floor((2 * attacker.level) / 5) + 2;

  // Step 2: Scaled Damage
  const scaled = Math.floor(levelBase * power * attacker.attack / target.defense);

  // Step 3: Reduction
  const reduced = (scaled / 50) + 2;

  // Step 4: Final Modifier
  let damage = Math.floor(reduced * modifier);

  // Step 5: Hooks
  damage = applyDamageModifiers(damage, {
    source: attacker,
    target,
    program,
    state,
    triggerDepth: 0 // Base damage calculation is depth 0
  });

  return Math.max(0, damage);
}

export function calculateHeal(attacker: IBattleEntity, target: IBattleEntity, power: number): number {
  const levelBase = ((2 * attacker.level) / 5) + 2;

  // Dividing by 50 offsets the unmitigated 'attack' multiplier 
  // and brings the curve in line with the damage formula's pacing.
  // We add +2 at the end to guarantee a minimum heal amount.
  const rawHeal = ((levelBase * power * attacker.attack) / 50) + 2;

  const missingHp = target.maxHp - target.currentHp;
  return Math.floor(Math.min(rawHeal, missingHp));
}
