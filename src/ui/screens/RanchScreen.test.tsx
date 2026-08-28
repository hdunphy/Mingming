/**
 * The ranch screen — ticket 20, retargeted by ticket 11.
 *
 * Rendered to static markup, the shape the panel tests established (`SnapshotPanel.test.tsx`): the
 * repo has no `@testing-library/react`, and `renderToStaticMarkup` never runs effects, which keeps
 * `initAudio()` and the save-load mount effect out of the way.
 *
 * WHAT LEFT. This file used to assert that the Roster section explained a *refused party pick* —
 * "Already fielding this species" — because a silently swallowed click is indistinguishable from a
 * bug. The ranch has no party any more (`IRanchState` has no `activeParty`), so the explanation
 * moved with the choice: `RunStart` is where a party is picked and where a refusal has to be
 * legible, and the rule itself is tested in `engine/party.test.ts`. What is left to assert here is
 * that the Roster section is honest about being a collection rather than a loadout.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import RanchScreen from './RanchScreen';
import type { IRanchMember, IRanchState } from '../../engine/runTypes';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';

const member = (id: string, definitionId: string, activeOS?: string): IRanchMember => ({
    id,
    definitionId,
    attackIV: 7,
    defenseIV: 11,
    hpIV: 23,
    activeOS: activeOS ?? `${definitionId}_v1`,
});

function render(game: Partial<IRanchState>, section: 'expedition' | 'roster' | 'assembly' | 'vault' | 'codex' = 'roster'): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: { game: { ...createEmptyRanch(), ...game } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(
        <Provider store={store}>
            <RanchScreen initialSection={section} />
        </Provider>,
    );
}

describe('RanchScreen', () => {
    it('opens on the roster and shows the individual’s stat roll', () => {
        const markup = render({ roster: [member('a1', 'kraken', 'kraken_v1')] });

        expect(markup).toContain('Roster (1)');
        // Ticket 21 deleted levelling, so the roll is the whole of an individual's identity and
        // the only per-member number on the card.
        expect(markup).toContain('7');
        expect(markup).toContain('23');
        expect(markup).not.toMatch(/\bXP\b|\bLevel\b/i);
    });

    it('has no party UI at all — the party is picked at run start', () => {
        // Ticket 11: the slot grid, the "Active party n / 3" heading and the click-to-field
        // behaviour are gone with `activeParty`. A screen that still offered them would be
        // offering a choice with nowhere to store it.
        const markup = render({ roster: [member('a1', 'kraken'), member('a2', 'kraken')] });

        expect(markup).not.toMatch(/Active party/i);
        expect(markup).not.toMatch(/Empty slot/i);
        expect(markup).not.toMatch(/In party/i);
        // ...and it says so, so the player knows where the choice moved to.
        expect(markup).toContain('The party is chosen at run start');
    });

    it('shows two of a species without complaint — the roster is a collection', () => {
        const markup = render({ roster: [member('a1', 'kraken'), member('a2', 'kraken')] });

        expect(markup).toContain('Roster (2)');
        expect(markup).not.toContain('Already fielding this species');
    });

    it('has no scrap counter and no deck builder — both are run-scoped now', () => {
        const markup = render({ roster: [member('a1', 'kraken')] });

        expect(markup).not.toMatch(/scrap/i);
        expect(markup).not.toMatch(/deck builder/i);
    });

    it('teaches blueprints on the assembly tab, once — ticket 24', () => {
        const fresh = render({ roster: [member('a1', 'kraken')], seenTips: [] }, 'assembly');
        expect(fresh).toContain('Blueprints are what you keep');
        // Both exits are on screen. A tutorial you cannot leave is the thing returning players
        // resent, so "everything skippable" is asserted rather than assumed.
        expect(fresh).toContain('Got it');
        expect(fresh).toContain('Skip tips');

        const taught = render(
            { roster: [member('a1', 'kraken')], seenTips: ['ranch:blueprints'] },
            'assembly',
        );
        expect(taught).not.toContain('Blueprints are what you keep');
        // The section itself is untouched by the tip being gone.
        expect(taught).toContain('Assembly bay');
    });

    it('does not put the blueprint tip on a tab it is not about', () => {
        const markup = render({ roster: [member('a1', 'kraken')], seenTips: [] }, 'roster');
        expect(markup).not.toContain('Blueprints are what you keep');
    });

    it('the vault reports the RUN’s drivers, and says so when there is no run', () => {
        const markup = render({ roster: [member('a1', 'kraken')] }, 'vault');

        expect(markup).toContain('Nothing installed');
        expect(markup).toMatch(/run-scoped|lost when it ends/i);
    });

    it('has a codex tab, and it opens on the overview — ticket 31', () => {
        const markup = render({ roster: [member('a1', 'kraken')] }, 'codex');

        expect(markup).toContain('📖');
        expect(markup).toContain('Codex');
        // Fresh ranch, so every track reads zero — and the screen still shows the target.
        expect(markup).toContain('Cards seen');
        expect(markup).toMatch(/0 \/ \d+/);
    });
});

/**
 * TICKET 68 ruling 4 — the offer screen has to TELEGRAPH the leader's Driver.
 *
 * Rendered through the Expedition section, which is where `RunStart` lives. The claim is not
 * cosmetic: the route is a run's one irreversible choice and it is made here, so a boss built around
 * an escalating aura is answerable at party selection or not at all. A missing rule text is a
 * player learning the fight by losing it.
 */
describe('RanchScreen — the gym offer telegraph (ticket 68)', () => {
    const roster = [member('a1', 'kraken', 'kraken_v1')];

    it('prints the authored leader’s Driver by name and rule on the offer card', () => {
        const markup = render({ roster }, 'expedition');

        // All three leaders are always offered (`offerGyms` rule 3), so Emberfall's Driver is on
        // this screen for every seed — no fixture has to pin one.
        expect(markup).toContain('Emberfall');
        expect(markup).toContain('WAR FOOTING');
        expect(markup).toContain('Strengthened');
        expect(markup).toContain('turn 4');
    });

    it('still prints the un-authored leaders’ existing relic text, unchanged (ruling 6)', () => {
        const markup = render({ roster }, 'expedition');

        expect(markup).toContain('Tidewrack');
        expect(markup).toContain('Rootfall');
        // One of the three relic names, whichever the biomes produce — the point is that a gym
        // ruling 6 has not migrated is not left with a blank signature block.
        expect(markup).toMatch(/FIRE_RELIC_OS|WATER_RELIC_OS|ICE_RELIC_OS/);
    });

    it('never calls either of them a relic in the player-facing name (ruling 1)', () => {
        // The naming law: `boss_relic_*` is an id, not a word the game says. The relic OSes still
        // print their own `name`/`description` from hooks.json, and those strings are ticket 18's —
        // what must not appear is the raw id leaking through as a label.
        const markup = render({ roster }, 'expedition');
        expect(markup).not.toContain('boss_relic_');
        expect(markup).not.toContain('driver_war_footing');
    });
});
