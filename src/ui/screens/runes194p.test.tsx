/**
 * TICKET 194p — runes and Totems are visible outside battle.
 *
 * Henry: *"I can't see the runes anywhere in the map/shop/roster/loadout/gym prep screen, so I can't
 * tell what I already have."* One `RuneTag` serves every screen; a member with a rune shows it and a
 * member without one shows nothing. The loadout also lists the run's Totems once.
 */
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import LoadoutEditor from './LoadoutEditor';
import PartyFaces from './PartyFaces';
import RanchScreen from './RanchScreen';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { RuneTag } from '../components/RuneTag';
import { runeIdsOf } from '../components/runeIds';
import { TotemRow } from '../components/TotemRow';
import { getPatch } from '../../engine/data/patchRegistry';
import { plain } from '../labels/labels';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IRanchMember, IRanchState, IRunState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const MEMBER: IRanchMember = { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 };
const ranch = (): IRanchState => ({ ...createEmptyRanch(), roster: [MEMBER] });

/** The rune's name as the player reads it (a Norse one, so the letter is not "A"). */
const NAME = plain(getPatch('amplifier')!.name);

const baseRun = (): IRunState =>
    createRun({ seed: 'runes-194p', offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 1 });
const withRune = (run: IRunState): IRunState => ({ ...run, patches: { mm1: ['amplifier'] } });

function store(run: IRunState, game: IRanchState) {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: { game, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

const loadout = (run: IRunState): string => renderToStaticMarkup(
    <Provider store={store(run, ranch())}>
        <LoadoutEditor run={run} ranch={ranch()} context="DEN" onClose={() => undefined} />
    </Provider>,
);

const roster = (run: IRunState): string => renderToStaticMarkup(
    <Provider store={store(run, ranch())}><RanchScreen initialSection="roster" /></Provider>,
);

describe('194p — the rune tag', () => {
    it('names the rune, with what it does on this Instinct as its tooltip', () => {
        const markup = renderToStaticMarkup(<RuneTag patchIds={['amplifier']} osId="fenrir_v1" />);
        expect(markup).toContain('data-rune="amplifier"');
        expect(markup).toContain(`>${NAME}<`);
        expect(markup).toContain('Fenrir gains 4 Strengthened per attack instead of 2');
    });

    it('is the first letter where space is tight, and nothing for a body with no rune', () => {
        expect(renderToStaticMarkup(<RuneTag patchIds={['amplifier']} compact />)).toContain(`>${NAME.charAt(0)}<`);
        expect(renderToStaticMarkup(<RuneTag patchIds={[]} />)).toBe('');
        expect(renderToStaticMarkup(<RuneTag patchIds={undefined} />)).toBe('');
    });

    it('reads a body\'s runes from the run, and nothing for an unknown body', () => {
        expect(runeIdsOf(withRune(baseRun()), 'mm1')).toEqual(['amplifier']);
        expect(runeIdsOf(withRune(baseRun()), 'nobody')).toEqual([]);
        expect(runeIdsOf(null, 'mm1')).toEqual([]);
    });
});

describe('194p — where a Mingming is shown, its rune is shown', () => {
    it('the loadout editor', () => {
        expect(loadout(withRune(baseRun()))).toContain('data-rune="amplifier"');
        expect(loadout(baseRun())).not.toContain('rune-tag');
    });

    it('the ranch roster, while a run holds the rune', () => {
        expect(roster(withRune(baseRun()))).toContain('data-rune="amplifier"');
        expect(roster(baseRun())).not.toContain('rune-tag');
    });

    it('the map\'s row of party faces', () => {
        const withTag = renderToStaticMarkup(<PartyFaces members={[MEMBER]} patches={{ mm1: ['amplifier'] }} />);
        expect(withTag).toContain('data-rune="amplifier"');
        expect(renderToStaticMarkup(<PartyFaces members={[MEMBER]} patches={{}} />)).not.toContain('rune-tag');
        // The face is still the face: the same list item count as before.
        expect(withTag.match(/run-party-face"/g)).toHaveLength(1);
    });
});

describe('194p — the Totems', () => {
    it('the loadout screen lists the run\'s Totems once, with the rule as the tooltip', () => {
        const markup = loadout({ ...baseRun(), drivers: ['driver_tenth_strike'] });
        expect(markup.match(/class="totem-row"/g)).toHaveLength(1);
        expect(markup).toContain('TENTH STRIKE');
    });

    it('lists a temporary one after the permanent ones, marked "next fight"', () => {
        const markup = loadout({
            ...baseRun(), drivers: ['driver_tenth_strike'], tempDrivers: [{ driverId: 'driver_static_haze', fightsLeft: 1 }],
        });
        expect(markup.indexOf('TENTH STRIKE')).toBeLessThan(markup.indexOf('BARROW MIST · next fight'));
    });

    it('shows nothing when the run has none', () => {
        expect(loadout(baseRun())).not.toContain('totem-row');
        expect(renderToStaticMarkup(<TotemRow drivers={[]} />)).toBe('');
        expect(renderToStaticMarkup(<TotemRow drivers={undefined} tempDrivers={[]} />)).toBe('');
    });
});
