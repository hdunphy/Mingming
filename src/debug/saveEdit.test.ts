/**
 * Tests for the ranch editor's dry-run guard.
 *
 * Two obligations, both from the ticket:
 *   1. every surviving verb produces a `RanchStateSchema`-valid ranch;
 *   2. a deliberately invalid edit is refused *before* dispatch and leaves the store untouched.
 *
 * TICKET 11 CHANGED THE SUBJECT AND SHRANK THE VERB LIST. The guard used to validate the
 * pre-roguelike slice against `PlayerSaveSchema` — which was *not* the schema the autosave ran, so
 * the dry run and the write were checking two different objects. It now runs the same schema
 * against the same object. Four verbs went with the fields they wrote: `grant scraps`,
 * `grant cards` and `grant relic` are `IRunState` concerns, `unlock sector` has no successor
 * (`gymsCleared` is a narrower claim), and `heal party` was an explicit no-op. Their invalid-input
 * cases — negative, fractional, NaN — are re-pointed at `recordTierCleared`, which is the surviving
 * numeric verb and fails the schema in exactly the same way.
 *
 * Headless — no React, and deliberately not the app store (`src/ui/store/store.ts`), whose
 * import would install the localStorage autosave subscription these tests exist to protect.
 * A throwaway `configureStore` over the same `gameSlice` reducer stands in.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import { createRanchMember } from '../engine/gameTypes';
import type { IRanchState } from '../engine/runTypes';
import { MingmingRegistry } from '../engine/data/mingmingRegistry';
import { SeedStream } from '../engine/core/SeedStream';
import gameReducer, { createEmptyRanch, markGymCleared, recordTierCleared } from '../ui/store/gameSlice';
import {
    buildAddToRoster,
    buildGrantBlueprint,
    buildReplaceSave,
    buildSetActiveOS,
    buildWipeSave,
    commitEdit,
    parseSaveFileText,
    prepareEdit,
    projectSave,
    savesAreIdentical,
    stableStringify,
    validateSave,
    type SaveEditAction,
} from './saveEdit';

/** A realistic editing baseline: one assembled individual and a blueprint or two to spend. */
function baseline(): IRanchState {
    return {
        ...createEmptyRanch(),
        roster: [createRanchMember('kraken', 'kraken_v1', new SeedStream('save-editor-test-seed'))],
        blueprints: { kraken: 2 },
    };
}

function memberId(ranch: IRanchState): string {
    return ranch.roster[0].id;
}

/** Assert an edit was allowed, and hand back the prospective ranch it validated. */
function expectAllowed(current: IRanchState, action: SaveEditAction | null): IRanchState {
    expect(action).not.toBeNull();
    const prepared = prepareEdit(current, action as SaveEditAction);
    if (!prepared.ok) {
        throw new Error(`expected edit to be allowed, got issues: ${prepared.issues.join(' | ')}`);
    }
    // The guard's whole promise: what it hands back is what the autosave will accept.
    expect(validateSave(prepared.prospective).valid).toBe(true);
    return prepared.prospective;
}

describe('validateSave', () => {
    it('accepts the ranches the game itself constructs', () => {
        expect(validateSave(createEmptyRanch()).valid).toBe(true);
        expect(validateSave(baseline()).valid).toBe(true);
    });

    it('reports the same [path] message shape the autosave logs', () => {
        const result = validateSave({ ...createEmptyRanch(), highestTierCleared: -1 });
        expect(result.valid).toBe(false);
        expect(result.issues.join('\n')).toContain('[highestTierCleared]');
    });
});

