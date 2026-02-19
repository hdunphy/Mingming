import { HookPriority, type HookDefinition } from '../core/HookTypes';
import { registerHook } from '../core/HookRegistry';
import { HookFactory } from '../core/HookFactory';
import { StatusType } from '../types';

export interface OSDefinition {
    id: string;
    name: string;
    description: string;
    hooks: HookDefinition[];
}

const FIRMWARE_DATA: Record<string, { id: string, name: string, description: string, hooks: any[] }> = {
    'fenrir_v1': {
        id: 'fenrir_v1',
        name: 'UNBOUND_KERNEL',
        description: 'Attack programs apply 1 Strengthened and deal 2% Max HP recoil damage.',
        hooks: [{
            id: 'fenrir_v1_hook',
            trigger: 'onActionStart',
            priority: HookPriority.PROGRAM,
            when: { source: 'SELF', programCategory: 'Attack' },
            do: [
                { type: 'STATUS', target: 'SELF', status: StatusType.Strengthened, stacks: 1 },
                { type: 'HP', target: 'SELF', percentMaxHP: 2 },
                { type: 'LOG', text: '{owner} pushes its core to the limit!' }
            ]
        }]
    },
    'fenrir_v2': {
        id: 'fenrir_v2',
        name: 'CINDER_WALL_OS',
        description: 'Whenever Fenrir applies the Burn status to an enemy, he gains a stack of Sharp.',
        hooks: [{
            id: 'fenrir_v2_hook',
            trigger: 'onStatusApplied',
            priority: HookPriority.PROGRAM,
            when: { source: 'SELF', statusApplied: StatusType.Burn },
            do: [
                { type: 'STATUS', target: 'SELF', status: StatusType.Sharp, stacks: 1 },
                { type: 'LOG', text: '{owner} feeds on the flames!' }
            ]
        }]
    },
    'kraken_v1': {
        id: 'kraken_v1',
        name: 'ABYSSAL_INK_SYS',
        description: 'Drawing a card outside the draw phase applies 1 Dazed to a random enemy.',
        hooks: [{
            id: 'kraken_v1_hook',
            trigger: 'onCardDraw',
            priority: HookPriority.PROGRAM,
            when: { isNaturalDraw: false },
            do: [
                { type: 'STATUS', target: 'RANDOM_ENEMY', status: StatusType.Dazed, stacks: 1 },
                { type: 'LOG', text: '{target} is blinded by Abyssal Ink!' }
            ]
        }]
    },
    'kraken_v2': {
        id: 'kraken_v2',
        name: 'TIDAL_CRUSH_OS',
        description: 'Water cards that cost 3 or more Energy deal 30% more damage.',
        hooks: [{
            id: 'kraken_v2_hook',
            trigger: 'onDamageCalculated',
            priority: HookPriority.PROGRAM,
            when: { source: 'SELF', programElement: 'Water', baseCost: { operator: 'GTE', value: 3 } },
            multiplier: 1.3
        }]
    },
    'ratatoskr_v1': {
        id: 'ratatoskr_v1',
        name: 'GOSSIP_NODE',
        description: '0-cost programs heal all allies for 1 HP.',
        hooks: [{
            id: 'ratatoskr_v1_hook',
            trigger: 'onActionStart',
            priority: HookPriority.PROGRAM,
            when: { source: 'SELF', baseCost: 0 },
            do: [
                { type: 'HP', target: 'ALLIES', amount: 1, isHeal: true },
                { type: 'LOG', text: '{owner} spreads positive rumors!' }
            ]
        }]
    },
    'ratatoskr_v2': {
        id: 'ratatoskr_v2',
        name: 'INSTIGATOR_OS',
        description: 'Whenever Ratatoskr plays a 0-cost card, he applies 1 stack of Dazed to the target.',
        hooks: [{
            id: 'ratatoskr_v2_hook',
            trigger: 'onActionStart',
            priority: HookPriority.PROGRAM,
            when: { source: 'SELF', baseCost: 0 },
            do: [
                { type: 'STATUS', target: 'TARGET', status: StatusType.Dazed, stacks: 1 }
            ]
        }]
    }
};

export const FIRMWARE_REGISTRY: Record<string, OSDefinition> = {};

// Build and register all hooks
Object.entries(FIRMWARE_DATA).forEach(([key, data]) => {
    const hooks = data.hooks.map(h => HookFactory.createHook(h));
    FIRMWARE_REGISTRY[key] = {
        ...data,
        hooks
    };
    hooks.forEach(hook => registerHook(hook));
});

export const getOSBehavior = (osId: string): OSDefinition | undefined => {
    return FIRMWARE_REGISTRY[osId];
};
