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
import BattleTopBar from './components/BattleTopBar';
import PatchHolders from './components/PatchHolders';
import { FirmwareChip } from './components/UnitReadouts';
import RunScreen from './screens/RunScreen';
import battleReducer from './store/battleSlice';
import gameReducer, { createEmptyRanch } from './store/gameSlice';
import runReducer from './store/runSlice';

import { createRun } from '../engine/run/createRun';
import { offerGyms } from '../engine/run/gyms';
import { ALL_TIP_IDS } from '../engine/tips';
import { loadSettings, saveSettings } from './settings/settings';
import type { IRanchMember, IRunState, MacroSlots } from '../engine/runTypes';
import type { IBattleEntity, IBattleState, IMingmingState, ProgramEntity } from '../engine/types';

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

/** A battle state with the named cards spread over the player's piles (the top bar reads all five). */
function battleHolding(handIds: string[], over: Partial<IBattleState> = {}): IBattleState {
    const cards = handIds.map((dataId, i) => ({ id: `c${i}`, dataId, currentCost: 1, isPlayable: true }) as ProgramEntity);
    return {
        playerParty: [], enemyParty: [], activeSide: 'PLAYER', turn: 1, logs: [],
        playerDeck: { deck: [], hand: cards, drawpile: [], discard: [], exhaust: [] },
        enemyDeck: { deck: [], hand: [], drawpile: [], discard: [], exhaust: [] },
        cardsPlayedThisTurn: 0, counters: {}, activeDrivers: [],
        ...over,
    } as unknown as IBattleState;
}
const topBar = (battle: IBattleState) => html(<BattleTopBar battleState={battle} onToggleLog={() => undefined} logOpen={false} />);

describe('182b - the "PLAYED n" pill', () => {
    it('is not drawn while no card in the deck scales with cards played', () => {
        expect(topBar(battleHolding(['ember_jab', 'cinder_lance']))).not.toContain('battle-topbar-played');
    });
    it('is drawn the moment one does (stampede)', () => {
        const markup = topBar(battleHolding(['ember_jab', 'stampede'], { cardsPlayedThisTurn: 2 } as never));
        expect(markup).toContain('battle-topbar-played');
        expect(markup).toContain('PLAYED ');
    });
    it('finds the scaler in any pile, not only the hand', () => {
        const state = battleHolding(['ember_jab']);
        const withDraw = {
            ...state,
            playerDeck: { ...state.playerDeck, drawpile: [{ id: 'd1', dataId: 'stampede', currentCost: 1, isPlayable: true }] },
        } as unknown as IBattleState;
        expect(topBar(withDraw)).toContain('battle-topbar-played');
    });
    it('is drawn with Show advanced content on, even with no scaler', () => {
        advanced(true);
        expect(topBar(battleHolding(['ember_jab']))).toContain('battle-topbar-played');
    });
});

/*
 * STALE ROWS (R7). The cut list's "patch holders" and "drivers strip" were already hidden when empty
 * by 167j and 145c; these cases pin that, so a later change cannot start drawing them empty. Show
 * advanced content does not draw them either - "as today" is hidden for these two.
 */
describe('182b - patch holders and the drivers strip (already hidden when empty)', () => {
    const body = { id: 'mm1', name: 'Kraken' } as unknown as IBattleEntity;

    it('the "who holds a patch" list draws nothing when nobody does, and a line when someone does', () => {
        expect(html(<PatchHolders winners={[body]} heldPatches={{}} />)).toBe('');
        expect(html(<PatchHolders winners={[body]} heldPatches={{ mm1: ['amplifier'] }} />)).toContain('patch-holder');
        advanced(true);
        expect(html(<PatchHolders winners={[body]} heldPatches={{}} />)).toBe('');
    });

    it('the patch chip on a unit plate is drawn only for a unit that has a patch', () => {
        const unit = (patches?: string[]) => ({
            id: 'mm1', activeOS: 'kraken_v1', patches,
        }) as unknown as IBattleEntity;
        expect(html(<FirmwareChip entity={unit()} />)).not.toContain('hud-os-patch');
        expect(html(<FirmwareChip entity={unit(['amplifier'])} />)).toContain('hud-os-patch');
    });

    it('the battle drivers strip is drawn only when the run has drivers', () => {
        expect(topBar(battleHolding([], { activeDrivers: [] } as never))).not.toContain('battle-drivers');
        expect(topBar(battleHolding([], { activeDrivers: ['driver_antivenom'] } as never))).toContain('battle-drivers');
        advanced(true);
        expect(topBar(battleHolding([], { activeDrivers: [] } as never))).not.toContain('battle-drivers');
    });

    it('the map has no drivers strip at all', () => {
        expect(html(<RunScreen />, { ...RUN, drivers: ['driver_antivenom'] })).not.toContain('battle-drivers');
    });
});
