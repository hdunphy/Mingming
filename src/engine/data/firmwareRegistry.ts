import { type HookDefinition } from '../core/HookTypes';
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
}

export const FIRMWARE_REGISTRY: Record<string, OSDefinition> = {};
let isInitialized = false;

function initFirmwareHooks() {
    if (isInitialized) return;


    // Validate JSON on boot
    let validatedData: any = {};
    try {
        validatedData = HookLibrarySchema.parse(HOOKS_DATA);
    } catch (error) {
        console.error("Failed to parse hooks.json schema in firmwareRegistry:", error);
        validatedData = HOOKS_DATA; // Fallback
    }

    const firmwareKeys = Object.keys(validatedData).filter(key => key.endsWith('_v1') || key.endsWith('_v2'));

    firmwareKeys.forEach(key => {
        const data = validatedData[key];
        let hooks: HookDefinition[] = [];

        if (data && data.hooks) {
            hooks = data.hooks.map((h: any) => HookFactory.createHook(h));
        }

        if (CustomFirmware[key]) {
            hooks = [...hooks, ...CustomFirmware[key]];
        }

        if (data) {
            FIRMWARE_REGISTRY[key] = {
                id: data.id || key,
                name: data.name || 'CUSTOM_OS',
                description: data.description || 'Custom Firmware',
                hooks
            };
            hooks.forEach((hook: any) => registerHook(hook));
        }
    });

    isInitialized = true;
}

export const getOSBehavior = (osId: string): OSDefinition | undefined => {
    initFirmwareHooks();
    return FIRMWARE_REGISTRY[osId];
};
