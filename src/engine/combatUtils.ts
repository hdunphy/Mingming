
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

export const STAB_BONUS = 1.5;
const SECONDARY_MITIGATION = 0.75;

/** UI-facing decomposition of the elemental modifier (see getModifierBreakdown). */
export interface ModifierBreakdown {
  /** True when the program's element matches the attacker's primary OR secondary element (×1.5 STAB). */
  stab: boolean;
  /** ElementalMatrix product vs the target (primary × mitigated secondary); 1 when neutral. */
  effectiveness: number;
  /** Final multiplier: (stab ? 1.5 : 1) × effectiveness. Identical to calculateModifier's result. */
  modifier: number;
}

/**
 * Decomposes the elemental modifier into its STAB and type-effectiveness parts
 * so the UI can explain the number. Pure and cheap; `modifier` reproduces the
 * exact multiplication order of the original calculateModifier.
 */
export function getModifierBreakdown(attacker: IBattleEntity, target: IBattleEntity, program: ProgramData): ModifierBreakdown {
  // 1. STAB (Same-Type Attack Bonus)
  // Check if program element matches attacker's primary OR secondary.
  // 'None' never grants STAB: every species carries secondaryElement 'None',
  // which used to make ALL neutral cards get x1.5 from anyone (port artifact).
  const stab = program.element !== 'None'
    && (attacker.primaryElement === program.element || attacker.secondaryElement === program.element);
  let modifier = stab ? STAB_BONUS : 1.0;

  // 2. Primary Type Advantage
  const primaryAdv = ElementalMatrix[program.element]?.[target.primaryElement] ?? 1.0;
  modifier *= primaryAdv;
  let effectiveness = primaryAdv;

  // 3. Secondary Type Advantage
  if (target.secondaryElement) {
    // Only apply if the interaction is explicitly defined (Effective/Ineffective)
    const secondaryAdv = ElementalMatrix[program.element]?.[target.secondaryElement];
    if (secondaryAdv !== undefined) {
      modifier *= secondaryAdv * SECONDARY_MITIGATION;
      effectiveness *= secondaryAdv * SECONDARY_MITIGATION;
    }
  }

  return { stab, effectiveness, modifier };
}

/**
 * Calculates the final elemental modifier including STAB and Resistance.
 * Matches `Rules.GetModifier` and `Rules.GetTypeAdvantage`
 */
export function calculateModifier(attacker: IBattleEntity, target: IBattleEntity, program: ProgramData): number {
  return getModifierBreakdown(attacker, target, program).modifier;
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

  // Milestone 8.4: Relic Attack Multiplier
  if (attacker.relicBonuses?.attackMod) {
    damage = Math.floor(damage * attacker.relicBonuses.attackMod);
  }

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

export function calculateHeal(attacker: IBattleEntity, _target: IBattleEntity, power: number): number {
  const levelBase = ((2 * attacker.level) / 5) + 2;

  // Dividing by 50 offsets the unmitigated 'attack' multiplier
  // and brings the curve in line with the damage formula's pacing.
  // We add +2 at the end to guarantee a minimum heal amount.
  let rawHeal = ((levelBase * power * attacker.attack) / 50) + 2;

  // Stance system: while in Light Stance the healer's heals are +50%.
  // (healOverride-based heals are boosted separately in HealExecutor.)
  if (attacker.statusEffects?.some(s => s.type === 'LightStance')) {
    rawHeal *= 1.5;
  }

  // Returns the INTENDED heal, deliberately NOT clamped to the target's missing
  // HP. Clamping happens at the single application choke point
  // (effectHandlers.handleHealEffect), which records the overflow as the
  // `last_overheal` counter so effects like AUDHUMBLA v2's NOURISH_ROUTINE can
  // convert real Overheal into damage.
  return Math.floor(rawHeal);
}
