import type { IBattleState, IBattleEntity, ProgramData } from '../types';
import type { ActionType, ProgramAction, AttackActionData, StatusActionData, HealActionData, DrawActionData, EnergyActionData, GenerateCardActionData } from '../types';
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
            }
        }

        const newCurrentHp = Math.max(0, target.currentHp - damage);

        let wakesUp = false;
        if (damage > 0) {
            const sleepIndex = target.statusEffects.findIndex(s => s.type === 'Asleep');
            if (sleepIndex !== -1) {
                wakesUp = true;
            }
        }

        globalBattleEventBus.emit({
            type: 'DAMAGE_TAKEN',
            targetId: target.id,
            amount: damage,
            element: element || program.element,
            timestamp: Date.now()
        });

        if (wakesUp) {
            globalBattleEventBus.emit({
                type: 'STATUS_REMOVED',
                targetId: target.id,
                status: 'Asleep',
                timestamp: Date.now()
            });
        }

        const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
            party.map(e => {
                if (e.id !== targetId) return e;
                let newStatus = e.statusEffects;
                if (wakesUp) {
                    newStatus = newStatus.filter(s => s.type !== 'Asleep');
                }
                return { ...e, currentHp: newCurrentHp, statusEffects: newStatus };
            });

        let newState = {
            ...state,
            playerParty: updateParty(state.playerParty),
            enemyParty: updateParty(state.enemyParty)
        } as IBattleState;

        if (wakesUp) {
            // Apply Awoken by mutating through Status execution logic directly or resolving.
            newState = applyMutations(newState, [{
                type: 'STATUS',
                targetId: target.id,
                sourceId: sourceId,
                payload: { status: 'Awoken', stacks: 1 }
            }]);
        }

        newState = addLog(newState, `  → ${target.name} takes ${damage} damage${newCurrentHp <= 0 ? ' ☠️ DEFEATED' : ''}`);

        if (newCurrentHp <= 0) {
            newState = checkDefeat(newState, targetId);
        }

        return newState;
    }
}

export class StatusExecutor extends ActionExecutor<StatusActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: StatusActionData, _program: ProgramData, _context: HookContext): IBattleState {
        const { status, stacks } = actionData;

        //TODO: negative stacks should decrement instead of remove compeltely. If its 0 or less, remove it. Although the dual-type statuses like strengthen/weaken will need to transition between eachother.
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
            return newState;
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

        const newCurrentHp = Math.min(target.maxHp, target.currentHp + healAmount);

        globalBattleEventBus.emit({
            type: 'HEAL',
            targetId: target.id,
            amount: healAmount,
            sourceId: source?.id || sourceId,
            timestamp: Date.now()
        });

        const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
            party.map(e => e.id === targetId ? { ...e, currentHp: newCurrentHp } : e);

        let newState: IBattleState = {
            ...state,
            playerParty: updateParty(state.playerParty),
            enemyParty: updateParty(state.enemyParty)
        } as IBattleState;

        newState = addLog(newState, `  → ${target.name} heals ${healAmount} HP`);
        return newState;
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

// Registry to route ActionType to Executors
export const ActionExecutorRegistry: Record<ActionType, ActionExecutor<any>> = {
    'ATTACK': new AttackExecutor(),
    'STATUS': new StatusExecutor(),
    'HEAL': new HealExecutor(),
    'DRAW': new DrawExecutor(),
    'ENERGY': new EnergyExecutor(),
    'GENERATE_CARD': new GenerateCardExecutor()
};
