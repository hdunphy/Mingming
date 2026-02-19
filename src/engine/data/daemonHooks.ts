import { registerHook } from '../core/HookRegistry';
import { HookPriority } from '../core/HookTypes';
import { HookFactory } from '../core/HookFactory';

export const RECURSION_DAEMON_HOOK_ID = 'recursion_daemon_hook';
export const THERMAL_OVERLOAD_HOOK_ID = 'thermal_overload_hook';
export const THERMAL_OVERLOAD_LOGIC_ID = 'thermal_overload_logic';

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

// 2. THERMAL_OVERLOAD: Passive: Deal 25% more damage. Host takes 5 Fire damage at turn end.
// Damage Modifier
registerHook(HookFactory.createHook({
    id: THERMAL_OVERLOAD_HOOK_ID,
    trigger: 'onDamageCalculated',
    priority: HookPriority.ATTACKER,
    when: { source: 'SELF' },
    multiplier: 1.25
}));

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
