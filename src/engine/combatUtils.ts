import type { Element, IBattleEntity, ProgramData } from './types';

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
 */
export function calculateModifier(attacker: IBattleEntity, target: IBattleEntity, program: ProgramData): number {
  let modifier = 1.0;

  // 1. STAB (Same-Type Attack Bonus)
  if (program.element === attacker.primaryElement || program.element === attacker.secondaryElement) {
    modifier *= STAB_BONUS;
  }

  // 2. Primary Type Advantage
  const primaryAdv = ElementalMatrix[program.element]?.[target.primaryElement];
  if (primaryAdv) modifier *= primaryAdv;

  // 3. Secondary Type Advantage (with 0.75x mitigation for resistance)
  if (target.secondaryElement) {
    const secondaryAdv = ElementalMatrix[program.element]?.[target.secondaryElement];
    if (secondaryAdv) {
      // If it's a resistance (0.5), apply the 0.75 mitigation
      const finalSecondaryAdv = secondaryAdv < 1.0 ? secondaryAdv * SECONDARY_MITIGATION : secondaryAdv;
      modifier *= finalSecondaryAdv;
    }
  }

  return modifier;
}

/**
 * Final Damage Formula from legacy Rules.cs
 */
export function calculateDamage(attacker: IBattleEntity, target: IBattleEntity, program: ProgramData, power: number): number {
  const modifier = calculateModifier(attacker, target, program);

  // Step A: Base Level Component
  const levelBase = ((2 * attacker.level) / 5) + 2;

  // Step B: Stat Scaling
  const scaled = levelBase * power * attacker.attack / target.defense;

  // Step C: Constant normalization
  const total = (scaled / 50) + 2;

  // Final: Apply elemental modifier and floor
  return Math.floor(total * modifier);
}
