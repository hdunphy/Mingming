/**
 * THE PITY COUNTER, ON THE RUN — Henry's ruling of 2026-09-01.
 *
 * `RewardSystem` decides what a drought is worth; this reducer is the only thing that knows a
 * drought is happening. The two halves are tested apart because they fail apart: an engine that
 * honours the floor is useless if nothing counts the dry fights, and the 13-fight run that prompted
 * the ruling would have looked exactly the same either way.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import { createEmptyRanch } from './gameSlice';
import runReducer, { recordFightBlueprintOutcome, setRun } from './runSlice';
import { BLUEPRINT_PITY_FIGHTS, rollDropTable } from '../../engine/RewardSystem';
import { PRNG } from '../../engine/core/PRNG';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { loadGameState, saveRanch, saveRun } from '../../engine/SaveSystem';
import { setSaveStorage, type ISaveStorage } from '../../engine/save/storage';
import { createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { IBattleEntity, IMingmingState } from '../../engine/types';

class MemoryStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    read(k: string) { return this.data.get(k) ?? null; }
    write(k: string, v: string) { this.data.set(k, v); }
    remove(k: string) { this.data.delete(k); }
    keys() { return [...this.data.keys()]; }
}

const corpse = (id: string, definitionId: string): IBattleEntity =>
    createSparseEntity({ id, definitionId, name: definitionId, currentHp: 0 });

const PARTY = [createSparseEntity({ id: 'p1', definitionId: 'kraken', name: 'Kraken', activeOS: 'kraken_v1' })];

/** The roster the run's `partyIds` point into — see the save round-trip case. */
const ROSTER = [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }];

/** A seed the solo rate does not pay on, found once so the loop below is a pure drought. */
const DRY_SEED: string = (() => {
    let seed = 'pity-loop:0';
    for (let i = 0; i < 400; i++) {
        for (let roll = 0; roll < 250; roll++) seed = String(new PRNG(seed).next().nextSeed);
        const { blueprints } = rollDropTable({
            defeated: [corpse('e0', 'fenrir')], nodeKind: 'wild', party: PARTY, seed,
        });
        if (blueprints.length === 0) return seed;
    }
    throw new Error('no dry seed found');
})();

const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const store = () => {
    const s = configureStore({ reducer: { run: runReducer } });
    s.dispatch(setRun(createRun({ seed: 'pity', offer: offerGyms('pity-offer')[0], party: [MEMBER], startedAt: 0 })));
    return s;
};

describe('blueprintDryFights', () => {
    it('starts a run at zero — a fresh run never inherits a debt', () => {
        expect(store().getState().run.run?.blueprintDryFights).toBe(0);
    });

    it('counts each dry win, and counts FIGHTS rather than bodies', () => {
        const s = store();
        for (let i = 0; i < 3; i++) s.dispatch(recordFightBlueprintOutcome({ dropped: false }));
        expect(s.getState().run.run?.blueprintDryFights).toBe(3);
    });

    it('resets the moment a fight pays', () => {
        const s = store();
        s.dispatch(recordFightBlueprintOutcome({ dropped: false }));
        s.dispatch(recordFightBlueprintOutcome({ dropped: false }));
        s.dispatch(recordFightBlueprintOutcome({ dropped: true }));
        expect(s.getState().run.run?.blueprintDryFights).toBe(0);
    });

    it('is a no-op with no run behind it — a debug scenario has nothing to count', () => {
        const s = configureStore({ reducer: { run: runReducer } });
        s.dispatch(recordFightBlueprintOutcome({ dropped: false }));
        expect(s.getState().run.run).toBeNull();
    });

    /**
     * A DROUGHT SURVIVES THE APP CLOSING.
     *
     * The counter is only worth having if it outlives a session: a player who quits mid-run —
     * which the 2026-08-30 quit button now makes a first-class thing to do — must come back owed
     * exactly what they were owed. `blueprintDryFights` is optional on the interface and
     * `.default(0)` in the schema, and that pair is easy to get wrong in a way nothing else
     * notices: a field the schema strips reads as "no drought" forever, and the floor silently
     * never fires again.
     */
    it('survives the save and comes back owed the same debt', () => {
        setSaveStorage(new MemoryStorage());
        const s = store();
        for (let i = 0; i < 4; i++) s.dispatch(recordFightBlueprintOutcome({ dropped: false }));

        // The RANCH goes down first, and not as ceremony: `loadGameState` reconciles the two keys
        // and DISCARDS a run whose `partyIds` name nobody on the roster. Saving the run alone would
        // make this case pass or fail on the reconcile rather than on the field, which is how a
        // stripped field hides behind a discarded run.
        expect(saveRanch({ ...createEmptyRanch(), roster: ROSTER }).success).toBe(true);
        expect(saveRun(s.getState().run.run).success).toBe(true);

        const loaded = loadGameState();
        expect(loaded.discarded, 'the run must survive reconciliation to prove anything').toBeUndefined();
        expect(loaded.run?.blueprintDryFights).toBe(4);
    });

    /**
     * THE LOOP, CLOSED. The counter and the floor are wired at opposite ends of `BattleArena`'s
     * victory — one reads, one writes — and each half passing its own test says nothing about
     * whether they agree. This runs the two against each other on a seed that never pays, which is
     * the 13-fight run that prompted the ruling, reduced to its shape.
     */
    it('ends a drought that the roll alone never would', () => {
        const s = store();
        const defeated = [corpse('e0', 'fenrir')];
        let longestDrought = 0;

        for (let fight = 0; fight < 20; fight++) {
            const { blueprints } = rollDropTable({
                defeated, nodeKind: 'wild', party: PARTY, seed: DRY_SEED,
                dryFights: s.getState().run.run?.blueprintDryFights ?? 0,
            });
            s.dispatch(recordFightBlueprintOutcome({ dropped: blueprints.length > 0 }));
            longestDrought = Math.max(longestDrought, s.getState().run.run?.blueprintDryFights ?? 0);
        }

        // The seed pays never, so without the floor this would be 20. With it, no drought can outlive
        // the ruled length — and the run keeps moving instead of grinding one node seven times.
        expect(longestDrought).toBe(BLUEPRINT_PITY_FIGHTS);
    });
});
