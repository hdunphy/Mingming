/**
 * TICKET 185e — **THE RUN REMEMBERS WHAT ITS LAST TWO CARD PICKS SHOWED.**
 *
 * The engine decides what to leave out (`rewards/recentOffers`); this reducer is the only thing that
 * knows a pick happened. Tested apart for the reason the pity counter is: an engine that honours the
 * memory is useless if nothing writes it, and the memory must survive a save or a resume would offer
 * cards the uninterrupted run would not have.
 */
import fs from 'node:fs';
import path from 'node:path';
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import { createEmptyRanch } from './gameSlice';
import runReducer, { recordCardOffer, setRun } from './runSlice';
import { rollDropTable } from '../../engine/RewardSystem';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { loadGameState, saveRanch, saveRun } from '../../engine/SaveSystem';
import { setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import { RunStateSchema } from '../../engine/runTypes';
import { createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import { applyChoice } from '../events/applyOutcome';
import type { IMingmingState } from '../../engine/types';

class MemoryStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    read(k: string) { return this.data.get(k) ?? null; }
    write(k: string, v: string) { this.data.set(k, v); }
    remove(k: string) { this.data.delete(k); }
    keys() { return [...this.data.keys()]; }
}

const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'fenrir', activeOS: 'fenrir_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const ROSTER = [{ id: 'mm1', definitionId: 'fenrir', activeOS: 'fenrir_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }];

const freshRun = () => createRun({ seed: 'recent', offer: offerGyms('recent-offer')[0], party: [MEMBER], startedAt: 0 });
const store = () => {
    const s = configureStore({ reducer: { run: runReducer } });
    s.dispatch(setRun(freshRun()));
    return s;
};
const recent = (s: ReturnType<typeof store>) => s.getState().run.run?.recentOffers;

describe('recentOffers on the run', () => {
    it('starts a run with nothing remembered', () => {
        expect(recent(store())).toEqual([]);
    });

    it('keeps the last two picks, oldest first', () => {
        const s = store();
        s.dispatch(recordCardOffer(['a', 'b', 'c']));
        expect(recent(s)).toEqual([['a', 'b', 'c']]);
        s.dispatch(recordCardOffer(['d', 'e', 'f']));
        s.dispatch(recordCardOffer(['g', 'h', 'i']));
        expect(recent(s)).toEqual([['d', 'e', 'f'], ['g', 'h', 'i']]);
    });

    it('is a no-op outside a run', () => {
        const s = configureStore({ reducer: { run: runReducer } });
        s.dispatch(recordCardOffer(['a']));
        expect(s.getState().run.run).toBeNull();
    });

    it('survives a save and a load', () => {
        setSaveStorage(new MemoryStorage());
        const s = store();
        s.dispatch(recordCardOffer(['a', 'b', 'c']));
        s.dispatch(recordCardOffer(['d', 'e', 'f']));
        // The ranch goes down first so the run is not discarded by reconciliation (see the pity test).
        expect(saveRanch({ ...createEmptyRanch(), roster: ROSTER }).success).toBe(true);
        expect(saveRun(s.getState().run.run).success).toBe(true);
        const loaded = loadGameState();
        expect(loaded.discarded).toBeUndefined();
        expect(loaded.run?.recentOffers).toEqual([['a', 'b', 'c'], ['d', 'e', 'f']]);
    });

    it('reads a save from before the field as nothing remembered', () => {
        const { recentOffers: _dropped, ...withoutField } = freshRun();
        void _dropped;
        expect(RunStateSchema.parse(withoutField).recentOffers).toEqual([]);
    });
});

describe('recentOffers, closed against the roll', () => {
    const corpse = () => createSparseEntity({ id: 'e0', definitionId: 'fyrbot', name: 'Foe', currentHp: 0 });

    it('a run of consecutive fights never shows a card from either of the last two picks', () => {
        const s = store();
        const history: string[][] = [];
        for (let fight = 0; fight < 30; fight += 1) {
            const run = s.getState().run.run!;
            const offer = rollDropTable({
                defeated: [corpse()], nodeKind: 'wild', party: [MEMBER], seed: `loop-${fight}`,
                ownedCardIds: [], recentOffers: run.recentOffers,
            }).cardChoices[0].options.map((o) => o.dataId);
            for (const earlier of history.slice(-2)) {
                for (const id of offer) expect(earlier, `fight ${fight} repeated ${id}`).not.toContain(id);
            }
            history.push(offer);
            s.dispatch(recordCardOffer(offer));
        }
    });
});

describe('an event card pick leaves its offer behind', () => {
    it('records the offer it showed when the pick is applied, whichever card was taken', () => {
        const s = store();
        const run = s.getState().run.run!;
        const node = run.nodes[0];
        const choice = { id: 'c', label: 'Take', detail: '', outcomes: [{ type: 'CARD_PICK' as const, count: 3, rarities: ['Common' as const] }] };
        const offered = ['a', 'b', 'c'];
        applyChoice(s.dispatch, { run, node }, { id: 'evt' }, choice, { 0: { cardId: 'b', toCollection: false, offered } });
        expect(recent(s)).toEqual([offered]);
        expect(s.getState().run.run!.deck.map((c) => c.dataId)).toContain('b');
    });

    it('records nothing for a pick that carries no offer (an older caller)', () => {
        const s = store();
        const run = s.getState().run.run!;
        const choice = { id: 'c', label: 'Take', detail: '', outcomes: [{ type: 'CARD_PICK' as const, count: 3, rarities: ['Common' as const] }] };
        applyChoice(s.dispatch, { run, node: run.nodes[0] }, { id: 'evt' }, choice, { 0: { cardId: 'b', toCollection: false } });
        expect(recent(s)).toEqual([]);
    });
});

describe('the arena\'s wiring (a crude guard, like the collection browser\'s)', () => {
    // BattleArena is not rendered here (it drags in the whole battle UI); what is being guarded is
    // deletion: the roll reads the memory and the claim writes it, and either half missing is silent.
    const arena = fs.readFileSync(path.join('src', 'ui', 'components', 'BattleArena.tsx'), 'utf8');

    it('hands the run\'s cards and recent offers to the roll', () => {
        expect(arena).toMatch(/ownedCardIds,\s*\n\s*recentOffers,/);
    });

    it('records each claimed pick\'s offer, taken or skipped', () => {
        expect(arena).toContain('dispatch(recordCardOffer(offered));');
    });
});
