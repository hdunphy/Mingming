
import type { ProgramData } from '../types';

export const ProgramRegistry: Record<string, ProgramData> = {
    // Fire
    'card_ember': {
        id: 'card_ember',
        name: 'Ember',
        description: 'Deal 10 damage.',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [],
        actions: [], // We will define Actions later in the ActionFactory
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
        constraints: [],
        actions: [],
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
        constraints: [],
        actions: [],
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
        constraints: [],
        actions: [],
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
        constraints: [],
        actions: [],
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
        constraints: [],
        actions: [],
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
            constraints: [],
            actions: [],
            artReference: ''
        };
    }
    return data;
};
