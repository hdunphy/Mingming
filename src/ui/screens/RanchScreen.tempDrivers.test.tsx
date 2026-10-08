/**
 * TICKET 168b — the vault lists a run's temporary Drivers after its permanent ones, marked
 * "next fight", so the penalty an event handed out is not invisible until it bites.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import RanchScreen from './RanchScreen';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IRunState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

function vault(run: IRunState): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: { game: createEmptyRanch(), run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(<Provider store={store}><RanchScreen initialSection="vault" /></Provider>);
}

describe('RanchScreen vault — temporary Drivers (168b)', () => {
    const base = createRun({ seed: 'vault', offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 1 });

    it('lists a temporary Driver with "next fight" after its name, and its rule text', () => {
        const markup = vault({ ...base, tempDrivers: [{ driverId: 'driver_frayed_signal', fightsLeft: 1 }] });
        expect(markup).toContain('GJÖLL CHILL · next fight');
        expect(markup).toContain('loses 25% of its max HP');
        expect(markup).not.toContain('Nothing installed');
    });

    it('lists it after the permanent ones, which carry no marker', () => {
        const markup = vault({
            ...base,
            drivers: ['driver_tenth_strike'],
            tempDrivers: [{ driverId: 'driver_static_haze', fightsLeft: 1 }],
        });
        expect(markup.indexOf('TENTH STRIKE')).toBeGreaterThan(-1);
        expect(markup.indexOf('TENTH STRIKE')).toBeLessThan(markup.indexOf('BARROW MIST · next fight'));
        expect(markup).not.toContain('TENTH STRIKE · next fight');
    });
});
