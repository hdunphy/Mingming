/**
 * The battle stage sheet's entry — ticket 183b. Dev only: `stage.html` is not a Vite build input, so
 * it is served by `npm run dev` at `/Mingming/stage.html` and never reaches `dist/`.
 *
 * A real `BattleArena` over a real 3v3 state, with the things the stage has to draw dressed on: one
 * body hurt with a Bark Shield, a status of every kind on another, one dead, a cursor-worthy caster.
 * `?biome=Fire|Water|Nature|None` picks the room; `?party=N` / `?foes=N` size the sides (183e); `?run=1` puts the player in a run (macro rack, tip toast); `?enemyHand=1` opens nothing — the tab is drawn
 * closed, which is the state a player sees first.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import '../../index.css';
import BattleArena from '../../ui/components/BattleArena';
import battleReducer, { selectCard, selectSource, setBattleState } from '../../ui/store/battleSlice';
import gameReducer from '../../ui/store/gameSlice';
import runReducer, { setRun } from '../../ui/store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import uiReducer from '../../ui/store/uiSlice';
import { createBattleState, type IBattleSetup } from '../../engine/data/battleFactories';
import type { Element, IBattleEntity, IBattleState, ProgramEntity, StatusType } from '../../engine/types';

type Member = IBattleSetup['party'][number];
const member = (id: string, definitionId: string): Member =>
    ({ id, definitionId, blueprintsCollected: 0, hpIV: 15, attackIV: 15, defenseIV: 15 });

const params = new URLSearchParams(window.location.search);
const biome = (params.get('biome') ?? 'Nature') as Element;
// `?party=1|2|3` and `?foes=1|2|3` — how many bodies each side brings (ticket 183e).
const sideSize = (key: string) => Math.min(3, Math.max(1, Number(params.get(key) ?? 3) || 3));

function status(type: StatusType, stacks = 1, duration = 2) {
    return { id: `s-${type}`, type, stacks, duration, sourceId: 'dev' };
}

function build(): IBattleState {
    const base = createBattleState(
        {
            party: [member('p1', 'fenrir'), member('p2', 'skoll'), member('p3', 'ratatoskr')],
            deck: [], drivers: [], persistedHp: {}, encounter: null,
        },
        ['kraken', 'huldra', 'nidhoggr'],
        undefined,
        { seed: 'stage-sheet', enemyMode: 'CARDS' },
    );
    const hand: ProgramEntity[] = ['ignite', 'growth', 'ember_jab', 'cinder_lance'].map((dataId, i) => (
        { id: `card_${i}`, dataId, currentCost: 1, isPlayable: true }
    ));
    const hurt = (e: IBattleEntity, frac: number, extra: Partial<IBattleEntity> = {}): IBattleEntity =>
        ({ ...e, currentHp: Math.round(e.maxHp * frac), ...extra });
    const [a1, a2, a3] = base.playerParty;
    const [e1, e2, e3] = base.enemyParty;
    const party = sideSize('party');
    const foes = sideSize('foes');
    return {
        ...base,
        biomeName: biome === 'None' ? 'The Wilds' : `${biome}fall`,
        biomeElement: biome,
        playerDeck: { ...base.playerDeck, hand },
        playerParty: [
            hurt(a1, 0.55, { statusEffects: [status('BarkShield', 25, 3), status('Strengthened', 2), status('Regen', 3)] }),
            hurt(a2, 0.3, { statusEffects: [status('Burn', 3), status('Poison', 2), status('Dazed', 1), status('Weakened', 1), status('Sharp', 2), status('Strengthened', 2)] }),
            hurt(a3, 1),
        ].slice(0, party),
        enemyParty: [
            hurt(e1, 0.8, { statusEffects: [status('Asleep', 1, 1)] }),
            hurt(e2, 0.12),
            // The dead third body only belongs to a full 3v3; a smaller side keeps everyone alive.
            foes === 3 ? hurt(e3, 0, { statusEffects: [] }) : e3,
        ].slice(0, foes),
    };
}

const store = configureStore({
    reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
});
store.dispatch(setBattleState(build()));
store.dispatch(selectSource('p1'));
// `?run=1`: stand inside a run, which is what draws the macro rack and the tip toast.
if (params.get('run')) {
    const run = createRun({
        seed: 'stage-sheet-run',
        offer: offerGyms('offer-seed')[0],
        party: [{ id: 'mm1', definitionId: 'fenrir', activeOS: 'fenrir_v1', blueprintsCollected: 0, attackIV: 15, defenseIV: 15, hpIV: 15 }],
        startedAt: 1,
    });
    store.dispatch(setRun({ ...run, macros: ['surge', 'mend', null] as typeof run.macros }));
}
if (params.get('card')) store.dispatch(selectCard(params.get('card')));

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider store={store}>
            <BattleArena />
        </Provider>
    </StrictMode>,
);
