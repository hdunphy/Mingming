import { type HookDefinition, type HookContext, type HookResult, type MutationRequest, resolveCounterKey } from './HookTypes';
import type { IBattleState, IBattleEntity } from '../types';
import { StatusType } from '../types';
import { applyMutations } from '../resolutionEngine';

/** Decided in the OS design review (deck-archetypes ticket 09): 50% of maxHP. */
const HULDRA_V2_SHIELD_PERCENT = 50;

/**
 * BARK_SHIELD_OS: grant the once-per-battle shield at the owner's first turn
 * boundary. Shared by the onTurnStart and onTurnEnd hooks; the per-owner
 * counter guard makes whichever fires first the only one that acts.
 */
function grantHuldraShieldOnce(context: HookContext, owner: IBattleEntity): HookResult {
    let state = context.state;
    const guardKey = resolveCounterKey('huldra_shield_init', 'OWNER', owner);
    if (!state.counters[guardKey]) {
        state = applyMutations(state, [
            // BarkShield stacks are a percent of maxHp (see StatusBehaviors).
            { type: 'STATUS', targetId: owner.id, sourceId: owner.id, payload: { status: 'BarkShield', stacks: HULDRA_V2_SHIELD_PERCENT } },
            { type: 'COUNTER', targetId: '', payload: { key: guardKey, operator: 'SET', amount: 1 } },
            { type: 'LOG', targetId: '', payload: `${owner.name}'s BARK_SHIELD_OS activates a massive temporary shield!` }
        ]);
    }
    return { state };
}

export const CustomFirmware: Record<string, HookDefinition[]> = {
    "fafnir_v1": [
        {
            id: "fafnir_v1_hoard",
            priority: 40,
            onTurnEnd: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                // Only hoard at the END of the OWNER's own turn (onTurnEnd fires
                // for hooks on both sides; context.source is the ending entity).
                if (context.source?.id === owner.id && owner.currentEnergy > 0) {
                    const energyToHoard = owner.currentEnergy;
                    state = applyMutations(state, [
                        { type: 'STATUS', targetId: owner.id, sourceId: owner.id, payload: { status: 'Energized', stacks: energyToHoard } },
                        { type: 'COUNTER', targetId: '', payload: { key: resolveCounterKey('fafnir_hoard', 'OWNER', owner), operator: 'SET', amount: energyToHoard } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s HOARD_PROTOCOL retains ${energyToHoard} Energy!` }
                    ]);
                }
                return { state };
            }
        },
        {
            id: "fafnir_v1_recoil",
            priority: 40,
            onTurnStart: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                // Recoil lands at the START of the owner's next turn — the moment
                // the hoarded Energy is cashed in (1% max HP per point, min 1).
                const hoardKey = resolveCounterKey('fafnir_hoard', 'OWNER', owner);
                const hoarded = state.counters[hoardKey] || 0;
                if (context.source?.id === owner.id && hoarded > 0) {
                    const recoilDamage = Math.max(1, Math.floor(owner.maxHp * 0.01 * hoarded));
                    state = applyMutations(state, [
                        { type: 'HP', targetId: owner.id, payload: { amount: recoilDamage } },
                        { type: 'COUNTER', targetId: '', payload: { key: hoardKey, operator: 'RESET' } },
                        { type: 'LOG', targetId: '', payload: `${owner.name}'s hoarded Energy burns its core for ${recoilDamage} damage!` }
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
    // NOTE (ticket 07, 2026-08-05): fafnir_v2 previously had a hand-written duplicate here
    // with the SAME id as the hooks.json version ("fafnir_v2_corrupted") — only the Set-dedup
    // in hook collection prevented double energy. The data-driven hooks.json version is the
    // survivor, matching the gullinbursti/audhumbla cleanup above.
    //
    // NOTE (ticket 07, 2026-08-05): hraesvelgr_v1's no-op onActionStart stub was deleted —
    // the real GALE_FORCE_OS hook lives in hooks.json (trigger: onDiscarded) and is fully
    // wired; it just has no enabler cards in the pool yet (see deck-archetypes map).
    "hraesvelgr_v2": [
        {
            id: "hraesvelgr_v2_updraft",
            priority: 40,
            onCardDraw: (context: HookContext, owner: IBattleEntity): HookResult => {
                let state = context.state;
                // deck_shuffles is genuinely global (one shared deck per side);
                // the once-only guard is namespaced per owner so two Hraesvelgrs
                // each get their own +1 Max Energy.
                const guardKey = resolveCounterKey('hraesvelgr_max_energy', 'OWNER', owner);
                if ((state.counters['deck_shuffles'] || 0) > 0 && !(state.counters[guardKey] || 0)) {
                    state = applyMutations(state, [
                        { type: 'MAX_ENERGY', targetId: owner.id, payload: { amount: 1 } },
                        { type: 'COUNTER', targetId: '', payload: { key: guardKey, operator: 'SET', amount: 1 } },
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
                        // The real buff StatusTypes (sourced from types.ts, not
                        // free-form strings — 'Protect'/'Nimble' never existed).
                        const positiveStatuses: string[] = [
                            StatusType.Strengthened,
                            StatusType.Sharp,
                            StatusType.Regen,
                            StatusType.StableOS,
                            StatusType.Energized,
                            StatusType.BarkShield
                        ];
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
        // Ticket 07 (2026-08-05): two fixes.
        // (1) The old `state.turn === 1` guard never matched for the player side — battles
        //     start mid-turn-1 in the ACTION phase, so the player's first onTurnStart is
        //     turn 2. The shield now lands on the owner's FIRST turn boundary (turn start
        //     or turn end, whichever comes first), once per battle: enemy-side Huldra at
        //     her turn-1 pre-turn, player-side Huldra at the end of turn 1 — in both cases
        //     before the opposing side's first attack resolves against her.
        // (2) BarkShield stacks ARE a percent of maxHp (StatusBehaviors), so the old
        //     `floor(maxHp * 0.5)` stacks made the shield quadratic in maxHp. Now a flat
        //     percent. HULDRA_V2_SHIELD_PERCENT = 50 matches the old
        //     effective value at ~100 maxHp and was confirmed as the decided value by
        //     the OS design review (deck-archetypes ticket 09).
        {
            id: "huldra_v2_bark_start",
            priority: 40,
            onTurnStart: (context: HookContext, owner: IBattleEntity): HookResult =>
                grantHuldraShieldOnce(context, owner)
        },
        {
            id: "huldra_v2_bark_end",
            priority: 40,
            onTurnEnd: (context: HookContext, owner: IBattleEntity): HookResult =>
                grantHuldraShieldOnce(context, owner)
        }
    ],
    "ymir_v2": [
        {
            id: "ymir_v2_glacial",
            priority: 40,
            onDamageCalculated: (currentDamage: number, context: HookContext, owner: IBattleEntity): number => {
                if (context.source?.id === owner.id && context.program?.element === 'Ice') {
                    // Ice cards deal 35% more base damage (ticket 09: softened from 50%)
                    return currentDamage + Math.floor(currentDamage * 0.35);
                }
                return currentDamage;
            }
        }
    ]
};
