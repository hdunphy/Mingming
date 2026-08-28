import { type HookDefinition } from './HookTypes';

const hookRegistry: Record<string, HookDefinition> = {};

export const registerHook = (definition: HookDefinition) => {
    hookRegistry[definition.id] = definition;
};

export const getHook = (id: string): HookDefinition | undefined => {
    return hookRegistry[id];
};
