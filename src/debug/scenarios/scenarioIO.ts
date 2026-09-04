/**
 * Scenario load/save - the two helpers every debug surface goes through.
 *
 * Read path:  parse -> migrateScenario -> validate -> normalizeBattleState
 * Write path: normalizeBattleState -> stamp version + registryHash -> validate -> stringify
 *
 * The read path mirrors SaveSystem.ts:78-94 (migrate before validate, so an older shape
 * loads instead of being rejected wholesale). The normalizer runs on both sides so that
 * every state that leaves or enters this module is already in canonical form.
 *
 * Registry-hash mismatch is LOUD BUT NON-BLOCKING: console.warn and load anyway. The
 * failure being guarded against is a silent rebalance corrupting a replay diff; hard
 * failing would invalidate the whole scenario library on every card tweak during active
 * content work. Callers that render UI should surface `registryHashMismatch` as a banner.
 */

import { z } from 'zod';
import { normalizeBattleState } from './normalizeBattleState';
import { computeRegistryHash } from './registryHash';
import {
    CURRENT_SCENARIO_VERSION,
    ScenarioSchema,
    migrateScenario,
} from './scenarioSchema';
import type { Scenario, ScenarioDraft } from './scenarioSchema';

export interface ScenarioLoadResult {
    /** null only when parsing or validation failed. A hash mismatch still returns the scenario. */
    scenario: Scenario | null;
    error?: string;
    /** True when the file's stamp differs from the registries loaded right now. */
    registryHashMismatch: boolean;
    /** The stamp computed from the current registries, when it was computed at all. */
    currentRegistryHash?: string;
}

export interface ScenarioSaveResult {
    success: boolean;
    /** Pretty-printed `.scenario.json` contents, ready to write to disk or download. */
    json?: string;
    /** The stamped and normalized scenario that produced `json`. */
    scenario?: Scenario;
    error?: string;
}

function formatZodError(err: z.ZodError): string {
    return err.issues
        .map(issue => `[${issue.path.join('.')}] ${issue.message}`)
        .join('\n');
}

/** The exact banner text, so the launcher UI and the headless warning stay in sync. */
export function describeRegistryMismatch(fileHash: string, currentHash: string): string {
    return (
        'REGISTRY DRIFT: this scenario was authored against a different data registry.\n' +
        `  scenario: ${fileHash}\n` +
        `  current:  ${currentHash}\n` +
        'Loading anyway. Results may not match the run this scenario was captured from.'
    );
}

/**
 * `parse -> migrate -> validate -> normalize`.
 *
 * `input` may be the raw JSON text or an already-parsed value.
 */
export function loadScenario(input: unknown): ScenarioLoadResult {
    let currentRegistryHash: string | undefined;
    try {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        const migrated = migrateScenario(parsed);
        const validated = ScenarioSchema.parse(migrated) as unknown as Scenario;

        currentRegistryHash = computeRegistryHash();
        const registryHashMismatch = validated.registryHash !== currentRegistryHash;
        if (registryHashMismatch) {
            console.warn(describeRegistryMismatch(validated.registryHash, currentRegistryHash));
        }

        const scenario: Scenario =
            validated.kind === 'snapshot'
                ? { ...validated, state: normalizeBattleState(validated.state) }
                : validated;

        return { scenario, registryHashMismatch, currentRegistryHash };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const messages = formatZodError(err);
            console.error('Scenario validation failed:\n' + messages);
            return { scenario: null, error: messages, registryHashMismatch: false, currentRegistryHash };
        }
        if (err instanceof SyntaxError) {
            console.error('Corrupted scenario file (invalid JSON)');
            return {
                scenario: null,
                error: 'Corrupted scenario file (invalid JSON)',
                registryHashMismatch: false,
                currentRegistryHash,
            };
        }
        return { scenario: null, error: String(err), registryHashMismatch: false, currentRegistryHash };
    }
}

/**
 * `normalize -> stamp -> validate -> stringify`.
 *
 * `version` and `registryHash` are stamped here, so authoring code never hand-writes
 * them. `createdAt` is filled in only when the draft omits it - it is informational and
 * never compared, so an existing value is preserved verbatim.
 */
export function saveScenario(draft: ScenarioDraft): ScenarioSaveResult {
    try {
        const stamp = {
            version: draft.version ?? CURRENT_SCENARIO_VERSION,
            registryHash: computeRegistryHash(),
            createdAt: draft.createdAt ?? new Date().toISOString(),
        };

        // Narrowed on `draft` rather than on the merged object so the discriminant is
        // never lost through the spread.
        const scenario: Scenario =
            draft.kind === 'snapshot'
                ? { ...draft, ...stamp, state: normalizeBattleState(draft.state) }
                : { ...draft, ...stamp };

        ScenarioSchema.parse(scenario);
        return { success: true, json: JSON.stringify(scenario, null, 2), scenario };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const messages = formatZodError(err);
            console.error('Scenario save validation failed:\n' + messages);
            return { success: false, error: messages };
        }
        return { success: false, error: String(err) };
    }
}
