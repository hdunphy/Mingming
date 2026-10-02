/**
 * TICKET 169f — the run modifiers, parsed once at load. See `modifierSchema.ts`.
 *
 * **Storage.** An active modifier is a `mod:<id>` string in the existing `IRunState.modifiers`
 * array, the precedent `reveal:biome:N` set (ticket 15; see `macroRegistry.revealedBiomesFrom`). No
 * new field and no save version bump. **Every effect asks through `hasModifier`**, so how a
 * modifier is stored is one decision in one file.
 */

import raw from '../../data/modifiers.json';
import type { IRunState } from '../../runTypes';
import { parseModifiers } from './modifierSchema';
import type { ModifierDefinition, ModifierNumberKey } from './modifierSchema';

export const MODIFIERS: ReadonlyArray<ModifierDefinition> = parseModifiers(raw);

export const MODIFIER_IDS: ReadonlyArray<string> = MODIFIERS.map((modifier) => modifier.id);

/** What `IRunState.modifiers` entries for a modifier start with. */
export const MODIFIER_PREFIX = 'mod:';

/** The `IRunState.modifiers` entry for a modifier id. */
export function modifierEntry(id: string): string {
    return `${MODIFIER_PREFIX}${id}`;
}

/** A modifier's row, or undefined for an id the file does not list. */
export function getModifier(id: string): ModifierDefinition | undefined {
    return MODIFIERS.find((modifier) => modifier.id === id);
}

/** One of a modifier's numbers. Throws if the row does not carry it: that is a data error, not a default. */
export function modifierNumber(id: string, key: ModifierNumberKey): number {
    const value = getModifier(id)?.[key];
    if (value === undefined) throw new Error(`modifiers.json: "${id}" has no ${key}`);
    return value;
}

/** The ids of the modifiers a run has on, in the order they were stored. Other `modifiers` entries are ignored. */
export function activeModifiers(run: Pick<IRunState, 'modifiers'>): string[] {
    return run.modifiers.filter((entry) => entry.startsWith(MODIFIER_PREFIX)).map((entry) => entry.slice(MODIFIER_PREFIX.length));
}

/** Whether a run has the modifier on. The only way any rule should ask. */
export function hasModifier(run: Pick<IRunState, 'modifiers'>, id: string): boolean {
    return run.modifiers.includes(modifierEntry(id));
}

/** The display names of a run's active modifiers, for labels. An id the file no longer lists shows as its id. */
export function activeModifierNames(run: Pick<IRunState, 'modifiers'>): string[] {
    return activeModifiers(run).map((id) => getModifier(id)?.name ?? id);
}