describe('each verb produces a schema-valid ranch', () => {
    it('grant blueprint (not "unlock species" — there is no species flag)', () => {
        const before = baseline();
        const after = expectAllowed(before, buildGrantBlueprint('fenrir'));
        expect(after.blueprints.fenrir).toBe((before.blueprints.fenrir ?? 0) + 1);
    });

    it('grant blueprint twice stacks, because the verb grants spendable currency', () => {
        // Ticket 20: the verb used to be a one-shot "unlock" whose second use did nothing. A
        // blueprint is spent per assembly and per OS reflash now, so granting twice has to hand
        // the debug user two of them or the panel cannot set up a two-assembly scenario.
        const before = baseline();
        const once = expectAllowed(before, buildGrantBlueprint('fenrir'));
        const twice = expectAllowed(once, buildGrantBlueprint('fenrir'));
        expect(twice.blueprints.fenrir).toBe((before.blueprints.fenrir ?? 0) + 2);
    });

    it('grant blueprint refuses an unknown species by returning no action at all', () => {
        expect(buildGrantBlueprint('not_a_species')).toBeNull();
    });

    it('add to roster — which grants nothing else, since ticket 11', () => {
        const before = baseline();
        const after = expectAllowed(before, buildAddToRoster('fenrir'));
        expect(after.roster).toHaveLength(before.roster.length + 1);
        // The base-deck grant this verb used to ride along with is gone: cards are run-scoped.
        expect(after.blueprints).toEqual(before.blueprints);
        // `IRanchMember.activeOS` is required, so the built member has to carry a real one.
        expect(after.roster.at(-1)?.activeOS).toBe(MingmingRegistry.fenrir.availableOS[0]);
    });

    it('add to roster refuses an unknown species by returning no action at all', () => {
        expect(buildAddToRoster('not_a_species')).toBeNull();
    });

    it('set activeOS (not "unlock OS" — availability is the definition\'s static list)', () => {
        const before = baseline();
        const os = MingmingRegistry[before.roster[0].definitionId].availableOS[1];
        const after = expectAllowed(before, buildSetActiveOS(memberId(before), os));
        expect(after.roster[0].activeOS).toBe(os);
    });

    it('wipe save', () => {
        const after = expectAllowed(baseline(), buildWipeSave());
        expect(savesAreIdentical(after, createEmptyRanch())).toBe(true);
    });

    it('replace ranch from file', () => {
        const replacement: IRanchState = {
            ...createEmptyRanch(),
            roster: [createRanchMember('ratatoskr', 'ratatoskr_v1', new SeedStream('replacement-seed'))],
            gymsCleared: ['gym_rootfall'],
            highestTierCleared: 1,
        };
        const after = expectAllowed(baseline(), buildReplaceSave(replacement));
        expect(savesAreIdentical(after, replacement)).toBe(true);
    });
});

describe('invalid edits are refused before dispatch', () => {
    // These used to run against `buildGrantScraps`, the numeric verb of the moment. `scrapCount` is
    // run state now, so they run against the ranch's own bounded number instead — same guard, same
    // three shapes of bad input, same `[path]` reporting.
    it('refuses a value that would go negative', () => {
        const prepared = prepareEdit(baseline(), { type: 'game/loadSave', payload: { ...baseline(), highestTierCleared: -1 } });
        expect(prepared.ok).toBe(false);
        if (!prepared.ok) expect(prepared.issues.join('\n')).toContain('[highestTierCleared]');
    });

    it('refuses a fractional count', () => {
        const prepared = prepareEdit(baseline(), { type: 'game/loadSave', payload: { ...baseline(), blueprints: { kraken: 2.5 } } });
        expect(prepared.ok).toBe(false);
    });

    it('refuses NaN, which JSON would have written as null', () => {
        const prepared = prepareEdit(baseline(), { type: 'game/loadSave', payload: { ...baseline(), highestTierCleared: Number.NaN } });
        expect(prepared.ok).toBe(false);
    });

    it('refuses a wholesale replace whose roster is not a legal ranch', () => {
        // An IV outside 0-31 is the ranch's equivalent of the old over-cap party: a value the
        // schema bounds, that a hand-edited file could plausibly carry.
        const bad = { ...createEmptyRanch(), roster: [{ ...createRanchMember('kraken'), attackIV: 99 }] } as IRanchState;
        const prepared = prepareEdit(baseline(), buildReplaceSave(bad));
        expect(prepared.ok).toBe(false);
        if (!prepared.ok) expect(prepared.issues.join('\n')).toContain('[roster.0.attackIV]');
    });

    it('a no-op reducer reports `changed: false` rather than a refusal', () => {
        // `markGymCleared` on an already-cleared gym. The panel says "the save did not change",
        // which is a different message from "refused", and both are true statements to make.
        const before: IRanchState = { ...baseline(), gymsCleared: ['gym_emberfall'] };
        const prepared = prepareEdit(before, markGymCleared('gym_emberfall'));
        expect(prepared.ok).toBe(true);
        if (prepared.ok) expect(prepared.changed).toBe(false);
    });

    it('catches a reducer that throws on a malformed payload instead of letting dispatch throw', () => {
        // `assembleMingming` reads `payload.definitionId`, so an undefined payload throws inside
        // the reducer — which is exactly the case this guard exists to catch before dispatch.
        const prepared = prepareEdit(baseline(), { type: 'game/assembleMingming', payload: undefined });
        expect(prepared.ok).toBe(false);
        if (!prepared.ok) expect(prepared.issues.join('\n')).toContain('reducer threw before any dispatch');
    });
});

