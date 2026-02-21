import { type HookDefinition } from '../core/HookTypes';
import { registerHook } from '../core/HookRegistry';
import { HookFactory } from '../core/HookFactory';
import HOOKS_DATA from './lib/hooks.json';
import { HookLibrarySchema } from './HookSchema';

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

    const firmwareKeys = ['fenrir_v1', 'fenrir_v2', 'kraken_v1', 'kraken_v2', 'ratatoskr_v1', 'ratatoskr_v2'];

    // Validate JSON on boot
    let validatedData: any = {};
    try {
        validatedData = HookLibrarySchema.parse(HOOKS_DATA);
    } catch (error) {
        console.error("Failed to parse hooks.json schema in firmwareRegistry:", error);
        validatedData = HOOKS_DATA; // Fallback
    }

    firmwareKeys.forEach(key => {
        const data = validatedData[key];
        if (data && data.hooks) {
            const hooks = data.hooks.map((h: any) => HookFactory.createHook(h));
            FIRMWARE_REGISTRY[key] = {
                ...data,
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
