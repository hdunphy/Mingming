import { registerHook, getHook } from '../core/HookRegistry';
import { HookPriority, type HookContext } from '../core/HookTypes';
import { HookFactory } from '../core/HookFactory';

export const RECURSION_DAEMON_HOOK_ID = 'recursion_daemon_hook';
export const THERMAL_OVERLOAD_HOOK_ID = 'thermal_overload_hook';
export const THERMAL_OVERLOAD_LOGIC_ID = 'thermal_overload_logic';
export const ECHO_CHAMBER_DAEMON_HOOK_ID = 'echo_chamber_daemon_hook';

// 1. RECURSION_DAEMON: Passive: Whenever you draw a card from an effect, heal 5 HP.
registerHook(HookFactory.createHook({
    id: RECURSION_DAEMON_HOOK_ID,
    trigger: 'onCardDraw',
    priority: HookPriority.PROGRAM,
    when: { source: 'SELF', isNaturalDraw: false },
    do: [
        { type: 'HP', target: 'SELF', amount: 5, isHeal: true },
        { type: 'LOG', text: "{owner}'s RECURSION_DAEMON repairs 5 HP!" }
    ]
}));

// 2. THERMAL_OVERLOAD: Passive: Increase Burn damage by 50%. Host takes 5 Fire damage at turn end.
// Damage Modifier (Standard)
registerHook(HookFactory.createHook({
    id: THERMAL_OVERLOAD_HOOK_ID,
    trigger: 'onDamageCalculated',
    priority: HookPriority.ATTACKER,
    when: { source: 'SELF' },
    multiplier: 1.10 // Reduced standard boost to compensate for Burn focus? Or leave 1.25. 
}));

// NEW: Burn specific damage boost
registerHook({
    id: 'thermal_overload_burn_boost',
    priority: HookPriority.PROGRAM,
    onStatusDamageCalculated: (damage, context, owner) => {
        // If the owner is the 'virtual source' of the status? 
        // Status effects don't track source properly right now.
        // For Fenrir, we'll assume if YOU have Thermal Overload, YOUR targets take more burn damage?
        // Or simpler: any Burn on any unit dealt while YOU are active? 
        // Usually, Thermal Overload is "Your burns do more". 
        // Let's check context.target. Or just check if 'owner' is on the same side as the status caster.
        // For MVP: if the person with this daemon is alive, ALL burns on their ENEMIES deal 50% more.
        const isOwnerPlayer = context.state.playerParty.some(e => e.id === owner.id);
        const isTargetPlayer = context.state.playerParty.some(e => e.id === context.target?.id);

        if (isOwnerPlayer !== isTargetPlayer) {
            return damage * 1.5;
        }
        return damage;
    }
});

// Update thermal_overload program to include this new hook
// (Already did in programRegistry.ts if I used IDs, but let's make sure IDs match)

// Turn End Logic
registerHook(HookFactory.createHook({
    id: THERMAL_OVERLOAD_LOGIC_ID,
    trigger: 'onTurnEnd',
    priority: HookPriority.PROGRAM,
    when: { source: 'SELF' },
    do: [
        { type: 'HP', target: 'SELF', amount: 5, isHeal: false },
        { type: 'LOG', text: "{owner}'s THERMAL_OVERLOAD causes 5 overheat damage!" }
    ]
}));

// 3. ECHO_CHAMBER_DAEMON: Whenever you play a 0-cost card, generate a 0-cost "Feedback" token in your hand (deals 2 Nature damage).
registerHook(HookFactory.createHook({
    id: ECHO_CHAMBER_DAEMON_HOOK_ID,
    trigger: 'onActionStart',
    priority: HookPriority.PROGRAM,
    when: { source: 'SELF' },
    condition: (context: HookContext) => context.program?.baseCost === 0,
    do: [
        { type: 'GENERATE_CARD', dataId: 'feedback_token', target: 'SELF' },
        { type: 'LOG', text: "{owner}'s ECHO_CHAMBER_DAEMON generates Feedback!" }
    ] as any // Bypass strict do typing if needed, but I updated it
}));
