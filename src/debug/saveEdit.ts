/**
 * Save/run editor — the dry-run guard.
 *
 * WHY THIS MODULE EXISTS
 *
 * `src/ui/store/store.ts:20-31` autosaves on *every* game-state change by calling
 * `saveGame`, which validates against `PlayerSaveSchema` (`SaveSystem.ts:58-70`). A save
 * that fails validation is not written — the failure surfaces as a `console.error` and
 * nothing else. Progress silently stops persisting and the player finds out on the next
 * reload, having lost everything since the wedge.
 *
 * A debug editor is the single most likely source of such a save, so every mutation it
 * performs goes through `prepareEdit`/`commitEdit` here: the prospective save is computed
 * *without dispatching* and validated first. Validating after the dispatch would be racing
 * the very subscription this guards — by the time the check ran, the bad state would
 * already be live and the autosave already failed.
 *
 * HOW THE PROSPECTIVE SAVE IS COMPUTED WITHOUT DISPATCHING
 *
 * `gameSlice`'s reducer is a pure function of (state, action). `projectSave` calls it
 * directly — `gameReducer(current, action)` — outside any store. Immer's copy-on-write
 * means the live state object is never mutated, no subscriber runs, and no autosave fires.
 * The *same* action object is then handed to `dispatch`, so the store recomputes exactly
 * the state that was validated.
 *
 * One deliberate caveat: two `gameSlice` reducers mint ids internally
 * (`addToRoster`'s base-deck grant and `addCardsToDeck` call `crypto.randomUUID()`), so the
 * projected save and the dispatched save differ in those id *values*. `PlayerSaveSchema`
 * treats them as opaque `z.string()`, so validity is identical — which is all this dry run
 * claims. Nothing else in the slice is non-deterministic.
 *
 * Everything here is React-free and store-free on purpose, so it is testable headlessly.
 */

import { z } from 'zod';

import { MingmingRegistry } from '../engine/data/mingmingRegistry';
import { createMingmingInstance, createOwnedProgram } from '../engine/gameTypes';
import type { IBlueprint, IOwnedProgram, IPlayerSave } from '../engine/gameTypes';
import { PlayerSaveSchema, migrateSave } from '../engine/SaveSystem';
import gameReducer, {
    addBlueprint,
    addCardsToInventory,
    addRelic,
    addScrap,
    addToRoster,
    grantExperience,
    healParty,
    loadSave,
    resetSave,
    unlockSector,
    updateMingmingOS,
} from '../ui/store/gameSlice';

/**
 * The shape both `projectSave` and `dispatch` accept. Slice action creators produce this.
 * Declared as a type alias rather than an interface so TypeScript grants it the implicit
 * index signature redux's `UnknownAction` requires — otherwise every `dispatch` call site
 * would need a cast.
 */
export type SaveEditAction = {
    readonly type: string;
    readonly payload?: unknown;
};

/** Minimal structural view of a Zod issue, so this module does not pin a zod internal type. */
interface ZodIssueLike {
    readonly path: ReadonlyArray<PropertyKey>;
    readonly message: string;
}

// --- Validation ---

export interface SaveValidation {
    readonly valid: boolean;
    /** Human-readable `[path] message` lines. Empty when `valid`. */
    readonly issues: ReadonlyArray<string>;
}

/** Same `[path] message` formatting `saveGame`/`loadGame` log, so panel text matches the console. */
export function formatIssues(error: unknown): string[] {
    if (error instanceof z.ZodError) {
        const issues = (error as unknown as { issues: ReadonlyArray<ZodIssueLike> }).issues;
        return issues.map((issue) => `[${issue.path.map(String).join('.')}] ${issue.message}`);
    }
    return [String(error)];
}

/**
 * Run the exact check the autosave runs. Used both to vet a prospective save and to report
 * whether the *current* save is already wedged.
 */
export function validateSave(candidate: unknown): SaveValidation {
    try {
        PlayerSaveSchema.parse(candidate);
        return { valid: true, issues: [] };
    } catch (err) {
        return { valid: false, issues: formatIssues(err) };
    }
}

// --- Projection ---

/**
 * Apply `action` to `current` with the real `gameSlice` reducer and return the result.
 *
 * Pure: no store, no dispatch, no subscribers, no autosave. `current` is not mutated.
 * May throw if the reducer itself throws on a malformed payload — `prepareEdit` catches that.
 */
export function projectSave(current: IPlayerSave, action: SaveEditAction): IPlayerSave {
    // gameReducer is typed against redux's UnknownAction; SaveEditAction satisfies it structurally.
    return gameReducer(current, action);
}

export type PreparedEdit =
    | {
          readonly ok: true;
          readonly action: SaveEditAction;
          /** The save the store will hold after dispatch. Already schema-valid. */
          readonly prospective: IPlayerSave;
          /** False when the reducer was a no-op (duplicate relic, already-unlocked sector, ...). */
          readonly changed: boolean;
      }
    | {
          readonly ok: false;
          readonly action: SaveEditAction;
          readonly issues: ReadonlyArray<string>;
      };

/**
 * The gate. Project, validate, and report — but never dispatch.
 *
 * Callers must treat `ok: false` as "do not dispatch this action"; `commitEdit` enforces that.
 */
export function prepareEdit(current: IPlayerSave, action: SaveEditAction): PreparedEdit {
    let prospective: IPlayerSave;
    try {
        prospective = projectSave(current, action);
    } catch (err) {
        // A reducer that throws on this payload would have thrown inside dispatch, mid-store-update.
        return { ok: false, action, issues: [`reducer threw before any dispatch: ${String(err)}`] };
    }

    const validation = validateSave(prospective);
    if (!validation.valid) {
        return { ok: false, action, issues: validation.issues };
    }

    return { ok: true, action, prospective, changed: !savesAreIdentical(current, prospective) };
}

