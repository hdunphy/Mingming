/**
 * Status Effect Behavior System
 * 
 * Each status type is a class that defines:
 * - onApply(): How the status is applied (stacking, caps, overflow)
 * - endTurn(): What happens at end of turn (damage, decrement, removal)
 */

import type { StatusEffectInstance, IBattleEntity, StatusType } from './types';
import { DEFAULT_GAME_CONFIG } from './data/gameConfig';

// --- Result Types ---

export interface ApplyResult {
    /** Updated status effects array for the entity */
    readonly updatedEffects: StatusEffectInstance[];
    /** Immediate damage dealt (e.g. burn overflow) */
    readonly immediateDamage: number;
    /** Log messages to append */
    readonly logs: string[];
}

export interface EndTurnResult {
    /** Updated instance, or null to remove */
    readonly updatedInstance: StatusEffectInstance | null;
    /** Damage dealt this tick */
    readonly damage: number;
    /** Healing received this tick */
    readonly healing?: number;
    /** Defense shred amount */
    readonly defenseShred: number;
    /** Log messages */
    readonly logs: string[];
}

export interface PostDamageResult {
    readonly damage: number;
    readonly updatedInstances: StatusEffectInstance[];
    readonly logs: string[];
}

// --- Base Class ---

export abstract class StatusBehavior {
    abstract readonly type: StatusType;

    /**
     * Called when this status is applied to a target.
     * Handles stacking, caps, overflow, resets.
     */
    abstract onApply(
        currentEffects: StatusEffectInstance[],
        incomingStacks: number,
        target: IBattleEntity,
        source?: IBattleEntity,
        power?: number
    ): ApplyResult;

    /**
     * Called at end of turn for each active status instance.
     */
    abstract endTurn(
        instance: StatusEffectInstance,
        entity: IBattleEntity
    ): EndTurnResult;

    /**
     * Called after damage has been calculated but before it's applied.
     * Allows statues to absorb or modify incoming damage.
     */
    onPostDamage(
        currentDamage: number,
        _defender: IBattleEntity,
        instances: StatusEffectInstance[]
    ): PostDamageResult {
        return { damage: currentDamage, updatedInstances: instances, logs: [] };
    }

    /** Create a fresh instance */
    protected createInstance(stacks: number): StatusEffectInstance {
        return {
            id: crypto.randomUUID(),
            type: this.type,
            stacks
        };
    }

    /** Calculate how many stacks are actually applied after source/power scaling */
    getScaledStacks(stacks: number, _source?: IBattleEntity, _power?: number): number {
        return stacks;
    }
}

// --- Permanent Statuses (never expire from endTurn) ---

/** Shared behavior for Strengthened, Weakened, Dazed, Sharp */
class PermanentStatusBehavior extends StatusBehavior {
    readonly type: StatusType;

    constructor(type: StatusType) {
        super();
        this.type = type;
    }

    onApply(currentEffects: StatusEffectInstance[], incomingStacks: number, _target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === this.type);

        if (existingIdx !== -1) {
            const existing = effects[existingIdx];
            effects[existingIdx] = { ...existing, stacks: existing.stacks + incomingStacks };
        } else {
            effects.push(this.createInstance(incomingStacks));
        }

        return { updatedEffects: effects, immediateDamage: 0, logs: [] };
    }

    endTurn(instance: StatusEffectInstance, _entity: IBattleEntity): EndTurnResult {
        // Permanent — no change, no damage
        return { updatedInstance: instance, damage: 0, healing: 0, defenseShred: 0, logs: [] };
    }
}

// --- Burn (DoT with a capped pile and an overflow payout) ---

