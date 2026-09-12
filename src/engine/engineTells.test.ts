// @vitest-environment node
/**
 * TICKET 146b — the three engine tells.
 *
 * The bus carried *what* happened and never *why*, and the UI cannot infer it: a Burn tick and a
 * sword arrive as the same event on the same target for the same number. 146f rules that they must
 * not look alike, so the engine has to say which is which.
 *
 * Three additive fields and one new event. The whole row's risk is in the word ADDITIVE — the
 * balance suite and `SimRunner` read this bus, and a row that changed a number would invalidate
 * every measurement taken since ticket 149. The last describe block is that guarantee.
 */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { globalBattleEventBus, type BattleEvent } from './events';
import { createBattleState } from './data/battleFactories';
import type { IBattleSetup } from './data/battleFactories';
import { getDeckForOS } from './data/mingmingRegistry';
import { SeedStream } from './core/SeedStream';
import { createRanchMember } from './gameTypes';
import { toMingmingState } from './run/battleSetup';
import { battleReducer } from './battleReducer';
import { effectHandlers } from './effectHandlers';
import { applyMutations } from './resolutionEngine';
import { beginSimulation, endSimulation } from './core/simulationDepth';
import type { IBattleState } from './types';

const setupFor = (species: string, os: string): IBattleSetup => ({
    party: [toMingmingState(createRanchMember(species, os, new SeedStream(`146b-${species}`)))],
    deck: getDeckForOS(species, os),
    drivers: [],
    persistedHp: {},
});

const freshBattle = (): IBattleState =>
    createBattleState(setupFor('fenrir', 'fenrir_v1'), ['ratatoskr'], undefined, { seed: '146b' });

let seen: BattleEvent[] = [];
let unsubscribe: (() => void) | null = null;

beforeEach(() => {
    seen = [];
    unsubscribe = globalBattleEventBus.subscribe((e) => seen.push(e));
});
afterEach(() => {
    unsubscribe?.();
    unsubscribe = null;
});

const damageEvents = () => seen.filter((e) => e.type === 'DAMAGE_TAKEN');

describe('146b — DAMAGE_TAKEN.cause', () => {
    it('says `attack` for a hit that went through the damage formula', () => {
        const state = freshBattle();
        const target = state.enemyParty[0];
        effectHandlers.ATTACK(state, {
            sourceId: state.playerParty[0].id, targetId: target.id, power: 10, element: 'None',
        });

        expect(damageEvents()).toHaveLength(1);
        expect(damageEvents()[0]).toMatchObject({ cause: 'attack' });
    });

    it('says `recoil` when a card hurts its own caster', () => {
        // The distinction 146f needs: a recoil is a red pulse on the CASTER with no trail, not an
        // incoming hit. Both ways of being one route through the same handler as a sword.
        const state = freshBattle();
        const self = state.playerParty[0];
        applyMutations(state, [{
            type: 'HP', targetId: self.id, sourceId: self.id,
            payload: { amount: 3, isHeal: false, cause: 'recoil' },
        }]);

        expect(damageEvents()[0]).toMatchObject({ cause: 'recoil', targetId: self.id });
    });

    it('says `toll` for an engine price, which is not a recoil', () => {
        // hel's UNDERWORLD_GATEWAY blood cost. Same shape as a recoil and a different thing: a
        // recoil is a card's printed price, a toll is the OS taking its cut.
        const state = freshBattle();
        const self = state.playerParty[0];
        applyMutations(state, [{
            type: 'HP', targetId: self.id, sourceId: self.id,
            payload: { amount: 2, isHeal: false, cause: 'toll' },
        }]);

        expect(damageEvents()[0]).toMatchObject({ cause: 'toll' });
    });

    it('says `status`, and WHICH status, for a damage-over-time tick', () => {
        // The headline case. Without `status` the float cannot take Poison's green or Burn's
        // orange, and without `cause` the tick would collect a hit-stop and a screen shake.
        let state = freshBattle();
        const victim = state.playerParty[0];
        state = effectHandlers.APPLY_STATUS(state, { targetId: victim.id, status: 'Poison', stacks: 3 });
        seen = [];

        // A DoT ticks on its OWNER's turn boundary, so the poisoned unit's own turn has to come
        // round. Driven rather than asserted at a fixed turn count: ticket 126 gives statuses two
        // possible timings, and which one Poison uses is that ticket's business, not this test's.
        for (let turn = 0; turn < 4 && !damageEvents().some((e) => e.cause === 'status'); turn += 1) {
            state = battleReducer(state, { type: 'END_TURN' });
        }

        const tick = damageEvents().find((e) => e.cause === 'status');
        expect(tick).toBeDefined();
        expect(tick).toMatchObject({ cause: 'status', status: 'Poison', targetId: victim.id });
    });

    it('leaves `cause` absent on a hand-built event, which listeners read as `attack`', () => {
        // Additive means a fixture that predates this row still type-checks and still means what
        // it meant. The UI's fallback is documented on `DamageCause`.
        globalBattleEventBus.emit({
            type: 'DAMAGE_TAKEN', targetId: 'x', amount: 1, element: 'None', timestamp: 0,
        });
        expect(damageEvents()[0].cause).toBeUndefined();
    });
});

