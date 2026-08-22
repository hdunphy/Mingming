/**
 * Ticket 15's firmware reflash, as ticket 20 re-priced it and ticket 11 trimmed it.
 *
 * WHAT THIS FILE NO LONGER TESTS, AND WHY THAT IS THE POINT. Most of it was about the **one-time
 * card grant**: the first swap to an OS handed the player up to `OS_SWAP_PICK_COUNT` cards from
 * that OS's kit, keyed by `deckGrantKey(species, os)` in `baseDecksGranted`, with tests for the
 * cap, for picks outside the kit, for copy counts, and for the grant firing once ever. Ticket 11
 * deleted the grant, the constant and the key together: cards are run-scoped (`IRunState.deck`),
 * and a ranch dealing them out was dealing a resource the player cannot bring home. **A reflash
 * costs a blueprint and grants nothing**, so what is left to test is the price and the validation.
 */

import { describe, it, expect } from 'vitest';
import gameReducer, { swapOS, addToRoster, createEmptyRanch } from './gameSlice';
import { RanchStateSchema } from '../../engine/runTypes';
import type { IRanchMember, IRanchState } from '../../engine/runTypes';

const member = (id: string, definitionId: string, activeOS: string): IRanchMember => ({
    id,
    definitionId,
    nickname: 'Testling',
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
    activeOS,
});

const baseState = (): IRanchState => ({
    ...createEmptyRanch(),
    roster: [member('m1', 'kraken', 'kraken_v1')],
    blueprints: { kraken: 1 },
});

describe('Ticket 15 - swapOS', () => {
    it('spends one species blueprint, sets the OS, and grants nothing', () => {
        const after = gameReducer(baseState(), swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(after.roster[0].activeOS).toBe('kraken_v2');
        // The last blueprint of a species leaves no zero behind — an empty key would show the
        // ranch screen a species it cannot actually assemble or reflash.
        expect(after.blueprints).toEqual({});
        // The only things that changed are the OS, the count, and — since ticket 31 — the codex's
        // firmware ledger, because equipping is exactly what that ledger records. Ticket 11: there
        // is still no card inventory and no grant ledger for a stray write to land in.
        expect(after).toEqual({
            ...baseState(),
            roster: [member('m1', 'kraken', 'kraken_v2')],
            blueprints: {},
            codex: { ...baseState().codex, os: ['kraken_v2'] },
        });
        // The resulting state must survive the autosave schema.
        expect(() => RanchStateSchema.parse(after)).not.toThrow();
    });

    it('spends exactly one of a stack, leaving the rest', () => {
        const stocked: IRanchState = { ...baseState(), blueprints: { kraken: 3, fenrir: 2 } };
        const after = gameReducer(stocked, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(after.blueprints).toEqual({ kraken: 2, fenrir: 2 });
    });

    it('is a no-op when no blueprint of the species is held', () => {
        // This replaces the old "not enough scrap" case: the scrap price is gone, so a held
        // blueprint is the only thing that can now make a reflash unaffordable.
        const noBp: IRanchState = { ...baseState(), blueprints: {} };
        const after1 = gameReducer(noBp, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(after1.roster[0].activeOS).toBe('kraken_v1');

        // A blueprint of some OTHER species does not pay for this one's reflash.
        const wrongSpecies: IRanchState = { ...baseState(), blueprints: { fenrir: 5 } };
        const after2 = gameReducer(wrongSpecies, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(after2.roster[0].activeOS).toBe('kraken_v1');
        expect(after2.blueprints).toEqual({ fenrir: 5 });
    });

    it('refuses an OS the species does not have, and refuses a no-op swap, without spending', () => {
        const alien = gameReducer(baseState(), swapOS({ id: 'm1', targetOS: 'fenrir_v2' }));
        expect(alien).toEqual(baseState());

        const same = gameReducer(baseState(), swapOS({ id: 'm1', targetOS: 'kraken_v1' }));
        expect(same).toEqual(baseState());
    });

    it('swapping back and forth costs a blueprint every time', () => {
        // The old test asserted the *grant* fired once ever. What survives is the price: there is
        // no "first swap" discount or bonus any more, so three reflashes cost three blueprints.
        let s: IRanchState = { ...baseState(), blueprints: { kraken: 3 } };
        s = gameReducer(s, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(s.blueprints).toEqual({ kraken: 2 });
        s = gameReducer(s, swapOS({ id: 'm1', targetOS: 'kraken_v1' }));
        expect(s.blueprints).toEqual({ kraken: 1 });
        s = gameReducer(s, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(s.blueprints).toEqual({});
        expect(s.roster[0].activeOS).toBe('kraken_v2');
    });

    it('addToRoster adds a member and nothing else', () => {
        const after = gameReducer(createEmptyRanch(), addToRoster(member('m9', 'kraken', 'kraken_v2')));
        expect(after).toEqual({ ...createEmptyRanch(), roster: [member('m9', 'kraken', 'kraken_v2')] });
    });
});

describe('Ticket 23 - the v3 migration is gone, not relocated', () => {
    it('has no upgrade path left: a legacy save shape simply fails validation', () => {
        // Ticket 15 used to migrate bare species entries in `baseDecksGranted` to `species:os`.
        // Save v4 is the floor (Henry, 2026-08-21) — a pre-v4 blob reads as NO SAVE rather than
        // being repaired, so the only thing left to assert is that nothing pretends to fix it.
        // Ticket 11 swapped the schema doing the refusing: the autosave validates the ranch now.
        const legacy = {
            version: 2,
            roster: [{ definitionId: 'kraken', activeOS: 'kraken_v2' }],
            baseDecksGranted: ['kraken', 'fenrir', 'huldra:huldra_v1'],
        };
        expect(RanchStateSchema.safeParse(legacy).success).toBe(false);
    });
});
