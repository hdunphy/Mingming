/**
 * TICKET 183b — THE TOP BAR IN THE SLANT KIT: the turn chip, the event toast, the biome sign and the
 * Settings button. `BattleTopBar.test.tsx` already holds what the three islands said (145c); this
 * holds the new parts.
 */
import { configureStore } from '@reduxjs/toolkit';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';

import type { IBattleState } from '../../../engine/types';
import battleReducer from '../../store/battleSlice';
import gameReducer from '../../store/gameSlice';
import runReducer from '../../store/runSlice';
import uiReducer from '../../store/uiSlice';
import BattleTopBar from '../BattleTopBar';

const battle = (over: Partial<IBattleState> = {}): IBattleState => ({
    playerParty: [], enemyParty: [], activeSide: 'PLAYER', turn: 3, phase: 'PLAYER_TURN',
    playerDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    counters: {}, seed: 'x', logs: ['Skoll\'s Treachery instinct triggers'], cardsPlayedThisTurn: 0,
    ...over,
} as unknown as IBattleState);

function render(state: IBattleState): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        preloadedState: { run: { run: null } } as never,
    } as never);
    return renderToStaticMarkup(
        <Provider store={store}>
            <BattleTopBar battleState={state} onToggleLog={() => {}} />
        </Provider>,
    );
}

describe('183b — the top bar', () => {
    it('draws the turn as a number in a slant panel', () => {
        const html = render(battle({ turn: 12 } as never));
        expect(html).toContain('battle-topbar-turn');
        expect(html).toContain('k-panel');
        expect(html).toContain('>12<');
    });

    it('draws the latest event line as the toast', () => {
        const html = render(battle());
        expect(html).toContain('battle-topbar-log');
        expect(html).toContain('instinct triggers');
    });

    it('names the biome in a sign with its element symbol, and says nothing outside a biome', () => {
        const html = render(battle({ biomeName: 'Verdant Sprawl', biomeElement: 'Nature' } as never));
        expect(html).toContain('data-testid="battle-biome"');
        expect(html).toContain('Verdant Sprawl');
        expect(render(battle())).not.toContain('battle-biome');
    });

    it('has a Settings button, labelled, in a slant panel', () => {
        const html = render(battle());
        expect(html).toContain('aria-label="Settings"');
        expect(html).toContain('battle-topbar-gear-panel');
    });
});