/**
 * Ticket 62: Burn's whole mechanic behind ONE config object.
 *
 * Why a config rather than four constants: ticket 62's grid measures 21 configurations
 * (2 shapes x 3 caps x 3 overflow values, plus tick arms and the live baseline) by mutating
 * this object in memory the way ticket 60 mutated firmware hook data. Nothing about the grid
 * is committed - `BURN_CONFIG` below reproduces the LIVE pre-62 behavior exactly, and
 * `StatusBehaviors.burn.test.ts` pins that identity so the refactor cannot silently ship a
 * balance change under cover of a refactor.
 *
 * `shape` is the thing the grid is really asking about:
 *
 *   VENT      Stacks hold AT the cap and every excess stack pays `overflowPercent` of the
 *             burned entity's max HP immediately. This is what ships today (and what shipped
 *             historically at 0.08). Its failure mode is that the payout is unbounded in the
 *             application rate - a hot target can be farmed forever without the pile ever
 *             being rebuilt.
 *
 *   DETONATE  Every cap-crossing pays once and SUBTRACTS the cap from the pile (modulo carry),
 *             so the payout rate is bounded by application rate / cap. 3 + 1 = 4 detonates
 *             once and leaves 1; 3 + 4 = 7 detonates twice and leaves 1; 3 + 3 = 6 detonates
 *             once and leaves 3 (exactly divisible stays at cap). The rebuild is the limiter
 *             the historical design lacked.
 *
 * Both shapes are SYMMETRIC by construction rather than by branch: `immediateDamage` is
 * applied to the burned entity by `effectHandlers.handleStatusEffect`, so self-applied Burn
 * detonates on its own holder and nothing here needs to know who the source was.
 */
export type BurnShape = 'VENT' | 'DETONATE';

export interface BurnMechanicConfig {
    shape: BurnShape;
    /** Stack ceiling. Crossing it is what triggers the shape above. */
    maxStacks: number;
    /**
     * Immediate damage per overflow EVENT, as a fraction of the burned entity's max HP.
     * VENT charges one event per excess stack; DETONATE one per cap-crossing.
     *
     * The live value is 0.14 (ticket 62). The history is worth keeping, because this number
     * has now been wrong in both directions:
     *
     *   0.08, VENT   The original. A single excess stack instantly dealt a full top-tier turn
     *                of Burn AND bypassed defense, with the pile parked at the cap - so a hot
     *                target could be farmed forever without ever rebuilding it. Measured at
     *                ~half of fenrir_v2's whole output, matchups over on turn 3.
     *   0.01, VENT   The over-correction. `Math.floor(maxHp x 0.01)` is 0 on every frame under
     *                100 max HP, so ticket 58 counted 0 overflow damage across 54,767 requested
     *                stacks roster-wide while 32.1% of all Burn applied was thrown away at the
     *                cap. The mechanic was not tuned down; it was switched off.
     *   0.14, DETONATE  What ships. Nearly twice the ORIGINAL rate, and safe at that rate only
     *                because DETONATE's modulo carry bounds the payout by application rate over
     *                cap rather than by every excess cast. The rate was never the defect; the
     *                absence of a limiter was.
     *
     * Ticket 62's grid measured 20 configurations before this one: at ANY dial that rounds
     * above zero the wasted-stack number collapses 40.4% -> 0.0%, so "the waste" was always a
     * flooring artifact rather than a design constraint.
     */
    overflowPercent: number;
    /** Per-stack tick tiers; index = stacks - 1. Length is expected to match `maxStacks`. */
    tiers: ReadonlyArray<{ damagePercent: number; defShredPercent: number }>;
}

