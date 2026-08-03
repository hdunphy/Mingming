/**
 * Tests for the save editor's dry-run guard.
 *
 * Two obligations, both from the ticket:
 *   1. every v1 verb produces a `PlayerSaveSchema`-valid save;
 *   2. a deliberately invalid edit is refused *before* dispatch and leaves the store untouched.
 *
 * Headless — no React, and deliberately not the app store (`src/ui/store/store.ts`), whose
 * import would install the localStorage autosave subscription these tests exist to protect.
 * A throwaway `configureStore` over the same `gameSlice` reducer stands in.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import { createDefaultSave, createStarterSave } from '../engine/gameTypes';
import type { IPlayerSave } from '../engine/gameTypes';
import { getExpForLevel } from '../engine/types';
import { MingmingRegistry } from '../engine/data/mingmingRegistry';
import gameReducer from '../ui/store/gameSlice';
import {
    buildAddToRoster,
    buildGrantBlueprint,
    buildGrantCards,
    buildGrantExperience,
    buildGrantRelic,
    buildGrantScraps,
    buildHealParty,
    buildReplaceSave,
    buildSetActiveOS,
    buildUnlockSector,
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

/** A starter save is the realistic editing baseline: one rostered unit, a deck, some scrap. */
function baseline(): IPlayerSave {
    return createStarterSave('kraken', 'save-editor-test-seed');
}

function memberId(save: IPlayerSave): string {
    return save.roster[0].id;
}

/** Assert an edit was allowed, and hand back the prospective save it validated. */
function expectAllowed(current: IPlayerSave, action: SaveEditAction | null): IPlayerSave {
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
    it('accepts the saves the game itself constructs', () => {
        expect(validateSave(createDefaultSave()).valid).toBe(true);
        expect(validateSave(baseline()).valid).toBe(true);
    });

    it('reports the same [path] message shape the autosave logs', () => {
        const result = validateSave({ ...createDefaultSave(), scrapCount: -1 });
        expect(result.valid).toBe(false);
        expect(result.issues.join('\n')).toContain('[scrapCount]');
    });
});

describe('v1 verbs each produce a schema-valid save', () => {
    it('grant scraps', () => {
        const before = baseline();
        const after = expectAllowed(before, buildGrantScraps(250));
        expect(after.scrapCount).toBe(before.scrapCount + 250);
    });

    it('grant blueprint (not "unlock species" — there is no species flag)', () => {
        const before = baseline();
        const after = expectAllowed(before, buildGrantBlueprint('fenrir'));
        expect(after.blueprints.map((b) => b.architectureId)).toContain('fenrir');
        expect(after.blueprints[0].compileCost).toBeGreaterThanOrEqual(0);
    });

    it('grant blueprint refuses an unknown species by returning no action at all', () => {
        expect(buildGrantBlueprint('not_a_species')).toBeNull();
    });

    it('grant relic', () => {
        const after = expectAllowed(baseline(), buildGrantRelic('expansion_slot'));
        expect(after.relics).toContain('expansion_slot');
    });

    it('grant cards', () => {
        const before = baseline();
        const after = expectAllowed(before, buildGrantCards('cinder_slash', 3));
        expect(after.cardInventory).toHaveLength(before.cardInventory.length + 3);
        expect(after.cardInventory.slice(-3).every((c) => c.dataId === 'cinder_slash')).toBe(true);
        // Instance ids must stay unique — duplicates would break deck references.
        const ids = new Set(after.cardInventory.map((c) => c.instanceId));
        expect(ids.size).toBe(after.cardInventory.length);
    });

    it('add to roster, and the base-deck grant that rides along with it', () => {
        const before = baseline();
        const after = expectAllowed(before, buildAddToRoster('fenrir', 12));
        expect(after.roster).toHaveLength(before.roster.length + 1);
        expect(after.roster[after.roster.length - 1].level).toBe(12);
        // addToRoster is preferred over a hand-built write precisely because of this:
        expect(after.baseDecksGranted).toContain('fenrir');
        expect(after.cardInventory.length).toBe(
            before.cardInventory.length + MingmingRegistry['fenrir'].baseDeck.length,
        );
    });

    it('set activeOS (not "unlock OS" — availability is the definition\'s static list)', () => {
        const before = baseline();
        const os = MingmingRegistry[before.roster[0].definitionId].availableOS[1];
        const after = expectAllowed(before, buildSetActiveOS(memberId(before), os));
        expect(after.roster[0].activeOS).toBe(os);
    });

    it('heal party — valid, and honestly a no-op on the save', () => {
        const before = baseline();
        const prepared = prepareEdit(before, buildHealParty());
        expect(prepared.ok).toBe(true);
        if (prepared.ok) {
            expect(validateSave(prepared.prospective).valid).toBe(true);
            expect(prepared.changed).toBe(false);
        }
    });

    it('unlock sector', () => {
        const before = baseline();
        expect(before.unlockedSectors).not.toContain('Ice');
        const after = expectAllowed(before, buildUnlockSector('Ice'));
        expect(after.unlockedSectors).toContain('Ice');
    });

    it('unlock sector is a no-op when already unlocked', () => {
        const before = baseline();
        const prepared = prepareEdit(before, buildUnlockSector(before.unlockedSectors[0]));
        expect(prepared.ok).toBe(true);
        if (prepared.ok) expect(prepared.changed).toBe(false);
    });

    it('grant XP, running the same level-up loop the battle path uses', () => {
        const before = baseline();
        const after = expectAllowed(before, buildGrantExperience(memberId(before), getExpForLevel(9)));
        expect(after.roster[0].level).toBeGreaterThan(before.roster[0].level);
        expect(after.roster[0].experience).toBe(before.roster[0].experience + getExpForLevel(9));
    });

    it('wipe save', () => {
        const after = expectAllowed(baseline(), buildWipeSave());
        expect(savesAreIdentical(after, createDefaultSave())).toBe(true);
    });

    it('replace save from file', () => {
        const replacement = createStarterSave('ratatoskr', 'replacement-seed');
        const after = expectAllowed(baseline(), buildReplaceSave(replacement));
        expect(savesAreIdentical(after, replacement)).toBe(true);
    });
});

