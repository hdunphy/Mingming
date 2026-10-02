// @vitest-environment jsdom
/**
 * TICKET 183h — the data sweep and the rendered sweep.
 *
 * The registries keep their old words; the screens print them through `plain()`. So the sweep asks
 * the two questions that matter: does `plain()` leave any old word in any registry string a screen
 * can print, and does a real rendering of the big screens print none.
 */
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

import MainMenuView from '../components/MainMenuView';
import RanchScreen from '../screens/RanchScreen';
import RunSummary from '../screens/RunSummary';
import SettingsScreen from '../screens/SettingsScreen';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { createRanchMember } from '../../engine/gameTypes';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { MacroRegistry } from '../../engine/data/macroRegistry';
import { PATCHES } from '../../engine/data/patchRegistry';
import { PATCH_TEXT } from '../../engine/data/patchText';
import { DRIVER_IDS, TEMPORARY_DRIVER_IDS } from '../../engine/data/driverRegistry';
import { EVENTS } from '../../engine/run/events/eventCatalogue';
import { MODIFIERS } from '../../engine/run/modifiers/modifierRegistry';
import { TIERS } from '../../engine/run/tiers/tierRegistry';
import { FIRMWARE_REGISTRY } from '../../engine/data/firmwareRegistry';
import { CODEX_MILESTONES, codexProgress } from '../../engine/codex';
import { REFLASH_BLOCK_REASON } from '../../engine/run/events/eventReflash';
import { driverText } from './driverText';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';
import { OLD_WORDS, plain } from './labels';
import { oldWordsIn } from './sweep';

function leftOver(source: string, text: unknown): string | null {
    if (typeof text !== 'string') return null;
    const shown = plain(text);
    OLD_WORDS.lastIndex = 0;
    return OLD_WORDS.test(shown) ? `${source}: ${shown.slice(0, 100)}` : null;
}

describe('183h data sweep', () => {
    it('plain() leaves no old word in any registry string a screen can print', () => {
        const left: Array<string | null> = [];
        for (const [id, data] of Object.entries(ProgramRegistry)) left.push(leftOver(`card ${id}`, data.name), leftOver(`card ${id}`, data.description));
        for (const [id, macro] of Object.entries(MacroRegistry)) left.push(leftOver(`macro ${id}`, macro.name), leftOver(`macro ${id}`, macro.description));
        for (const [id, patch] of Object.entries(PATCHES)) left.push(leftOver(`patch ${id}`, patch.name), leftOver(`patch ${id}`, (patch as { text?: string }).text));
        for (const [os, row] of Object.entries(PATCH_TEXT)) for (const [patch, text] of Object.entries(row)) left.push(leftOver(`patch text ${os}/${patch}`, text));
        for (const id of [...DRIVER_IDS, ...TEMPORARY_DRIVER_IDS]) left.push(leftOver(`driver ${id}`, driverText(id).name), leftOver(`driver ${id}`, driverText(id).description));
        for (const event of EVENTS) {
            left.push(leftOver(`event ${event.id}`, event.name), leftOver(`event ${event.id}`, event.text));
            for (const choice of event.choices) left.push(leftOver(`event ${event.id}`, choice.label), leftOver(`event ${event.id}`, choice.detail));
        }
        for (const mod of MODIFIERS) left.push(leftOver(`modifier ${mod.id}`, mod.name), leftOver(`modifier ${mod.id}`, mod.description));
        for (const tier of TIERS) left.push(leftOver(`tier ${tier.tier}`, tier.name), leftOver(`tier ${tier.tier}`, tier.description));
        for (const [id, os] of Object.entries(FIRMWARE_REGISTRY)) left.push(leftOver(`instinct ${id}`, os.description));
        for (const reason of Object.values(REFLASH_BLOCK_REASON)) left.push(leftOver('retrain block', reason));
        for (const milestone of CODEX_MILESTONES) left.push(leftOver(`milestone ${milestone.id}`, milestone.label));
        for (const line of codexProgress({ seen: [], played: [], species: [], assembled: [], os: [] } as never)) left.push(leftOver(`codex ${line.id}`, line.label));
        expect(left.filter((line) => line !== null)).toEqual([]);
    });
});

function render(tree: ReactNode, game = createEmptyRanch(), run: unknown = null): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        preloadedState: { game, run: { run } } as unknown as undefined,
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(<Provider store={store}>{tree}</Provider>);
}

const ranch = {
    ...createEmptyRanch(),
    roster: [createRanchMember('kraken', 'kraken_v1'), createRanchMember('fenrir', 'fenrir_v1')],
    blueprints: { fenrir: 1, ratatoskr: 2 },
    codex: { seen: ['ignite'], played: ['ignite'], species: ['kraken'], assembled: ['kraken'], os: ['kraken_v1'] },
};
const baseRun = createRun({
    seed: 'sweep', offer: offerGyms('o')[0],
    party: [{ id: 'm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 1, defenseIV: 1, hpIV: 1 }],
    startedAt: 1,
});

describe('183h rendered sweep', () => {
    const screens: Record<string, () => string> = {
        'main menu': () => render(<MainMenuView />),
        'ranch: expedition': () => render(<RanchScreen initialSection="expedition" />, ranch),
        'ranch: roster': () => render(<RanchScreen initialSection="roster" />, ranch),
        'ranch: summon': () => render(<RanchScreen initialSection="assembly" />, ranch),
        'ranch: vault': () => render(<RanchScreen initialSection="vault" />, ranch, { ...baseRun, drivers: ['driver_war_footing', 'driver_first_blood'] }),
        'ranch: codex': () => render(<RanchScreen initialSection="codex" />, ranch),
        settings: () => render(<SettingsScreen />, ranch),
        'run summary': () => render(<RunSummary run={{ ...baseRun, phase: 'ended', outcome: 'victory' }} endedAt={5} />, ranch),
    };
    for (const [name, draw] of Object.entries(screens)) {
        it(`${name} prints no old word`, () => {
            expect(oldWordsIn(draw())).toEqual([]);
        });
    }
});
