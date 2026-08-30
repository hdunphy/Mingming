import { type HookDefinition, type DataHookDefinition, type ModifierDataHookDefinition } from '../core/HookTypes';
import { registerHook } from '../core/HookRegistry';
import { HookFactory } from '../core/HookFactory';
import HOOKS_DATA from './lib/hooks.json';
import { HookLibrarySchema } from './HookSchema';
import { CustomFirmware } from '../core/CustomFirmware';

export interface OSDefinition {
    id: string;
    name: string;
    description: string;
    hooks: HookDefinition[];
    /** Per-unit cap on cards played each turn (e.g. GLACIAL_PACE_OS: 2). Undefined = unlimited. */
    maxCardsPerTurn?: number;
    /**
     * Ticket 48: the owner may play cards while Asleep (draugr_v1 PERMAFROST_WAKE).
     *
     * The `not_asleep` constraint stays PRINTED on every card - this waives that one check for
     * this OS's owner only, so Asleep still shuts down everyone else and a card cannot become
     * castable-while-asleep for whoever happens to draft it.
     */
    actsWhileAsleep?: boolean;
}

/** hooks.json, keyed by firmware id — only the fields read below. */
type HookLibraryEntry = {
    id?: string;
    name?: string;
    description?: string;
    maxCardsPerTurn?: number;
    actsWhileAsleep?: boolean;
    hooks?: Array<DataHookDefinition | ModifierDataHookDefinition>;
};

export const FIRMWARE_REGISTRY: Record<string, OSDefinition> = {};
let isInitialized = false;

function initFirmwareHooks() {
    if (isInitialized) return;


    // Validate JSON on boot
    let validatedData: Record<string, HookLibraryEntry> = {};
    try {
        validatedData = HookLibrarySchema.parse(HOOKS_DATA) as unknown as Record<string, HookLibraryEntry>;
    } catch (error) {
        console.error("Failed to parse hooks.json schema in firmwareRegistry:", error);
        validatedData = HOOKS_DATA as unknown as Record<string, HookLibraryEntry>; // Fallback
    }

    /*
     * TICKET 68 added the `driver_` prefix, and it is the one entry class here that is NOT an OS.
     *
     * A Driver is a side-level passive that sits BESIDE a unit's firmware rather than replacing it
     * (`data/driverRegistry.ts` attaches its hook ids to `IBattleEntity.hooks`, leaving `activeOS`
     * alone). It is loaded through this function anyway because the two things a Driver needs are
     * exactly the two things this function does: its hooks have to reach `registerHook`, or
     * `Hooks.ts` cannot find them by id; and its name and rule text have to be readable by id, or
     * the offer screen cannot telegraph it.
     *
     * Building a parallel loader to say the same two sentences would have meant a second place for
     * a hooks.json entry to be silently missed — which is the failure mode this whole file's
     * comments are about. The naming law is kept where it belongs instead: in the id. Nothing
     * prefixed `driver_` is ever set as an `activeOS`, and `driverRegistry` is the only door to one.
     */
    const firmwareKeys = Object.keys(validatedData).filter(key =>
        key.endsWith('_v1') || key.endsWith('_v2')
        || key.startsWith('driver_')
    );

    firmwareKeys.forEach(key => {
        const data = validatedData[key];
        let hooks: HookDefinition[] = [];

        if (data && data.hooks) {
            hooks = data.hooks.map(h => HookFactory.createHook(h));
        }

        if (CustomFirmware[key]) {
            hooks = [...hooks, ...CustomFirmware[key]];
        }

        if (data) {
            FIRMWARE_REGISTRY[key] = {
                id: data.id || key,
                name: data.name || 'CUSTOM_OS',
                description: data.description || 'Custom Firmware',
                hooks,
                maxCardsPerTurn: data.maxCardsPerTurn,
                actsWhileAsleep: data.actsWhileAsleep
            };
            hooks.forEach(hook => registerHook(hook));
        }
    });

    isInitialized = true;
}

export const getOSBehavior = (osId: string): OSDefinition | undefined => {
    initFirmwareHooks();
    return FIRMWARE_REGISTRY[osId];
};
