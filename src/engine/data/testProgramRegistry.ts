import type { ProgramData } from '../types';
import { StatusType } from '../types';
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
            { type: 'HEAL', power: 40, target: 'SELF' }
        ],
        rarity: 'Common'
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
        rarity: 'Common'
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
        rarity: 'Common'
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
        rarity: 'Common'
    },
    'test_discard_card': {
        id: 'test_discard_card',
        name: 'Test Discard Card',
        description: 'Testing discard hooks.',
        element: 'None',
        target: 'Self',
        category: 'Skill',
        baseCost: 0,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [],
        hooks: ['mock_discard_hook'],
        rarity: 'Common'
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
        rarity: 'Common'
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
        rarity: 'Common'
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
        rarity: 'Common'
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
            { type: 'ATTACK', power: 10, target: 'TARGET' },
            { type: 'ATTACK', power: 10, target: 'TARGET' },
            { type: 'ATTACK', power: 10, target: 'TARGET' }
        ],
        rarity: 'Common'
    },
    'card_strike': {
        id: 'card_strike',
        name: 'Strike',
        description: 'Basic strike.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 10, target: 'TARGET' }],
        rarity: 'Common'
    },
    'card_0_cost_test': {
        id: 'card_0_cost_test',
        name: 'Freebie',
        description: '0-cost test card.',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        baseCost: 0,
        constraints: [],
        actions: [{ type: 'ATTACK', power: 0, target: 'TARGET' }],
        rarity: 'Common'
    },
    'whirlpool': {
        id: 'whirlpool',
        name: 'Whirlpool',
        description: 'Draw 2 cards.',
        element: 'Water',
        target: 'Single',
        category: 'Skill',
        baseCost: 1,
        constraints: [],
        actions: [{ type: 'DRAW', amount: 2 }],
        rarity: 'Common'
    },
    'card_draw_test': {
        id: 'card_draw_test',
        name: 'Insight',
        description: 'Draw 1 card.',
        element: 'None',
        target: 'Single',
        category: 'Skill',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'DRAW', amount: 1, target: 'SELF' }],
        rarity: 'Common'
    },
    'card_burn_test': {
        id: 'card_burn_test',
        name: 'Ignite',
        description: 'Apply 1 Burn.',
        element: 'Fire',
        target: 'Single',
        category: 'Skill',
        baseCost: 1,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'STATUS', status: StatusType.Burn, stacks: 1, target: 'TARGET' }],
        rarity: 'Common'
    },
    'card_water_blast': {
        id: 'card_water_blast',
        name: 'Tsunami',
        description: 'Heavy water damage.',
        element: 'Water',
        target: 'Single',
        category: 'Attack',
        baseCost: 3,
        constraints: [...STANDARD_CONSTRAINTS],
        actions: [{ type: 'ATTACK', power: 100, target: 'TARGET' }],
        rarity: 'Rare'
    }
};
