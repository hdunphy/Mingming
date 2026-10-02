// @vitest-environment jsdom
/**
 * TICKET 182b — HIDE WHEN EMPTY.
 *
 * A panel, slot or label with nothing in it is not drawn. For each rule here: one render with the
 * thing empty (hidden), one with it present (shown), and one with "Show advanced content" on (drawn
 * even when empty, as before 182). The rows are added one at a time, each with the change that makes
 * it pass.
 */
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

import MacroRack from './components/MacroRack';
import RunScreen from './screens/RunScreen';
import battleReducer from './store/battleSlice';
import gameReducer, { createEmptyRanch } from './store/gameSlice';
import runReducer from './store/runSlice';

import { createRun } from '../engine/run/createRun';
import { offerGyms } from '../engine/run/gyms';
import { ALL_TIP_IDS } from '../engine/tips';
import { loadSettings, saveSettings } from './settings/settings';
import type { IRanchMember, IRunState, MacroSlots } from '../engine/runTypes';
import type { IBattleState, IMingmingState } from '../engine/types';

const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0,
    attackIV: 10, defenseIV: 10, hpIV: 10,
};
const ROSTER: IRanchMember[] = [{
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10,
}];
const RUN = createRun({
    seed: 'hide-empty-seed', offer: offerGyms('offer-seed')[0], party: [MEMBER], startedAt: 1_700_000_000_000,
});

function advanced(on: boolean): void {
    saveSettings({ ...loadSettings(), showAdvancedContent: on });
}

afterEach(() => localStorage.clear());

function store(run: IRunState, game = { ...createEmptyRanch(), roster: ROSTER, seenTips: [...ALL_TIP_IDS] }) {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: { game, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

function html(tree: ReactNode, run: IRunState = RUN): string {
    return renderToStaticMarkup(<Provider store={store(run)}>{tree}</Provider>);
}

const EMPTY: MacroSlots = [null, null, null];

describe('182b - the macro rack on the battle screen', () => {
    const battle = {
        playerParty: [], enemyParty: [], activeSide: 'PLAYER', turn: 1, logs: [],
        playerDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
        enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
        cardsPlayedThisTurn: 0, counters: {}, activeDrivers: [],
    } as unknown as IBattleState;
    const rack = (macros: MacroSlots) => html(
        <MacroRack macros={macros} battleState={battle} selectedSourceId={null} selectedTargetId={null} onFire={() => undefined} />,
    );

    it('is not drawn while all three slots are empty', () => {
        expect(rack(EMPTY)).toBe('');
    });
    it('is drawn the moment a slot holds a macro', () => {
        const markup = rack(['surge', null, null]);
        expect(markup).toContain('macro-rack');
        expect(markup).toContain('Surge');
    });
    it('is drawn empty (three slots) with Show advanced content on', () => {
        advanced(true);
        const markup = rack(EMPTY);
        expect(markup).toContain('macro-rack');
        expect(markup.match(/macro-slot empty/g)).toHaveLength(3);
    });
});

describe('182b - the macro slots on the map', () => {
    const map = (macros: MacroSlots) => html(<RunScreen />, { ...RUN, macros });

    it('are not drawn while all three slots are empty', () => {
        const markup = map(EMPTY);
        expect(markup).not.toContain('>Macros<');
        expect(markup).not.toContain('Slot 1');
    });
    it('are drawn the moment a slot holds a macro', () => {
        const markup = map(['surge', null, null]);
        expect(markup).toContain('>Macros<');
        expect(markup).toContain('Fires in battle');
    });
    it('are drawn empty with Show advanced content on', () => {
        advanced(true);
        const markup = map(EMPTY);
        expect(markup).toContain('>Macros<');
        expect(markup).toContain('Slot 1');
    });
});
