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
    // NOTE: gullinbursti_v1 / gullinbursti_v2 / audhumbla_v1 used to have hand-written
    // implementations here with DIFFERENT hook ids than the hooks.json versions, so both
    // registered and both fired (double Sharp damage bonus, two competing discount systems,
    // double max-energy gains). The data-driven hooks.json versions match the OS
    // descriptions, so the custom duplicates were removed.
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
    ]
};
