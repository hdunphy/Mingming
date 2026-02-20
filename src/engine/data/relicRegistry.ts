import type { IRelic } from '../types';

/**
 * Epic 8: Milestone 8.4 - Relic System
 * Global passives that modify battle logic.
 */

export const RelicRegistry: Record<string, IRelic> = {
    'expansion_slot': {
        id: 'expansion_slot',
        name: 'Expansion Slot',
        description: 'Increases Card Draw by 1.',
        effect: 'DRAW_BONUS'
    },
    'heatsink': {
        id: 'heatsink',
        name: 'Heatsink',
        description: 'Start each battle with +5 Max Energy on all units.',
        effect: 'ENERGY_CAP_BONUS'
    },
    'buffer_cache': {
        id: 'buffer_cache',
        name: 'Buffer Cache',
        description: 'The first time a Mingming would be knocked out, it stays at 1 HP.',
        effect: 'DEATH_PREVENT'
    },
    'overclock_module': {
        id: 'overclock_module',
        name: 'Overclock Module',
        description: 'Increases Attack by 10% on all units.',
        effect: 'ATTACK_MULTIPLIER'
    }
};

export function GetRelic(id: string): IRelic {
    const relic = RelicRegistry[id];
    if (!relic) throw new Error(`Relic with ID ${id} not found!`);
    return relic;
}
