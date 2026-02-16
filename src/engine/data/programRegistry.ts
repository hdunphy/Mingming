import type { ProgramData } from '../types';

const ProgramRegistry: Record<string, ProgramData> = {
    // Fire
    'card_ember': {
        id: 'card_ember',
        name: 'Ember',
        description: 'Deal 10 damage.',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' },],
        actions: [
            { type: 'ATTACK', power: 10, element: 'Fire', target: 'TARGET' }
        ],
        artReference: 'ember_art'
    },
    'card_fireball': {
        id: 'card_fireball',
        name: 'Fireball',
        description: 'Deal 25 damage. Apply Burn 1.',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' },],
        actions: [
            { type: 'ATTACK', power: 25, element: 'Fire', target: 'TARGET' },
            { type: 'APPLY_STATUS', status: 'Burn', stacks: 1, target: 'TARGET' }
        ],
        artReference: 'fireball_art'
    },
    // Water
    'card_bubble': {
        id: 'card_bubble',
        name: 'Bubble',
        description: 'Deal 8 damage. Draw 1.',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' },],
        actions: [
            { type: 'ATTACK', power: 8, element: 'Water', target: 'TARGET' },
            { type: 'DRAW', count: 1, target: 'SELF' } // Draw not implemented in handlers yet, but good to have data
        ],
        artReference: 'bubble_art'
    },
    // Nature
    'card_vine_whip': {
        id: 'card_vine_whip',
        name: 'Vine Whip',
        description: 'Deal 15 damage.',
        element: 'Nature',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' },],
        actions: [
            { type: 'ATTACK', power: 15, element: 'Nature', target: 'TARGET' }
        ],
        artReference: 'vine_whip_art'
    },
    // Neutral / Energy
    'card1': { // Test card
        id: 'card1',
        name: 'Test Strike',
        description: 'Testing',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 3,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' },],
        actions: [
            { type: 'ATTACK', power: 5, element: 'None', target: 'TARGET' }
        ],
        artReference: ''
    },
    'card2': { // Test card
        id: 'card2',
        name: 'Test Beam',
        description: 'Testing',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' },],
        actions: [
            { type: 'ATTACK', power: 5, element: 'None', target: 'TARGET' }
        ],
        artReference: ''
    },
    'card_earthquake': {
        id: 'card_earthquake',
        name: 'Earthquake',
        description: 'Deal 15 damage to all enemies.',
        element: 'Earth',
        target: 'Side',
        category: 'Attack',
        baseCost: 3,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' },],
        actions: [
            { type: 'ATTACK', power: 15, element: 'Earth', target: 'TARGET' }
        ],
        artReference: ''
    },
    'prog_drain': {
        id: 'prog_drain',
        name: 'Drain Attack',
        description: 'Deal 15 damage. Heal self for 10.',
        element: 'Nature',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' }],
        actions: [
            { type: 'ATTACK', power: 15, element: 'Nature', target: 'TARGET' },
            { type: 'HEAL', power: 10, target: 'SELF' }
        ],
        artReference: ''
    },
    'prog_adrenaline': {
        id: 'prog_adrenaline',
        name: 'Adrenaline Rush',
        description: 'Requires HP < 30%. Deal 40 damage.',
        element: 'Air',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' },
            { type: 'HEALTH_THRESHOLD', target: 'SELF', value: 'LT:30' }
        ],
        actions: [
            { type: 'ATTACK', power: 40, element: 'Air', target: 'TARGET' }
        ],
        artReference: ''
    },
    'prog_kick': {
        id: 'prog_kick',
        name: 'Punish Burn',
        description: 'Requires target to have Burn. Deal 30 damage.',
        element: 'Earth',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [
            { type: 'BASE', target: 'SELF', value: '' },
            { type: 'HAS_STATUS', target: 'TARGET', value: 'Burn' }
        ],
        actions: [
            { type: 'ATTACK', power: 30, element: 'Earth', target: 'TARGET' }
        ],
        artReference: ''
    }
};

export const GetProgramData = (id: string): ProgramData => {
    const data = ProgramRegistry[id];
    if (!data) {
        console.warn(`Program ID not found: ${id}`);
        // Return a dummy safe object to prevent crashes
        return {
            id: 'missing',
            name: 'Missing Program',
            description: 'Data not found',
            element: 'None',
            target: 'Single',
            category: 'Attack',
            baseCost: 99,
            constraints: [
                { type: 'BASE', target: 'SELF', value: '' }
            ],
            actions: [],
            artReference: ''
        };
    }
    return data;
};