describe('commitEdit never dispatches a refused edit', () => {
    function harness() {
        const store = configureStore({ reducer: { game: gameReducer } });
        store.dispatch(buildReplaceSave(baseline()));
        const dispatched: SaveEditAction[] = [];
        const dispatch = (action: SaveEditAction) => {
            dispatched.push(action);
            store.dispatch(action);
        };
        return { store, dispatched, dispatch };
    }

    it('leaves the store byte-identical when the edit is invalid', () => {
        const { store, dispatched, dispatch } = harness();
        const before = store.getState().game;

        const result = commitEdit(before, { type: 'game/loadSave', payload: { ...before, highestTierCleared: -999 } }, dispatch);

        expect(result.ok).toBe(false);
        expect(dispatched).toHaveLength(0);
        // Reference identity, not just deep equality: no reducer ran at all, so no
        // subscriber fired and no autosave was attempted.
        expect(store.getState().game).toBe(before);
    });

    it('dispatches a valid edit, and the store lands on exactly the state that was validated', () => {
        const { store, dispatched, dispatch } = harness();
        const before = store.getState().game;

        const result = commitEdit(before, recordTierCleared(3), dispatch);

        expect(result.ok).toBe(true);
        expect(dispatched).toHaveLength(1);
        const after = store.getState().game;
        expect(after).not.toBe(before);
        expect(validateSave(after).valid).toBe(true);
        if (result.ok) expect(savesAreIdentical(result.prospective, after)).toBe(true);
    });

    it('the dry run is now EXACT, not merely exact up to id values', () => {
        // The two reducers that minted `crypto.randomUUID()` ids internally were `addToRoster`'s
        // base-deck grant and `addCardsToDeck`; ticket 11 deleted both, so the projected state and
        // the dispatched state are byte-identical rather than schema-equivalent.
        const { store, dispatch } = harness();
        const before = store.getState().game;
        const action = buildAddToRoster('fenrir') as SaveEditAction;
        const result = commitEdit(before, action, dispatch);
        expect(result.ok).toBe(true);
        if (result.ok) expect(store.getState().game).toEqual(result.prospective);
    });
});

describe('projection is side-effect free', () => {
    it('does not mutate the ranch it was given', () => {
        const before = baseline();
        const snapshot = stableStringify(before);

        projectSave(before, recordTierCleared(5));
        projectSave(before, markGymCleared('gym_tidewrack'));
        prepareEdit(before, buildAddToRoster('fenrir') as SaveEditAction);

        expect(stableStringify(before)).toBe(snapshot);
    });
});

describe('parseSaveFileText', () => {
    it('accepts a current-version ranch', () => {
        const result = parseSaveFileText(JSON.stringify(baseline()));
        expect(result.ok).toBe(true);
        if (result.ok) expect(savesAreIdentical(result.save, baseline())).toBe(true);
    });

    it('fills omitted optional fields and flags that it did (ticket 23: default, never migrate)', () => {
        // The upgrade chain is gone — save v4 is the floor. What survives is `RanchStateSchema`'s
        // `.default()` fills, which handle a file that simply omits an optional field. That is a
        // different guarantee from migration and the flag says so.
        const sparse = { roster: [] };
        const result = parseSaveFileText(JSON.stringify(sparse));
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.defaulted).toBe(true);
            expect(result.save.gymsCleared).toEqual([]);
            expect(result.save.highestTierCleared).toBe(0);
            // Ticket 31 added three more ledgers, each with its own `.default([])` — which is
            // exactly the guarantee this test is about: a file that omits a field gets the empty
            // one, and nothing migrates.
            expect(result.save.codex).toEqual({ seen: [], played: [], species: [], assembled: [], os: [] });
            expect(result.save.codexMilestones).toEqual([]);
            // Ticket 20: the fill is an empty COUNT MAP, not an empty list.
            expect(result.save.blueprints).toEqual({});
        }
    });

    it('rejects a malformed field instead of silently emptying it', () => {
        // The `.catch([])` -> `.default([])` swap (ticket 23). Under `.catch` this parsed clean
        // with an EMPTY blueprint map, and the next autosave wrote that emptiness over the good
        // save. Blueprints are the only persistent currency in the game; that is data loss.
        // Ticket 20 changed what "malformed" looks like: a negative count rather than a
        // half-written blueprint object, since a count is all that is stored now.
        const corrupt = { ...baseline(), blueprints: { kraken: -1 } };
        expect(parseSaveFileText(JSON.stringify(corrupt)).ok).toBe(false);
    });

    it('rejects non-JSON', () => {
        const result = parseSaveFileText('{ not json');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.issues.join('\n')).toContain('not valid JSON');
    });

    it('rejects JSON that is not a ranch', () => {
        const result = parseSaveFileText('{"hello":"world"}');
        expect(result.ok).toBe(false);
    });
});

describe('stableStringify', () => {
    it('ignores key order, so a schema round-trip does not read as a change', () => {
        expect(stableStringify({ a: 1, b: [2, { c: 3, d: 4 }] })).toBe(
            stableStringify({ b: [2, { d: 4, c: 3 }], a: 1 }),
        );
    });

    it('still distinguishes real differences', () => {
        expect(savesAreIdentical({ a: 1 }, { a: 2 })).toBe(false);
        expect(savesAreIdentical([1, 2], [2, 1])).toBe(false);
    });
});
