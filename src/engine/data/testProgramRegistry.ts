import type { ProgramData } from '../types';
import { STANDARD_CONSTRAINTS, ASLEEP_CONSTRAINT, BASE_CONSTRAINT, ALERT_CONSTRAINT } from './programRegistry';

export const TestProgramRegistry: Record<string, ProgramData> = {
    'prog_drain': {
        id: 'prog_drain',
        name: 'Drain',
        description: 'Attack target and heal self.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 20, target: 'TARGET' },
            { type: 'HEAL', power: 10, target: 'SELF' }
        ],
    },
    'prog_adrenaline': {
        id: 'prog_adrenaline',
        name: 'Adrenaline',
        description: 'Attack target. Fails if HP >= 30%.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [
            { type: 'HEALTH_THRESHOLD', target: 'SELF', value: 'LT:30' },
            ...STANDARD_CONSTRAINTS
        ],
        actions: [{ type: 'ATTACK', power: 30, target: 'TARGET' }],
    },
    'prog_kick': {
        id: 'prog_kick',
        name: 'Kick',
        description: 'Attack target. Fails if target lacks Burn.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [
            { type: 'HAS_STATUS', target: 'TARGET', value: 'Burn' },
            ...STANDARD_CONSTRAINTS
        ],
        actions: [{ type: 'ATTACK', power: 40, target: 'TARGET' }],
    },
    'card1': {
        id: 'card1',
        name: 'Test Card 1',
        description: 'Basic test card.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 10, target: 'TARGET' }],
    },
    'card2': {
        id: 'card2',
        name: 'Test Card 2',
        description: 'Basic test card.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 10, target: 'TARGET' }],
    },
    'card_e1': {
        id: 'card_e1',
        name: 'Enemy Card 1',
        description: 'Basic enemy test card.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 10, target: 'TARGET' }],
    },
    'card_fireball': {
        id: 'card_fireball',
        name: 'Fireball',
        description: 'Multi-hit fire attack.',
        element: 'Fire',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 20, target: 'TARGET' },
            { type: 'ATTACK', power: 20, target: 'TARGET' }
        ],
    },
    'card_multihit': {
        id: 'card_multihit',
        name: 'Multi-Hit',
        description: '3-hit attack.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 2,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [
            { type: 'ATTACK', power: 10, target: 'TARGET', count: 3 }
        ],
    }
};
