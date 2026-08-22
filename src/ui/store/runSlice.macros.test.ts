/**
 * THE MACRO RACK'S REDUCERS — ticket 15.
 *
 * `engine/macros.test.ts` proves what a macro DOES in a battle and `marketplace.macros.test.ts`
 * proves what one costs. This proves what the rack does to the run, which is a different failure:
 *
 * - **Three slots, single use.** Acquiring fills the leftmost free slot; firing empties one. The
 *   rack is a ratified fixed-length tuple, so a reducer that turned it into a growable list would
 *   break the save shape rather than the game, which is the kind of bug that surfaces a week later.
 * - **A full rack refuses with a REASON.** Ticket 15 says so in as many words. A reducer has no
 *   error channel, so the refusal is split: the reducer refuses silently and *byte-identically*
 *   (the slice's standing convention), and `macroRackBlockFor` — checked here too — is what the
 *   screen prints. Both halves are tested, because either alone is a half-kept promise.
 * - **The map-reveal writes `modifiers` and spends its slot in ONE action.** Two dispatches would
 *   make "surveyed but the macro is still there" and "macro gone, nothing surveyed" both reachable.
 */

import { describe, expect, it } from 'vitest';

import runReducer, {
    buyMacro,
    consumeMacro,
    fireMapReveal,
    grantMacro,
    startRun,
    type RunSliceState,
} from './runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { macroPrice } from '../../engine/run/marketplace';
import {
    biomeRevealModifier,
    firstFreeMacroSlot,
    macroRackBlockFor,
    revealedBiomesFrom,
} from '../../engine/data/macroRegistry';
import { battleReducer, canFireMacro } from '../../engine/battleReducer';
import { MACRO_SLOTS, RunStateSchema } from '../../engine/runTypes';
import type { IBattleEntity, IBattleState, IMingmingState } from '../../engine/types';
import type { IRunState, MacroSlots } from '../../engine/runTypes';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

