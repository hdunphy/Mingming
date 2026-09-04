import { registerHook } from '../core/HookRegistry';
import { HookFactory } from '../core/HookFactory';
import HOOKS_DATA from './lib/hooks.json';
import { HookLibrarySchema } from './HookSchema';
import type { DataHookDefinition, ModifierDataHookDefinition } from '../core/HookTypes';

/** hooks.json, keyed by daemon/firmware id — only `hooks` is read below. */
type HookLibrary = Record<string, { hooks?: Array<DataHookDefinition | ModifierDataHookDefinition> }>;

export const RECURSION_DAEMON_HOOK_ID = 'recursion_daemon_hook';
export const THERMAL_OVERLOAD_HOOK_ID = 'thermal_overload_hook';
export const THERMAL_OVERLOAD_LOGIC_ID = 'thermal_overload_logic';
export const ECHO_CHAMBER_DAEMON_HOOK_ID = 'echo_chamber_daemon_hook';
export const HOOFBEAT_DAEMON_HOOK_ID = 'hoofbeat_daemon_hook';

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
        'einherjar_standard',
        'hoofbeat_daemon',
        /*
         * TICKET 69's Tidewrack toolbox, printed 2026-08-30. Both are `when.source: OPPONENT`
         * daemons — `riptide` taxes cards PLAYED, `short_circuit` taxes engine draws.
         *
         * THIS LIST IS AN ALLOWLIST, AND THAT IS A TRAP. A daemon whose `hooks.json` entry is
         * perfect and whose `programs.json` printing is perfect does NOTHING if its key is missing
         * here — no error, no warning, no failing test. Both of these were built, schema-valid, and
         * completely inert until this line existed. `daemonCoverage.test.ts` now fails for any
         * Daemon in the registry whose hook ids do not resolve, so the next one is caught by the
         * suite rather than by a measurement that reads "the counter is too weak".
         */
        'riptide',
        'short_circuit',
        // The remaining three toolbox daemons (69-toolbox-printings.md). `discharge` and `vent` are
        // Skills and resolve through their `actions`, so they have no entry here by design —
        // `daemonCoverage.test.ts` is what proves that is a shape and not an omission.
        'reactive_plating',
        'scrubber',
        'drip_feed'
    ];

    // Validate JSON on boot
    let validatedData: HookLibrary = {};
    try {
        validatedData = HookLibrarySchema.parse(HOOKS_DATA) as unknown as HookLibrary;
    } catch (error) {
        console.error("Failed to parse hooks.json schema in daemonHooks:", error);
        validatedData = HOOKS_DATA as unknown as HookLibrary; // Fallback
    }

    daemonKeys.forEach(key => {
        const data = validatedData[key];
        if (data && data.hooks) {
            data.hooks.forEach(h => {
                registerHook(HookFactory.createHook(h));
            });
        }
    });

    isDaemonsInitialized = true;
}
