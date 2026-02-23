import { type HookDefinition, type HookContext, type HookResult, type MutationRequest } from './HookTypes';
import type { IBattleState, IBattleEntity } from '../types';
import { applyMutations } from '../resolutionEngine';

export const CustomFirmware: Record<string, HookDefinition[]> = {
    "fafnir_v1": [
        {
            id: "fafnir_v1_hoard",
            priority: 40,
            onTurnEnd: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                if (owner.currentEnergy > 0) {
                    const energyToHoard = owner.currentEnergy;
                    const recoilDamage = Math.max(1, Math.floor(owner.maxHp * 0.01 * energyToHoard));
                    state = applyMutations(state, [
                        { type: 'HP', targetId: owner.id, payload: { amount: recoilDamage } },
                        { type: 'STATUS', targetId: owner.id, sourceId: owner.id, payload: { status: 'Energized', stacks: energyToHoard } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s HOARD_PROTOCOL retains ${energyToHoard} Energy but takes ${recoilDamage} damage!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    "gullinbursti_v1": [
        {
            id: "gullinbursti_v1_prepare",
            priority: 40,
            onActionStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                const hasDefensiveStatus = context.program?.actions.some(a => a.type === 'STATUS' && (a.target === 'SELF' || a.target === 'ALLIES'));
                if (context.source?.id === owner.id && hasDefensiveStatus) {
                    // Defensive status
                    state = applyMutations(state, [{ type: 'COUNTER', targetId: '', payload: { key: 'gullin_discount', operator: 'SET', amount: 1 } }]);
                }
                const isAttack = context.program?.category === 'Attack';
                if (context.source?.id === owner.id && isAttack && (state.counters['gullin_discount'] || 0) > 0) {
                    // Refund 1 energy
                    state = applyMutations(state, [
                        { type: 'ENERGY', targetId: owner.id, payload: { amount: 1 } },
                        { type: 'COUNTER', targetId: '', payload: { key: 'gullin_discount', operator: 'SET', amount: 0 } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s UNSTOPPABLE_MASS refunds 1 Energy!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    "gullinbursti_v2": [
        {
            id: "gullinbursti_v2_ram",
            priority: 40,
            onDamageCalculated: (currentDamage: number, context: HookContext, owner: IBattleEntity): number => {
                const isAttack = context.program?.category === 'Attack';
                if (context.source?.id === owner.id && context.program?.element === 'Earth' && isAttack) {
                    const sharpStacks = owner.statusEffects.find(s => s.type === 'Sharp')?.stacks || 0;
                    return currentDamage + sharpStacks;
                }
                return currentDamage;
            }
        }
    ],
    "fafnir_v2": [
        {
            id: "fafnir_v2_corrupted",
            priority: 40,
            onStatusApplied: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                if (context.target?.id === owner.id) {
                    const isNegative = ['Burn', 'Poison', 'Asleep', 'Weakened', 'Dazed', 'Stunned'].includes(context.statusApplied || '');
                    if (isNegative) {
                        state = applyMutations(state, [
                            { type: 'ENERGY', targetId: owner.id, payload: { amount: 1 } },
                            { type: 'LOG', targetId: '', payload: `${owner.name}'s CORRUPTED_GOLD_OS gains 1 Energy from the debuff!` }
                        ]);
                    }
                }
                return { state };
            }
        }
    ],
    "hraesvelgr_v1": [
        {
            id: "hraesvelgr_v1_gale",
            priority: 40,
            onActionStart: (context: HookContext, _owner: IBattleEntity): HookResult => {
                let state = context.state;
                // Whenever you voluntarily discard... The discard system right now is via the DISCARD mutation.
                // We'd need an `onDiscard` hook. To keep it simple, if they play a card that discards...
                // Actually, if we use the generic DISCARD hook (wait, we don't have one).
                // Let's hook `onPostDamage` or something?
                // Let's just track it via the EventBus or add an onDiscard hook later. For now, leave empty.
                return { state };
            }
        }
    ],
    "hraesvelgr_v2": [
        {
            id: "hraesvelgr_v2_updraft",
            priority: 40,
            onCardDraw: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                if ((state.counters['deck_shuffles'] || 0) > 0 && !(state.counters['hraesvelgr_max_energy'] || 0)) {
                    state = applyMutations(state, [
                        { type: 'MAX_ENERGY', targetId: owner.id, payload: { amount: 1 } },
                        { type: 'COUNTER', targetId: '', payload: { key: 'hraesvelgr_max_energy', operator: 'SET', amount: 1 } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s UPDRAFT_KERNEL increases Max Energy by 1!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    "valkyrie_v1": [
        {
            id: "valkyrie_v1_uplink",
            priority: 40,
            onStatusApplied: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                if (context.source?.id === owner.id && context.target && context.target.id !== owner.id) {
                    const isAlly = state.playerParty.some((e: IBattleEntity) => e.id === owner.id)
                        ? state.playerParty.some((e: IBattleEntity) => e.id === context.target!.id)
                        : state.enemyParty.some((e: IBattleEntity) => e.id === context.target!.id);

                    if (isAlly) {
                        const positiveStatuses = ['Strengthened', 'Sharp', 'Protect', 'Nimble', 'Regen', 'StableOS'];
                        if (positiveStatuses.includes(context.statusApplied || '')) {
                            const healAmount = Math.max(1, Math.floor(context.target.maxHp * 0.05));
                            state = applyMutations(state, [
                                { type: 'HP', targetId: context.target.id, payload: { amount: healAmount, isHeal: true, override: true } },
                                { type: 'LOG', targetId: '', payload: `${owner.name}'s VALHALLA_UPLINK heals ${context.target.name} for ${healAmount} HP!` }
                            ]);
                        }
                    }
                }
                return { state };
            }
        }
    ],
    "audhumbla_v1": [
        {
            id: "audhumbla_v1_genesis",
            priority: 40,
            onActionStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                const isHealOrSkill = context.program?.category === 'Skill' || context.program?.actions.some(a => a.type === 'HEAL' || a.type === 'STATUS');
                if (context.source?.id === owner.id && isHealOrSkill) {
                    const counterKey = `audhumbla_spells_${owner.id}`;
                    let currentCount = state.counters[counterKey] || 0;
                    currentCount++;
                    if (currentCount >= 3) {
                        state = applyMutations(state, [
                            { type: 'MAX_ENERGY', targetId: owner.id, payload: { amount: 1 } },
                            { type: 'COUNTER', targetId: '', payload: { key: counterKey, operator: 'RESET', amount: 0 } },
                            { type: 'LOG', targetId: '', payload: `${owner.name}'s GENESIS_FIRMWARE increases Max Energy by 1!` }
                        ]);
                    } else {
                        state = applyMutations(state, [
                            { type: 'COUNTER', targetId: '', payload: { key: counterKey, operator: 'SET', amount: currentCount } }
                        ]);
                    }
                }
                return { state };
            }
        }
    ],
    "huldra_v2": [
        {
            id: "huldra_v2_bark",
            priority: 40,
            onTurnStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                if (state.turn === 1 && !state.counters['huldra_shield_init']) {
                    const shieldAmount = Math.floor(owner.maxHp * 0.5);
                    state = applyMutations(state, [
                        { type: 'STATUS', targetId: owner.id, sourceId: owner.id, payload: { status: 'BarkShield', stacks: shieldAmount } },
                        { type: 'COUNTER', targetId: '', payload: { key: 'huldra_shield_init', operator: 'SET', amount: 1 } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s BARK_SHIELD_OS activates a massive temporary shield!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    "ymir_v2": [
        {
            id: "ymir_v2_glacial",
            priority: 40,
            onDamageCalculated: (currentDamage: number, context: HookContext, owner: IBattleEntity): number => {
                if (context.source?.id === owner.id && context.program?.element === 'Ice') {
                    // Ice cards deal 50% more base damage
                    return currentDamage + Math.floor(currentDamage * 0.5);
                }
                return currentDamage;
            }
        }
    ],
    "draugr_v1": [
        {
            id: "draugr_v1_permafrost",
            priority: 40,
            onTurnStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                const isAsleep = owner.statusEffects.some(s => s.type === 'Asleep');
                const wasAsleep = state.counters[`draugr_asleep_${owner.id}`];

                if (isAsleep) {
                    state = applyMutations(state, [{ type: 'COUNTER', targetId: '', payload: { key: `draugr_asleep_${owner.id}`, operator: 'SET', amount: 1 } }]);
                } else if (!isAsleep && wasAsleep) {
                    state = applyMutations(state, [
                        { type: 'COUNTER', targetId: '', payload: { key: `draugr_asleep_${owner.id}`, operator: 'SET', amount: 0 } },
                        { type: 'STATUS', targetId: owner.id, sourceId: owner.id, payload: { status: 'Strengthened', stacks: 3 } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s PERMAFROST_WAKE grants 3 Strengthened upon waking!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    "draugr_v2": [
        {
            id: "draugr_v2_chill",
            priority: 40,
            onActionStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                if (context.target?.id === owner.id && context.source && context.source.id !== owner.id) {
                    const negativeStatusCount = context.source.statusEffects.filter(s => ['Burn', 'Poison', 'Asleep', 'Weakened', 'Dazed', 'Stunned'].includes(s.type)).length;
                    if (negativeStatusCount >= 2 && context.source.currentEnergy >= 1) {
                        state = applyMutations(state, [
                            { type: 'ENERGY', targetId: context.source.id, payload: { amount: -1 } },
                            { type: 'LOG', targetId: '', payload: `${owner.name}'s GRAVE_CHILL_OS drained 1 Energy from the attacker!` }
                        ]);
                    }
                }
                return { state };
            }
        }
    ],
    "hel_v1": [
        {
            id: "hel_v1_equinox",
            priority: 40,
            onActionStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                if (context.source?.id === owner.id) {
                    const isAttack = context.program?.category === 'Attack';
                    const stance = isAttack ? 'DarkStance' : 'LightStance'; // Assuming these will be statuses later, or just logs
                    // For now, let's just log stance shifting
                    state = applyMutations(state, [
                        { type: 'LOG', targetId: '', payload: `${owner.name} shifts to ${stance}!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    "hel_v2": [
        {
            id: "hel_v2_underworld",
            priority: 40,
            onActionStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                if (context.source?.id === owner.id && context.program?.element === 'Dark' && context.program.category !== 'Attack' && context.program.baseCost) {
                    const cost = context.program.baseCost;
                    state = applyMutations(state, [
                        { type: 'ENERGY', targetId: owner.id, payload: { amount: cost } }, // Refund energy
                        { type: 'HP', targetId: owner.id, payload: { amount: cost, isHeal: false, element: 'None' } }, // Pay in HP
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s UNDERWORLD_GATEWAY paid ${cost} HP instead of Energy!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    "nidhoggr_v1": [
        {
            id: "nidhoggr_v1_root",
            priority: 40,
            onTurnEnd: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                // Identify enemies with poison and add +1 stack to counter the natural -1 decay
                const isPlayerTarget = state.playerParty.some((e: IBattleEntity) => e.id === owner.id);
                const enemies = isPlayerTarget ? state.enemyParty : state.playerParty;

                let mutated = false;
                const mutations: MutationRequest[] = [];
                enemies.forEach((enemy: IBattleEntity) => {
                    if (enemy.statusEffects.some(s => s.type === 'Poison')) {
                        mutated = true;
                        mutations.push({
                            type: 'STATUS', targetId: enemy.id, sourceId: owner.id, payload: { status: 'Poison', stacks: 1 }
                        });
                    }
                });

                if (mutated) {
                    state = applyMutations(state, [
                        ...mutations,
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s ROOT_CORRUPTION prevents Poison from decaying!` }
                    ]);
                }
                return { state };
            }
        }
    ],
    "nidhoggr_v2": [
        {
            id: "nidhoggr_v2_fallen",
            priority: 40,
            onTurnStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                const totalAlive = state.playerParty.filter((e: IBattleEntity) => e.currentHp > 0).length + state.enemyParty.filter((e: IBattleEntity) => e.currentHp > 0).length;
                const lastAlive = state.counters['nidhoggr_alive_count'];

                if (lastAlive !== undefined && totalAlive < lastAlive) {
                    const diff = lastAlive - totalAlive;
                    state = applyMutations(state, [
                        { type: 'STATUS', targetId: owner.id, sourceId: owner.id, payload: { status: 'Strengthened', stacks: 3 * diff } },
                        { type: 'STATUS', targetId: owner.id, sourceId: owner.id, payload: { status: 'Sharp', stacks: 3 * diff } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s FALLEN_FEAST_OS activates on death: gained ${3 * diff} Str and Sharp!` }
                    ]);
                }

                state = applyMutations(state, [
                    { type: 'COUNTER', targetId: '', payload: { key: 'nidhoggr_alive_count', operator: 'SET', amount: totalAlive } }
                ]);

                return { state };
            }
        }
    ]
};