describe('invalid edits are refused before dispatch', () => {
    it('refuses a scrap drain that would go negative', () => {
        const before = baseline();
        const prepared = prepareEdit(before, buildGrantScraps(-(before.scrapCount + 1)));
        expect(prepared.ok).toBe(false);
        if (!prepared.ok) expect(prepared.issues.join('\n')).toContain('[scrapCount]');
    });

    it('refuses a fractional scrap grant', () => {
        const prepared = prepareEdit(baseline(), buildGrantScraps(2.5));
        expect(prepared.ok).toBe(false);
    });

    it('refuses NaN, which JSON would have written as null', () => {
        const prepared = prepareEdit(baseline(), buildGrantScraps(Number.NaN));
        expect(prepared.ok).toBe(false);
    });

    it('refuses a wholesale replace whose activeParty exceeds the cap', () => {
        const bad = { ...createDefaultSave(), activeParty: ['a', 'b', 'c', 'd'] } as IPlayerSave;
        const prepared = prepareEdit(baseline(), buildReplaceSave(bad));
        expect(prepared.ok).toBe(false);
        if (!prepared.ok) expect(prepared.issues.join('\n')).toContain('[activeParty]');
    });

    it('catches a reducer that throws on a malformed payload instead of letting dispatch throw', () => {
        const prepared = prepareEdit(baseline(), { type: 'game/addToRoster', payload: undefined });
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

        const result = commitEdit(before, buildGrantScraps(-999999), dispatch);

        expect(result.ok).toBe(false);
        expect(dispatched).toHaveLength(0);
        // Reference identity, not just deep equality: no reducer ran at all, so no
        // subscriber fired and no autosave was attempted.
        expect(store.getState().game).toBe(before);
    });

    it('dispatches a valid edit, and the store lands on exactly the state that was validated', () => {
        const { store, dispatched, dispatch } = harness();
        const before = store.getState().game;

        const result = commitEdit(before, buildGrantScraps(75), dispatch);

        expect(result.ok).toBe(true);
        expect(dispatched).toHaveLength(1);
        const after = store.getState().game;
        expect(after).not.toBe(before);
        expect(validateSave(after).valid).toBe(true);
        if (result.ok) expect(savesAreIdentical(result.prospective, after)).toBe(true);
    });
});

describe('projection is side-effect free', () => {
    it('does not mutate the save it was given', () => {
        const before = baseline();
        const snapshot = stableStringify(before);

        projectSave(before, buildGrantScraps(500));
        projectSave(before, buildUnlockSector('Dark'));
        prepareEdit(before, buildAddToRoster('fenrir', 3) as SaveEditAction);

        expect(stableStringify(before)).toBe(snapshot);
    });
});

describe('parseSaveFileText', () => {
    it('accepts a current-version save', () => {
        const result = parseSaveFileText(JSON.stringify(baseline()));
        expect(result.ok).toBe(true);
        if (result.ok) expect(savesAreIdentical(result.save, baseline())).toBe(true);
    });

    it('migrates an older save shape rather than rejecting it wholesale', () => {
        const legacy = {
            version: 1,
            roster: [],
            activeParty: [],
            cardInventory: [],
            activeDeck: null,
            scrapCount: 10,
            baseDecksGranted: [],
        };
        const result = parseSaveFileText(JSON.stringify(legacy));
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.migrated).toBe(true);
            expect(result.save.version).toBe(2);
            expect(result.save.unlockedSectors).toEqual([]);
        }
    });

    it('rejects non-JSON', () => {
        const result = parseSaveFileText('{ not json');
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.issues.join('\n')).toContain('not valid JSON');
    });

    it('rejects JSON that is not a save', () => {
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
