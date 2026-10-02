/* eslint-disable react-refresh/only-export-components -- a dev entry file: it mounts, it does not export. */
/**
 * The screen sheet's entry — ticket 183f. Dev only: `screens.html` is not a Vite build input, so it
 * is served by `npm run dev` at `/Mingming/screens.html` and never reaches `dist/`.
 *
 * The four full screens 183f paints, mounted for real over a believable save so the screenshots
 * show shipped markup: `?view=ranch&section=expedition|roster|assembly|vault|codex`, `runstart`,
 * `settings`, `map` and `town` (the 183g pieces laid out like the mocks), `summary&outcome=victory|defeat|abandoned`.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import '../../index.css';
import RanchScreen from '../../ui/screens/RanchScreen';
import RunStart from '../../ui/screens/RunStart';
import SettingsScreen from '../../ui/screens/SettingsScreen';
import RunSummary from '../../ui/screens/RunSummary';
import { MapPieces, TownPieces } from './MapPieces';
import battleReducer from '../../ui/store/battleSlice';
import gameReducer, { createEmptyRanch } from '../../ui/store/gameSlice';
import runReducer from '../../ui/store/runSlice';
import uiReducer from '../../ui/store/uiSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IRanchMember, IRunState, RunOutcome } from '../../engine/runTypes';

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? 'ranch';

const member = (id: string, definitionId: string, activeOS: string, iv: number): IRanchMember => (
    { id, definitionId, activeOS, attackIV: iv, defenseIV: iv + 4, hpIV: iv + 9 }
);
const ROSTER: IRanchMember[] = [
    member('mm1', 'kraken', 'kraken_v1', 10),
    member('mm2', 'fenrir', 'fenrir_v1', 17),
    member('mm3', 'ratatoskr', 'ratatoskr_v1', 6),
];

const ranch = {
    ...createEmptyRanch(),
    roster: ROSTER,
    blueprints: { fenrir: 2, ratatoskr: 1, jormungandr: 1 },
    introDone: true,
    runsCompleted: 2,
};

const store = configureStore({
    reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
    preloadedState: { game: ranch },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
});

const STARTED_AT = 1_700_000_000_000;
function endedRun(outcome: RunOutcome): IRunState {
    const run = createRun({
        seed: 'screen-sheet',
        offer: offerGyms('offer-seed')[0],
        party: ROSTER.map((m) => ({ ...m, blueprintsCollected: 0 })),
        startedAt: STARTED_AT,
    });
    return { ...run, phase: 'ended', outcome };
}

function Screen() {
    switch (view) {
        case 'map': return <MapPieces />;
        case 'town': return <TownPieces />;
        case 'runstart': return <RunStart />;
        case 'settings': return <SettingsScreen />;
        case 'summary': return (
            <RunSummary
                run={endedRun((params.get('outcome') ?? 'victory') as RunOutcome)}
                endedAt={STARTED_AT + 42 * 60_000 + 13_000}
            />
        );
        default: return (
            <RanchScreen
                initialSection={(params.get('section') ?? 'expedition') as 'expedition' | 'roster' | 'assembly' | 'vault' | 'codex'}
            />
        );
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider store={store}>
            <Screen />
        </Provider>
    </StrictMode>,
);
