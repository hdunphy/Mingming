import type { ProgramAction, ProgramConstraint, ProgramData } from '../types';
import programsData from './programs.json';
import { initDaemonHooks } from './daemonHooks';
import { resolveProgramId } from './programAliases';

export const BURNED_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'TARGET' as const, value: 'Burn' }
export const DAZED_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'TARGET' as const, value: 'Dazed' }
export const AWAKE_CONSTRAINT = { type: 'NOT_STATUS' as const, target: 'SELF' as const, value: 'Asleep' };
export const ALERT_CONSTRAINT = { type: 'NOT_STATUS' as const, target: 'SELF' as const, value: 'Stunned' };
export const ASLEEP_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'SELF' as const, value: 'Asleep' };
export const BASE_CONSTRAINT = { type: 'BASE' as const, target: 'SELF' as const, value: '' };

export const STANDARD_CONSTRAINTS = [ALERT_CONSTRAINT, AWAKE_CONSTRAINT, BASE_CONSTRAINT];

import actionsLib from './lib/actions.json';
import constraintsLib from './lib/constraints.json';

/** lib/actions.json and lib/constraints.json, keyed by library id. */
const ACTIONS_LIB = actionsLib as unknown as Record<string, ProgramAction>;
const CONSTRAINTS_LIB = constraintsLib as unknown as Record<string, ProgramConstraint>;

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
const inflateAction = (action: ProgramAction, parentId: string): ProgramAction => {
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
const inflateConstraint = (constraint: string | ProgramConstraint, parentId: string): ProgramConstraint => {
    // A bare string in programs.json is a library id; anything else is already a (possibly
    // partial) constraint that only overrides fields of its library entry.
    const constraintObj: Partial<ProgramConstraint> = typeof constraint === 'string' ? { id: constraint } : constraint;

    if (constraintObj.id) {
        if (CONSTRAINTS_LIB[constraintObj.id]) {
            return { ...CONSTRAINTS_LIB[constraintObj.id], ...constraintObj };
        } else {
            console.error(`[ProgramRegistry] Missing constraint definition for ID: "${constraintObj.id}" in card: "${parentId}"`);
            // Deliberately NOT a valid constraint: the miss path returns an `error` marker for
            // the validator to reject, exactly as before.
            return { ...constraintObj, error: `Missing constraint: ${constraintObj.id}` } as ProgramConstraint;
        }
    }
    return constraintObj as ProgramConstraint;
};

/*
 * TICKET 144d — THE INFLATED CARD, BUILT ONCE.
 *
 * `GetProgramData` re-inflated from scratch on every call: a spread of the raw record, then
 * `inflateConstraint` over every constraint, then `inflateAction` over every action plus every
 * action's conditionals, then the same again for `discardEffect`. That is several object
 * allocations per call, and the profile puts the function at 2.4% of a run with `inflateConstraint`
 * alone at 0.8% — because the AI calls it per candidate, per hook scan, per daemon, inside a search
 * that makes 93,889 reducer calls a decision.
 *
 * Nothing about the result depends on the battle, so it is memoised by id.
 *
 * THE ONE THING THAT MADE THIS DELICATE. Ticket 97 warns that the engine mutates registry-resident
 * card data during a battle, which would make a stale cache a silent behaviour change. Two checks
 * before trusting it: nothing writes to `ProgramRegistry[id]` or `InternalTestRegistry[id]` outside
 * `programRegistry.test.ts` (which uses a distinct id per case, so each is a cache miss), and
 * nothing writes into the object `GetProgramData` returns. Growth (`growPerPlay`) is carried on
 * `state.counters`, not on the card.
 *
 * Callers now share one object where they used to get a private copy. That is what the ticket asks
 * for — identity, not equality — and it is safe for exactly as long as the second check above holds.
 * `clearProgramDataCache` is the seam for a suite that rebuilds a registry entry in place.
 */
const inflatedByIdCache = new Map<string, ProgramData>();

/** Drop the memo. For a test that redefines an id it has already asked for. */
export const clearProgramDataCache = (): void => {
    inflatedByIdCache.clear();
    inflatedCache = null;
};

export const GetProgramData = (rawId: string): ProgramData => {
    initDaemonHooks();
    // TICKET 162a: the thirteen v2 renames resolve here, so every fixture, run log and non-EA deck
    // that still says `water_slap` opens `tackle`. See `programAliases.ts` for why the table is
    // consulted rather than folded into the registry as extra keys.
    const id = resolveProgramId(rawId);
    const memo = inflatedByIdCache.get(id);
    if (memo) return memo;
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
    const inflated: ProgramData = {
        ...rawData,
        constraints: rawData.constraints?.map(c => inflateConstraint(c, id)) || [],
        actions: rawData.actions?.map(action => {
            const inflatedAction = inflateAction(action, id);
            if (inflatedAction.conditionals) {
                return {
                    ...inflatedAction,
                    conditionals: inflatedAction.conditionals.map(c => inflateConstraint(c, id))
                };
            }
            return inflatedAction;
        }) || [],
        discardEffect: rawData.discardEffect ? rawData.discardEffect.map(action => {
            const inflatedAction = inflateAction(action, id);
            if (inflatedAction.conditionals) {
                return {
                    ...inflatedAction,
                    conditionals: inflatedAction.conditionals.map(c => inflateConstraint(c, id))
                };
            }
            return inflatedAction;
        }) : undefined
    };
    // The `missing` fallback above returns WITHOUT caching, on purpose: an id absent now may be
    // registered a moment later (test registries, lazy daemon init), and caching the placeholder
    // would make that first miss permanent.
    inflatedByIdCache.set(id, inflated);
    return inflated;
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
