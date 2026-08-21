
import type { Element, IBattleEntity, ProgramData, IBattleState } from './types';
import { CALIBRATION_LEVEL_DAMAGE_BASE } from './types';

/**
 * Elemental Advantage Matrix. Source Element -> Target Element -> Multiplier.
 *
 * Ticket 35 (Henry): SOFT AND ASYMMETRIC. Advantage is **1.5x** (was 2.0) and **resistance is
 * gone entirely** (was 0.5) - a bad matchup means you simply do not get the bonus, never that
 * your damage is halved. Doing extra damage feels good; having yours halved felt awful, and the
 * two compounded: STAB cancels in the ratio, so the old 2.0/0.5 pair was a flat 4x swing
 * between the two sides.
 *
 * RESISTED PAIRS ARE ABSENT FROM THE TABLE, NOT LISTED AS 1.0 - and that is load-bearing.
 * `getModifierBreakdown` multiplies any *defined* secondary-element entry by
 * SECONDARY_MITIGATION, so an explicit `1.0` would silently become 1.0 x 0.75 = a 25% PENALTY
 * on a matchup that is meant to be neutral. Absent means "no interaction", which is what
 * asymmetric requires.
 *
 * The relationships the removed entries used to encode, kept readable here: Fire was resisted
 * by Water and Earth; Water by Nature and Ice; Earth by Water and Earth; Air by Fire and Earth;
 * Nature by Fire; Ice by Air. Each is now simply an absence of advantage in that direction.
 *
 * Why 1.5/1.0 and not something smaller: measured over 1,440 games per variant, a PERSISTENT
 * MULTIPLICATIVE damage modifier is a win condition rather than matchup flavour - it applies to
 * every attack all game, so shrinking it only makes the same outcome arrive more slowly. Even
 * 1.05/1.0 still produced an 89/11 cross-element split, and doubling game length did not help
 * (8.6-turn games measured the same spread as 4.4-turn ones). This number is therefore chosen
 * for FEEL - enough to reward bringing the right deck to a gym or boss - and the residual
 * lopsidedness is accepted as the price of type mattering at all. If it ever needs to be a true
 * coin flip, change the mechanism's SHAPE (first-hit-only, additive, or paying out in energy or
 * draw instead of damage), do not shave this number again. See ticket 35.
 */
export const ElementalMatrix: Record<Element, Partial<Record<Element, number>>> = {
  Fire: { Nature: 1.5, Ice: 1.5 },
  Water: { Fire: 1.5, Earth: 1.5 },
  Earth: { Fire: 1.5 },
  Air: { Ice: 1.5 },
  Nature: { Water: 1.5, Earth: 1.5, Air: 1.5 },
  Ice: { Water: 1.5, Earth: 1.5 },
  Light: { Dark: 1.5 },
  Dark: { Light: 1.5 },
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

import { applyDamageModifiers, STATUS_MODEL } from './core/Hooks';
// ... types ...

/** Raw stack count of one status, or 0. Ticket 95's POWER shape reads these directly. */
function stacksOf(entity: IBattleEntity, status: string): number {
  return entity.statusEffects.find(s => s.type === status)?.stacks ?? 0;
}

export function calculateDamage(attacker: IBattleEntity, target: IBattleEntity, program: ProgramData, power: number, state: IBattleState): number {
  const modifier = calculateModifier(attacker, target, program);

  // Step 1: Base damage coefficient.
  //
  // Was `Math.floor((2 * attacker.level) / 5) + 2` — the last place a per-entity level reached
  // the damage formula. Ticket 21 freezes the engine at `CALIBRATION_LEVEL` (15), where that
  // expression evaluates to exactly 8, so it is folded to a constant. Every balance row ever
  // computed already ran at level 15, so this changes no number in the corpus.
  const levelBase = CALIBRATION_LEVEL_DAMAGE_BASE;

  // Ticket 95, POWER shape: the four duality statuses are worth POWER rather than a multiplier, so
  // they are added HERE - before the divisor, STAB and resistances - which is the ticket-26 law
  // (a bonus that rides the power is the only kind `powerscale` can price, and the only kind that
  // behaves the same at every level). Under the live PERCENT shape this contributes nothing and
  // `applyDamageModifiers` does the work instead; the two can never both fire.
  const statusPower = STATUS_MODEL.shape === 'POWER'
    ? STATUS_MODEL.powerPerStack * (
        (stacksOf(attacker, 'Strengthened') - stacksOf(attacker, 'Weakened'))
        + (stacksOf(target, 'Dazed') - stacksOf(target, 'Sharp')))
    : 0;
  // Floored at zero: a card whose power is cancelled into the negative deals nothing, it does not
  // heal the target.
  const effectivePower = Math.max(0, power + statusPower);

  // Step 2: Scaled Damage
  const scaled = Math.floor(levelBase * effectivePower * attacker.attack / target.defense);

  // Step 3: Reduction
  // No flat bonus here (docs/power_curve_spec.md rev 3): the old `+2` was paid per hit,
  // secretly inflating small/multi-hit attacks, and its relative weight shrank as units
  // leveled up, so the curve is now purely proportional to power at every level.
  //
  // The DIVISOR is the game's pace dial, and 45 is the rev-3.1 amendment (ticket 23).
  // /35 was rev 3's choice, picked to preserve the pace the old /50+2 formula produced -
  // but that pace turned out to be too fast to play in: a full turn removed 60-70% of a
  // health pool, so even matchups resolved in 3-4.5 turns and any archetype that builds
  // over time (poison attrition, momentum, discard windmills) never got to exist. /45
  // is a deliberate ~22% slowdown that buys those archetypes room - even matchups land
  // at ~5-6 turns, element/level-advantage routs still end in 2-3, and a first-turn kill
  // needs a perfect setup rather than an ordinary curve-out.
  //
  // This is a GLOBAL divisor, so it moves absolute pace only: every card's damage is
  // scaled by the same factor and relative card economics - the whole rev-3 budget - are
  // untouched. Card prices deliberately did NOT change with it.
  const reduced = scaled / 45;

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

export function calculateHeal(_attacker: IBattleEntity, target: IBattleEntity, power: number): number {
  // docs/power_curve_spec.md rev 3: heals are a fixed % of the RECEIVING entity's
  // maxHp, not scaled by the healer's level/attack — level-proof by construction,
  // since maxHp already carries the level scaling. 1 power heals 0.25% maxHp (the
  // 4-power-per-1%-maxHp price — pricier than damage's 3-power-per-1%, deliberately,
  // since healing doesn't advance the win condition the way damage does). No flat
  // +2 floor and no attacker-stat scaling, per the same "+2 drifted with level" and
  // "attack scaling made healing ~18x damage per power point" problems damage had.
  const rawHeal = (target.maxHp * power) / 400;

  // Ticket 36: the LightStance +50% healing branch that used to sit here is gone.
  // LightStance is a DEFENSIVE stance now (-30% damage taken, in applyDamageModifiers)
  // and healing multipliers ride the `onHealCalculated` modifier path instead, applied
  // once at the heal choke point in effectHandlers - which is what finally makes the
  // power-based and engine flat-heal pipelines agree.

  // Returns the INTENDED heal, deliberately NOT clamped to the target's missing
  // HP. Clamping happens at the single application choke point
  // (effectHandlers.handleHealEffect), which records the overflow as the
  // `last_overheal` counter so effects like AUDHUMBLA v2's NOURISH_ROUTINE can
  // convert real Overheal into damage.
  return Math.floor(rawHeal);
}
