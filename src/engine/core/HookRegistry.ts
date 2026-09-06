import { type HookDefinition } from './HookTypes';

const hookRegistry: Record<string, HookDefinition> = {};

/**
 * TICKET 144b — bumped on every registration, so anything memoising a hook LOOKUP can tell whether
 * its cache is still describing the registry it was built from.
 *
 * Registration is not a boot-only event: `firmwareRegistry` registers lazily on first
 * `getOSBehavior`, `daemonHooks` registers on init, and several test files register hand-built
 * hooks at module scope. A cache that assumed "registered once, at startup" would serve a stale
 * hook to whichever test ran second, and it would do it silently.
 */
let version = 0;

export const registerHook = (definition: HookDefinition) => {
    hookRegistry[definition.id] = definition;
    version += 1;
};

/** The registry's generation. See `version` above. */
export const hookRegistryVersion = (): number => version;

export const getHook = (id: string): HookDefinition | undefined => {
    return hookRegistry[id];
};
