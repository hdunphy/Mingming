
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
 * Matches `Rules.GetModifier` and `Rules.GetTypeAdvantage`
 */
export function calculateModifier(attackerType: Element, defenderPrimary: Element, defenderSecondary: Element | undefined, cardElement: Element): number {
  let modifier = 1.0;

  // 1. STAB (Same-Type Attack Bonus) - Rules.cs line 133
  // "attackerType.Contains(cardType)" implies if the card element matches any of the attacker's types.
  // Our system separates primary/secondary, but for now assuming attackerType passed here is checked against card.
  // Wait, Rules.cs takes `MingmingAlignment attackerType` which implies it holds both.
  // Let's stick to the current logic: if card matches primary OR secondary (if we had it passed)
  // For this pure function, let's assume `attackerType` is the checking context. 
  // Actually, let's look at `calculateDamage` signature.

  if (attackerType === cardElement) {
    modifier = STAB_BONUS;
  }

  // 2. Primary Type Advantage - Rules.cs line 142
  const primaryAdv = ElementalMatrix[cardElement]?.[defenderPrimary] ?? 1.0;
  modifier *= primaryAdv;

  // 3. Secondary Type Advantage - Rules.cs line 145
  if (defenderSecondary) {
    const secondaryAdv = ElementalMatrix[cardElement]?.[defenderSecondary] ?? 1.0;
    // Rules.cs line 146: modifier *= hasSecondaryAdvantage ? secondaryValue * SECONDARY_TYPE_ADVANTAGE : 1;
    // Wait, Rules.cs says: if (hasSecondaryAdvantage) result *= val * 0.75.
    // This implies ANY secondary interaction is dampened? Or only if it exists in the lookup?
    // "AlignmentAdvantageLookup.TryGetValue" returns true ONLY if it's explicitly defined (Effective/Ineffective).
    // So neutral interactions (1.0) don't trigger the 0.75 mitigation.
    // We must check if it exists in our Matrix.

    const hasSecondaryEntry = ElementalMatrix[cardElement]?.[defenderSecondary] !== undefined;
    if (hasSecondaryEntry) {
      modifier *= secondaryAdv * SECONDARY_MITIGATION;
    }
  }

  return modifier;
}

export function calculateDamage(attacker: IBattleEntity, target: IBattleEntity, program: ProgramData, power: number): number {
  // STAB logic needs to check both attacker elements
  let isStab = false;
  if (attacker.primaryElement === program.element) isStab = true;
  if (attacker.secondaryElement && attacker.secondaryElement === program.element) isStab = true;

  // We pass the "matching" element to calculateModifier or handle STAB outside?
  // Rules.cs handles STAB inside GetModifier.
  // Let's refactor calculateModifier to take the whole attacker/target if needed, or just keep it pure.
  // Let's keep it pure but handle STAB correctly.

  let modifier = isStab ? STAB_BONUS : 1.0;

  // Type Advantages
  const primaryAdv = ElementalMatrix[program.element]?.[target.primaryElement] ?? 1.0;
  modifier *= primaryAdv;

  if (target.secondaryElement) {
    const secVal = ElementalMatrix[program.element]?.[target.secondaryElement];
    if (secVal !== undefined) {
      modifier *= secVal * SECONDARY_MITIGATION;
    }
  }

  // Formula from Rules.cs line 123-126
  // float damage = (float)((2 * level) / 5) + 2;
  // damage *= (float)cardPower * attack / defense;
  // damage = (float)(damage / 50) + 2;
  // damage *= _modifier;

  const levelBase = ((2 * attacker.level) / 5) + 2;

  // Note: Rules.cs uses float division. JavaScript numbers are doubles (floats) by default, so we are good.
  // But we might want to floor at intermediate steps if Unity mimics integer division in parts?
  // Line 123: ((2 * level) / 5) is integer division in C# if level is int!
  // So Math.floor((2 * level) / 5) is required.

  const step1 = Math.floor((2 * attacker.level) / 5) + 2;
  const step2 = step1 * power * attacker.attack / target.defense;
  const step3 = (step2 / 50) + 2;
  // Final: Apply elemental modifier and floor
  return Math.floor(step3 * modifier);
}

/**
 * Calculates Heal Amount from legacy Rules.cs
 * Formula: LevelMod * Power * Attack / 2
 * Clamped to target's missing health.
 */
export function calculateHeal(attacker: IBattleEntity, target: IBattleEntity, power: number): number {
  const levelBase = ((2 * attacker.level) / 5) + 2;
  const rawHeal = levelBase * power * attacker.attack / 2;

  const missingHp = target.maxHp - target.currentHp;
  return Math.floor(Math.min(rawHeal, missingHp));
}
