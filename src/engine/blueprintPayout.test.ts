/**
 * DOES A BLUEPRINT ACTUALLY ARRIVE? — Henry, 2026-08-30: *"In a run I've been to 8 fights and have
 * no blueprints."*
 *
 * That report cannot be answered by reading `BLUEPRINT_DROP_RATE`, because there are two ways to
 * see no blueprints after eight fights and only one of them is a bug:
 *
 *  1. **The dice.** A SOLO run fights one body per wild (`enemyPartySize` mirrors the party), and
 *     the rate is PER BODY — so a solo wild pays a blueprint 20% of the time, not the ~49% a
 *     three-body wild does. Eight dry fights at 20% is a 1-in-6 event. At three bodies it would be
 *     1-in-175, which is a bug report.
 *  2. **The pipe.** The roll could be fine and the blueprint could still never reach the ranch —
 *     `RewardSystem` returns it, `BattleArena`'s banking effect dispatches it, `gameSlice` counts
 *     it, `SaveSystem` writes it, and the run's own ledger records it for the summary. Any one of
 *     those five links could be broken with the other four healthy.
 *
 * So this file measures the first and walks the second. It is a permanent test rather than a probe
 * because "the reward path went quiet" is a defect nobody notices until a playtester has already
 * lost a run's worth of time to it, and because a future re-cost of the table (the whole knob is
 * marked as proposals awaiting ratification) should have to look a measured distribution in the eye.
 *
 * THE SEEDS ARE REALISTIC, WHICH IS THE POINT. `rollDropTable` is handed `battleState.seed` — the
 * live seed a fight ENDS on, a numeric string hundreds of LCG steps deep — and `PRNG` hashes a
 * string seed before it rolls. Measuring against `Math.random()` seeds would prove nothing about
 * the seeds the game actually feeds it, which is where a bias would live if there were one.
 */

import { describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

import { BLUEPRINT_DROP_RATE, blueprintRateFor, rollDropTable } from './RewardSystem';
import { PRNG } from './core/PRNG';
import { enemyPartySize } from './run/encounter';
import { bankedBlueprintCounts } from './run/runSummary';
import { createRun } from './run/createRun';
import { offerGyms } from './run/gyms';
import { saveRanch } from './SaveSystem';
import { loadGameState } from './SaveSystem';
import { setSaveStorage, type ISaveStorage } from './save/storage';
import { createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import gameReducer, { addBlueprint, createEmptyRanch } from '../ui/store/gameSlice';
import runReducer, { recordBankedBlueprint, setRun } from '../ui/store/runSlice';
import type { IBattleEntity } from './types';
import type { IRanchMember, NodeKind } from './runTypes';
import type { IMingmingState } from './types';

/** How many fights each measurement runs. Enough that a 20% rate is pinned inside ±2 points. */
const SAMPLE = 3000;

const corpse = (id: string, definitionId: string): IBattleEntity =>
    createSparseEntity({ id, definitionId, name: definitionId, currentHp: 0 });

const PARTY = [createSparseEntity({ id: 'p1', definitionId: 'kraken', name: 'Kraken', activeOS: 'kraken_v1' })];

/**
 * Seeds shaped like the ones fights actually end on: one chain, walked in fight-sized strides, so
 * consecutive samples are consecutive fights of one long session rather than independent draws.
 */
function endOfFightSeeds(count: number): string[] {
    const out: string[] = [];
    let seed = 'run-seed:node-3:1';
    for (let i = 0; i < count; i++) {
        for (let roll = 0; roll < 250; roll++) seed = String(new PRNG(seed).next().nextSeed);
        out.push(seed);
    }
    return out;
}

function measure(kind: NodeKind, bodies: number, seeds: string[]): { perBody: number; perFight: number } {
    const defeated = Array.from({ length: bodies }, (_, i) => corpse(`e${i}`, ['fenrir', 'huldra', 'draugr'][i % 3]));
    let drops = 0;
    let fightsThatPaid = 0;
    for (const seed of seeds) {
        const { blueprints } = rollDropTable({ defeated, nodeKind: kind, party: PARTY, seed });
        drops += blueprints.length;
        if (blueprints.length > 0) fightsThatPaid++;
    }
    return { perBody: drops / (seeds.length * bodies), perFight: fightsThatPaid / seeds.length };
}

describe('the blueprint roll', () => {
    const seeds = endOfFightSeeds(SAMPLE);

    it('pays each fight kind at the rate its table states, per BODY (three bodies: no solo bonus)', () => {
        for (const kind of ['wild', 'elite', 'ambush', 'gym'] as NodeKind[]) {
            const { perBody } = measure(kind, 3, seeds);
            // ±3 points: wide enough that the LCG's own lumpiness is not a flake, tight enough that
            // a table read as per-FIGHT (which would land near a third of this) fails loudly.
            expect(Math.abs(perBody - BLUEPRINT_DROP_RATE[kind]), `${kind} paid ${perBody}`)
                .toBeLessThan(0.03);
        }
    });

    it('honours the alpha ruling exactly — one body, one blueprint, every time', () => {
        // Ticket 07's only ruled number in the table. An approximate 100% is a broken 100%.
        expect(measure('alpha', 1, seeds).perFight).toBe(1);
    });

    it('pays a SOLO run the ruled 30%, and a full party the table 20% per body', () => {
        // The heart of Henry's report. `enemyPartySize` mirrors the party, so a solo run's wild is
        // one body and one roll — 20%, not the 49% three bodies produce. Both are printed by this
        // test on failure so the number in the ticket and the number in the game stay the same one.
        expect(enemyPartySize('wild', 1)).toBe(1);
        expect(enemyPartySize('wild', 3)).toBe(3);

        const solo = measure('wild', 1, seeds).perFight;
        const full = measure('wild', 3, seeds).perFight;
        // Henry, 2026-09-01: solo fights pay 30%, every other size keeps the table's 20% per body.
        expect(Math.abs(solo - 0.30), `solo paid ${solo}`).toBeLessThan(0.03);
        expect(Math.abs(full - 0.49), `full party paid ${full}`).toBeLessThan(0.03);

        // The bonus is a property of the FIGHT, not of the run: two bodies is not solo.
        expect(blueprintRateFor('wild', 1)).toBeCloseTo(0.30, 10);
        expect(blueprintRateFor('wild', 2)).toBeCloseTo(0.20, 10);
        expect(blueprintRateFor('wild', 3)).toBeCloseTo(0.20, 10);
        // A certainty cannot be improved, and a non-fight cannot be turned into one.
        expect(blueprintRateFor('alpha', 1)).toBe(1);
        expect(blueprintRateFor('marketplace', 1)).toBe(0);
    });

    it('rolls a blueprint the player can actually be handed - never an unknown species', () => {
        // The drop IS the species you defeated (ticket 12). A corpse's `definitionId` is what the
        // ranch will be asked to assemble, so a drop naming anything else is a crash waiting at the
        // assembly bay rather than a reward.
        const defeated = [corpse('e0', 'fenrir'), corpse('e1', 'huldra')];
        for (const seed of seeds.slice(0, 500)) {
            const { blueprints } = rollDropTable({ defeated, nodeKind: 'wild', party: PARTY, seed });
            blueprints.forEach((id) => expect(['fenrir', 'huldra']).toContain(id));
        }
    });
});

// ---------------------------------------------------------------------------------------------
// The pipe: from the roll to the ranch, and to the receipt the summary prints
// ---------------------------------------------------------------------------------------------

class MemoryStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    read(key: string) { return this.data.get(key) ?? null; }
    write(key: string, value: string) { this.data.set(key, value); }
    remove(key: string) { this.data.delete(key); }
    keys() { return [...this.data.keys()]; }
}

const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const ROSTER: IRanchMember[] = [{
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10,
}];

/** The first seed in the chain that actually drops, so the pipe is walked with a REAL bundle. */
function seedThatDrops(): { seed: string; species: string } {
    const defeated = [corpse('e0', 'fenrir')];
    for (const seed of endOfFightSeeds(200)) {
        const { blueprints } = rollDropTable({ defeated, nodeKind: 'wild', party: PARTY, seed });
        if (blueprints.length > 0) return { seed, species: blueprints[0] };
    }
    throw new Error('no blueprint in 200 wild fights — the roll is broken, not the pipe');
}

describe('the blueprint pipe', () => {
    it('carries a dropped blueprint to the ranch, to the run ledger, and onto disk', () => {
        setSaveStorage(new MemoryStorage());
        const { seed, species } = seedThatDrops();

        const run = createRun({
            seed: 'pipe', offer: offerGyms('pipe-offer')[0], party: [MEMBER], startedAt: 1_700_000_000_000,
        });
        const store = configureStore({
            reducer: { game: gameReducer, run: runReducer },
            preloadedState: { game: { ...createEmptyRanch(), roster: ROSTER }, run: { run } },
        });
        store.dispatch(setRun(run));

        // What `BattleArena`'s banking effect does, in the order it does it.
        const bundle = rollDropTable({ defeated: [corpse('e0', 'fenrir')], nodeKind: 'wild', party: PARTY, seed });
        expect(bundle.blueprints).toHaveLength(1);
        for (const id of bundle.blueprints) {
            store.dispatch(addBlueprint(id));
            store.dispatch(recordBankedBlueprint(id));
        }

        // 1. The ranch holds it as a spendable count.
        const ranch = store.getState().game;
        expect(ranch.blueprints[species]).toBe(1);

        // 2. The run's own ledger holds the receipt the summary screen reads. The ranch cannot
        //    answer "which blueprints did THIS run produce" — it is a count with no provenance.
        const after = store.getState().run.run;
        expect(bankedBlueprintCounts(after?.modifiers ?? [])).toEqual({ [species]: 1 });

        // 3. And it survives the save, which is the half that makes "dead runs still pay forward"
        //    true: the ranch is written the moment the count changes, not when the run ends.
        expect(saveRanch(ranch).success).toBe(true);
        expect(loadGameState().ranch?.blueprints[species]).toBe(1);
    });

    it('banks a repeat drop as a second charge rather than deduping it', () => {
        // Ticket 20 made blueprints consumable counts, so the second fenrir is a second assembly
        // (or an IV re-roll). A `Set` here would silently eat every drop after the first, which
        // would look exactly like "I fight and fight and get no blueprints".
        setSaveStorage(new MemoryStorage());
        const store = configureStore({
            reducer: { game: gameReducer, run: runReducer },
            preloadedState: { game: { ...createEmptyRanch(), roster: ROSTER }, run: { run: null } },
        });

        store.dispatch(addBlueprint('fenrir'));
        store.dispatch(addBlueprint('fenrir'));
        expect(store.getState().game.blueprints.fenrir).toBe(2);
    });
});