/**
 * THE LIVE CONFIGURATION — ticket 62, shipped 2026-08-15 on Henry's pick of `DET-C4-D14`.
 *
 * Burn detonates. Crossing the 4-stack cap pays 14% of the burned entity's max HP and
 * subtracts the cap from the pile, so the pile has to be REBUILT before it can pay again.
 *
 * Why these three numbers and not others - all measured, none reasoned:
 *
 *   shape DETONATE   Worth ~44 field points against VENT at the same cap and dial, because
 *                    VENT charges on every excess stack and nothing makes a hot target
 *                    expensive to keep burning. Henry's pick for the self-limiter.
 *   cap 4            NOT a balance tweak on the primary - cap 3 and cap 4 both put fenrir_v2
 *                    at ~48%. It is the COLLATERAL that differs: at cap 3 detonation costs
 *                    skoll_v2 ~6 field points and pushes hraesvelgr_v2 to 83% (over the
 *                    ceiling); at cap 4 skoll_v2 is left where she started and hraesvelgr_v2
 *                    comes down to 77.7%. Same primary, no bill.
 *   D 14%            The value putting fenrir_v2 nearest 0.50 - 48.5% across two independent
 *                    seed bases (49.4 / 47.5, 900 decided games each).
 *
 * FTK is the reason this took a 36-arm sweep rather than a knob round: a double-digit
 * percent-of-max-HP burst is the first credible first-turn-kill vector Burn has ever had.
 * Measured 0 across ~46,000 games at every cap and every dial up to 16%, largest single
 * detonation observed 14 HP. Any future rate increase re-opens that question.
 *
 * Grid arms mutate this object in memory; nothing but this line writes it on disk.
 */
export const BURN_CONFIG: BurnMechanicConfig = {
    shape: 'DETONATE',
    maxStacks: 4,
    overflowPercent: 0.14,
    tiers: DEFAULT_GAME_CONFIG.status.burnStacks,
};

class BurnBehavior extends StatusBehavior {
    readonly type = 'Burn' as const;

    onApply(currentEffects: StatusEffectInstance[], incomingStacks: number, target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const cfg = BURN_CONFIG;
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'Burn');
        const currentStacks = existingIdx !== -1 ? effects[existingIdx].stacks : 0;
        const totalStacks = currentStacks + incomingStacks;
        let immediateDamage = 0;
        const logs: string[] = [];

        // Per-event payout. Floored, so it is 0 on any frame under `1 / overflowPercent` max HP -
        // see BurnMechanicConfig.overflowPercent for why that matters today.
        const perEvent = Math.floor(target.maxHp * cfg.overflowPercent);
        let finalStacks = totalStacks;

        if (totalStacks > cfg.maxStacks) {
            if (cfg.shape === 'DETONATE') {
                // Modulo carry: pay once per cap-crossing and subtract the cap each time, so the
                // pile has to be REBUILT before it can pay again. Exactly divisible stays at cap
                // (6 with a cap of 3 -> one detonation, 3 remain) because 3 is not > 3.
                let remaining = totalStacks;
                let detonations = 0;
                while (remaining > cfg.maxStacks) {
                    remaining -= cfg.maxStacks;
                    detonations++;
                }
                immediateDamage = perEvent * detonations;
                finalStacks = remaining;
                for (let i = 0; i < detonations; i++) {
                    logs.push(`  🔥 ${target.name} — Burn overload! Detonation deals ${perEvent} damage`);
                }
            } else {
                // VENT: the pile holds at the cap and every excess stack pays.
                const overflowStacks = totalStacks - cfg.maxStacks;
                immediateDamage = perEvent * overflowStacks;
                finalStacks = cfg.maxStacks;
                logs.push(`  🔥 ${target.name} — Burn overflow! ${overflowStacks} excess stack${overflowStacks !== 1 ? 's' : ''} deal ${immediateDamage} immediate damage`);
            }
        }

        if (existingIdx !== -1) {
            effects[existingIdx] = { ...effects[existingIdx], stacks: finalStacks };
        } else {
            effects.push(this.createInstance(finalStacks));
        }