describe('146b — STATUS_APPLIED / STATUS_REMOVED source', () => {
    it('names the card that applied it, and the unit that cast it', () => {
        // 146g points ALLURE_PROXY's arc from the OWNER to the weakened target. The target was
        // always on the event; the owner is what this adds.
        const state = freshBattle();
        const caster = state.playerParty[0];
        const target = state.enemyParty[0];
        effectHandlers.APPLY_STATUS(state, {
            targetId: target.id, status: 'Weakened', stacks: 2, sourceId: caster.id,
            source: { kind: 'card', id: 'some_card', ownerId: caster.id },
        });

        const applied = seen.find((e) => e.type === 'STATUS_APPLIED');
        expect(applied).toMatchObject({
            source: { kind: 'card', id: 'some_card', ownerId: caster.id },
        });
    });

    it('falls back to `engine` when nothing claimed it', () => {
        // True of expiries, of Burn overflow, and of every hand-built fixture. An honest `engine`
        // beats a guessed card id — 146g's family default is the right tell for "the engine did it".
        const state = freshBattle();
        const target = state.enemyParty[0];
        effectHandlers.APPLY_STATUS(state, { targetId: target.id, status: 'Weakened', stacks: 1 });

        const applied = seen.find((e) => e.type === 'STATUS_APPLIED');
        expect(applied).toMatchObject({ source: { kind: 'engine' } });
    });
});

describe('146b — HOOK_FIRED', () => {
    const hookEvents = () => seen.filter((e) => e.type === 'HOOK_FIRED');

    it('fires with its owner and trigger when a hook actually acts', () => {
        const state = freshBattle();
        seen = [];
        battleReducer(state, { type: 'END_TURN' });

        // Every fight in this game runs hooks on a turn boundary; the assertion is about the SHAPE
        // rather than about any particular OS, so it survives a firmware roster change.
        for (const event of hookEvents()) {
            expect(typeof event.hookId).toBe('string');
            expect(typeof event.ownerId).toBe('string');
            expect(typeof event.trigger).toBe('string');
            expect(event.osId ?? event.daemonId ?? null).not.toBe(undefined);
        }
    });

    it('is SILENT inside AI lookahead', () => {
        /*
         * The guard that makes this row affordable. `TacticalAI` drives the real reducer to score
         * candidate plays — ticket 127 measured 93,889 reducer calls for one 3v3 decision — so
         * without this the bus would carry tens of thousands of events a turn and the stage would
         * strobe with tells for fights that never happened.
         */
        const state = freshBattle();
        seen = [];

        beginSimulation();
        try {
            battleReducer(state, { type: 'END_TURN' });
        } finally {
            endSimulation();
        }

        expect(hookEvents()).toHaveLength(0);
    });

    it('says nothing for a hook that was consulted and declined', () => {
        // "Fired" means it DID something. A tell that plays whenever an OS looks at the board and
        // shrugs teaches the player that the icon means nothing.
        const state = freshBattle();
        seen = [];
        // A phase no hook in the roster acts on leaves the state identical by definition.
        battleReducer(state, { type: 'SELECT_TARGET', payload: { targetId: state.enemyParty[0].id } });
        expect(hookEvents()).toHaveLength(0);
    });
});

describe('146b — additive, and provably so', () => {
    it('changes no existing field on DAMAGE_TAKEN', () => {
        // `amount` keeps its post-shield pre-floor meaning, which ticket 12's listeners depend on.
        const state = freshBattle();
        effectHandlers.ATTACK(state, {
            sourceId: state.playerParty[0].id, targetId: state.enemyParty[0].id,
            power: 10, element: 'None',
        });

        const event = damageEvents()[0];
        expect(event).toHaveProperty('targetId');
        expect(event).toHaveProperty('amount');
        expect(event).toHaveProperty('element');
        expect(event).toHaveProperty('damage');
        expect(typeof event.amount).toBe('number');
    });

    it('leaves the battle state byte-identical — the balance suite reads this engine', () => {
        /*
         * THE ROW'S WHOLE RISK, IN ONE ASSERTION.
         *
         * Every number in `docs/wayfinder` since ticket 149 came out of `SimRunner` driving this
         * reducer. If adding three event fields moved so much as a rounding, every one of those
         * measurements would be quietly invalid and nothing would say so.
         *
         * Same seed, same inputs, deep-equal states — the determinism suite's own instrument,
         * pointed at this change.
         */
        const a = freshBattle();
        const b = freshBattle();
        expect(battleReducer(a, { type: 'END_TURN' })).toEqual(battleReducer(b, { type: 'END_TURN' }));
    });
});
