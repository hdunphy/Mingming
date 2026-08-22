import { describe, it, expect, vi, beforeEach } from 'vitest';
import gameReducer, { swapOS, addToRoster } from './gameSlice';
import { createDefaultSave, deckGrantKey, OS_SWAP_PICK_COUNT } from '../../engine/gameTypes';
import { getDeckForOS } from '../../engine/data/mingmingRegistry';
import { PlayerSaveSchema } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';
import type { IPlayerSave } from '../../engine/gameTypes';

// Deterministic instance ids for assertions
let uuidCounter = 0;
beforeEach(() => {
    uuidCounter = 0;
    vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID: () => `uuid-${uuidCounter++}` });
});

const member = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id,
    definitionId,
    nickname: 'Testling',
    currentHp: 50,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
    activeOS,
    blueprintsCollected: 0
} as unknown as IMingmingState);

const baseState = (): IPlayerSave => {
    const s = createDefaultSave() as IPlayerSave;
    return {
        ...s,
        scrapCount: 100,
        roster: [member('m1', 'kraken', 'kraken_v1')],
        blueprints: { kraken: 1 },
        baseDecksGranted: [deckGrantKey('kraken', 'kraken_v1')]
    } as IPlayerSave;
};

describe('Ticket 15 - swapOS', () => {
    it('spends one species blueprint and no scrap, sets the OS, grants the picks, records the key', () => {
        const picks = getDeckForOS('kraken', 'kraken_v2').slice(0, 2);
        const after = gameReducer(baseState() as any, swapOS({ id: 'm1', targetOS: 'kraken_v2', pickedCardIds: picks }));
        expect(after.roster[0].activeOS).toBe('kraken_v2');
        // Ticket 20 re-priced the reflash: one blueprint, and `OS_SWAP_SCRAP_COST` is deleted
        // outright, because scrap is run-scoped and a ranch that charges it is charging a
        // currency the player cannot carry home.
        expect(after.scrapCount).toBe(100);
        // The last blueprint of a species leaves no zero behind — an empty key would show the
        // ranch screen a species it cannot actually assemble or reflash.
        expect(after.blueprints).toEqual({});
        expect(after.cardInventory.map(c => c.dataId)).toEqual(picks);
        expect(after.baseDecksGranted).toContain(deckGrantKey('kraken', 'kraken_v2'));
        // The resulting state must survive the autosave schema.
        expect(() => PlayerSaveSchema.parse(after)).not.toThrow();
    });

    it('spends exactly one of a stack, leaving the rest', () => {
        const stocked = { ...baseState(), blueprints: { kraken: 3, fenrir: 2 } } as IPlayerSave;
        const after = gameReducer(stocked as any, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(after.blueprints).toEqual({ kraken: 2, fenrir: 2 });
    });

    it('is a no-op when no blueprint of the species is held', () => {
        // This replaces the old "not enough scrap" case: the scrap price is gone, so a held
        // blueprint is the only thing that can now make a reflash unaffordable.
        const noBp = { ...baseState(), blueprints: {} } as IPlayerSave;
        const after1 = gameReducer(noBp as any, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(after1.roster[0].activeOS).toBe('kraken_v1');
        expect(after1.cardInventory).toHaveLength(0);
        expect(after1.baseDecksGranted).not.toContain(deckGrantKey('kraken', 'kraken_v2'));

        // A blueprint of some OTHER species does not pay for this one's reflash.
        const wrongSpecies = { ...baseState(), blueprints: { fenrir: 5 } } as IPlayerSave;
        const after2 = gameReducer(wrongSpecies as any, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(after2.roster[0].activeOS).toBe('kraken_v1');
        expect(after2.blueprints).toEqual({ fenrir: 5 });
    });

    it('caps picks at OS_SWAP_PICK_COUNT, rejects cards outside the kit, respects copy counts', () => {
        const kit = getDeckForOS('kraken', 'kraken_v2'); // capacitor appears twice
        const greedy = [...kit.slice(0, OS_SWAP_PICK_COUNT), kit[3], 'fire_poke'];
        const after = gameReducer(baseState() as any, swapOS({ id: 'm1', targetOS: 'kraken_v2', pickedCardIds: greedy }));
        expect(after.cardInventory).toHaveLength(OS_SWAP_PICK_COUNT);
        expect(after.cardInventory.every(c => kit.includes(c.dataId))).toBe(true);

        // Two copies of the same card are only grantable if the kit lists it twice.
        const singles = gameReducer(baseState() as any, swapOS({ id: 'm1', targetOS: 'kraken_v2', pickedCardIds: ['maelstrom', 'maelstrom'] }));
        expect(singles.cardInventory.filter(c => c.dataId === 'maelstrom')).toHaveLength(1);
        const doubles = gameReducer(baseState() as any, swapOS({ id: 'm1', targetOS: 'kraken_v2', pickedCardIds: ['capacitor', 'capacitor'] }));
        expect(doubles.cardInventory.filter(c => c.dataId === 'capacitor')).toHaveLength(2);
    });

    it('the pick grant fires once ever per OS - a swap back and forth gives nothing new', () => {
        // Three swaps, three blueprints — one per reflash (ticket 20).
        let s: any = baseState();
        s = { ...s, blueprints: { kraken: 3 } };
        s = gameReducer(s, swapOS({ id: 'm1', targetOS: 'kraken_v2', pickedCardIds: ['maelstrom'] }));
        expect(s.cardInventory).toHaveLength(1);
        s = gameReducer(s, swapOS({ id: 'm1', targetOS: 'kraken_v1', pickedCardIds: ['ink_stream'] }));
        // kraken_v1 kit was granted at compile time (key present) -> no new cards.
        expect(s.cardInventory).toHaveLength(1);
        s = gameReducer(s, swapOS({ id: 'm1', targetOS: 'kraken_v2', pickedCardIds: ['hydro_blast'] }));
        // v2 key recorded on the first swap -> no new cards either.
        expect(s.cardInventory).toHaveLength(1);
    });

    it('compile-time grants are keyed per species+OS (addToRoster)', () => {
        const empty = { ...(createDefaultSave() as IPlayerSave), scrapCount: 0 };
        const after = gameReducer(empty as any, addToRoster(member('m9', 'kraken', 'kraken_v2')));
        expect(after.baseDecksGranted).toContain(deckGrantKey('kraken', 'kraken_v2'));
        expect(after.cardInventory.map(c => c.dataId).sort()).toEqual([...getDeckForOS('kraken', 'kraken_v2')].sort());
    });
});

describe('Ticket 23 - the v3 migration is gone, not relocated', () => {
    it('has no upgrade path left: a legacy save shape simply fails validation', () => {
        // Ticket 15 used to migrate bare species entries in `baseDecksGranted` to `species:os`.
        // Save v4 is the floor (Henry, 2026-08-21) — a pre-v4 blob reads as NO SAVE rather than
        // being repaired, so the only thing left to assert is that nothing pretends to fix it.
        const legacy = {
            version: 2,
            roster: [{ definitionId: 'kraken', activeOS: 'kraken_v2' }],
            baseDecksGranted: ['kraken', 'fenrir', 'huldra:huldra_v1']
        };
        expect(PlayerSaveSchema.safeParse(legacy).success).toBe(false);
    });
});
