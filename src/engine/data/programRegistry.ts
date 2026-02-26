import type { ProgramData } from '../types';
import programsData from './programs.json';
import { initDaemonHooks } from './daemonHooks';

export const BURNED_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'TARGET' as const, value: 'Burn' }
export const DAZED_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'TARGET' as const, value: 'Dazed' }
export const AWAKE_CONSTRAINT = { type: 'NOT_STATUS' as const, target: 'SELF' as const, value: 'Asleep' };
export const ALERT_CONSTRAINT = { type: 'NOT_STATUS' as const, target: 'SELF' as const, value: 'Stunned' };
export const ASLEEP_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'SELF' as const, value: 'Asleep' };
export const BASE_CONSTRAINT = { type: 'BASE' as const, target: 'SELF' as const, value: '' };

export const STANDARD_CONSTRAINTS = [ALERT_CONSTRAINT, AWAKE_CONSTRAINT, BASE_CONSTRAINT];

import actionsLib from './lib/actions.json';
import constraintsLib from './lib/constraints.json';

const ACTIONS_LIB = actionsLib as Record<string, any>;
const CONSTRAINTS_LIB = constraintsLib as Record<string, any>;

// Milestone 8.5: Keep a small registry for basic engine tests if needed, 
// though most tests now use TestProgramRegistry.ts
export const InternalTestRegistry: Record<string, ProgramData> = {
    'test_strike': {
        id: 'test_strike',
        name: 'Test Strike',
        description: 'Basic strike for internal tests.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 10, target: 'TARGET' }]
    }
};

export const ProgramRegistry: Record<string, ProgramData> = programsData as unknown as Record<string, ProgramData>;


/**
 * Inflates a single action by merging it with its library definition if an ID is present.
 */
const inflateAction = (action: any, parentId: string): any => {
    if (action.id) {
        if (ACTIONS_LIB[action.id]) {
            return { ...ACTIONS_LIB[action.id], ...action };
        } else {
            console.error(`[ProgramRegistry] Missing action definition for ID: "${action.id}" in card: "${parentId}"`);
            return { ...action, error: `Missing action: ${action.id}` };
        }
    }
    return action;
};

/**
 * Inflates a single constraint by merging it with its library definition if an ID is present.
 */
const inflateConstraint = (constraint: any, parentId: string): any => {
    const constraintObj = typeof constraint === 'string' ? { id: constraint } : constraint;

    if (constraintObj.id) {
        if (CONSTRAINTS_LIB[constraintObj.id]) {
            return { ...CONSTRAINTS_LIB[constraintObj.id], ...constraintObj };
        } else {
            console.error(`[ProgramRegistry] Missing constraint definition for ID: "${constraintObj.id}" in card: "${parentId}"`);
            return { ...constraintObj, error: `Missing constraint: ${constraintObj.id}` };
        }
    }
    return constraintObj;
};

export const GetProgramData = (id: string): ProgramData => {
    initDaemonHooks();
    const rawData = ProgramRegistry[id] || InternalTestRegistry[id];
    if (!rawData) {
        console.warn(`Program ID not found: ${id}`);
        if (!id) console.trace();
        return {
            id: 'missing',
            name: 'Missing Program',
            description: 'Data not found',
            element: 'None',
            target: 'Single',
            category: 'Attack',
            rarity: 'Common',
            baseCost: 99,
            constraints: [],
            actions: [],
            artReference: ''
        };
    }

    // Inflate Data with validation checks
    return {
        ...rawData,
        constraints: rawData.constraints?.map(c => inflateConstraint(c, id)) || [],
        actions: rawData.actions?.map(action => {
            const inflatedAction = inflateAction(action, id);
            if (inflatedAction.conditionals) {
                return {
                    ...inflatedAction,
                    conditionals: inflatedAction.conditionals.map((c: any) => inflateConstraint(c, id))
                };
            }
            return inflatedAction;
        }) || []
    };
};

/**
 * A registry of all programs, pre-inflated with library data.
 * Used primarily for UI and inventory listings.
 */
let inflatedCache: Record<string, ProgramData> | null = null;
export const getInflatedProgramRegistry = (): Record<string, ProgramData> => {
    if (!inflatedCache) {
        inflatedCache = Object.keys(ProgramRegistry).reduce((acc, key) => {
            acc[key] = GetProgramData(key);
            return acc;
        }, {} as Record<string, ProgramData>);
    }
    return inflatedCache;
};
