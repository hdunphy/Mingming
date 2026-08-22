/**
 * Ticket 20 — the ranch's three rulings, at the reducer level.
 *
 * These are separated from `gameSlice.test.ts` because they are not "does this reducer do its
 * thing" tests: each one pins a *design ruling* that the code is the only remaining record of, and
 * each has a specific way it would silently regress.
 *
 *   1. **Assembly costs one blueprint, atomically.** The old flow was two dispatches with the
 *      affordability check living in a component. Anything between them produced a free unit.
 *   2. **Blueprints stack.** v3 deduplicated them, which is coherent for a permission and incoherent
 *      for currency.
 *   3. **No duplicate species in a party.** A standing law that no code enforced until now.
 */

import { describe, expect, it } from 'vitest';

import gameReducer, {
    addBlueprint,
    addToRoster,
    assembleMingming,
    setActiveParty,
    swapOS,
} from './gameSlice';
import { createDefaultSave } from '../../engine/gameTypes';
import type { IPlayerSave } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';

const member = (id: string, definitionId: string, activeOS?: string): IMingmingState => ({
    id,
    definitionId,
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
    ...(activeOS === undefined ? {} : { activeOS }),
});

const save = (overrides: Partial<IPlayerSave> = {}): IPlayerSave => ({ ...createDefaultSave(), ...overrides });

// --- 1. Assembly ---------------------------------------------------------------------------

describe('assembleMingming — one blueprint, atomically', () => {
    it('spends exactly one blueprint and adds the individual', () => {
        const before = save({ blueprints: { kraken: 2 }, scrapCount: 500 });

        const after = gameReducer(before, assembleMingming(member('mm1', 'kraken', 'kraken_v1')));

        expect(after.blueprints).toEqual({ kraken: 1 });
        expect(after.roster.map((m) => m.id)).toEqual(['mm1']);
        // Ticket 20 deleted the flat 100-scrap `compileCost`. Scrap is run-scoped; the ranch must
        // not touch it, and a test that only checked the blueprint would not have caught a stray
        // `state.scrapCount -=` left behind.
        expect(after.scrapCount).toBe(500);
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
        // `addToRoster` still grants the species' base deck, deliberately, so the debug scenario
        // launcher has a deck to read until ticket 09. The player-facing path must not: cards are
        // run-scoped, and ticket 08 rules that a run starts from `startKit` tags instead.
        const after = gameReducer(save({ blueprints: { kraken: 1 } }), assembleMingming(member('mm1', 'kraken', 'kraken_v1')));

        expect(after.cardInventory).toEqual([]);
        expect(after.baseDecksGranted).toEqual([]);
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

    it('a reflash costs one blueprint and no scrap', () => {
        const before = save({
            roster: [member('mm1', 'kraken', 'kraken_v1')],
            blueprints: { kraken: 2 },
            scrapCount: 500,
        });

        const after = gameReducer(before, swapOS({ id: 'mm1', targetOS: 'kraken_v2' }));

        expect(after.roster[0].activeOS).toBe('kraken_v2');
        expect(after.blueprints).toEqual({ kraken: 1 });
        expect(after.scrapCount).toBe(500);
    });

    it('refuses a reflash with no blueprint, however much scrap is lying around', () => {
        const before = save({
            roster: [member('mm1', 'kraken', 'kraken_v1')],
            blueprints: {},
            scrapCount: 9999,
        });

        const after = gameReducer(before, swapOS({ id: 'mm1', targetOS: 'kraken_v2' }));

        expect(after.roster[0].activeOS).toBe('kraken_v1');
        expect(after.scrapCount).toBe(9999);
    });
});

// --- 3. The species clause ------------------------------------------------------------------

describe('setActiveParty enforces the species clause', () => {
    const roster = [
        member('a1', 'kraken'),
        member('a2', 'kraken'),
        member('b1', 'fenrir'),
        member('c1', 'ratatoskr'),
        member('d1', 'huldra'),
    ];

    it('keeps the first of a species and drops the later duplicate', () => {
        const after = gameReducer(save({ roster }), setActiveParty(['a1', 'a2', 'b1']));
        expect(after.activeParty).toEqual(['a1', 'b1']);
    });

    it('still caps at three and still rejects ids that are not in the roster', () => {
        const after = gameReducer(save({ roster }), setActiveParty(['a1', 'b1', 'ghost', 'c1', 'd1']));
        expect(after.activeParty).toEqual(['a1', 'b1', 'c1']);
    });

    it('lets a duplicate in once the first one is out — the clause is about the party, not the roster', () => {
        let state = gameReducer(save({ roster }), setActiveParty(['a1', 'b1']));
        state = gameReducer(state, setActiveParty(['a2', 'b1']));
        expect(state.activeParty).toEqual(['a2', 'b1']);
    });

    it('does not stop the ROSTER holding two of a species', () => {
        // Re-assembly is the re-roll, so a collection full of krakens is the intended end state.
        // Only fielding them together is illegal.
        let state = save({ blueprints: { kraken: 2 } });
        state = gameReducer(state, addToRoster(member('mm1', 'kraken')));
        state = gameReducer(state, addToRoster(member('mm2', 'kraken')));
        expect(state.roster).toHaveLength(2);
    });
});
