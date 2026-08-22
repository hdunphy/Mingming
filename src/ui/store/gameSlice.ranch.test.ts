/**
 * Ticket 20 — the ranch's rulings, at the reducer level; retargeted by ticket 11.
 *
 * These are separated from `gameSlice.test.ts` because they are not "does this reducer do its
 * thing" tests: each one pins a *design ruling* that the code is the only remaining record of, and
 * each has a specific way it would silently regress.
 *
 *   1. **Assembly costs one blueprint, atomically.** The old flow was two dispatches with the
 *      affordability check living in a component. Anything between them produced a free unit.
 *   2. **Blueprints stack.** v3 deduplicated them, which is coherent for a permission and incoherent
 *      for currency.
 *
 * The third ruling this file used to cover — **no duplicate species in a party** — moved with the
 * party itself. `IRanchState` has no `activeParty` (ticket 11), so `setActiveParty` is gone and the
 * clause is tested where the rule actually lives: `engine/party.test.ts`.
 *
 * The scrap assertions below are gone for the same reason and are worth naming, because they were
 * load-bearing: several of these tests checked that a ranch transaction left `scrapCount`
 * untouched, which is exactly the kind of stray `-=` a blueprint-only assertion would miss. A ranch
 * cannot touch scrap at all now — the field is not there — so the type system makes the assertion
 * the tests were making.
 */

import { describe, expect, it } from 'vitest';

import gameReducer, {
    addBlueprint,
    addToRoster,
    assembleMingming,
    createEmptyRanch,
    swapOS,
} from './gameSlice';
import type { IRanchMember, IRanchState } from '../../engine/runTypes';

const member = (id: string, definitionId: string, activeOS?: string): IRanchMember => ({
    id,
    definitionId,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
    activeOS: activeOS ?? `${definitionId}_v1`,
});

const save = (overrides: Partial<IRanchState> = {}): IRanchState => ({ ...createEmptyRanch(), ...overrides });

// --- 1. Assembly ---------------------------------------------------------------------------

describe('assembleMingming — one blueprint, atomically', () => {
    it('spends exactly one blueprint and adds the individual', () => {
        const before = save({ blueprints: { kraken: 2 } });

        const after = gameReducer(before, assembleMingming(member('mm1', 'kraken', 'kraken_v1')));

        expect(after.blueprints).toEqual({ kraken: 1 });
        expect(after.roster.map((m) => m.id)).toEqual(['mm1']);
        // Ticket 20 deleted the flat 100-scrap `compileCost`, and ticket 11 deleted the field it
        // was charged against. The ranch touches nothing but the blueprint and the roster.
        expect(after).toEqual({ ...before, blueprints: { kraken: 1 }, roster: [member('mm1', 'kraken', 'kraken_v1')] });
    });

    it('removes the species key entirely at zero rather than leaving a 0', () => {
        // A lingering `{ kraken: 0 }` would show as an assemblable species in the Assembly bay and
        // round-trip through the save as a blueprint the player does not have.
        const after = gameReducer(save({ blueprints: { kraken: 1 } }), assembleMingming(member('mm1', 'kraken')));
        expect(after.blueprints).toEqual({});
        expect('kraken' in after.blueprints).toBe(false);
    });

    it('is a no-op with no blueprint of that species — no roster member, no negative count', () => {
        // The atomicity guarantee. The old two-dispatch flow could spend and then fail to add, or
        // add without spending; neither is reachable here.
        const before = save({ blueprints: { fenrir: 3 } });

        const after = gameReducer(before, assembleMingming(member('mm1', 'kraken')));

        expect(after.roster).toEqual([]);
        expect(after.blueprints).toEqual({ fenrir: 3 });
    });

    it('grants no cards — the start kit is a RUN thing now', () => {
        // Ticket 11 finished this: `addToRoster`'s base-deck grant is gone too, so neither the
        // player-facing path nor the debug one hands out cards. A ranch has nowhere to put them —
        // the deck is `IRunState.deck`, minted at run start from ticket 08's `startKit` tags.
        const before = save({ blueprints: { kraken: 1 } });
        const after = gameReducer(before, assembleMingming(member('mm1', 'kraken', 'kraken_v1')));

        expect(Object.keys(after).sort()).toEqual(
            ['blueprints', 'codex', 'gymsCleared', 'highestTierCleared', 'roster'],
        );
        expect(after.codex).toEqual({ seen: [], played: [] });
    });

    it('re-assembly is the re-roll: two blueprints, two distinct individuals of one species', () => {
        // `vision.md`: "two krakens are not the same kraken". The roster is allowed to hold both —
        // it is the PARTY that may not field two of a species.
        let state = save({ blueprints: { kraken: 2 } });
        state = gameReducer(state, assembleMingming(member('mm1', 'kraken')));
        state = gameReducer(state, assembleMingming(member('mm2', 'kraken')));

        expect(state.roster.map((m) => m.id)).toEqual(['mm1', 'mm2']);
        expect(state.blueprints).toEqual({});
    });
});

// --- 2. Blueprints as currency -------------------------------------------------------------

describe('blueprints are currency, not permissions', () => {
    it('stacks rather than dedupes', () => {
        let state = save();
        state = gameReducer(state, addBlueprint('kraken'));
        state = gameReducer(state, addBlueprint('kraken'));
        state = gameReducer(state, addBlueprint('fenrir'));

        expect(state.blueprints).toEqual({ kraken: 2, fenrir: 1 });
    });

    it('a reflash costs one blueprint and nothing else', () => {
        const before = save({
            roster: [member('mm1', 'kraken', 'kraken_v1')],
            blueprints: { kraken: 2 },
        });

        const after = gameReducer(before, swapOS({ id: 'mm1', targetOS: 'kraken_v2' }));

        expect(after.roster[0].activeOS).toBe('kraken_v2');
        expect(after.blueprints).toEqual({ kraken: 1 });
    });

    it('refuses a reflash with no blueprint of that species', () => {
        const before = save({
            roster: [member('mm1', 'kraken', 'kraken_v1')],
            blueprints: {},
        });

        const after = gameReducer(before, swapOS({ id: 'mm1', targetOS: 'kraken_v2' }));

        expect(after.roster[0].activeOS).toBe('kraken_v1');
    });
});

// --- 3. What the species clause does NOT constrain ------------------------------------------

describe('the roster is a collection, not a loadout', () => {
    it('holds two of a species happily', () => {
        // Re-assembly is the re-roll ("two krakens are not the same kraken"), so a collection full
        // of one species is the intended end state. Only *fielding* them together is illegal, and
        // that rule now lives entirely in `engine/party.ts` — see `party.test.ts`.
        let state = save({ blueprints: { kraken: 2 } });
        state = gameReducer(state, addToRoster(member('mm1', 'kraken')));
        state = gameReducer(state, addToRoster(member('mm2', 'kraken')));
        expect(state.roster).toHaveLength(2);
    });
});