/**
 * `prepareEdit` plus the dispatch, so no call site can accidentally invert the order.
 * `dispatch` is called exactly once, and only on `ok: true`.
 */
export function commitEdit(
    current: IPlayerSave,
    action: SaveEditAction,
    dispatch: (action: SaveEditAction) => void,
): PreparedEdit {
    const prepared = prepareEdit(current, action);
    if (prepared.ok) dispatch(action);
    return prepared;
}

// --- Comparison / persistence check ---

/**
 * Key-order-independent JSON. `PlayerSaveSchema.parse` rebuilds objects in *schema* key order,
 * so a save round-tripped through `loadGame` will not stringify identically to the live state
 * even when nothing changed. Sorting keys makes the comparison mean what it looks like.
 */
export function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
}

export function savesAreIdentical(a: unknown, b: unknown): boolean {
    return stableStringify(a) === stableStringify(b);
}

// --- Replace-from-file ---

export type SaveFileParse =
    | { readonly ok: true; readonly save: IPlayerSave; readonly migrated: boolean }
    | { readonly ok: false; readonly issues: ReadonlyArray<string> };

/**
 * Read path for "replace save from file", mirroring `loadGame` (`SaveSystem.ts:113-121`):
 * JSON.parse -> `migrateSave` -> validate. Migrating first means an older export loads
 * instead of being rejected wholesale. The validated object is what `loadSave` receives.
 */
export function parseSaveFileText(text: string): SaveFileParse {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (err) {
        return { ok: false, issues: [`not valid JSON: ${String(err)}`] };
    }

    const migrated = migrateSave(raw);
    const validation = validateSave(migrated);
    if (!validation.valid) return { ok: false, issues: validation.issues };

    return {
        ok: true,
        save: PlayerSaveSchema.parse(migrated) as IPlayerSave,
        migrated: !savesAreIdentical(raw, migrated),
    };
}

// --- Verb builders ---
//
// Each returns the action a real game capability would dispatch — existing `gameSlice`
// actions wherever one exists, so the edit inherits the game's own logic (e.g. `addToRoster`
// also grants the species base deck). `loadSave` is used only for wholesale wipe/replace.
//
// Naming is deliberately literal about what the save can represent:
//   * "grant blueprint" — NOT "unlock species". There is no species flag; availability is
//     derived from `blueprints` (`gameTypes.ts:30-34`).
//   * "set activeOS" — NOT "unlock OS". There is no OS flag either; the candidate list is the
//     definition's static `availableOS` (`types.ts:79`) and only the per-instance `activeOS`
//     is stored. `PlayerSaveSchema` types it as a bare `z.string()`, so membership in
//     `availableOS` is a constraint only the caller can enforce — the panel offers a select.

/** Compile cost `RewardSystem.ts:107` stamps on every blueprint it rolls. */
export const BLUEPRINT_COMPILE_COST = 100;

/** Grant (or drain, with a negative amount) scrap. A drain past zero is refused by the guard. */
export function buildGrantScraps(amount: number): SaveEditAction {
    return addScrap(amount);
}

/** Grant a species blueprint. Returns null for an unknown definition id. */
export function buildGrantBlueprint(definitionId: string): SaveEditAction | null {
    const definition = MingmingRegistry[definitionId];
    if (!definition) return null;
    const blueprint: IBlueprint = {
        architectureId: definition.id,
        name: `${definition.name} Blueprint`,
        compileCost: BLUEPRINT_COMPILE_COST,
    };
    return addBlueprint(blueprint);
}

export function buildGrantRelic(relicId: string): SaveEditAction {
    return addRelic(relicId);
}

/** Grant `count` fresh copies of a card into the inventory (not the deck). */
export function buildGrantCards(dataId: string, count: number): SaveEditAction {
    const cards: IOwnedProgram[] = [];
    const total = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    for (let i = 0; i < total; i++) cards.push(createOwnedProgram(dataId));
    return addCardsToInventory(cards);
}

/**
 * Add a rostered instance. Goes through `addToRoster` rather than a hand-built save write so
 * the first synthesis of a species also grants its base deck (`gameSlice.ts:27-36`).
 */
export function buildAddToRoster(definitionId: string, level: number): SaveEditAction | null {
    if (!MingmingRegistry[definitionId]) return null;
    const safeLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
    return addToRoster(createMingmingInstance(definitionId, safeLevel));
}

export function buildSetActiveOS(mingmingId: string, activeOS: string): SaveEditAction {
    return updateMingmingOS({ id: mingmingId, activeOS });
}

/**
 * Heal the party.
 *
 * Honest label: `healParty` is a no-op on the save (`gameSlice.ts:170-176`). Roster HP is not
 * persisted — HP lives on `IBattleEntity` and is restored when a battle is entered. The one
 * HP the save *does* carry is `gauntlet.persistedStats`, and no existing action resets it
 * without also advancing `currentBattleIndex` (`updateGauntlet` only increments), so a
 * mid-gauntlet heal is out of reach without new production code. The panel says so.
 */
export function buildHealParty(): SaveEditAction {
    return healParty();
}

export function buildUnlockSector(element: string): SaveEditAction {
    return unlockSector(element);
}

export function buildGrantExperience(mingmingId: string, amount: number): SaveEditAction {
    return grantExperience({ mingmingId, amount });
}

/** Wipe to `createDefaultSave()`. */
export function buildWipeSave(): SaveEditAction {
    return resetSave();
}

/** Wholesale replace. Only ever called with a save that already passed `parseSaveFileText`. */
export function buildReplaceSave(save: IPlayerSave): SaveEditAction {
    return loadSave(save);
}
