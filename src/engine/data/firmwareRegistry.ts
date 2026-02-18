import { HookPriority, type HookDefinition, type HookResult, type HookContext } from '../core/HookTypes';
import { PRNG } from '../core/PRNG';
import { StatusType, type IBattleEntity } from '../types';

export interface OSDefinition {
    id: string;
    name: string;
    description: string;
    hooks: HookDefinition[];
}

export const FIRMWARE_REGISTRY: Record<string, OSDefinition> = {
    'fenrir_v1': {
        id: 'fenrir_v1',
        name: 'UNBOUND_KERNEL',
        description: 'Attack programs apply 1 Strengthened and deal 2% Max HP recoil damage.',
        hooks: [{
            id: 'fenrir_v1_hook',
            priority: HookPriority.PROGRAM,
            onActionStart: (context: HookContext): HookResult => {
                if (context.program?.category === 'Attack') {
                    const maxHp = context.source?.maxHp || 0;
                    const recoil = Math.floor(maxHp * 0.02);
                    return {
                        mutations: [
                            {
                                type: 'STATUS',
                                targetId: context.source!.id,
                                payload: { status: StatusType.Strengthened, stacks: 1 } //lets start off with 1
                            },
                            {
                                type: 'HP',
                                targetId: context.source!.id,
                                payload: { amount: recoil }
                            },
                            {
                                type: 'LOG',
                                targetId: context.source!.id,
                                payload: `${context.source!.name} pushes its core to the limit!`
                            }
                        ]
                    };
                }
                return { mutations: [] };
            }
        }]
    },
    'fenrir_v2': {
        id: 'fenrir_v2',
        name: 'CINDER_WALL_OS',
        description: 'Whenever Fenrir applies the Burn status to an enemy, he gains a stack of Sharp.',
        hooks: [{
            id: 'fenrir_v2_hook',
            priority: HookPriority.PROGRAM,
            onStatusApplied: (context: HookContext): HookResult => {
                if (context.statusApplied === StatusType.Burn && context.source) {
                    return {
                        mutations: [
                            {
                                type: 'STATUS',
                                targetId: context.source.id,
                                sourceId: 'SYSTEM',
                                payload: { status: StatusType.Sharp, stacks: 1 }
                            },
                            {
                                type: 'LOG',
                                targetId: context.source.id,
                                payload: `${context.source.name} feeds on the flames!`
                            }
                        ]
                    };
                }
                return { mutations: [] };
            }
        }]
    },
    'kraken_v1': {
        id: 'kraken_v1',
        name: 'ABYSSAL_INK_SYS',
        description: 'Drawing a card outside the draw phase applies 1 Dazed to a random enemy.',
        hooks: [{
            id: 'kraken_v1_hook',
            priority: HookPriority.PROGRAM,
            onCardDraw: (context: HookContext): HookResult => {
                if (context.isNaturalDraw) return { mutations: [] };

                const enemySide = context.source?.id.startsWith('p') ? 'enemyParty' : 'playerParty';
                const liveEnemies = (context.state[enemySide] as any[]).filter(e => e.currentHp > 0);

                if (liveEnemies.length === 0) return { mutations: [] };

                const prng = new PRNG(context.state.seed);
                const { value: index } = prng.nextInt(0, liveEnemies.length - 1);
                const target = liveEnemies[index];

                return {
                    mutations: [
                        {
                            type: 'STATUS',
                            targetId: target.id,
                            payload: { status: StatusType.Dazed, stacks: 1 }
                        },
                        {
                            type: 'LOG',
                            targetId: target.id,
                            payload: `${target.name} is blinded by Abyssal Ink!`
                        }
                    ]
                };
            }
        }]
    },
    'kraken_v2': {
        id: 'kraken_v2',
        name: 'TIDAL_CRUSH_OS',
        description: 'Water cards that cost 3 or more Energy deal 30% more damage.',
        hooks: [{
            id: 'kraken_v2_hook',
            priority: HookPriority.PROGRAM,
            onDamageCalculated: (currentDamage: number, context: HookContext): number => {
                if (context.program?.element === 'Water' && context.program.baseCost >= 3) {
                    return Math.floor(currentDamage * 1.3);
                }
                return currentDamage;
            }
        }]
    },
    'ratatoskr_v1': {
        id: 'ratatoskr_v1',
        name: 'GOSSIP_NODE',
        description: '0-cost programs heal all allies for 1 HP.',
        hooks: [{
            id: 'ratatoskr_v1_hook',
            priority: HookPriority.PROGRAM,
            onActionStart: (context: HookContext): HookResult => {
                if (context.program?.baseCost === 0) {
                    const allySide = context.source?.id.startsWith('p') ? 'playerParty' : 'enemyParty';
                    const allies = (context.state[allySide] as IBattleEntity[]).filter(e => e.currentHp > 0);

                    const mutations: any[] = allies.map(ally => ({
                        type: 'HP' as const,
                        targetId: ally.id,
                        payload: { amount: 1, isHeal: true } //todo should this be a percent heal or maybe based off of stats? For now leave
                    }));

                    mutations.push({
                        type: 'LOG' as const,
                        targetId: context.source!.id,
                        payload: `Ratatoskr spreads positive rumors!`
                    });

                    return { mutations };
                }
                return { mutations: [] };
            }
        }]
    },
    'ratatoskr_v2': {
        id: 'ratatoskr_v2',
        name: 'INSTIGATOR_OS',
        description: 'Whenever Ratatoskr plays a 0-cost card, he applies 1 stack of Dazed to the target.',
        hooks: [{
            id: 'ratatoskr_v2_hook',
            priority: HookPriority.PROGRAM,
            onActionStart: (context: HookContext): HookResult => {
                if (context.program?.baseCost === 0 && context.target) {
                    return {
                        mutations: [
                            {
                                type: 'STATUS',
                                targetId: context.target.id,
                                sourceId: context.source?.id,
                                payload: { status: StatusType.Dazed, stacks: 1 }
                            }
                        ]
                    };
                }
                return { mutations: [] };
            }
        }]
    }
};

export const getOSBehavior = (osId: string): OSDefinition | undefined => {
    return FIRMWARE_REGISTRY[osId];
};
