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

// --- Burn (Permanent + DoT with overflow) ---

const BURN_MAX_STACKS = 3;

class BurnBehavior extends StatusBehavior {
    readonly type = 'Burn' as const;

    onApply(currentEffects: StatusEffectInstance[], incomingStacks: number, target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'Burn');
        const currentStacks = existingIdx !== -1 ? effects[existingIdx].stacks : 0;
        const totalStacks = currentStacks + incomingStacks;
        let immediateDamage = 0;
        const logs: string[] = [];

        if (totalStacks > BURN_MAX_STACKS) {
            // Overflow: stacks beyond max deal immediate max-burn-tier damage per overflow stack
            const overflowStacks = totalStacks - BURN_MAX_STACKS;
            const burnConfig = DEFAULT_GAME_CONFIG.status.burnStacks;
            const maxTier = burnConfig[burnConfig.length - 1];
            immediateDamage = Math.floor(target.maxHp * maxTier.damagePercent) * overflowStacks;
            logs.push(`  🔥 ${target.name} — Burn overflow! ${overflowStacks} excess stack${overflowStacks !== 1 ? 's' : ''} deal ${immediateDamage} immediate damage`);

            // Set to max stacks
            if (existingIdx !== -1) {
                effects[existingIdx] = { ...effects[existingIdx], stacks: BURN_MAX_STACKS };
            } else {
                effects.push(this.createInstance(BURN_MAX_STACKS));
            }
        } else {
            // Normal stack addition
            if (existingIdx !== -1) {
                effects[existingIdx] = { ...effects[existingIdx], stacks: totalStacks };
            } else {
                effects.push(this.createInstance(totalStacks));
            }
        }

        return { updatedEffects: effects, immediateDamage, logs };
    }

    endTurn(instance: StatusEffectInstance, entity: IBattleEntity): EndTurnResult {
        const burnConfig = DEFAULT_GAME_CONFIG.status.burnStacks;
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

        // Permanent — never removed
        return { updatedInstance: instance, damage, healing: 0, defenseShred, logs };
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
        // 1 damage per stack
        const damage = instance.stacks;
        const newStacks = instance.stacks - 1;
        const logs: string[] = [];

        logs.push(`  ☠️ ${entity.name} — Poison deals ${damage} damage (${instance.stacks} → ${newStacks} stacks)`);

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
        if (target.statusEffects.some(s => s.type === 'Awoken')) {
            return { updatedEffects: currentEffects, immediateDamage: 0, logs: [`  ✨ ${target.name} is Awoken and cannot be put to sleep!`] };
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
            // When waking up naturally, we don't apply Awoken here (usually handled by endTurn process applying new statuses?)
            // Actually, let's return a mutation or apply it in endTurn? 
            // Better to handle it in battleReducer or effectHandlers when the status is removed.
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

// --- Awoken (1-turn immunity to Sleep) ---

class AwokenBehavior extends StatusBehavior {
    readonly type = 'Awoken' as const;

    onApply(currentEffects: StatusEffectInstance[], _incomingStacks: number, _target: IBattleEntity, _source?: IBattleEntity, _power?: number): ApplyResult {
        const effects = [...currentEffects];
        const existingIdx = effects.findIndex(s => s.type === 'Awoken');

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
            logs: [`  ✨ ${entity.name}'s Awoken protection wore off`]
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
        const healAmount = 5; // 5 HP per stack? Or just 5 total? User said "it should give HP every turn". 
        // Let's do 5 HP per stack as a baseline for scaling.
        const healing = healAmount * instance.stacks;
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
    'Awoken': new AwokenBehavior(),
    'Energized': new EnergizedBehavior(),
};

export function getStatusBehavior(type: StatusType): StatusBehavior {
    return BEHAVIOR_REGISTRY[type];
}
