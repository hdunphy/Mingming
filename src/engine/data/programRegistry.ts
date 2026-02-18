import type { ProgramData } from '../types';


export const AWAKE_CONSTRAINT = { type: 'NOT_STATUS' as const, target: 'SELF' as const, value: 'Asleep' };
export const ALERT_CONSTRAINT = { type: 'NOT_STATUS' as const, target: 'SELF' as const, value: 'Stunned' };
export const ASLEEP_CONSTRAINT = { type: 'HAS_STATUS' as const, target: 'SELF' as const, value: 'Asleep' };
export const BASE_CONSTRAINT = { type: 'BASE' as const, target: 'SELF' as const, value: '' };

export const STANDARD_CONSTRAINTS = [ALERT_CONSTRAINT, AWAKE_CONSTRAINT, BASE_CONSTRAINT];

const ProgramRegistry: Record<string, ProgramData> = {
    // --- GDD CORE CARDS (34) ---
    'rest': {
        id: 'rest',
        name: 'Rest',
        description: 'MingMing falls asleep and heals each turn.',
        element: 'None',
        target: 'Single',
        category: 'Status',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'APPLY_STATUS', status: 'Asleep', stacks: 1, target: 'TARGET' },
            { type: 'HEAL', power: 10, target: 'TARGET' }
        ],
    },
    'nightmare': {
        id: 'nightmare',
        name: 'Nightmare',
        description: 'If MingMing is asleep deal damage.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [ASLEEP_CONSTRAINT, BASE_CONSTRAINT, ALERT_CONSTRAINT],
        actions: [{ type: 'ATTACK', power: 20, target: 'TARGET' }],
    },
    'scratch': {
        id: 'scratch',
        name: 'Scratch',
        description: 'Scratch MingMing.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 40, target: 'TARGET' }],
    },
    'squirt': {
        id: 'squirt',
        name: 'Squirt',
        description: 'Spray water on MingMing dealing low damage.',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 10, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Dazed', stacks: 1, target: 'TARGET' }
        ],
    },
    'water_jet': {
        id: 'water_jet',
        name: 'Water Jet',
        description: 'MingMing shoots a jet of water.',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 90, target: 'TARGET' }],
    },
    'whirlpool': {
        id: 'whirlpool',
        name: 'Whirlpool',
        description: 'MingMing creates a whirlpool and draws a card.',
        element: 'Water',
        target: 'Side',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 20, target: 'TARGET' },
            { type: 'DRAW', count: 1, target: 'SELF' }
        ],
    },
    'cleanse': {
        id: 'cleanse',
        name: 'Cleanse',
        description: 'Cleanse all buffs/debuffs from a MingMing.',
        element: 'None',
        target: 'Single',
        category: 'Special',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'REMOVE_STATUS', target: 'TARGET' }],
    },
    'bathe': {
        id: 'bathe',
        name: 'Bathe',
        description: 'MingMing bathes in clean water healing a portion of its health.',
        element: 'Water',
        target: 'Self',
        category: 'Heal',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'HEAL', power: 10, target: 'TARGET' }],
    },
    'scald': {
        id: 'scald',
        name: 'Scald',
        description: 'Shoot boiling hot water at MingMing.',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 30, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Burn', stacks: 1, target: 'TARGET' }
        ],
    },
    'toxic_water': {
        id: 'toxic_water',
        name: 'Toxic Water',
        description: 'Shoot toxic water at MingMing.',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 30, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Poison', stacks: 1, target: 'TARGET' }
        ],
    },
    'renew': {
        id: 'renew',
        name: 'Renew',
        description: 'Heal and draw a card.',
        element: 'None',
        target: 'Self',
        category: 'Heal',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'HEAL', power: 10, target: 'TARGET' },
            { type: 'DRAW', count: 1, target: 'SELF' }
        ],
    },
    'wave': {
        id: 'wave',
        name: 'Wave',
        description: 'Send a wave of water at all enemies.',
        element: 'Water',
        target: 'Side',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 20, target: 'TARGET' }],
    },
    'hypnosis': {
        id: 'hypnosis',
        name: 'Hypnosis',
        description: 'Put a MingMing to sleep.',
        element: 'None',
        target: 'Single',
        category: 'Status',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Asleep', stacks: 1, target: 'TARGET' }],
    },
    'reguvinate': {
        id: 'reguvinate',
        name: 'Reguvinate',
        description: 'If MingMing is sleeping, heal double.',
        element: 'None',
        target: 'Self',
        category: 'Heal',
        baseCost: 1,
        constraints: [ASLEEP_CONSTRAINT, BASE_CONSTRAINT, ALERT_CONSTRAINT],
        actions: [{ type: 'HEAL', power: 20, target: 'TARGET' }],
    },
    'rain': {
        id: 'rain',
        name: 'Rain',
        description: 'Weaken all enemies.',
        element: 'Water',
        target: 'Side',
        category: 'Status',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Weakened', stacks: 1, target: 'TARGET' }],
    },
    'drink_tea': {
        id: 'drink_tea',
        name: 'Drink Tea',
        description: 'Gain Sharp and draw a card.',
        element: 'Water',
        target: 'Self',
        category: 'Status',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'APPLY_STATUS', status: 'Sharp', stacks: 1, target: 'TARGET' },
            { type: 'DRAW', count: 1, target: 'SELF' }
        ],
    },
    'hydro_pump': {
        id: 'hydro_pump',
        name: 'Hydro Pump',
        description: 'A large blast of water.',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        baseCost: 3,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 150, target: 'TARGET' }],
    },
    'boost': {
        id: 'boost',
        name: 'Boost',
        description: 'Give a MingMing a boost of energy.',
        element: 'None',
        target: 'Single',
        category: 'Special',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ADD_ENERGY', amount: 2, target: 'TARGET' }],
    },
    'cannon_ball': {
        id: 'cannon_ball',
        name: 'Cannon Ball',
        description: 'Large Splash causing a tidal wave on one side.',
        element: 'Water',
        target: 'Side',
        category: 'Attack',
        baseCost: 4,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 100, target: 'TARGET' }],
    },
    'hot_springs': {
        id: 'hot_springs',
        name: 'Hot Springs',
        description: 'Gives all allies strengthened.',
        element: 'Water',
        target: 'Side',
        category: 'Status',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Strengthened', stacks: 1, target: 'TARGET' }],
    },
    'reckless': {
        id: 'reckless',
        name: 'Reckless',
        description: 'Get Dazed and Strengthened.',
        element: 'None',
        target: 'Self',
        category: 'Status',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'APPLY_STATUS', status: 'Dazed', stacks: 1, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Strengthened', stacks: 1, target: 'TARGET' }
        ],
    },
    'flamethrower': {
        id: 'flamethrower',
        name: 'Flamethrower',
        description: 'Shoot Jet of fire.',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 75, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Burn', stacks: 1, target: 'TARGET' }
        ],
    },
    'erupt': {
        id: 'erupt',
        name: 'Erupt',
        description: 'Explode with lava and fire dealing damage to a whole side.',
        element: 'Fire',
        target: 'Side',
        category: 'Attack',
        baseCost: 3,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 90, target: 'TARGET' }],
    },
    'rage': {
        id: 'rage',
        name: 'Rage',
        description: 'Deal Fire damage and strengthen self.',
        element: 'Fire',
        // target: 'Single,Self',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 20, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Strengthened', stacks: 1, target: 'SELF' }
        ],
    },
    'charge': {
        id: 'charge',
        name: 'Charge',
        description: 'Dash towards enemy, but leaving itself open for retaliation.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 50, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Weakened', stacks: 1, target: 'SELF' }
        ],
    },
    'radiate': {
        id: 'radiate',
        name: 'Radiate',
        description: 'Strengthen whole side.',
        element: 'Fire',
        target: 'Side',
        category: 'Status',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Strengthened', stacks: 1, target: 'TARGET' }],
    },
    'fired_up': {
        id: 'fired_up',
        name: 'Fired Up',
        description: 'If has burn status, heal and remove burn.',
        element: 'Fire',
        target: 'Self',
        category: 'Heal',
        baseCost: 1,
        constraints: [{ type: 'HAS_STATUS', target: 'SELF', value: 'Burn' }, ...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'HEAL', power: 10, target: 'TARGET' },
            { type: 'REMOVE_STATUS', status: 'Burn', target: 'TARGET' }
        ],
    },
    'toats': {
        id: 'toats',
        name: 'Toats',
        description: 'Apply burn status.',
        element: 'Fire',
        target: 'Single',
        category: 'Status',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Burn', stacks: 1, target: 'TARGET' }],
    },
    'roast': {
        id: 'roast',
        name: 'Roast',
        description: 'Apply max burn status.',
        element: 'Fire',
        target: 'Single',
        category: 'Status',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Burn', stacks: 3, target: 'TARGET' }],
    },
    'spicy_breath': {
        id: 'spicy_breath',
        name: 'Spicy Breath',
        description: 'Deal small amount of fire damage.',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 10, target: 'TARGET' }],
    },
    'preheat': {
        id: 'preheat',
        name: 'Preheat',
        description: 'Strengthen self.',
        element: 'Fire',
        target: 'Self',
        category: 'Status',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Strengthened', stacks: 1, target: 'TARGET' }],
    },
    'flash': {
        id: 'flash',
        name: 'Flash',
        description: 'Summons bright light to stun enemy.',
        element: 'Fire',
        target: 'Single',
        category: 'Status',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Stunned', stacks: 1, target: 'TARGET' }],
    },
    'fire_punch': {
        id: 'fire_punch',
        name: 'Fire Punch',
        description: 'Punch enemy with fire causing enemy to be stunned.',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 60, target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Stunned', stacks: 1, target: 'TARGET' }
        ],
    },

    // --- NORSE EXPANSION ---
    // Surtr (Fire)
    'ignite_pipeline': {
        id: 'ignite_pipeline',
        name: 'Ignite Pipeline',
        description: 'Apply Burn (Stage 1). If already Burned, upgrade to Stage 2.',
        element: 'Fire', target: 'Single', category: 'Status', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Burn', stacks: 1, target: 'TARGET' }],
    },
    'magma_surge': {
        id: 'magma_surge',
        name: 'Magma Surge',
        description: 'Deal 30 damage. Target takes +5 damage from Burn for 3 turns.',
        element: 'Fire', target: 'Single', category: 'Attack', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 30, target: 'TARGET' }],
    },
    'heat_sink': {
        id: 'heat_sink',
        name: 'Heat Sink',
        description: 'Remove Burn from target to gain +2 Energy.',
        element: 'Fire', target: 'Single', category: 'Special', baseCost: 0, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'REMOVE_STATUS', status: 'Burn', target: 'TARGET' }, { type: 'ADD_ENERGY', amount: 2, target: 'SELF' }],
    },
    'combustion': {
        id: 'combustion',
        name: 'Combustion',
        description: 'Deal 40 damage. If target is Stage 3 Burned, deal 80 instead.',
        element: 'Fire', target: 'Single', category: 'Attack', baseCost: 2, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 40, target: 'TARGET' }],
    },
    'sulfur_cloud': {
        id: 'sulfur_cloud',
        name: 'Sulfur Cloud',
        description: 'Apply Stage 1 Burn to the entire enemy Side.',
        element: 'Fire', target: 'Side', category: 'Status', baseCost: 2, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Burn', stacks: 1, target: 'TARGET' }],
    },
    'surtrs_wrath': {
        id: 'surtrs_wrath',
        name: "Surtr's Wrath",
        description: 'Deal 100 damage. Targets with Stage 3 Burn are also Stunned.',
        element: 'Fire', target: 'Single', category: 'Attack', baseCost: 4, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 100, target: 'TARGET' }],
    },
    'self_immolate': {
        id: 'self_immolate',
        name: 'Self-Immolate',
        description: 'Take 15 damage, gain 2 Strengthened stacks.',
        element: 'Fire', target: 'Self', category: 'Status', baseCost: 0, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 15, target: 'SELF' }, { type: 'APPLY_STATUS', status: 'Strengthened', stacks: 2, target: 'SELF' }],
    },
    'nova_blast': {
        id: 'nova_blast',
        name: 'Nova Blast',
        description: 'Deal 70 damage to all units.',
        element: 'Fire', target: 'All', category: 'Attack', baseCost: 2, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 70, target: 'TARGET' }],
    },

    // Jormungandr (Water)
    'venomous_coil': {
        id: 'venomous_coil',
        name: 'Venomous Coil',
        description: 'Deal 20 damage and apply 2 Dazed stacks.',
        element: 'Water', target: 'Single', category: 'Attack', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 20, target: 'TARGET' }, { type: 'APPLY_STATUS', status: 'Dazed', stacks: 2, target: 'TARGET' }],
    },
    'abyssal_grip': {
        id: 'abyssal_grip',
        name: 'Abyssal Grip',
        description: 'If target is Dazed, apply Stunned (1 turn).',
        element: 'Water', target: 'Single', category: 'Status', baseCost: 2, constraints: [{ type: 'HAS_STATUS', target: 'TARGET', value: 'Dazed' }, ...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Stunned', stacks: 1, target: 'TARGET' }],
    },
    'murky_water': {
        id: 'murky_water',
        name: 'Murky Water',
        description: 'Apply 3 Dazed stacks to the entire enemy Side.',
        element: 'Water', target: 'Side', category: 'Status', baseCost: 3, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Dazed', stacks: 3, target: 'TARGET' }],
    },

    // Fafnir (Earth)
    'iron_hide': {
        id: 'iron_hide',
        name: 'Iron Hide',
        description: 'Gain 3 Sharp stacks.',
        element: 'Earth', target: 'Self', category: 'Status', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Sharp', stacks: 3, target: 'TARGET' }],
    },
    'earthquake_norse': {
        id: 'earthquake_norse',
        name: 'Earthquake',
        description: 'Deal 40 damage to all enemies. Power increases by 5 for every Sharp stack you have.',
        element: 'Earth', target: 'Side', category: 'Attack', baseCost: 3, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 40, target: 'TARGET' }],
    },

    // Hruesvelgr (Air)
    'tailwind': {
        id: 'tailwind',
        name: 'Tailwind',
        description: 'Draw 2 cards, then Discard 1.',
        element: 'Air', target: 'Self', category: 'Special', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'DRAW', count: 2, target: 'SELF' }],
    },

    // Ratatoskr (Nature)
    'acorn_shot': {
        id: 'acorn_shot',
        name: 'Acorn Shot',
        description: 'Deal 10 damage 3 times.',
        element: 'Nature', target: 'Single', category: 'Attack', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 10, target: 'TARGET' },
            { type: 'ATTACK', power: 10, target: 'TARGET' },
            { type: 'ATTACK', power: 10, target: 'TARGET' }
        ],
    },
    'quick_leaf': {
        id: 'quick_leaf',
        name: 'Quick Leaf',
        description: 'Deal 5 damage. Draw 1.',
        element: 'Nature', target: 'Single', category: 'Attack', baseCost: 0, constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 5, target: 'TARGET' },
            { type: 'DRAW', count: 1, target: 'SELF' }
        ],
    },
    'forage': {
        id: 'forage',
        name: 'Forage',
        description: 'Draw 1 card.',
        element: 'Nature', target: 'Self', category: 'Special', baseCost: 0, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'DRAW', count: 1, target: 'SELF' }],
    },
    'squirrel_scurry': {
        id: 'squirrel_scurry',
        name: 'Squirrel Scurry',
        description: 'Deal 5 damage to all enemies. Draw 1.',
        element: 'Nature', target: 'Side', category: 'Attack', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 5, target: 'TARGET' },
            { type: 'DRAW', count: 1, target: 'SELF' }
        ],
    },
    'nature_bond': {
        id: 'nature_bond',
        name: 'Nature Bond',
        description: 'Heal 10 and draw 1.',
        element: 'Nature', target: 'Self', category: 'Heal', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'HEAL', power: 10, target: 'TARGET' },
            { type: 'DRAW', count: 1, target: 'SELF' }
        ],
    },

    // Ymir (Ice)
    'glacial_age': {
        id: 'glacial_age',
        name: 'Glacial Age',
        description: 'All enemies are Asleep for 1 turn.',
        element: 'Ice', target: 'Side', category: 'Status', baseCost: 4, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'APPLY_STATUS', status: 'Asleep', stacks: 1, target: 'TARGET' }],
    },

    // Heimdall (Light)
    'radiant_hope': {
        id: 'radiant_hope',
        name: 'Radiant Hope',
        description: 'Heal all allied MingMings for 15 HP.',
        element: 'Light', target: 'Side', category: 'Heal', baseCost: 2, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'HEAL', power: 15, target: 'TARGET' }],
    },

    // Hel (Dark)
    'soul_siphon': {
        id: 'soul_siphon',
        name: 'Soul Siphon',
        description: 'Deal 30 damage, heal for 15.',
        element: 'Dark', target: 'Single', category: 'Attack', baseCost: 1, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 30, target: 'TARGET' }, { type: 'HEAL', power: 15, target: 'SELF' }],
    },
    'reboot': {
        id: 'reboot',
        name: 'Reboot',
        description: 'Revive a fainted MingMing with 1 HP.',
        element: 'Dark', target: 'Single', category: 'Special', baseCost: 5, constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'REVIVE', target: 'TARGET' }],
    },

    // --- Legacy / Test ---
    'card_ember': {
        id: 'card_ember',
        name: 'Ember',
        description: 'Deal 10 damage.',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 10, element: 'Fire', target: 'TARGET' }],
    },
    'card_vine_whip': {
        id: 'card_vine_whip',
        name: 'Vine Whip',
        description: 'Deal 15 damage.',
        element: 'Nature',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 15, element: 'Nature', target: 'TARGET' }],
    },
    'card_bubble': {
        id: 'card_bubble',
        name: 'Bubble',
        description: 'Deal 8 damage. Draw 1.',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 8, element: 'Water', target: 'TARGET' }, { type: 'DRAW', count: 1, target: 'SELF' }],
    },
    'card_fireball': {
        id: 'card_fireball',
        name: 'Fireball',
        description: 'Deal 25 damage. Apply Burn 1.',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 25, element: 'Fire', target: 'TARGET' }, { type: 'APPLY_STATUS', status: 'Burn', stacks: 1, target: 'TARGET' }],
    },
    'card_earthquake': {
        id: 'card_earthquake',
        name: 'Earthquake',
        description: 'Deal 15 damage to all enemies.',
        element: 'Earth',
        target: 'Side',
        category: 'Attack',
        baseCost: 3,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 15, element: 'Earth', target: 'TARGET' }],
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
            baseCost: 99,
            constraints: [],
            actions: [],
            artReference: ''
        };
    }
    return data;
};