        return { updatedEffects: effects, immediateDamage, logs };
    }

    endTurn(instance: StatusEffectInstance, entity: IBattleEntity): EndTurnResult {
        // Ticket 62: the tier table now comes from BURN_CONFIG so a grid arm that changes the
        // cap can change the climb with it. Identical to DEFAULT_GAME_CONFIG.status.burnStacks
        // as committed - BURN_CONFIG.tiers IS that array.
        const burnConfig = BURN_CONFIG.tiers;
        const tier = burnConfig[instance.stacks - 1] ?? burnConfig[burnConfig.length - 1];

        const damage = Math.floor(entity.maxHp * tier.damagePercent);
        const defenseShred = tier.defShredPercent > 0
            ? Math.floor(entity.defense * tier.defShredPercent)
            : 0;

        const logs: string[] = [];
        if (damage > 0) {
            logs.push(`  🔥 ${entity.name} — Burn deals ${damage} damage (${instance.stacks} stacks)`);
        }
        if (defenseShred > 0) {
            logs.push(`  🔥 ${entity.name} — Burn shreds ${defenseShred} defense`);
        }

        // docs/power_curve_spec.md rev 3: Burn now decays 1 stack/turn (was permanent).
        // Tiers, def shred and the onApply overflow burst are unchanged.
        const newStacks = instance.stacks - 1;
        if (newStacks <= 0) {
            logs.push(`  ✅ ${entity.name} — Burn wore off`);
            return { updatedInstance: null, damage, healing: 0, defenseShred, logs };
        }

        return { updatedInstance: { ...instance, stacks: newStacks }, damage, healing: 0, defenseShred, logs };
    }
}

// --- Poison (Decrementing + DoT) ---

class PoisonBehavior extends StatusBehavior {
    readonly type = 'Poison' as const;

    onApply(currentEffects: StatusEffectInstance[], finalStacks: number, _target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'Poison');

        if (existingIdx !== -1) {
            const existing = effects[existingIdx];
            effects[existingIdx] = { ...existing, stacks: existing.stacks + finalStacks };
        } else {
            effects.push(this.createInstance(finalStacks));
        }

        return { updatedEffects: effects, immediateDamage: 0, logs: [] };
    }

    override getScaledStacks(stacks: number, source?: IBattleEntity, power?: number): number {
        if (!source || power === undefined) return stacks;
        return Math.max(1, Math.floor(stacks * (source.attack / 10) * (power / 10)));
    }

    endTurn(instance: StatusEffectInstance, entity: IBattleEntity): EndTurnResult {
        // 1% Max HP damage per stack
        const damage = Math.max(1, Math.floor(entity.maxHp * (instance.stacks / 100)));
        const newStacks = instance.stacks - 1;
        const logs: string[] = [];

        logs.push(`  ☠️ ${entity.name} — Poison deals ${damage} damage (${instance.stacks} stacks)`);

        if (newStacks <= 0) {
            logs.push(`  ✅ ${entity.name} — Poison wore off`);
            return { updatedInstance: null, damage, healing: 0, defenseShred: 0, logs };
        }

        return {
            updatedInstance: { ...instance, stacks: newStacks },
            damage,
            healing: 0,
            defenseShred: 0,
            logs
        };
    }
}

// --- Asleep (Decrementing, starts at 3, resets on reapply) ---

const ASLEEP_INITIAL_STACKS = 3;

class AsleepBehavior extends StatusBehavior {
    readonly type = 'Asleep' as const;

    onApply(currentEffects: StatusEffectInstance[], _incomingStacks: number, target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        if (target.statusEffects.some(s => s.type === 'StableOS')) {
            return { updatedEffects: currentEffects, immediateDamage: 0, logs: [`  ✨ ${target.name} cannot be put to sleep!`] };
        }

        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'Asleep');

        if (existingIdx !== -1) {
            // Reset to 3 stacks
            effects[existingIdx] = { ...effects[existingIdx], stacks: ASLEEP_INITIAL_STACKS };
        } else {
            effects.push(this.createInstance(ASLEEP_INITIAL_STACKS));
        }

