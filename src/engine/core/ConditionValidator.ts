import type { IBattleState, IBattleEntity, ProgramData, StatusType, ProgramConstraint } from '../types';
import type { HookCondition, HookContext } from './HookTypes';

/**
 * A purely functional, stateless utility for evaluating logic conditions.
 * Used by both OS/Daemon Hooks and ProgramCard Constraints to ensure 1:1 logic.
 */
export const ConditionValidator = {
    /**
     * Evaluates an OS or Daemon HookCondition against the current runtime context.
     */
    evaluateHookCondition(condition: HookCondition | undefined, context: HookContext, owner: IBattleEntity): boolean {
        if (!condition) return true;

        // 1. Source & Target Checks
        const isOwnerPlayer = context.state.playerParty.some((e: IBattleEntity) => e.id === owner.id);

        if (condition.source) {
            if (condition.source === 'SELF' && context.source?.id !== owner.id) {
                return false;
            }
            const isSourcePlayer = context.source ? context.state.playerParty.some((e: IBattleEntity) => e.id === context.source?.id) : false;
            if (condition.source === 'ALLY' && (isOwnerPlayer !== isSourcePlayer || context.source?.id === owner.id)) return false;
            if (condition.source === 'OPPONENT' && isOwnerPlayer === isSourcePlayer) return false;
        }

        if (condition.target) {
            if (condition.target === 'SELF' && context.target?.id !== owner.id) {
                return false;
            }
            const isTargetPlayer = context.target ? context.state.playerParty.some((e: IBattleEntity) => e.id === context.target?.id) : false;
            if (condition.target === 'ALLY' && (isOwnerPlayer !== isTargetPlayer || context.target?.id === owner.id)) return false;
            if (condition.target === 'OPPONENT' && isOwnerPlayer === isTargetPlayer) return false;
        }

        // 2. Program Checks
        if (condition.actionType && context.program) {
            // A program satisfies the actionType check if ANY of its actions match
            const hasAction = context.program.actions.some(a => a.type === condition.actionType);
            if (!hasAction) return false;
        }
        if (condition.programElement && context.program?.element !== condition.programElement) return false;

        // 3. Cost Check
        if (condition.baseCost !== undefined) {
            const cost = context.program?.baseCost ?? 0;
            if (typeof condition.baseCost === 'number') {
                if (cost !== condition.baseCost) return false;
            } else {
                const { operator, value } = condition.baseCost;
                if (operator === 'LT' && !(cost < value)) return false;
                if (operator === 'GT' && !(cost > value)) return false;
                if (operator === 'LTE' && !(cost <= value)) return false;
                if (operator === 'GTE' && !(cost >= value)) return false;
                if (operator === 'EQ' && !(cost === value)) return false;
            }
        }

        // 4. Status Check
        if (condition.statusApplied && context.statusApplied !== condition.statusApplied) return false;

        // 5. Draw Check
        if (condition.isNaturalDraw !== undefined && context.isNaturalDraw !== condition.isNaturalDraw) return false;

        // 6. Token Check
        if (condition.isToken !== undefined && (context.program?.isToken ?? false) !== condition.isToken) return false;

        // 7. Target Status Check
        if (condition.targetStatus && context.target) {
            const targetStat = context.target.statusEffects.find(s => s.type === condition.targetStatus!.status);
            if (!targetStat) return false;
            if (condition.targetStatus.minStacks !== undefined && targetStat.stacks < condition.targetStatus.minStacks) return false;
        }

        // 8. Source Status Check
        if (condition.sourceStatus && context.source) {
            const sourceStat = context.source.statusEffects.find(s => s.type === condition.sourceStatus!.status);
            if (!sourceStat) return false;
            if (condition.sourceStatus.minStacks !== undefined && sourceStat.stacks < condition.sourceStatus.minStacks) return false;
        }

        // 9. Counter Check
        if (condition.counter) {
            const { key, operator, value } = condition.counter;
            const currentCounters = context.state.counters || {};
            const currentVal = currentCounters[key] || 0;
            if (operator === 'LT' && !(currentVal < value)) return false;
            if (operator === 'GT' && !(currentVal > value)) return false;
            if (operator === 'LTE' && !(currentVal <= value)) return false;
            if (operator === 'GTE' && !(currentVal >= value)) return false;
            if (operator === 'EQ' && !(currentVal === value)) return false;
        }

        // 10. Current Energy Check
        if (condition.currentEnergy) {
            const { operator, value } = condition.currentEnergy;
            const currentVal = owner.currentEnergy;
            if (operator === 'LT' && !(currentVal < value)) return false;
            if (operator === 'GT' && !(currentVal > value)) return false;
            if (operator === 'LTE' && !(currentVal <= value)) return false;
            if (operator === 'GTE' && !(currentVal >= value)) return false;
            if (operator === 'EQ' && !(currentVal === value)) return false;
        }

        return true;
    },

    /**
     * Evaluates a ProgramConstraint (usually found on Cards directly) against the target.
     */
    evaluateCardConstraint(constraint: ProgramConstraint, source: IBattleEntity, subject: IBattleEntity, cost: number, state?: IBattleState): boolean {
        switch (constraint.type) {
            case 'HAS_STATUS':
                if (!subject.statusEffects.some(s => s.type === constraint.value)) {
                    return false;
                }
                break;

            case 'HEALTH_THRESHOLD':
                // value format: "LT:30" (Less Than 30%) or "GT:50" (Greater Than 50%)
                if (typeof constraint.value !== 'string') break;
                const [op, valStr] = constraint.value.split(':');
                const threshold = parseInt(valStr);
                const hpPercent = (subject.currentHp / subject.maxHp) * 100;

                if (op === 'LT' && hpPercent >= threshold) return false;
                if (op === 'GT' && hpPercent <= threshold) return false;
                break;

            case 'BASE':
                // Base Energy Check
                if (source.currentEnergy < cost) return false;
                break;

            case 'CARDS_DRAWN':
                // Check if enough cards were drawn this turn
                if (!state) return true; // Fail safe
                if (state.cardsDrawnThisTurn < (constraint.value as number)) return false;
                break;

            case 'NOT_STATUS':
                if (subject.statusEffects.some(s => s.type === constraint.value)) {
                    return false;
                }
                break;

            default:
                console.warn(`Unknown constraint type: ${constraint.type}`);
                break;
        }

        return true;
    }
};
