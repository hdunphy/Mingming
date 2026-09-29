/**
 * TICKET 168a — the balance walker at an event node.
 *
 * The walker has to survive events (or every measurement after 168 is a crash) and leave a trace of
 * them (or 168's own measurement has nothing to count). It takes the first free choice, else Leave.
 */

import { describe, expect, it } from 'vitest';

import { EVENTS } from '../../engine/run/events/eventCatalogue';
import { BUILT_EVENTS } from '../../engine/run/events/eventDraw';
import { playableChoices } from '../../engine/run/events/eventChoices';
import { configureStore } from '@reduxjs/toolkit';

import runReducer, { startRun } from '../../ui/store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IRunState } from '../../engine/runTypes';
import { BlueprintLedger } from './BlueprintLedger';
import { memberFor, playEventNode, walkRun } from './runWalker';
import { chooseEventChoice, isFreeChoice } from './eventPolicy';

describe('chooseEventChoice', () => {
    it('takes the first free choice, and leaves when none is free', () => {
        const cache = EVENTS.find((e) => e.id === 'scrap_cache')!;
        expect(chooseEventChoice(cache).id).toBe('take');

        const priced = {
            ...cache,
            choices: [
                { id: 'buy', label: 'Buy', detail: '', outcomes: [{ type: 'SCRAP' as const, amount: -10 }] },
                { id: 'leave', label: 'Leave', detail: '', outcomes: [] },
            ],
        };
        expect(chooseEventChoice(priced).id).toBe('leave');
    });

    it('never takes a temporary Driver unless it is the only option (168b)', () => {
        const stream = EVENTS.find((e) => e.id === 'corrupted_stream')!;
        // Corrupted Stream has no free option and no Leave: with 25 scrap the walker pays to
        // reroute, and with less it has no choice but to push through.
        expect(chooseEventChoice(stream, 25).id).toBe('reroute');
        expect(chooseEventChoice(stream, 24).id).toBe('push');
        // Scrap Cache's Dig deeper adds a temporary Driver, so the free Take beats it.
        expect(chooseEventChoice(EVENTS.find((e) => e.id === 'scrap_cache')!).id).toBe('take');
    });

    it('never picks a choice that costs scrap', () => {
        for (const event of EVENTS) {
            // Corrupted Stream and The Toll have no Leave, so a walker that finds nothing free is
            // forced to take something; every other event has an exit and the walker uses it.
            if (!event.choices.some((c) => c.id === 'leave')) continue;
            if (!BUILT_EVENTS.has(event.id)) continue;
            const chosen = chooseEventChoice(event);
            if (chosen.id !== 'leave') expect(isFreeChoice(chosen)).toBe(true);
            expect(playableChoices(event)).toContain(chosen);
        }
    });
});

describe('walkRun across event nodes', () => {
    // Seeds whose shortest path to the gym crosses an event node early (the walker only steps onto
    // an event when it is the only node on that path, so most seeds never see one).
    const SEEDS = ['ev-8', 'ev-33'];

    it('records EVENT_RESOLVED when a walk crosses an event node, and does not throw', () => {
        for (const seed of SEEDS) {
            const result = walkRun({ seed, starter: 'kraken_v1', gymIndex: 0, stopAfterFights: 4 });
            const entered = result.log.events.filter((e) => e.kind === 'NODE_ENTERED' && e.nodeKind === 'event').length;
            const resolved = result.log.events.filter((e) => e.kind === 'EVENT_RESOLVED');
            expect(entered).toBeGreaterThan(0);
            // One resolution for every event node the walk stepped onto.
            expect(resolved).toHaveLength(entered);
        }
    }, 120_000);

    it('is repeatable: the same seed resolves the same events the same way', () => {
        const resolutions = (): string[] => walkRun({ seed: 'ev-33', starter: 'kraken_v1', gymIndex: 0, stopAfterFights: 4 })
            .log.events.flatMap((e) => (e.kind === 'EVENT_RESOLVED' ? [`${e.eventId}:${e.choiceId}`] : []));
        expect(resolutions()).toEqual(resolutions());
    }, 120_000);
});

describe('chooseEventChoice for the six pick-a-reward events (168d)', () => {
    const pick = (id: string, scrap?: number): string => chooseEventChoice(EVENTS.find((e) => e.id === id)!, scrap).id;

    it('takes the free pick, and leaves Data Broker because both of its picks cost scrap', () => {
        expect(pick('abandoned_terminal')).toBe('upgrade');
        expect(pick('wild_tracks')).toBe('pick');
        expect(pick('rare_vault')).toBe('pick');
        expect(pick('macro_crate')).toBe('pick');
        expect(pick('stray_mingming')).toBe('recruit');
        expect(pick('data_broker', 1000)).toBe('leave');
    });
});

describe('playEventNode with a forced event (168d)', () => {
    /** A run standing on an event node, with every built event but one already seen. */
    function setup(only: string) {
        const raw = createRun({ seed: 'walker-pick', offer: offerGyms('walker-offer')[0], party: [memberFor('mm1', 'kraken_v1')], startedAt: 1 });
        const target = raw.nodes.find((node) => node.id !== raw.currentNodeId)!;
        const run: IRunState = {
            ...raw,
            eventHistory: [...BUILT_EVENTS].filter((id) => id !== only).map((eventId, i) => (
                { nodeId: `other${i}`, eventId, choiceId: 'leave', grants: [] }
            )),
        };
        const store = configureStore({ reducer: { run: runReducer }, middleware: (d) => d({ serializableCheck: false }) });
        store.dispatch(startRun(run));
        return { store, node: { ...target, visited: 1 } };
    }
    const play = (only: string, ledger = new BlueprintLedger(), recruit?: () => void) => {
        const { store, node } = setup(only);
        const log: unknown[] = [];
        playEventNode(store, node, [memberFor('mm1', 'kraken_v1')], ledger, () => ({ taken: null, toCollection: false }), (e) => log.push(e), recruit);
        return { run: store.getState().run.run!, log, ledger };
    };

    it('Abandoned Terminal: upgrades one card', () => {
        expect(play('abandoned_terminal').run.deck.filter((c) => c.upgraded === true)).toHaveLength(1);
    });

    it('Wild Tracks: adds the species it took to its blueprint ledger', () => {
        const { ledger, run } = play('wild_tracks');
        expect(ledger.recruitable([])).toHaveLength(1);
        expect(run.modifiers.some((m) => m.includes('blueprint'))).toBe(true);
    });

    it('Macro Crate: takes a macro onto the rack', () => {
        expect(play('macro_crate').run.macros.filter((m) => m !== null)).toHaveLength(1);
    });

    it('Stray Mingming: recruits through the callback it is given, when a blueprint is held', () => {
        const ledger = new BlueprintLedger();
        ledger.add('fenrir');
        let recruited = 0;
        const { log } = play('stray_mingming', ledger, () => { recruited += 1; });
        expect(recruited).toBe(1);
        expect(log).toContainEqual({ kind: 'EVENT_RESOLVED', eventId: 'stray_mingming', choiceId: 'recruit' });
    });

    it('Data Broker: leaves without paying', () => {
        const { run, log } = play('data_broker');
        expect(run.scrap).toBe(createRun({ seed: 'walker-pick', offer: offerGyms('walker-offer')[0], party: [memberFor('mm1', 'kraken_v1')], startedAt: 1 }).scrap);
        expect(log).toContainEqual({ kind: 'EVENT_RESOLVED', eventId: 'data_broker', choiceId: 'leave' });
    });
});