        return { updatedEffects: effects, immediateDamage: 0, logs: [] };
    }

    endTurn(instance: StatusEffectInstance, entity: IBattleEntity): EndTurnResult {
        const newStacks = instance.stacks - 1;
        const logs: string[] = [];

        if (newStacks <= 0) {
            logs.push(`  ✅ ${entity.name} — woke up!`);
            // BattleReducer must handle applying Awoken and StableOS upon natural wake-up.
            return { updatedInstance: null, damage: 0, healing: 0, defenseShred: 0, logs };
        }

        logs.push(`  💤 ${entity.name} — Asleep (${newStacks} turn${newStacks !== 1 ? 's' : ''} left)`);
        return {
            updatedInstance: { ...instance, stacks: newStacks },
            damage: 0,
            healing: 0,
            defenseShred: 0,
            logs
        };
    }
}

// --- Stunned (1-turn, boolean, cap at 1) ---

class StunnedBehavior extends StatusBehavior {
    readonly type = 'Stunned' as const;

    onApply(currentEffects: StatusEffectInstance[], _incomingStacks: number, _target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'Stunned');

        if (existingIdx === -1) {
            // Boolean — always 1 stack
            effects.push(this.createInstance(1));
        }
        // If already stunned, no-op (don't stack)

        return { updatedEffects: effects, immediateDamage: 0, logs: [] };
    }

    endTurn(_instance: StatusEffectInstance, entity: IBattleEntity): EndTurnResult {
        // Always remove after 1 turn
        return {
            updatedInstance: null,
            damage: 0,
            healing: 0,
            defenseShred: 0,
            logs: [`  ✅ ${entity.name} — Stunned wore off`]
        };
    }
}

// --- Regen (Decrementing + Healing) ---

class RegenBehavior extends StatusBehavior {
    readonly type = 'Regen' as const;

    onApply(currentEffects: StatusEffectInstance[], incomingStacks: number, _target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'Regen');

        if (existingIdx !== -1) {
            const existing = effects[existingIdx];
            effects[existingIdx] = { ...existing, stacks: existing.stacks + incomingStacks };
        } else {
            effects.push(this.createInstance(incomingStacks));
        }

        return { updatedEffects: effects, immediateDamage: 0, logs: [] };
    }

    endTurn(instance: StatusEffectInstance, entity: IBattleEntity): EndTurnResult {
        // Ticket 34 (Henry): Regen is a FLAT 3% of maxHP per turn, and `stacks` is how many
        // TURNS it lasts - not an intensity multiplier. 3 stacks = 3% a turn for three turns,
        // then it falls off.
        //
        // It used to multiply by stacks, which made one application worth 1.5*N*(N+1) percent
        // of a pool - quadratic - and unbounded, because the decay is a flat 1/turn while a
        // card can apply 2+/turn. Fifteen stacks was healing 45% of a health pool EVERY TURN.
        // That single property decided huldra_v1: 2 Regen per play won 79% of its matchup,
        // 1 Regen per play won 1%, because 1/play exactly cancels the decay and never
        // accumulates. Linear duration removes the cliff - see ticket 34.
        const REGEN_PERCENT_PER_TURN = 0.03;
        const healing = Math.floor(entity.maxHp * REGEN_PERCENT_PER_TURN);
        const newStacks = instance.stacks - 1;
        const logs: string[] = [`  💚 ${entity.name} — Regen heals ${healing} HP (${instance.stacks} → ${newStacks} stacks)`];

        if (newStacks <= 0) {
            logs.push(`  ✅ ${entity.name} — Regen wore off`);
            return { updatedInstance: null, damage: 0, healing, defenseShred: 0, logs };
        }

        return {
            updatedInstance: { ...instance, stacks: newStacks },
            damage: 0,
            healing,
            defenseShred: 0,
            logs
        };
    }
}

// --- Energized (Persistent stacking, consumed at turn start) ---

class EnergizedBehavior extends StatusBehavior {
    readonly type = 'Energized' as const;

