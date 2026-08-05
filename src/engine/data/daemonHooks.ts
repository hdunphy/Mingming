import { registerHook } from '../core/HookRegistry';
import { HookFactory } from '../core/HookFactory';
import HOOKS_DATA from './lib/hooks.json';
import { HookLibrarySchema } from './HookSchema';

export const RECURSION_DAEMON_HOOK_ID = 'recursion_daemon_hook';
export const THERMAL_OVERLOAD_HOOK_ID = 'thermal_overload_hook';
export const THERMAL_OVERLOAD_LOGIC_ID = 'thermal_overload_logic';
export const ECHO_CHAMBER_DAEMON_HOOK_ID = 'echo_chamber_daemon_hook';

let isDaemonsInitialized = false;

export function initDaemonHooks() {
    if (isDaemonsInitialized) return;

    const daemonKeys = [
        'recursion_daemon',
        'thermal_overload',
        'echo_chamber',
        'defensive_daemon',
        'core_overclock_daemon',
        'cinder_armor_daemon',
        'feedback_loop_daemon',
        'fertile_ground_daemon',
        'einherjar_standard'
    ];

    // Validate JSON on boot
    let validatedData: any = {};
    try {
        validatedData = HookLibrarySchema.parse(HOOKS_DATA);
    } catch (error) {
        console.error("Failed to parse hooks.json schema in daemonHooks:", error);
        validatedData = HOOKS_DATA; // Fallback
    }

    daemonKeys.forEach(key => {
        const data = validatedData[key];
        if (data && data.hooks) {
            data.hooks.forEach((h: any) => {
                registerHook(HookFactory.createHook(h));
            });
        }
    });

    isDaemonsInitialized = true;
}
