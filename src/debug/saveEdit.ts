/**
 * Ranch editor — the dry-run guard.
 *
 * WHY THIS MODULE EXISTS
 *
 * `src/ui/store/store.ts` autosaves on *every* game-state change by calling `saveRanch`, which
 * validates against `RanchStateSchema` (`runTypes.ts`). A ranch that fails validation is not
 * written — the failure surfaces as a `console.error` and a `saveHealth` report and nothing else.
 * Progress silently stops persisting and the player finds out on the next reload, having lost
 * everything since the wedge.
 *
 * A debug editor is the single most likely source of such a state, so every mutation it performs
 * goes through `prepareEdit`/`commitEdit` here: the prospective ranch is computed *without
 * dispatching* and validated first. Validating after the dispatch would be racing the very
 * subscription this guards — by the time the check ran, the bad state would already be live and the
 * autosave already failed.
 *
 * TICKET 11 CHANGED WHAT IS BEING VALIDATED, WHICH IS THE POINT OF THE FILE
 *
 * The check used to be `PlayerSaveSchema` — the pre-roguelike slice shape, which was *not* the
 * thing being persisted; `save/ranchProjection.ts` translated on the way out, so the dry run and
 * the autosave were validating two different objects against two different schemas. It now runs
 * exactly the schema the autosave runs, against exactly the object the autosave writes. The verbs
 * that granted run-scoped things (scrap, cards, relics, sector unlocks) went with the fields —
 * a ranch cannot hold them, so there was nothing left for those buttons to write.
 *
 * HOW THE PROSPECTIVE RANCH IS COMPUTED WITHOUT DISPATCHING
 *
 * `gameSlice`'s reducer is a pure function of (state, action). `projectSave` calls it
 * directly — `gameReducer(current, action)` — outside any store. Immer's copy-on-write
 * means the live state object is never mutated, no subscriber runs, and no autosave fires.
 * The *same* action object is then handed to `dispatch`, so the store recomputes exactly
 * the state that was validated.
 *
 * The dry run is now *exact*, where before it was only exact up to id values: the two reducers
 * that minted ids internally with `crypto.randomUUID()` were `addToRoster`'s base-deck grant and
 * `addCardsToDeck`, and ticket 11 deleted both. Nothing in the slice is non-deterministic any more.
 *
 * Everything here is React-free and store-free on purpose, so it is testable headlessly.
 */

import { z } from 'zod';

