/**
 * TICKET 168g — Ambush Bait's optional fight: what the run records, how the fight is classed, and
 * what a win pays.
 *
 * What would fail silently: the fight rolling as an "event" (no enemies, no rung), the double scrap
 * landing on some other fight, the flag surviving the fight (every later fight paying double), and
 * a run saved mid-fight losing the fact that it was an event fight.
 */

import { describe, expect, it } from 'vitest';

import runReducer, { enterNode, resolveEncounter, startEventFight, type RunSliceState } from '../../ui/store/runSlice';
import { rollDropTable, scrapForWin } from '../RewardSystem';
import { RunStateSchema } from '../runTypes';
import { createRun } from './createRun';
import { EVENT_FIGHT_SCRAP_MULTIPLIER, eventFightScrapMultiplier, fightKindOf, fightNodeFor, isEventFight } from './eventFight';
import { offerGyms } from './gyms';
import type { IMingmingState } from '../types';
import type { IRegionNode, IRunState } from '../runTypes';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const base = (): IRunState => createRun({ seed: 'ambush-run', offer: offerGyms('ambush-offer')[0], party: [KRAKEN], startedAt: 1 });

/** The run stood on an event node, the phase `enterNode` leaves for a non-fight kind. */
function onEvent(over: Partial<IRunState> = {}): { run: IRunState; node: IRegionNode } {
    const raw = base();
    const node = raw.nodes.find((candidate) => candidate.kind === 'event')!;
    const run = { ...raw, currentNodeId: node.id, ...over };
    return { run, node };
}
const stateOf = (run: IRunState): RunSliceState => ({ run });

describe('startEventFight', () => {
    it('on an event node, puts the run into an encounter and records that it is an event fight', () => {
        const { run } = onEvent();
        expect(run.phase).toBe('map');
        const after = runReducer(stateOf(run), startEventFight()).run!;
        expect(after.phase).toBe('encounter');
        expect(after.eventFight).toBe(true);
        expect({ ...after, phase: run.phase, eventFight: undefined }).toEqual({ ...run, eventFight: undefined });
    });

    it('refuses off an event node, in the middle of a fight, and with no run — byte for byte', () => {
        const raw = base();
        const wild = raw.nodes.find((node) => node.kind === 'wild')!;
        const onWild = { ...raw, currentNodeId: wild.id };
        expect(runReducer(stateOf(onWild), startEventFight()).run).toEqual(onWild);

        const { run } = onEvent({ phase: 'encounter' });
        expect(runReducer(stateOf(run), startEventFight()).run).toEqual(run);

        expect(runReducer({ run: null }, startEventFight()).run).toBeNull();
    });
});

describe('resolveEncounter after an event fight', () => {
    it('clears the flag, counts the fight and goes back to the map', () => {
        const { run } = onEvent();
        const fighting = runReducer(stateOf(run), startEventFight());
        const after = runReducer(fighting, resolveEncounter()).run!;
        expect(after.phase).toBe('map');
        expect(after.fightsResolved).toBe(run.fightsResolved + 1);
        expect(after.eventFight ?? false).toBe(false);
    });

    it('leaves a run that never fought an event exactly as it was (no stray field)', () => {
        const { run } = onEvent({ phase: 'encounter' });
        expect('eventFight' in runReducer(stateOf(run), resolveEncounter()).run!).toBe(false);
    });

    it('the next ordinary fight is not an event fight', () => {
        const { run, node } = onEvent();
        let state = runReducer(stateOf(run), startEventFight());
        state = runReducer(state, resolveEncounter());
        expect(isEventFight(state.run!, node)).toBe(false);
        expect(eventFightScrapMultiplier(state.run!, node)).toBe(1);
    });
});

describe('the run schema', () => {
    it('a run saved before the field parses to "not an event fight"', () => {
        const { eventFight: _dropped, ...older } = onEvent().run;
        expect(RunStateSchema.parse(older).eventFight).toBe(false);
    });

    it('a run saved mid-fight keeps the flag through a parse', () => {
        const fighting = runReducer(stateOf(onEvent().run), startEventFight()).run!;
        expect(RunStateSchema.parse(JSON.parse(JSON.stringify(fighting))).eventFight).toBe(true);
    });
});

describe('how the fight is classed and what it pays', () => {
    it('an event node in an event fight is a WILD; the same node otherwise is an event', () => {
        const { run, node } = onEvent();
        expect(fightKindOf(run, node)).toBe('event');
        const fighting = runReducer(stateOf(run), startEventFight()).run!;
        expect(fightKindOf(fighting, node)).toBe('wild');
        expect(fightNodeFor(fighting, node)).toEqual({ ...node, kind: 'wild' });
        expect(fightNodeFor(run, node)).toBe(node);
    });

    it('a real wild node during a (stale) flag is untouched: only an event node changes kind', () => {
        const raw = base();
        const wild = raw.nodes.find((node) => node.kind === 'wild')!;
        expect(fightKindOf({ ...raw, eventFight: true }, wild)).toBe('wild');
        expect(eventFightScrapMultiplier({ ...raw, eventFight: true }, wild)).toBe(1);
    });

    it('a win pays twice what a wild pays, for 1, 2 and 3 enemies', () => {
        const { run, node } = onEvent();
        const fighting = runReducer(stateOf(run), startEventFight()).run!;
        expect(EVENT_FIGHT_SCRAP_MULTIPLIER).toBe(2);
        for (const count of [1, 2, 3]) {
            const defeated = Array.from({ length: count }, (_, index) => ({
                id: `e${index}`, definitionId: 'fenrir', primaryElement: 'Fire', currentHp: 0, maxHp: 30,
            })) as never[];
            const bundle = rollDropTable({
                defeated, nodeKind: fightKindOf(fighting, node), party: [{ definitionId: 'kraken', activeOS: 'kraken_v1' }], seed: `pay-${count}`,
            });
            expect(bundle.scraps).toBe(scrapForWin('wild', count));
            expect(bundle.scraps * eventFightScrapMultiplier(fighting, node)).toBe(2 * scrapForWin('wild', count));
        }
    });
});

describe('walking onto an event node does not start a fight by itself', () => {
    it('enterNode leaves the phase on the map', () => {
        const raw = base();
        const node = raw.nodes.find((candidate) => candidate.kind === 'event')!;
        expect(runReducer(stateOf(raw), enterNode(node.id)).run!.phase).toBe('map');
    });
});