    onApply(currentEffects: StatusEffectInstance[], incomingStacks: number, _target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'Energized');

        if (existingIdx !== -1) {
            const existing = effects[existingIdx];
            effects[existingIdx] = { ...existing, stacks: existing.stacks + incomingStacks };
        } else {
            effects.push(this.createInstance(incomingStacks));
        }

        return { updatedEffects: effects, immediateDamage: 0, logs: [] };
    }

    endTurn(instance: StatusEffectInstance, _entity: IBattleEntity): EndTurnResult {
        // Persistent until naturally consumed at turn start
        return { updatedInstance: instance, damage: 0, healing: 0, defenseShred: 0, logs: [] };
    }
}

// --- StableOS (1-turn Hard CC Immunity) ---

class StableOSBehavior extends StatusBehavior {
    readonly type = 'StableOS' as const;

    onApply(currentEffects: StatusEffectInstance[], _incomingStacks: number, _target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'StableOS');

        if (existingIdx === -1) {
            effects.push(this.createInstance(1));
        }

        return { updatedEffects: effects, immediateDamage: 0, logs: [] };
    }

    endTurn(_instance: StatusEffectInstance, entity: IBattleEntity): EndTurnResult {
        return {
            updatedInstance: null,
            damage: 0,
            healing: 0,
            defenseShred: 0,
            logs: [`  📉 ${entity.name}'s StableOS (CC Immunity) wore off`]
        };
    }
}

// --- BarkShield (Temporary Health as % of maxHp, decays 20%/turn) ---

/**
 * Fraction of a BarkShield pool retained each turn (0.8 = the historical 20%/turn decay).
 * Ticket 33: extracted so it can be swept. Henry's question was whether 20%/turn is too fast
 * when the enemy is also chipping the pool from the other side - huldra_v2's 50% grant is a
 * third gone by her third turn before anyone attacks it.
 *
 * REGISTRY-WIDE, not huldra's. glacier_wall, stone_bark, spiked_carapace and shield_shards all
 * grant BarkShield, and Earth and Ice are both still placeholder species - a slower decay
 * silently buffs their future decks. Swept and reported in ticket 33; left at 0.8 pending the
 * Earth/Ice passes.
 */
const BARKSHIELD_DECAY_RETAINED = 0.8;

/**
 * docs/power_curve_spec.md rev 3: `stacks` now represents % of the holder's maxHp
 * (was flat HP points), so a shield is level-proof the same way Burn/Regen/Poison
 * already are. The absorb pool is recomputed from the holder's current maxHp each
 * time damage lands (rather than stored as a flat HP amount up front) so the shield
 * scales correctly if maxHp changes mid-battle. Same 20%/turn decay as before, just
 * operating on the percent value instead of flat points.
 */
class BarkShieldBehavior extends StatusBehavior {
    readonly type = 'BarkShield' as const;

    onApply(currentEffects: StatusEffectInstance[], incomingStacks: number, _target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'BarkShield');

        if (existingIdx !== -1) {
            const existing = effects[existingIdx];
            effects[existingIdx] = { ...existing, stacks: existing.stacks + incomingStacks };
        } else {
            effects.push(this.createInstance(incomingStacks));
        }