import { MingmingRegistry } from '../engine/data/mingmingRegistry';
import { createRanchMember } from '../engine/gameTypes';
import { RanchStateSchema, type IRanchState } from '../engine/runTypes';
import gameReducer, {
    addBlueprint,
    addToRoster,
    loadSave,
    resetSave,
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
 * Run the exact check the autosave runs — `RanchStateSchema`, the inner half of what `saveRanch`
 * parses. Used both to vet a prospective ranch and to report whether the *current* one is already
 * wedged.
 */
export function validateSave(candidate: unknown): SaveValidation {
    try {
        RanchStateSchema.parse(candidate);
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
export function projectSave(current: IRanchState, action: SaveEditAction): IRanchState {
    // gameReducer is typed against redux's UnknownAction; SaveEditAction satisfies it structurally.
    return gameReducer(current, action);
}

export type PreparedEdit =
    | {
          readonly ok: true;
          readonly action: SaveEditAction;
          /** The save the store will hold after dispatch. Already schema-valid. */
          readonly prospective: IRanchState;
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
export function prepareEdit(current: IRanchState, action: SaveEditAction): PreparedEdit {
    let prospective: IRanchState;
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
    current: IRanchState,
    action: SaveEditAction,
    dispatch: (action: SaveEditAction) => void,
): PreparedEdit {
    const prepared = prepareEdit(current, action);
    if (prepared.ok) dispatch(action);
    return prepared;
}

// --- Comparison / persistence check ---

/**
 * Key-order-independent JSON. `RanchStateSchema.parse` rebuilds objects in *schema* key order,
 * so a ranch round-tripped through `loadGameState` will not stringify identically to the live
 * state even when nothing changed. Sorting keys makes the comparison mean what it looks like.
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
    | {
        readonly ok: true;
        readonly save: IRanchState;
        /**
         * True when validation filled in fields the file did not carry, so the panel can say
         * "loaded, with defaults applied" rather than implying a byte-for-byte restore.
         *
         * This used to mean "an older save shape was upgraded". Ticket 23 deleted the upgrade
         * chain — save v4 is the floor and there is no migration — so the only difference a parse
         * can now introduce is `RanchStateSchema`'s `.default()` fills.
         */
        readonly defaulted: boolean;
    }
    | { readonly ok: false; readonly issues: ReadonlyArray<string> };

/**
 * Read path for "replace save from file": JSON.parse -> validate. **Validate, never migrate**
 * (ticket 23) — a file that does not describe a legal ranch is rejected with its issues rather than
 * silently reshaped into one.
 *
 * Ticket 11: the file is a bare `IRanchState`, not an envelope and not a whole game state. The run
 * has no import path here on purpose — a hand-edited run is the half the design is happy to throw
 * away, and `reconcileLoadedState` would discard a mismatched one anyway.
 */
export function parseSaveFileText(text: string): SaveFileParse {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (err) {
        return { ok: false, issues: [`not valid JSON: ${String(err)}`] };
    }

    const validation = validateSave(raw);
    if (!validation.valid) return { ok: false, issues: validation.issues };

    const parsed = RanchStateSchema.parse(raw) as IRanchState;
    return {
        ok: true,
        save: parsed,
        defaulted: !savesAreIdentical(raw, parsed),
    };
}

// --- Verb builders ---
//
// Each returns the action a real game capability would dispatch — existing `gameSlice` actions
// wherever one exists, so the edit inherits the game's own logic.
//
// TICKET 11 DELETED FOUR VERBS, AND THE REASON IS THE SAME EACH TIME: **the ranch cannot hold what
// they granted.** `grant scraps`, `grant cards` and `grant relic` wrote `scrapCount`,
// `cardInventory` and `relics`, all three of which are `IRunState` fields now; `unlock sector`
// wrote `unlockedSectors`, whose successor `gymsCleared` means "gyms you beat" rather than "places
// you may go", so granting one would be claiming a clear that never happened. `heal party` went
// too — it was an explicit no-op placeholder, and the one HP the save carries is
// `IGauntletProgress.persistedHp`, which is ticket 18's. Their run-side replacements live on
// `runSlice` (`addRunScrap`, `addRunCards`, `addDriver`) and want a run editor, which is a
// different panel than this one.
//
// Naming is deliberately literal about what the ranch can represent:
//   * "grant blueprint" — NOT "unlock species". There is no species flag; availability is
//     derived from `blueprints` counts.
//   * "set activeOS" — NOT "unlock OS". There is no OS flag either; the candidate list is the
//     definition's static `availableOS` (`types.ts`) and only the per-instance `activeOS` is
//     stored. `RanchMemberSchema` types it as a bare `z.string()`, so membership in `availableOS`
//     is a constraint only the caller can enforce — the panel offers a select.

/**
 * Grant a species blueprint. Returns null for an unknown definition id.
 *
 * Ticket 20: blueprints are counts, so this STACKS — granting twice gives you two, which is the
 * point now that one is spent per assembly.
 */
export function buildGrantBlueprint(definitionId: string): SaveEditAction | null {
    const definition = MingmingRegistry[definitionId];
    if (!definition) return null;
    return addBlueprint(definition.id);
}

/**
 * Add a rostered individual, free. Goes through `addToRoster` rather than a hand-built state write
 * so the debug path and the game path stay one path — note that ticket 11 removed that reducer's
 * base-deck grant, so this now adds a member and nothing else.
 */
export function buildAddToRoster(definitionId: string): SaveEditAction | null {
    if (!MingmingRegistry[definitionId]) return null;
    return addToRoster(createRanchMember(definitionId));
}

export function buildSetActiveOS(mingmingId: string, activeOS: string): SaveEditAction {
    return updateMingmingOS({ id: mingmingId, activeOS });
}

/** Wipe to an empty ranch (`createEmptyRanch()`). */
export function buildWipeSave(): SaveEditAction {
    return resetSave();
}

/** Wholesale replace. Only ever called with a ranch that already passed `parseSaveFileText`. */
export function buildReplaceSave(ranch: IRanchState): SaveEditAction {
    return loadSave(ranch);
}
