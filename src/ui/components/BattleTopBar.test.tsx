/**
 * TICKET 145c — THE TOP BAR SAYS WHAT THE THREE ISLANDS SAID.
 *
 * The bar replaced ticket 18's gauntlet banner, ticket 90's TURN / CARDS PLAYED pills and a floating
 * `AudioControls`. Each of those was added because a player could not otherwise see something, so
 * the test that matters is that none of them was quietly dropped in the consolidation — plus the two
 * things §1 and §2a say must NOT be there.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import BattleTopBar from './BattleTopBar';
import battleReducer from '../store/battleSlice';
import gameReducer from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';
import type { IBattleState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

const battle = (over: Partial<IBattleState> = {}): IBattleState => ({
    playerParty: [], enemyParty: [], activeSide: 'PLAYER', turn: 3, phase: 'PLAYER_TURN',
    // TICKET 182b: the PLAYED pill is drawn only when a card in the deck scales with cards played,
    // so the default board holds Stampede (the pill's own cases need it).
    playerDeck: { hand: [{ id: 'c1', dataId: 'stampede', currentCost: 1, isPlayable: true }], drawpile: [], discard: [], exhaust: [] },
    enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    counters: {}, seed: 'x', logs: ['Fenrir casts War Pact'], cardsPlayedThisTurn: 2,
    ...over,
} as unknown as IBattleState);

function render(state: IBattleState, run: Partial<IRunState> | null = null, logOpen = false): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        preloadedState: { run: { run: run as IRunState | null } } as never,
    } as never);
    return renderToStaticMarkup(
        <Provider store={store}>
            <BattleTopBar battleState={state} onToggleLog={() => {}} logOpen={logOpen} />
        </Provider>,
    );
}

describe('145c — nothing the three islands said was dropped', () => {
    it('keeps the turn number and the cards-played counter', () => {
        // Ticket 90 added these because "Henry had no way to see the turn number or how many cards
        // he had played" — and `stampede` / `momentum_crash` scale on exactly that count, so the
        // deck's whole plan is invisible without it.
        const markup = render(battle({ turn: 7, cardsPlayedThisTurn: 3 } as never));
        expect(markup).toContain('TURN ');
        expect(markup).toContain('>7<');
        expect(markup).toContain('PLAYED ');
        expect(markup).toContain('>3<');
    });

    it('marks the counter live only when something has been played', () => {
        expect(render(battle({ cardsPlayedThisTurn: 0 } as never))).not.toContain('is-live');
        expect(render(battle({ cardsPlayedThisTurn: 1 } as never))).toContain('is-live');
    });

    it('says whose turn it is - to screen readers only (182a cut the pill)', () => {
        expect(render(battle())).toContain('<span class="sr-only" aria-live="polite">Your move</span>');
        expect(render(battle({ activeSide: 'ENEMY' } as never))).toContain('>Enemy move<');
        expect(render(battle())).not.toContain('YOUR MOVE');
    });

    it('keeps ticket 18s gauntlet progress, and names the LEADER fight', () => {
        // Ticket 18's reason still holds: the last gauntlet fight is the leader's own team, and it
        // is the one fight where holding a Revive rather than spending it is a real decision.
        const run = { gymId: 'gym_rootfall', nodes: [], currentNodeId: '', drivers: [],
            gauntlet: { fightIndex: 0, totalFights: 3 } } as unknown as IRunState;
        expect(render(battle(), run)).toContain('GAUNTLET 1/3');
        const last = { ...run, gauntlet: { fightIndex: 2, totalFights: 3 } } as unknown as IRunState;
        expect(render(battle(), last)).toContain('LEADER');
    });

    it('no longer names the gym and the rung outside a gauntlet (182a cut that pill)', () => {
        const run = { gymId: 'gym_rootfall', drivers: [], currentNodeId: 'n1',
            nodes: [{ id: 'n1', kind: 'elite' }] } as unknown as IRunState;
        const markup = render(battle(), run);
        expect(markup).not.toContain('ROOTFALL');
        expect(markup).not.toContain('ELITE');
        expect(markup).not.toContain('battle-topbar-place');
    });

    it('carries the latest log line and the chevron that opens the panel', () => {
        const markup = render(battle({ logs: ['a', 'b', 'the newest thing'] } as never));
        expect(markup).toContain('the newest thing');
        expect(markup).toContain('battle-topbar-chevron');
    });
});

describe('145c — and does not say what Henry cut', () => {
    it('has no deck, hand or discard counts', () => {
        // §1 lists them among what he cut from the bar; 145d puts each count on the pile it counts.
        const markup = render(battle());
        expect(markup).not.toMatch(/\bDECK\b/);
        expect(markup).not.toMatch(/\bDISCARD\b/);
        expect(markup).not.toMatch(/\bHAND\b/);
    });

    it('draws PLAYED as a number, never as pips', () => {
        // §2a is precise rather than lazy here: draws mean there is no known maximum, so a pip row
        // would be drawing a denominator the game does not have.
        expect(render(battle())).not.toContain('hud-energy-pip');
    });
});

describe('145c — the Totems row (ticket 16: read off the battle, with the rule text as tooltip)', () => {
    it('names each Totem, and says nothing when the party has none', () => {
        const run = { gymId: 'gym_rootfall', drivers: [], nodes: [], currentNodeId: '' } as unknown as IRunState;
        expect(render(battle({ activeDrivers: [] } as never), run)).not.toContain('battle-drivers');

        const markup = render(battle({ activeDrivers: ['driver_first_blood'] } as never), run);
        expect(markup).toContain('battle-drivers');
        expect(markup).toContain('TOTEMS');
        expect(markup).toContain('FIRST BLOOD');
        // The tooltip is the rule — a chip with a name and no rule is a rule you cannot play around.
        expect(markup).toContain('title="The first attack card this side plays each turn deals 20% more damage."');
    });

    it('shows the Totems outside a run — a debug scenario fields them too', () => {
        // Until ticket 17 wires the elite drop, the scenario launcher is where a Driver gets tried;
        // a row keyed off `run.drivers` was blank there, which is the one place it was needed.
        const markup = render(battle({ activeDrivers: ['driver_antivenom'] } as never), null);
        expect(markup).toContain('battle-drivers');
        expect(markup).toContain('ANTIVENOM');
    });

    it('does not flash before anything has procced', () => {
        expect(render(battle({ activeDrivers: ['driver_antivenom'] } as never), null)).not.toContain('is-proc');
    });
});

describe('the chevron is a TOGGLE, and it says which way it goes', () => {
    /*
     * Henry, 2026-09-22: *"I cannot close the combat log."*
     *
     * `BattleArena` passed `() => setLogOpen(true)`, so this button could only ever open. The
     * panel's own header is the other way out and it sits UNDER this bar — `.combat-log-container`
     * is `position: absolute; top: 0; z-index: 50` against the bar's `z-index: 1500`, so the
     * header is drawn behind it and cannot be clicked. Between them, an open log was a trap.
     *
     * The state is asserted through `aria-expanded` rather than the glyph, because the glyph is
     * decoration a future restyle may replace and the accessible name is the contract.
     */
    it('reports its state, so the control is not a one-way door', () => {
        const state = battle({});
        expect(render(state, null, false)).toContain('aria-expanded="false"');
        expect(render(state, null, true)).toContain('aria-expanded="true"');
    });

    it('points down when the panel is closed and up when it is open', () => {
        expect(render(battle({}), null, false)).toContain('▾');
        expect(render(battle({}), null, true)).toContain('▴');
    });
});
