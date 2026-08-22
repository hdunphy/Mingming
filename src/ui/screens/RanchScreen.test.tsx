/**
 * The ranch screen — ticket 20.
 *
 * Rendered to static markup, the shape the panel tests established (`SnapshotPanel.test.tsx`): the
 * repo has no `@testing-library/react`, and `renderToStaticMarkup` never runs effects, which keeps
 * `initAudio()` and the save-load mount effect out of the way.
 *
 * What is worth asserting about a screen, as opposed to a reducer, is that the player can SEE the
 * rules. The species clause and the blueprint price are both enforced in `gameSlice` and tested
 * there; the failure mode this file guards is the screen quietly swallowing a click, which is
 * indistinguishable from a bug to whoever is holding the controller.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import RanchScreen from './RanchScreen';
import { PARTY_SIZE, partyBlockFor } from '../../engine/party';
import { createDefaultSave } from '../../engine/gameTypes';
import type { IPlayerSave } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';
import battleReducer from '../store/battleSlice';
import gameReducer from '../store/gameSlice';

const member = (id: string, definitionId: string, activeOS?: string): IMingmingState => ({
    id,
    definitionId,
    blueprintsCollected: 0,
    attackIV: 7,
    defenseIV: 11,
    hpIV: 23,
    ...(activeOS === undefined ? {} : { activeOS }),
});

function render(game: Partial<IPlayerSave>): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer },
        preloadedState: { game: { ...createDefaultSave(), ...game } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(
        <Provider store={store}>
            <RanchScreen />
        </Provider>,
    );
}

describe('partyBlockFor — the rule the screen and the reducer share', () => {
    const kraken1 = member('a1', 'kraken');
    const kraken2 = member('a2', 'kraken');
    const fenrir = member('b1', 'fenrir');

    it('blocks a second member of a species already in the party', () => {
        expect(partyBlockFor(kraken2, [kraken1])).toBe('duplicate-species');
    });

    it('blocks anything once the party is full', () => {
        const full = [kraken1, fenrir, member('c1', 'ratatoskr')];
        expect(full).toHaveLength(PARTY_SIZE);
        expect(partyBlockFor(member('d1', 'huldra'), full)).toBe('party-full');
    });

    it('never blocks a member that is already in the party — that click removes it', () => {
        expect(partyBlockFor(kraken1, [kraken1, fenrir, member('c1', 'ratatoskr')])).toBeNull();
    });

    it('allows an unrelated species with room to spare', () => {
        expect(partyBlockFor(fenrir, [kraken1])).toBeNull();
    });
});

describe('RanchScreen', () => {
    it('opens on the roster and shows the individual’s stat roll', () => {
        const markup = render({ roster: [member('a1', 'kraken', 'kraken_v1')] });

        expect(markup).toContain('Active party');
        // Ticket 21 deleted levelling, so the roll is the whole of an individual's identity and
        // the only per-member number on the card.
        expect(markup).toContain('7');
        expect(markup).toContain('23');
        expect(markup).not.toMatch(/\bXP\b|\bLevel\b/i);
    });

    it('SAYS why a duplicate species cannot join, rather than ignoring the click', () => {
        const markup = render({
            roster: [member('a1', 'kraken'), member('a2', 'kraken')],
            activeParty: ['a1'],
        });

        expect(markup).toContain('Already fielding this species');
    });

    it('has no scrap counter and no deck builder — both are run-scoped now', () => {
        const markup = render({ roster: [member('a1', 'kraken')], scrapCount: 250 });

        expect(markup).not.toContain('250');
        expect(markup).not.toMatch(/scrap/i);
        expect(markup).not.toMatch(/deck builder/i);
    });
});
