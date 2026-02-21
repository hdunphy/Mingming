import type { IBattleState, IBattleEntity, ProgramData } from '../types';
import type { ActionType, ProgramAction, AttackActionData, StatusActionData, HealActionData, DrawActionData, EnergyActionData, GenerateCardActionData, CleanseActionData, DiscardActionData, ExhaustActionData, ReturnActionData, SearchActionData } from '../types';
import type { HookContext } from '../core/Hooks';
import { calculateDamage, calculateHeal } from '../combatUtils';
import { checkDefeat } from '../effectHandlers'; // Need to refactor checkDefeat or keep it in effectHandlers for now
import { applyMutations, executeDraw } from '../resolutionEngine';
import { globalBattleEventBus } from '../events';

function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

/**
 * Base abstract class for executing ProgramAction data.
 * Pure execution logic mapping state + pure-data -> new state.
 */
export abstract class ActionExecutor<T extends ProgramAction> {
    abstract execute(state: IBattleState, sourceId: string, targetId: string, actionData: T, program: ProgramData, context: HookContext): IBattleState;
}

export class AttackExecutor extends ActionExecutor<AttackActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: AttackActionData, program: ProgramData, _context: HookContext): IBattleState {
        const { power, element, scaling } = actionData;

        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
        let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

        if (!target) return state;

        let damage = 0;
        if (source) {
            const programToUse = program || ({ element: element } as ProgramData);
            damage = calculateDamage(source, target, programToUse, power, state);

            if (scaling === 'CARDS_PLAYED') {
                const multiplier = state.cardsPlayedThisTurn;
                damage = Math.floor(damage * multiplier);
            } else if (scaling === 'MISSING_HP') {
                const missingHp = source.maxHp - source.currentHp;
                damage += Math.floor(missingHp * 0.5); // Example: 50% of missing HP
            } else if (scaling === 'STATUS_COUNT') {
                const targetStatusCount = target.statusEffects.reduce((acc, s) => acc + s.stacks, 0);
                damage += Math.floor(damage * (targetStatusCount * 0.25)); // +25% per status
            }
        }

        return applyMutations(state, [{
            type: 'HP',
            sourceId: sourceId,
            targetId: targetId,
            payload: {
                amount: damage,
                isHeal: false,
                element: element || program.element
            }
        }]);
    }
}

export class StatusExecutor extends ActionExecutor<StatusActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: StatusActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { status, stacks, consume } = actionData;

        if (consume) {
            const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
            const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);
            if (!target) return state;

            const existingStatus = target.statusEffects.find(s => s.type === status);
            if (existingStatus) {
                return applyMutations(state, [{
                    type: 'STATUS',
                    targetId: targetId,
                    sourceId: sourceId,
                    payload: { status, stacks: -existingStatus.stacks }
                }]);
            }
            return state;
        }

        if (stacks < 0) {
            const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
                party.map(e => {
                    if (e.id !== targetId) return e;
                    return {
                        ...e,
                        statusEffects: e.statusEffects.filter(s => s.type !== status)
                    };
                });
            let newState: IBattleState = {
                ...state,
                playerParty: updateParty(state.playerParty),
                enemyParty: updateParty(state.enemyParty)
            };
            newState = addLog(newState, `  ✨ ${status} removed from target`);
            return newState; // Or you could use applyMutations with stacks: -stacks here, but this is the existing simple logic
        }

        // Apply Status Logic
        return applyMutations(state, [{
            type: 'STATUS',
            targetId: targetId,
            sourceId: sourceId,
            payload: { status, stacks }
        }]);
    }
}

export class HealExecutor extends ActionExecutor<HealActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: HealActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { power, healOverride } = actionData;
        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        let source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
        let target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

        if (!target) return state;
        if (!source && healOverride === undefined) return state;

        const healAmount = healOverride !== undefined ? healOverride : calculateHeal(source as any, target, power);

        return applyMutations(state, [{
            type: 'HP',
            sourceId: sourceId,
            targetId: targetId,
            payload: {
                amount: healAmount,
                isHeal: true
            }
        }]);
    }
}

export class DrawExecutor extends ActionExecutor<DrawActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, actionData: DrawActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { amount } = actionData;
        const isPlayerSource = state.playerParty.some(e => e.id === sourceId);
        const side = isPlayerSource ? 'PLAYER' : 'ENEMY';

        return executeDraw(state, side, amount, false, sourceId);
    }
}

export class EnergyExecutor extends ActionExecutor<EnergyActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: EnergyActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { amount } = actionData;
        return applyMutations(state, [{
            type: 'ENERGY',
            targetId: targetId,
            sourceId: sourceId,
            payload: { amount }
        }]);
    }
}

export class GenerateCardExecutor extends ActionExecutor<GenerateCardActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, actionData: GenerateCardActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { dataId } = actionData;
        return applyMutations(state, [{
            type: 'GENERATE_CARD',
            sourceId: sourceId,
            targetId: _targetId,
            payload: { dataId }
        }]);
    }
}

export class CleanseExecutor extends ActionExecutor<CleanseActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: CleanseActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { statusTarget } = actionData;
        return applyMutations(state, [{
            type: 'CLEANSE',
            sourceId,
            targetId,
            payload: { statusTarget }
        }]);
    }
}

export class DiscardExecutor extends ActionExecutor<DiscardActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: DiscardActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { amount, isRandom } = actionData;
        return applyMutations(state, [{
            type: 'DISCARD',
            sourceId,
            targetId,
            payload: { amount, isRandom }
        }]);
    }
}

export class ExhaustExecutor extends ActionExecutor<ExhaustActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: ExhaustActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { amount } = actionData;
        return applyMutations(state, [{
            type: 'EXHAUST',
            sourceId,
            targetId,
            payload: { amount }
        }]);
    }
}

export class ReturnExecutor extends ActionExecutor<ReturnActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: ReturnActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { amount, sourcePile, destinationPile } = actionData;
        return applyMutations(state, [{
            type: 'RETURN',
            sourceId,
            targetId,
            payload: { amount, sourcePile, destinationPile }
        }]);
    }
}

export class SearchExecutor extends ActionExecutor<SearchActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: SearchActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { amount, criteria } = actionData;
        return applyMutations(state, [{
            type: 'SEARCH',
            sourceId,
            targetId,
            payload: { amount, criteria }
        }]);
    }
}

// Registry to route ActionType to Executors
export const ActionExecutorRegistry: Record<ActionType, ActionExecutor<any>> = {
    'ATTACK': new AttackExecutor(),
    'STATUS': new StatusExecutor(),
    'HEAL': new HealExecutor(),
    'DRAW': new DrawExecutor(),
    'ENERGY': new EnergyExecutor(),
    'GENERATE_CARD': new GenerateCardExecutor(),
    'CLEANSE': new CleanseExecutor(),
    'DISCARD': new DiscardExecutor(),
    'EXHAUST': new ExhaustExecutor(),
    'RETURN': new ReturnExecutor(),
    'SEARCH': new SearchExecutor()
};
