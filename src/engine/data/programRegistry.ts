import type { ProgramData } from '../types';

export const BURNED_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'TARGET' as const, value: 'Burn' }
export const DAZED_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'TARGET' as const, value: 'Dazed' }
export const AWAKE_CONSTRAINT = { type: 'NOT_STATUS' as const, target: 'SELF' as const, value: 'Asleep' };
export const ALERT_CONSTRAINT = { type: 'NOT_STATUS' as const, target: 'SELF' as const, value: 'Stunned' };
export const ASLEEP_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'SELF' as const, value: 'Asleep' };
export const BASE_CONSTRAINT = { type: 'BASE' as const, target: 'SELF' as const, value: '' };

export const STANDARD_CONSTRAINTS = [ALERT_CONSTRAINT, AWAKE_CONSTRAINT, BASE_CONSTRAINT];

import {
    THERMAL_OVERLOAD_HOOK_ID,
    THERMAL_OVERLOAD_LOGIC_ID,
    RECURSION_DAEMON_HOOK_ID,
    ECHO_CHAMBER_DAEMON_HOOK_ID
} from './daemonHooks';

export const ProgramRegistry: Record<string, ProgramData> = {
    // --- DAEMONS ---
    'recursion_daemon': {
        id: 'recursion_daemon',
        name: 'RECURSION_DAEMON',
        description: 'Passive: Whenever you draw a card from an effect, heal 5 HP.',
        element: 'None',
        target: 'Self',
        category: 'Daemon',
        exhaust: true,
        rarity: 'Rare',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [],
        hooks: [RECURSION_DAEMON_HOOK_ID]
    },
    'thermal_overload': {
        id: 'thermal_overload',
        name: 'THERMAL_OVERLOAD',
        description: 'Passive: Increase Burn damage by 50%. Take 5 damage at the end of each turn.',
        element: 'Fire',
        target: 'Self',
        category: 'Daemon',
        exhaust: true,
        rarity: 'Rare',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [],
        hooks: [THERMAL_OVERLOAD_HOOK_ID, THERMAL_OVERLOAD_LOGIC_ID, 'thermal_overload_burn_boost']
    },
    'echo_chamber_daemon': {
        id: 'echo_chamber_daemon',
        name: 'ECHO_CHAMBER_DAEMON',
        description: 'Passive: When you play a 0-cost card, generate a 0-cost "Feedback" token.',
        element: 'Nature',
        target: 'Self',
        category: 'Daemon',
        exhaust: true,
        rarity: 'Rare',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [],
        hooks: [ECHO_CHAMBER_DAEMON_HOOK_ID]
    },
    'feedback_token': {
        id: 'feedback_token',
        name: 'Feedback',
        description: 'Deals 5 Nature damage. (Token)',
        element: 'Nature',
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 0,
        isToken: true,
        exhaust: true,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 5, target: 'TARGET' }
        ]
    },

    // --- GDD CORE CARDS (34) ---
    'rest': {
        id: 'rest',
        name: 'Rest',
        description: 'MingMing falls asleep and heals each turn.',
        element: 'None',
        target: 'Single',
        category: 'Status',
        rarity: 'Common',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'APPLY_STATUS', status: 'Asleep', stacks: 1, target: 'TARGET' },
            { type: 'HEAL', power: 10, target: 'TARGET' }
        ],
    },
    'singularity': {
        id: 'singularity',
        name: 'Singularity',
        description: 'Apply burn to all enemies',
        element: 'Fire',
        target: 'Side',
        category: 'Status',
        rarity: 'Uncommon',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'APPLY_STATUS', status: 'Burn', stacks: 1, target: 'TARGET' }
        ],
    },
    'solar_flare': {
        id: 'solar_flare',
        name: 'Solar Flare',
        description: '30 power. +10 power if target is burned.',
        target: 'Single',
        category: 'Attack',
        element: 'Fire',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 30, target: 'TARGET' },
            { type: 'ATTACK', power: 10, target: 'TARGET', conditionals: [BURNED_CONSTRAINT] }
        ]
    },
    // --- FENRIR DECK ---
    'ignite_pipeline': {
        id: 'ignite_pipeline',
        name: 'Ignite Pipeline',
        description: 'Apply Burn (2 stacks)',
        element: 'Fire',
        target: 'Single',
        category: 'Status',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Burn', stacks: 2, target: 'TARGET' }]
    },
    'flash': {
        id: 'flash',
        name: 'Flash',
        description: '0-cost, apply Dazed',
        element: 'Light',
        target: 'Single',
        category: 'Status',
        rarity: 'Common',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Dazed', stacks: 1, target: 'TARGET' }]
    },
    'preheat': {
        id: 'preheat',
        name: 'Preheat',
        description: 'Gain Strengthened',
        element: 'Fire',
        target: 'Self',
        category: 'Status',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Strengthened', stacks: 1, target: 'TARGET' }]
    },
    'ash_to_ash': {
        id: 'ash_to_ash',
        name: 'Ash to Ash',
        description: 'Consume Burn to heal 25 HP',
        element: 'Fire',
        target: 'Single',
        category: 'Heal',
        rarity: 'Uncommon',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS, BURNED_CONSTRAINT],
        actions: [
            { type: 'REMOVE_STATUS', status: 'Burn', target: 'TARGET' },
            { type: 'HEAL', power: 0, healOverride: 25, target: 'SELF' }
        ]
    },
    'fire_punch': {
        id: 'fire_punch',
        name: 'Fire Punch',
        description: 'Reliable Fire damage (20 power)',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 20, target: 'TARGET' }]
    },
    'reckless': {
        id: 'reckless',
        name: 'Reckless',
        description: 'Huge damage (50 power), but self-Stun',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        rarity: 'Uncommon',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 50, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Stunned', stacks: 1, target: 'SELF' }
        ]
    },
    'combustion': {
        id: 'combustion',
        name: 'Combustion',
        description: 'Fire attack (50 power)',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        rarity: 'Uncommon',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 50, target: 'TARGET' }]
    },

    // --- KRAKEN DECK ---
    'squirt': {
        id: 'squirt',
        name: 'Squirt',
        description: '0-cost, draw 1',
        element: 'Water',
        target: 'Self',
        category: 'Special',
        rarity: 'Common',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'DRAW', count: 1, target: 'SELF' }]
    },
    'deep_pressure': {
        id: 'deep_pressure',
        name: 'Deep Pressure',
        description: 'Stun the target if they are Dazed',
        element: 'Water',
        target: 'Single',
        category: 'Status',
        rarity: 'Uncommon',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS, DAZED_CONSTRAINT],
        actions: [{ type: 'APPLY_STATUS', status: 'Stunned', stacks: 1, target: 'TARGET' }]
    },
    'whirlpool': {
        id: 'whirlpool',
        name: 'Whirlpool',
        description: 'Multi-hit (10 power x2), applies Dazed',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 10, count: 2, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Dazed', stacks: 1, target: 'TARGET' }
        ]
    },
    'renew': {
        id: 'renew',
        name: 'Renew',
        description: 'Heal 15 HP and draw 1',
        element: 'Water',
        target: 'Self',
        category: 'Heal',
        rarity: 'Common',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'HEAL', power: 0, healOverride: 15, target: 'SELF' },
            { type: 'DRAW', count: 1, target: 'SELF' }
        ]
    },
    'tidal_crush': {
        id: 'tidal_crush',
        name: 'Tidal Crush',
        description: 'Massive damage (60 power)',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        rarity: 'Rare',
        baseCost: 3,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 60, target: 'TARGET' }]
    },
    'ebb_and_flow': {
        id: 'ebb_and_flow',
        name: 'Ebb & Flow',
        description: 'Transfer 2 Energy to an ally',
        element: 'Water',
        target: 'Single', // Actually target an ally
        category: 'Special',
        rarity: 'Uncommon',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ENERGY', amount: -2, target: 'SELF' },
            { type: 'ENERGY', amount: 2, target: 'TARGET' }
        ]
    },
    'wave': {
        id: 'wave',
        name: 'Wave',
        description: 'AOE damage (15 power to side)',
        element: 'Water',
        target: 'Side',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 15, target: 'TARGET' }]
    },
    'hypnosis': {
        id: 'hypnosis',
        name: 'Hypnosis',
        description: 'Apply Sleep',
        element: 'Dark',
        target: 'Single',
        category: 'Status',
        rarity: 'Uncommon',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Asleep', stacks: 1, target: 'TARGET' }]
    },
    'water_jet': {
        id: 'water_jet',
        name: 'Water Jet',
        description: 'Water attack (20 power)',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 20, target: 'TARGET' }]
    },
    'bathe': {
        id: 'bathe',
        name: 'Bathe',
        description: 'Heal 10 HP',
        element: 'Water',
        target: 'Self',
        category: 'Heal',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'HEAL', target: 'SELF', power: 10 }]
    },
    'scald': {
        id: 'scald',
        name: 'Scald',
        description: 'Water attack (15 power), applies Burn',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        rarity: 'Uncommon',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 15, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Burn', stacks: 1, target: 'TARGET' }
        ]
    },
    'toxic_water': {
        id: 'toxic_water',
        name: 'Toxic Water',
        description: 'Target gains Poison (2 stacks)',
        element: 'Water',
        target: 'Single',
        category: 'Status',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Poison', stacks: 2, target: 'TARGET' }]
    },
    'reguvinate': {
        id: 'reguvinate',
        name: 'Reguvinate',
        description: 'Target gains Regen (2 stacks)',
        element: 'Water',
        target: 'Single',
        category: 'Status',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Regen', stacks: 2, target: 'TARGET' }]
    },
    'rain': {
        id: 'rain',
        name: 'Rain',
        description: 'Draw 2 cards',
        element: 'Water',
        target: 'Self',
        category: 'Special',
        rarity: 'Uncommon',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'DRAW', count: 2, target: 'SELF' }]
    },
    'cannon_ball': {
        id: 'cannon_ball',
        name: 'Cannon Ball',
        description: 'Water attack (15 power to side)',
        element: 'Water',
        target: 'Side',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 15, target: 'TARGET' }]
    },
    'hot_springs': {
        id: 'hot_springs',
        name: 'Hot Springs',
        description: 'Heal all allies (10 HP)',
        element: 'Water',
        target: 'Side',
        category: 'Heal',
        rarity: 'Uncommon',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'HEAL', target: 'TARGET', power: 10 }]
    },
    'nightmare': {
        id: 'nightmare',
        name: 'Nightmare',
        description: 'Attack target (30 power) if Asleep',
        element: 'Dark',
        target: 'Single',
        category: 'Attack',
        rarity: 'Uncommon',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS, ASLEEP_CONSTRAINT],
        actions: [{ type: 'ATTACK', power: 30, target: 'TARGET' }]
    },

    // --- RATATOSKR DECK ---
    'gossip': {
        id: 'gossip',
        name: 'Gossip',
        description: '0-cost, heal 5 HP',
        element: 'Nature',
        target: 'Self',
        category: 'Heal',
        rarity: 'Common',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'HEAL', power: 0, healOverride: 5, target: 'SELF' }]
    },
    'pruning': {
        id: 'pruning',
        name: 'Pruning',
        description: '0-cost, remove 1 random debuff', // Simplifying to all for now or specific
        element: 'Nature',
        target: 'Self',
        category: 'Special',
        rarity: 'Common',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'REMOVE_STATUS', status: 'Weakened', target: 'SELF' },
            { type: 'REMOVE_STATUS', status: 'Dazed', target: 'SELF' }
        ]
    },
    'nettle_lash': {
        id: 'nettle_lash',
        name: 'Nettle Lash',
        description: 'Nature attack (12 power), applies Poison',
        element: 'Nature',
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 12, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Poison', stacks: 2, target: 'TARGET' }
        ]
    },
    'photosynthesis': {
        id: 'photosynthesis',
        name: 'Photosynthesis',
        description: 'Gain 1 Energy next turn', // Simplifying to immediate for MVP or add Regen
        element: 'Nature',
        target: 'Self',
        category: 'Special',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Energized', stacks: 1, target: 'SELF' }]
    },
    'grafting': {
        id: 'grafting',
        name: 'Grafting',
        description: 'Transfer Strengthened to ally',
        element: 'Nature',
        target: 'Single',
        category: 'Special',
        rarity: 'Uncommon',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'REMOVE_STATUS', status: 'Strengthened', target: 'SELF' },
            { type: 'APPLY_STATUS', status: 'Strengthened', stacks: 1, target: 'TARGET' }
        ]
    },
    'seed_bomb': {
        id: 'seed_bomb',
        name: 'Seed Bomb',
        description: 'Damage scales based on cards played (5 power x cards)',
        element: 'Nature',
        target: 'Single',
        category: 'Attack',
        rarity: 'Uncommon',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 5, scaling: 'CARDS_PLAYED', target: 'TARGET' }]
    },
    'root_bind': {
        id: 'root_bind',
        name: 'Root Bind',
        description: 'Deals 40 Nature damage and applies Stun',
        element: 'Nature',
        target: 'Single',
        category: 'Attack',
        rarity: 'Rare',
        baseCost: 3,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 40, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Stunned', stacks: 1, target: 'TARGET' }
        ]
    },
    'forage': {
        id: 'forage',
        name: 'Forage',
        description: 'Draw 1 card',
        element: 'Nature',
        target: 'Self',
        category: 'Special',
        rarity: 'Common',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'DRAW', count: 1, target: 'SELF' }]
    },
    'squirrel_scurry': {
        id: 'squirrel_scurry',
        name: 'Squirrel Scurry',
        description: 'Multi-hit Nature attack (5 power x4)',
        element: 'Nature',
        target: 'Single',
        category: 'Attack',
        rarity: 'Uncommon',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 5, count: 4, target: 'TARGET' }]
    },
    'nature_bond': {
        id: 'nature_bond',
        name: 'Nature Bond',
        description: 'Heal target and self (5 HP)',
        element: 'Nature',
        target: 'Single',
        category: 'Heal',
        rarity: 'Common',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'HEAL', target: 'TARGET', power: 5 },
            { type: 'HEAL', target: 'SELF', power: 5 }
        ]
    }

};

export const GetProgramData = (id: string): ProgramData => {
    const data = ProgramRegistry[id];
    if (!data) {
        console.warn(`Program ID not found: ${id}`);
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
    return data;
};
