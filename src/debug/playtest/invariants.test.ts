/**
 * TICKET 180e — invariants, checked after every move in every mode.
 *
 * Each check is a plain function over a state, so each is tested with a hand-made bad fixture; and a
 * whole clean run in each mode must raise none (a check that cries wolf is worse than none).
 */
import { describe, it, expect } from 'vitest';

import { addRunCards } from '../../ui/store/runSlice';
import { battleInvariants } from './invariants/battleInvariants';
import { runInvariants } from './invariants/runInvariants';
import { fightInvariants, screenInvariants } from './invariants/screenInvariants';
import { checkMove } from './afterMove';
import { PLAYTEST_MAX_TURNS } from './battleSim';
import { dispatchChecked } from './stalls';
import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { aiBattleKey, routineMove } from './walkKit';
import { applyMove } from './world';
import type { FightReport, World } from './types';
import { runOf } from './types';

const inBattle = (): World => {
    const world = freshWorld({ mode: 'turn', seed: 'ps1' });
    applyMove(world, { key: currentScreen(world).moves[0].key, why: 'test' });
    return world;
};
const names = (violations: ReadonlyArray<{ name: string }>) => violations.map((v) => v.name);
const invariantsOf = (world: World) => world.findings.filter((f) => f.kind === 'invariant');

describe('180e — the run', () => {
    it('a fresh run is clean', () => {
        expect(runInvariants(runOf(freshWorld()))).toEqual([]);
    });

    it('a card instance id owned twice is caught', () => {
        const run = runOf(freshWorld());
        const twin = run.deck[0];
        expect(names(runInvariants({ ...run, deck: [...run.deck, { ...twin }] }))).toContain('duplicate-card-id');
    });

    it('a run that no longer parses as a RunState is caught, with the reason', () => {
        const run = runOf(freshWorld());
        const found = runInvariants({ ...run, scrap: 'a lot' as unknown as number });
        expect(names(found)).toContain('run-schema');
        expect(found[0].detail).toMatch(/scrap/);
    });
});

describe('180e — the battle', () => {
    const state = () => inBattle().view.battle!.state;

    it('an opening battle is clean', () => {
        expect(battleInvariants(state())).toEqual([]);
    });

    it('HP past its max, a negative shield and negative Energy are caught', () => {
        const s = state();
        const [me] = s.playerParty;
        expect(names(battleInvariants({ ...s, playerParty: [{ ...me, currentHp: me.maxHp + 1 }] }))).toContain('hp-range');
        expect(names(battleInvariants({ ...s, playerParty: [{ ...me, currentHp: -1 }] }))).toContain('hp-range');
        expect(names(battleInvariants({ ...s, playerParty: [{ ...me, tempHp: -3 }] }))).toContain('hp-range');
        expect(names(battleInvariants({ ...s, playerParty: [{ ...me, currentEnergy: -1 }] }))).toContain('energy-negative');
    });

    it('a duplicated card instance id is caught', () => {
        const s = state();
        const card = s.playerDeck.hand[0];
        const twin = { ...s, playerDeck: { ...s.playerDeck, discard: [...s.playerDeck.discard, { ...card }] } };
        expect(names(battleInvariants(twin))).toContain('duplicate-card-id');
    });

    it('a card that vanishes between two moves is caught, and one that merely moves is not', () => {
        const s = state();
        const [first, ...rest] = s.playerDeck.hand;
        const moved = { ...s, playerDeck: { ...s.playerDeck, hand: rest, discard: [...s.playerDeck.discard, first] } };
        expect(battleInvariants(moved, s)).toEqual([]);
        const gone = { ...s, playerDeck: { ...s.playerDeck, hand: rest } };
        expect(names(battleInvariants(gone, s))).toContain('card-vanished');
    });

    it('an open battle past the turn cap is caught', () => {
        expect(names(battleInvariants({ ...state(), turn: PLAYTEST_MAX_TURNS + 1 }))).toContain('turn-cap');
    });
});

describe('180e — the screen, the fight, the engine, the reducer', () => {
    it('a screen with no move on a live run is a soft-lock; an ended run is not', () => {
        const world = freshWorld();
        const run = runOf(world);
        const empty = { id: 'x', body: [], moves: [] };
        expect(names(screenInvariants(empty, run))).toEqual(['soft-lock']);
        expect(screenInvariants(empty, { ...run, phase: 'ended' })).toEqual([]);
        expect(screenInvariants(currentScreen(world), run)).toEqual([]);
    });

    it('a fight that hit the turn cap is reported', () => {
        const report = { nodeId: 'n1', truncated: true } as unknown as FightReport;
        expect(names(fightInvariants(report))).toEqual(['fight-truncated']);
        expect(fightInvariants({ ...report, truncated: false })).toEqual([]);
        expect(fightInvariants(null)).toEqual([]);
    });

    it('a duplicated card in the run is found by the move that follows it', () => {
        const world = freshWorld();
        const twin = runOf(world).deck[0];
        world.store.dispatch(addRunCards([{ ...twin }]));
        applyMove(world, { key: currentScreen(world).moves[0].key, why: 'test' });
        expect(invariantsOf(world).map((f) => f.kind === 'invariant' && f.name)).toContain('duplicate-card-id');
    });

    it('an offered move the reducer refuses is reported', () => {
        const world = freshWorld();
        // an action the run reducer does not know leaves the run as it was: "Nothing happened"
        const changed = dispatchChecked(world, { type: 'run/unknownAction', payload: null }, 'a test move');
        expect(changed).toBe(false);
        expect(invariantsOf(world).map((f) => f.kind === 'invariant' && f.name)).toContain('move-refused');
        expect(world.view.news.join(' ')).toMatch(/Nothing happened/);
    });

    it('a game-engine throw is reported against the move that caused it, once', () => {
        const world = freshWorld();
        const move = { key: 'x', why: 'test' };
        world.view.engineError = 'TypeError: boom';
        checkMove(world, { battle: null, engineError: null }, move, 5);
        const found = invariantsOf(world);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ name: 'engine-error', atMove: 5, detail: 'TypeError: boom' });
        // an error already reported before the move is not reported again
        checkMove(world, { battle: null, engineError: 'TypeError: boom' }, move, 6);
        expect(invariantsOf(world)).toHaveLength(1);
    });

    it('a screen that throws while it is built is reported, not allowed to crash the session', () => {
        const world = freshWorld({ mode: 'turn' });
        applyMove(world, { key: currentScreen(world).moves[0].key, why: 'test' });
        world.view.battle = { ...world.view.battle!, state: null as never };
        checkMove(world, { battle: null, engineError: null }, { key: 'x', why: 'test' }, 2);
        expect(invariantsOf(world).some((f) => f.kind === 'invariant' && f.name === 'screen-error')).toBe(true);
    });
});

describe('180e — no false alarms', () => {
    for (const mode of ['run', 'turn', 'card'] as const) {
        it(`a whole ${mode}-mode run raises no invariant failure`, () => {
            const world = freshWorld({ mode, seed: 'ps22', budget: 100_000 });
            const tried = new Set<string>();
            for (let n = 0; n < 3000 && runOf(world).phase !== 'ended'; n += 1) {
                const screen = currentScreen(world);
                const key = screen.id === 'battle' ? aiBattleKey(world, screen.moves.map((m) => m.key)) : routineMove(screen, tried, world);
                if (screen.id === 'event' || screen.id === 'reward') tried.add(key); else tried.clear();
                applyMove(world, { key, why: 'test' });
            }
            expect(runOf(world).phase).toBe('ended');
            expect(invariantsOf(world)).toEqual([]);
        });
    }
});