        return { updatedEffects: effects, immediateDamage: 0, logs: [] };
    }

    onPostDamage(currentDamage: number, defender: IBattleEntity, instances: StatusEffectInstance[]): PostDamageResult {
        const logs: string[] = [];
        let newDamage = currentDamage;
        const shieldIndex = instances.findIndex(s => s.type === 'BarkShield');

        if (shieldIndex !== -1 && currentDamage > 0) {
            const shieldPercent = instances[shieldIndex].stacks;
            const shieldHp = Math.floor(defender.maxHp * (shieldPercent / 100));
            const absorbed = Math.min(newDamage, shieldHp);
            newDamage -= absorbed;

            // Convert the absorbed HP back into consumed percent so the stored
            // stack value stays in the same % unit it was applied in.
            const absorbedPercent = defender.maxHp > 0 ? (absorbed / defender.maxHp) * 100 : 0;
            const remainingPercent = Math.max(0, shieldPercent - absorbedPercent);
            logs.push(`  🛡️ Bark Shield absorbed ${absorbed} damage!`);

            if (remainingPercent < 0.5) {
                logs.push(`  🛡️ Bark Shield broke!`);
                instances = instances.filter((_, i) => i !== shieldIndex);
            } else {
                const newInstances = [...instances];
                newInstances[shieldIndex] = { ...newInstances[shieldIndex], stacks: remainingPercent };
                instances = newInstances;
            }
        }
        return { damage: newDamage, updatedInstances: instances, logs };
    }

    endTurn(instance: StatusEffectInstance, _entity: IBattleEntity): EndTurnResult {
        const logs: string[] = [];
        const newStacks = instance.stacks * BARKSHIELD_DECAY_RETAINED;
        const lost = instance.stacks - newStacks;

        if (lost > 0.05) {
            logs.push(`  🛡️ Bark Shield decayed by ${lost.toFixed(1)}% maxHP`);
        }

        if (newStacks < 0.5) {
            return { updatedInstance: null, damage: 0, defenseShred: 0, logs };
        }
        return { updatedInstance: { ...instance, stacks: newStacks }, damage: 0, defenseShred: 0, logs };
    }
}

// --- Stances (DarkStance / LightStance): permanent, cap at 1, mutually exclusive ---

class StanceBehavior extends StatusBehavior {
    readonly type: StatusType;
    private readonly opposite: StatusType;

    constructor(type: 'DarkStance' | 'LightStance', opposite: 'DarkStance' | 'LightStance') {
        super();
        this.type = type;
        this.opposite = opposite;
    }

    onApply(currentEffects: StatusEffectInstance[], _incomingStacks: number, target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const logs: string[] = [];
        let effects = [...currentEffects];

        // Exclusivity: entering one stance replaces the other.
        if (effects.some(s => s.type === this.opposite)) {
            effects = effects.filter(s => s.type !== this.opposite);
            logs.push(`  ⚖️ ${target.name}'s ${this.opposite} fades as ${this.type} takes hold`);
        }

        // Cap at 1 stack — re-entering the same stance is a no-op.
        if (!effects.some(s => s.type === this.type)) {
            effects.push(this.createInstance(1));
        }

        return { updatedEffects: effects, immediateDamage: 0, logs };
    }

    endTurn(instance: StatusEffectInstance, _entity: IBattleEntity): EndTurnResult {
        // Permanent — never decays, no damage, no healing.
        return { updatedInstance: instance, damage: 0, healing: 0, defenseShred: 0, logs: [] };
    }
}

// --- Registry ---

const BEHAVIOR_REGISTRY: Record<StatusType, StatusBehavior> = {
    'Burn': new BurnBehavior(),
    'Poison': new PoisonBehavior(),
    'Asleep': new AsleepBehavior(),
    'Stunned': new StunnedBehavior(),
    'Strengthened': new PermanentStatusBehavior('Strengthened'),
    'Weakened': new PermanentStatusBehavior('Weakened'),
    'Dazed': new PermanentStatusBehavior('Dazed'),
    'Sharp': new PermanentStatusBehavior('Sharp'),
    'Regen': new RegenBehavior(),
    'Energized': new EnergizedBehavior(),
    'StableOS': new StableOSBehavior(),
    'BarkShield': new BarkShieldBehavior(),
    'DarkStance': new StanceBehavior('DarkStance', 'LightStance'),
    'LightStance': new StanceBehavior('LightStance', 'DarkStance'),
};

export function getStatusBehavior(type: StatusType): StatusBehavior {
    return BEHAVIOR_REGISTRY[type];
}
