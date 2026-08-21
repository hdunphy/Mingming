import { describe, it, expect, vi, beforeEach } from 'vitest';
import gameReducer, { swapOS, addToRoster } from './gameSlice';
import { createDefaultSave, deckGrantKey, OS_SWAP_SCRAP_COST, OS_SWAP_PICK_COUNT } from '../../engine/gameTypes';
import { getDeckForOS } from '../../engine/data/mingmingRegistry';
import { PlayerSaveSchema, migrateSave } from '../../engine/SaveSystem';
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
        blueprints: [{ architectureId: 'kraken', name: 'Kraken Blueprint', compileCost: 50 }],
        baseDecksGranted: [deckGrantKey('kraken', 'kraken_v1')]
    } as IPlayerSave;
};

describe('Ticket 15 - swapOS', () => {
    it('spends the species blueprint + scrap, sets the OS, grants the picks, records the key', () => {
        const picks = getDeckForOS('kraken', 'kraken_v2').slice(0, 2);
        const after = gameReducer(baseState() as any, swapOS({ id: 'm1', targetOS: 'kraken_v2', pickedCardIds: picks }));
        expect(after.roster[0].activeOS).toBe('kraken_v2');
        expect(after.scrapCount).toBe(100 - OS_SWAP_SCRAP_COST);
        expect(after.blueprints).toHaveLength(0); // SPENT
        expect(after.cardInventory.map(c => c.dataId)).toEqual(picks);
        expect(after.baseDecksGranted).toContain(deckGrantKey('kraken', 'kraken_v2'));
        // The resulting state must survive the autosave schema.
        expect(() => PlayerSaveSchema.parse(after)).not.toThrow();
    });

    it('is a no-op without a blueprint, and without enough scrap', () => {
        const noBp = { ...baseState(), blueprints: [] } as IPlayerSave;
        const after1 = gameReducer(noBp as any, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(after1.roster[0].activeOS).toBe('kraken_v1');
        expect(after1.scrapCount).toBe(100);

        const poor = { ...baseState(), scrapCount: OS_SWAP_SCRAP_COST - 1 } as IPlayerSave;
        const after2 = gameReducer(poor as any, swapOS({ id: 'm1', targetOS: 'kraken_v2' }));
        expect(after2.roster[0].activeOS).toBe('kraken_v1');
        expect(after2.blueprints).toHaveLength(1);
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
        let s: any = baseState();
        s = { ...s, blueprints: [
            { architectureId: 'kraken', name: 'BP', compileCost: 50 },
            { architectureId: 'kraken', name: 'BP', compileCost: 50 },
            { architectureId: 'kraken', name: 'BP', compileCost: 50 }
        ] };
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

describe('Ticket 15 - save migration v3 (grant keying)', () => {
    it('rewrites legacy species entries to species:os using the roster member OS', () => {
        const legacy = {
            version: 2,
            roster: [{ definitionId: 'kraken', activeOS: 'kraken_v2' }],
            baseDecksGranted: ['kraken', 'fenrir', 'huldra:huldra_v1']
        };
        const out = migrateSave(legacy) as Record<string, unknown>;
        expect(out.version).toBe(3);
        expect(out.baseDecksGranted).toEqual([
            'kraken:kraken_v2',      // from the roster member's active OS
            'fenrir:fenrir_v1',      // no member -> availableOS[0]
            'huldra:huldra_v1'       // already keyed -> untouched
        ]);
    });
});
