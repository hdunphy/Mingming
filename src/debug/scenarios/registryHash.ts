/**
 * Registry drift stamp - see docs/wayfinder/debug-toolkit/tickets/02-scenario-schema.md,
 * section 2.
 *
 * A scenario records the content of the *data* registries it was authored against, so a
 * silent rebalance cannot quietly corrupt a replay diff. The stamp is advisory: on
 * mismatch the loader warns loudly and loads anyway (see scenarioIO.ts).
 *
 * Shape: `<algoVersion>:<8 hex>`, e.g. `1:9f3ac02b`. The algoVersion prefix exists so
 * that changing *what* is hashed never silently compares apples to oranges - bump
 * REGISTRY_HASH_ALGO_VERSION whenever the input set or canonical form changes.
 *
 * Deliberately excluded: the hook registry (core/HookRegistry.ts). It is lazily
 * populated behind initFirmwareHooks()'s isInitialized guard, so hashing it would be
 * timing-dependent. Recorded consequence: a changed hook *implementation* is not caught
 * by this stamp; missing hook IDs still surface at resolve time.
 */

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { FIRMWARE_REGISTRY, getOSBehavior } from '../../engine/data/firmwareRegistry';

/** Bump when the hashed input set or the canonical string form changes. */
export const REGISTRY_HASH_ALGO_VERSION = 1;

/** NUL - separates an id from its serialized definition inside one pair. */
const FIELD_SEPARATOR = String.fromCharCode(0);
/** SOH - separates pairs from one another. */
const PAIR_SEPARATOR = String.fromCharCode(1);

/**
 * FIRMWARE_REGISTRY shares the same lazy initFirmwareHooks() guard as the hook registry,
 * so it has to be forced open before hashing or the result would depend on whether a
 * battle had started yet. getOSBehavior runs the initializer and returns undefined for
 * an unknown id without warning.
 */
const FIRMWARE_INIT_PROBE_ID = '__registry_hash_probe__';

/** FNV-1a, 32-bit, over UTF-16 code units. */
export function fnv1a32(input: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

function collectPairs(namespace: string, registry: Record<string, unknown>, into: string[]): void {
    for (const id of Object.keys(registry)) {
        into.push(`${namespace}:${id}${FIELD_SEPARATOR}${JSON.stringify(registry[id])}`);
    }
}

/**
 * The exact string that gets hashed. Exported for debugging a mismatch - diff two of
 * these to see which registry entry moved.
 */
export function buildRegistryCanonicalString(): string {
    getOSBehavior(FIRMWARE_INIT_PROBE_ID);

    const pairs: string[] = [];
    collectPairs('mingming', MingmingRegistry, pairs);
    collectPairs('program', ProgramRegistry, pairs);
    collectPairs('firmware', FIRMWARE_REGISTRY, pairs);

    // Namespaced ids keep the sort total and collision-free across registries.
    pairs.sort();
    return pairs.join(PAIR_SEPARATOR);
}

/** `<algoVersion>:<8 hex>` stamp of the Mingming, Program and firmware/OS registries. */
export function computeRegistryHash(): string {
    const digest = fnv1a32(buildRegistryCanonicalString()).toString(16).padStart(8, '0');
    return `${REGISTRY_HASH_ALGO_VERSION}:${digest}`;
}