function makeRun(over: Partial<IRunState> = {}): IRunState {
    const run = createRun({
        seed: 'macro-reducer-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    return { ...run, scrap: 500, ...over };
}

/** The slice, holding a run. Every case dispatches against the reducer alone — no screen. */
function stateFor(run: IRunState): RunSliceState {
    return runReducer(undefined, startRun(run));
}

const runOf = (state: RunSliceState): IRunState => state.run!;

// =================================================================================================
// Acquiring
// =================================================================================================

describe('buying a macro', () => {
    it('fills the leftmost free slot and charges the price, in one action', () => {
        const before = stateFor(makeRun());
        const after = runReducer(before, buyMacro({ macroId: 'surge', price: macroPrice('surge') }));

        expect(runOf(after).macros).toEqual(['surge', null, null]);
        expect(runOf(after).scrap).toBe(runOf(before).scrap - macroPrice('surge'));
    });

    it('fills left to right, so the rack reads predictably', () => {
        let state = stateFor(makeRun());
        for (const id of ['surge', 'mend', 'kindle']) {
            state = runReducer(state, buyMacro({ macroId: id, price: macroPrice(id) }));
        }
        expect(runOf(state).macros).toEqual(['surge', 'mend', 'kindle']);
    });

    it('allows DUPLICATES — a macro is a consumable, not a driver', () => {
        // `addDriver` dedupes because a second copy of a passive is not a second effect. Two Surges
        // in two slots are two Surges, so there is deliberately no dedupe here.
        let state = stateFor(makeRun());
        state = runReducer(state, buyMacro({ macroId: 'surge', price: macroPrice('surge') }));
        state = runReducer(state, buyMacro({ macroId: 'surge', price: macroPrice('surge') }));
        expect(runOf(state).macros).toEqual(['surge', 'surge', null]);
    });

    it('REFUSES a full rack — with a reason available, and byte-identically', () => {
        // Ticket 15: "a full rack must refuse a purchase with a reason, not silently drop it."
        const full: MacroSlots = ['surge', 'mend', 'kindle'];
        const before = stateFor(makeRun({ macros: full }));

        // The reason the screen prints, produced by the engine and not by the reducer.
        expect(macroRackBlockFor(full, 'revive')).toBe('rack-full');

        const after = runReducer(before, buyMacro({ macroId: 'revive', price: macroPrice('revive') }));
        expect(after.run).toEqual(before.run);
        expect(runOf(after).scrap).toBe(runOf(before).scrap); // and no scrap taken for nothing
    });

    it('refuses a purchase the run cannot afford, taking nothing', () => {
        const before = stateFor(makeRun({ scrap: 10 }));
        const after = runReducer(before, buyMacro({ macroId: 'revive', price: macroPrice('revive') }));
        expect(after.run).toEqual(before.run);
    });

    it('refuses an unknown macro id rather than parking a dead string in a slot', () => {
        // A slot holding an id no registry knows is a slot the rack cannot render and the reducer
        // cannot fire — a soft-locked consumable.
        const before = stateFor(makeRun());
        const after = runReducer(before, buyMacro({ macroId: 'no_such_macro', price: 1 }));
        expect(after.run).toEqual(before.run);
        expect(macroRackBlockFor(runOf(before).macros, 'no_such_macro')).toBe('unknown-macro');
    });

    it('refuses a negative or fractional price', () => {
        const before = stateFor(makeRun());
        expect(runReducer(before, buyMacro({ macroId: 'surge', price: -1 })).run).toEqual(before.run);
        expect(runReducer(before, buyMacro({ macroId: 'surge', price: 1.5 })).run).toEqual(before.run);
    });
});

describe('granting a macro', () => {
    it('fills a slot for free — the event and reward path', () => {
        const after = runReducer(stateFor(makeRun({ scrap: 0 })), grantMacro('salve'));
        expect(runOf(after).macros).toEqual(['salve', null, null]);
        expect(runOf(after).scrap).toBe(0);
    });

    it('refuses a full rack too — a gift cannot overflow it either', () => {
        const before = stateFor(makeRun({ macros: ['surge', 'mend', 'kindle'] }));
        expect(runReducer(before, grantMacro('revive')).run).toEqual(before.run);
    });
});

// =================================================================================================
// Spending
// =================================================================================================

describe('consuming a macro', () => {
    it('empties the slot it was fired from, and only that slot', () => {
        const before = stateFor(makeRun({ macros: ['surge', 'mend', 'kindle'] }));
        const after = runReducer(before, consumeMacro(1));
        expect(runOf(after).macros).toEqual(['surge', null, 'kindle']);
    });

    it('is SINGLE USE: the same macro cannot be fired from an emptied slot again', () => {
        let state = stateFor(makeRun({ macros: ['surge', null, null] }));
        state = runReducer(state, consumeMacro(0));
        expect(runOf(state).macros).toEqual([null, null, null]);
        const again = runReducer(state, consumeMacro(0));
        expect(again.run).toEqual(state.run);
    });

    it('leaves the run untouched for an empty slot or an index off the rack', () => {
        const before = stateFor(makeRun({ macros: ['surge', null, null] }));
        expect(runReducer(before, consumeMacro(1)).run).toEqual(before.run);
        expect(runReducer(before, consumeMacro(MACRO_SLOTS)).run).toEqual(before.run);
        expect(runReducer(before, consumeMacro(-1)).run).toEqual(before.run);
    });

    it('keeps the rack a valid three-slot tuple through every operation', () => {
        // The save shape is ratified and there is no v4 migration: a rack that grew to four entries
        // or shrank to two would fail the run's own schema at the next load, i.e. lose the run.
        let state = stateFor(makeRun());
        state = runReducer(state, buyMacro({ macroId: 'surge', price: macroPrice('surge') }));
        state = runReducer(state, consumeMacro(0));
        state = runReducer(state, grantMacro('echo'));
        expect(runOf(state).macros).toHaveLength(MACRO_SLOTS);
        expect(RunStateSchema.safeParse(runOf(state)).success).toBe(true);
    });
});

// =================================================================================================
// The map-reveal
// =================================================================================================

describe('firing the map-reveal', () => {
    /** Stand the run somewhere in biome 1, holding a Ping Sweep in slot 0. */
    function readyToSurvey(over: Partial<IRunState> = {}): IRunState {
        const run = makeRun({ macros: ['ping_sweep', null, null] });
        const node = run.nodes.find((n) => n.biomeIndex === 1)!;
        return { ...run, currentNodeId: node.id, ...over };
    }

    it('records the CURRENT biome in `modifiers` and spends the slot, in one action', () => {
        const before = stateFor(readyToSurvey());
        const here = runOf(before).nodes.find((n) => n.id === runOf(before).currentNodeId)!;
        const after = runReducer(before, fireMapReveal(0));

        expect(runOf(after).modifiers).toContain(biomeRevealModifier(here.biomeIndex));
        expect(runOf(after).macros).toEqual([null, null, null]);
        expect(revealedBiomesFrom(runOf(after).modifiers)).toEqual([here.biomeIndex]);
    });

    it('records it in a shape the ratified save still parses', () => {
        // The whole argument for using `modifiers` instead of a new field: `runTypes.ts` is ratified
        // and this ticket may not widen it. That is only true if the string survives the schema.
        const after = runReducer(stateFor(readyToSurvey()), fireMapReveal(0));
        expect(RunStateSchema.safeParse(runOf(after)).success).toBe(true);
    });

    it('refuses when the biome is already surveyed, keeping the macro', () => {
        // A second survey of the same biome changes nothing at all, so spending a consumable on it
        // would be pure loss. The screen greys the button for the same reason.
        const first = runReducer(stateFor(readyToSurvey()), fireMapReveal(0));
        const held = { ...runOf(first), macros: ['ping_sweep', null, null] as MacroSlots };
        const second = runReducer(stateFor(held), fireMapReveal(0));
        expect(second.run).toEqual(held);
    });

    it('refuses a slot holding a BATTLE macro — a mis-click cannot burn a Revive on the map', () => {
        const before = stateFor(makeRun({ macros: ['revive', null, null] }));
        expect(runReducer(before, fireMapReveal(0)).run).toEqual(before.run);
    });

    it('refuses an empty slot and an index off the rack', () => {
        const before = stateFor(readyToSurvey());
        expect(runReducer(before, fireMapReveal(1)).run).toEqual(before.run);
        expect(runReducer(before, fireMapReveal(9)).run).toEqual(before.run);
    });

    it('surveys each biome separately — one sweep is not the whole map', () => {
        // Ticket 07's amendment says "the current biome's node types", not the run's. Two sweeps,
        // two entries, and the fog over biome 2 is untouched by a sweep of biome 1.
        const run = readyToSurvey();
        const first = runReducer(stateFor(run), fireMapReveal(0));

        const elsewhere = runOf(first).nodes.find((n) => n.biomeIndex === 2)!;
        const second = runReducer(stateFor({
            ...runOf(first),
            macros: ['ping_sweep', null, null],
            currentNodeId: elsewhere.id,
        }), fireMapReveal(0));

        expect([...revealedBiomesFrom(runOf(second).modifiers)].sort()).toEqual([1, 2]);
    });
});

// =================================================================================================
// The two-slice write, end to end
// =================================================================================================

describe('buying a macro and firing it', () => {
    /** The smallest board a macro can be fired on. Mirrors `engine/macros.test.ts`'s fixture. */
    function board(): IBattleState {
        const unit = (id: string, over: Partial<IBattleEntity> = {}): IBattleEntity => ({
            id, name: id.toUpperCase(), definitionId: 'd', blueprintsCollected: 0,
            attackIV: 0, defenseIV: 0, hpIV: 0,
            maxHp: 100, currentHp: 100, cardDraw: 1, maxEnergy: 3, currentEnergy: 3,
            attack: 45, defense: 30, speed: 10, primaryElement: 'Fire',
            tempHp: 0, statusEffects: [], daemons: [], ...over,
        } as IBattleEntity);
        return {
            sessionId: 's', seed: 'x', turn: 1, phase: 'ACTION', activeSide: 'PLAYER',
            activeRelics: [], playerParty: [unit('p1')], enemyParty: [unit('e1')],
            playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
            enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
            logs: [], osLogs: [], procs: [],
            cardsPlayedThisTurn: 0, cardsDrawnThisTurn: 0, lastProgramPlayed: null, counters: {},
        } as IBattleState;
    }

    it('is bought, fires, and the slot is empty afterwards — the whole ruled life of a macro', () => {
        // The two halves live in two slices and no reducer can write both, so this is the only place
        // the pair is checked together. `BattleArena` performs exactly these dispatches, in this
        // order (battle first — see `consumeMacro`'s note on why).
        let run = runReducer(undefined, startRun(makeRun()));
        run = runReducer(run, buyMacro({ macroId: 'surge', price: macroPrice('surge') }));
        expect(runOf(run).macros[0]).toBe('surge');

        const before = board();
        const payload = { macroId: 'surge', sourceId: 'p1', targetId: 'e1' };
        expect(canFireMacro(before, payload)).toBeNull();

        const after = battleReducer(before, { type: 'FIRE_MACRO', payload });
        expect(after.enemyParty[0].currentHp).toBe(92);

        run = runReducer(run, consumeMacro(0));
        expect(runOf(run).macros).toEqual([null, null, null]);
        // SINGLE USE, proven where it matters: the slot the shot came from is empty, so the rack
        // cannot offer it again and `canFireMacro` never sees a second request for it.
        expect(runOf(run).macros.filter((m) => m !== null)).toHaveLength(0);
    });
});

// =================================================================================================
// The rack helper the screens share
// =================================================================================================

describe('firstFreeMacroSlot', () => {
    it('answers -1 for a full rack, which is what "refuse" is built on', () => {
        expect(firstFreeMacroSlot([null, null, null])).toBe(0);
        expect(firstFreeMacroSlot(['surge', null, null])).toBe(1);
        expect(firstFreeMacroSlot(['surge', 'mend', null])).toBe(2);
        expect(firstFreeMacroSlot(['surge', 'mend', 'kindle'])).toBe(-1);
    });
});
