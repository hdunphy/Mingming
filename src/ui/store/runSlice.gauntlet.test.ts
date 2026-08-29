/**
 * THE GAUNTLET'S REDUCERS — ticket 18.
 *
 * `engine/run/gauntlet.test.ts` proves what is *in* each of the three fights. This proves what the
 * three fights do to the run, which is a different set of failures:
 *
 * - **The chain.** `beginGauntlet` → `advanceGauntlet` ×2 → `finishGauntlet`. A chain that loses its
 *   place replays fight one forever, which is exactly what ticket 11 declined to ship rather than
 *   half-build.
 * - **HP carries, and a downed member stays down.** The whole point of the gym
 *   (`exploration-map.md`: "three fights, NO healing between them"), and the two fields
 *   `IGauntletProgress` exists for.
 * - **A revive un-downs.** Ticket 15's resolution names this as ticket 18's to wire: a revived
 *   member must leave `downedMemberIds` and enter `persistedHp`, or the next fight re-downs them.
 *   Both paths are tested — the explicit `reviveGauntletMember` hook, and the recompute at the end
 *   of the fight that catches it either way.
 * - **The run ends on a win and on a wipe.** Winning the gauntlet is the run's victory condition;
 *   a wipe in fight one is as final as a wipe anywhere else.
 * - **The save shape survives every step.** Each state is parsed against `RunStateSchema`, because
 *   a reducer that writes an unsavable run fails silently, on the next autosave, a screen later.
 */

import { describe, expect, it } from 'vitest';

import runReducer, {
    advanceGauntlet,
    beginGauntlet,
    endRun,
    enterNode,
    finishGauntlet,
    reviveGauntletMember,
    startRun,
    type RunSliceState,
} from './runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { GAUNTLET_FIGHTS } from '../../engine/run/gauntlet';
import { RunStateSchema } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

const member = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});

const PARTY = [
    member('mm1', 'kraken', 'kraken_v1'),
    member('mm2', 'fenrir', 'fenrir_v1'),
    member('mm3', 'ratatoskr', 'ratatoskr_v1'),
];

function makeRun(): IRunState {
    return createRun({
        seed: 'gauntlet-reducer-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
}

/** Walk the player onto a node of the given kind, exactly as `enterNode` would leave them. */
function standingOn(kind: IRunState['nodes'][number]['kind']): RunSliceState {
    const run = makeRun();
    const target = run.nodes.find((n) => n.kind === kind && n.id !== run.currentNodeId)!;
    return runReducer(runReducer(undefined, startRun(run)), enterNode(target.id));
}

/** Every state this file produces has to be a state the run can be saved in. */
function savable(state: RunSliceState): RunSliceState {
    expect(RunStateSchema.safeParse(state.run).success).toBe(true);
    return state;
}

const atGym = (): RunSliceState => savable(runReducer(standingOn('gym'), beginGauntlet()));

// ---------------------------------------------------------------------------------------------
// beginGauntlet
// ---------------------------------------------------------------------------------------------

describe('beginGauntlet', () => {
    it('turns the gym node into three fights', () => {
        const state = atGym();

        expect(state.run?.phase).toBe('gauntlet');
        expect(state.run?.gauntlet).toEqual({
            fightIndex: 0,
            totalFights: GAUNTLET_FIGHTS,
            persistedHp: {},
            downedMemberIds: [],
        });
    });

    it('is idempotent — a second dispatch does not reset the chain', () => {
        // React runs effects twice under StrictMode, and `RunScreen`'s trigger reads the phase it
        // writes. A second `beginGauntlet` that reset `fightIndex` would be an infinite gauntlet.
        const started = atGym();
        const midway = runReducer(started, advanceGauntlet([{ memberId: 'mm1', hp: 20 }]));
        const again = runReducer(midway, beginGauntlet());

        expect(again.run?.gauntlet?.fightIndex).toBe(1);
        expect(again).toEqual(midway);
    });

    it('refuses anywhere that is not a gym', () => {
        for (const kind of ['wild', 'marketplace', 'workshop'] as const) {
            const state = standingOn(kind);
            const after = runReducer(state, beginGauntlet());

            expect(after.run?.gauntlet).toBeNull();
            expect(after).toEqual(state);
        }
    });

    it('is a no-op with no run in progress', () => {
        expect(runReducer({ run: null }, beginGauntlet()).run).toBeNull();
    });
});

// ---------------------------------------------------------------------------------------------
// advanceGauntlet — the chain, and the carry
// ---------------------------------------------------------------------------------------------

describe('advanceGauntlet', () => {
    it('records the surviving party’s HP and the fallen, and moves to the next fight', () => {
        const state = savable(runReducer(atGym(), advanceGauntlet([
            { memberId: 'mm1', hp: 31 },
            { memberId: 'mm2', hp: 0 },
            { memberId: 'mm3', hp: 12 },
        ])));

        expect(state.run?.gauntlet?.fightIndex).toBe(1);
        expect(state.run?.gauntlet?.persistedHp).toEqual({ mm1: 31, mm2: 0, mm3: 12 });
        expect(state.run?.gauntlet?.downedMemberIds).toEqual(['mm2']);
        // A downed member is recorded in BOTH: 0 in the HP map is what builds them into the next
        // fight at 0 rather than at full (`IBattleSetup.persistedHp`), and the list is what the Pit
        // Stop and the revive hook read.
        expect(state.run?.gauntlet?.persistedHp.mm2).toBe(0);
    });

    it('counts the fight, without leaving the gauntlet', () => {
        const before = atGym();
        const after = runReducer(before, advanceGauntlet([{ memberId: 'mm1', hp: 20 }]));

        expect(after.run?.fightsResolved).toBe((before.run?.fightsResolved ?? 0) + 1);
        // There is no walking out of the exam: the phase stays put and `RunScreen` keeps rendering
        // the Pit Stop rather than the map.
        expect(after.run?.phase).toBe('gauntlet');
    });

    it('keeps a member’s carried HP when the payload omits them', () => {
        // Defensive rather than expected — `buildBattleSetup` fields every party member — but the
        // failure it prevents is the bad one: an omitted member walking into the next fight healed.
        let state = runReducer(atGym(), advanceGauntlet([
            { memberId: 'mm1', hp: 5 },
            { memberId: 'mm2', hp: 0 },
        ]));
        state = runReducer(state, advanceGauntlet([{ memberId: 'mm3', hp: 40 }]));

        expect(state.run?.gauntlet?.persistedHp).toEqual({ mm1: 5, mm2: 0, mm3: 40 });
        expect(state.run?.gauntlet?.downedMemberIds).toEqual(['mm2']);
    });

    it('a member who fell in fight 1 is still down going into fight 3', () => {
        let state = runReducer(atGym(), advanceGauntlet([{ memberId: 'mm2', hp: 0 }]));
        state = savable(runReducer(state, advanceGauntlet([{ memberId: 'mm1', hp: 9 }])));

        expect(state.run?.gauntlet?.fightIndex).toBe(2);
        expect(state.run?.gauntlet?.downedMemberIds).toEqual(['mm2']);
        expect(state.run?.gauntlet?.persistedHp.mm2).toBe(0);
    });

    it('un-downs a member reported alive — the revive, seen from the end of the fight', () => {
        let state = runReducer(atGym(), advanceGauntlet([{ memberId: 'mm2', hp: 0 }]));
        expect(state.run?.gauntlet?.downedMemberIds).toEqual(['mm2']);

        // Revived mid-fight-two and still standing when it ended.
        state = runReducer(state, advanceGauntlet([{ memberId: 'mm2', hp: 18 }]));

        expect(state.run?.gauntlet?.downedMemberIds).toEqual([]);
        expect(state.run?.gauntlet?.persistedHp.mm2).toBe(18);
    });

    it('floors HP at a non-negative integer, so the run stays savable', () => {
        // `RunStateSchema` types `persistedHp` as non-negative ints. Overkill damage arrives here as
        // a negative `currentHp` from the battle, and a run that cannot save itself is worse than a
        // rounded number.
        const state = savable(runReducer(atGym(), advanceGauntlet([
            { memberId: 'mm1', hp: -14 },
            { memberId: 'mm2', hp: 7.6 },
        ])));

        expect(state.run?.gauntlet?.persistedHp).toEqual({ mm1: 0, mm2: 7 });
        expect(state.run?.gauntlet?.downedMemberIds).toEqual(['mm1']);
    });

    it('ignores an id that is not in the party', () => {
        const state = runReducer(atGym(), advanceGauntlet([{ memberId: 'an-enemy', hp: 4 }]));

        expect(state.run?.gauntlet?.persistedHp).toEqual({});
    });

    it('refuses on the last fight — that one is finishGauntlet’s', () => {
        let state = runReducer(atGym(), advanceGauntlet([{ memberId: 'mm1', hp: 20 }]));
        state = runReducer(state, advanceGauntlet([{ memberId: 'mm1', hp: 10 }]));
        expect(state.run?.gauntlet?.fightIndex).toBe(GAUNTLET_FIGHTS - 1);

        const after = runReducer(state, advanceGauntlet([{ memberId: 'mm1', hp: 5 }]));

        expect(after).toEqual(state);
    });

    it('is a no-op outside a gauntlet', () => {
        const onTheMap = standingOn('marketplace');
        expect(runReducer(onTheMap, advanceGauntlet([{ memberId: 'mm1', hp: 1 }]))).toEqual(onTheMap);
        expect(runReducer({ run: null }, advanceGauntlet([])).run).toBeNull();
    });
});

// ---------------------------------------------------------------------------------------------
// reviveGauntletMember — the hook, not the policy
// ---------------------------------------------------------------------------------------------

describe('reviveGauntletMember', () => {
    const withDowned = (): RunSliceState =>
        runReducer(atGym(), advanceGauntlet([{ memberId: 'mm1', hp: 22 }, { memberId: 'mm2', hp: 0 }]));

    it('moves a member out of the downed list and into the HP map, in one action', () => {
        const state = savable(runReducer(withDowned(), reviveGauntletMember({ memberId: 'mm2', hp: 26 })));

        expect(state.run?.gauntlet?.downedMemberIds).toEqual([]);
        expect(state.run?.gauntlet?.persistedHp.mm2).toBe(26);
        // Nobody else is touched: a revive is one member coming back, not a rest stop.
        expect(state.run?.gauntlet?.persistedHp.mm1).toBe(22);
    });

    it('is what stops the NEXT fight re-downing them', () => {
        // Ticket 15's resolution, in one assertion: without this the member's 0 rides into the next
        // fight through `persistedHp` and the revive is undone by the chain that recorded it.
        let state = runReducer(withDowned(), reviveGauntletMember({ memberId: 'mm2', hp: 26 }));
        state = runReducer(state, advanceGauntlet([{ memberId: 'mm2', hp: 26 }]));

        expect(state.run?.gauntlet?.persistedHp.mm2).toBe(26);
        expect(state.run?.gauntlet?.downedMemberIds).toEqual([]);
    });

    it('refuses a member who is not down — a revive on a living unit is a bug at the call site', () => {
        const state = withDowned();
        expect(runReducer(state, reviveGauntletMember({ memberId: 'mm1', hp: 40 }))).toEqual(state);
    });

    it('refuses a non-positive or fractional HP — reviving to 0 is not reviving', () => {
        const state = withDowned();
        for (const hp of [0, -1, 12.5]) {
            expect(runReducer(state, reviveGauntletMember({ memberId: 'mm2', hp }))).toEqual(state);
        }
    });

    it('is a no-op outside a gauntlet', () => {
        const onTheMap = standingOn('wild');
        expect(runReducer(onTheMap, reviveGauntletMember({ memberId: 'mm1', hp: 10 }))).toEqual(onTheMap);
    });
});

// ---------------------------------------------------------------------------------------------
// The whole chain, and both ways out
// ---------------------------------------------------------------------------------------------

describe('the three-fight chain', () => {
    it('runs begin → advance → advance → finish, and ends the run on the win', () => {
        let state = atGym();
        expect(state.run?.gauntlet?.fightIndex).toBe(0);

        state = savable(runReducer(state, advanceGauntlet([{ memberId: 'mm1', hp: 30 }])));
        expect(state.run?.gauntlet?.fightIndex).toBe(1);

        state = savable(runReducer(state, advanceGauntlet([{ memberId: 'mm1', hp: 14 }])));
        expect(state.run?.gauntlet?.fightIndex).toBe(2);

        state = savable(runReducer(state, finishGauntlet()));
        // A finished gauntlet is not a gauntlet in progress. The phase is back on the map for the
        // instant before `endRun` says the run is over — the same two-step `resolveEncounter` and
        // `endRun` have always been.
        expect(state.run?.gauntlet).toBeNull();
        expect(state.run?.phase).toBe('map');
        expect(state.run?.fightsResolved).toBe(3);

        state = savable(runReducer(state, endRun('victory')));
        expect(state.run?.phase).toBe('ended');
        expect(state.run?.outcome).toBe('victory');
    });

    it('a wipe ends the run wherever in the gauntlet it happens', () => {
        // There is no partial credit for two fights of three: `handleDefeat` ends the run, and the
        // gauntlet progress goes with it because the run does.
        const state = savable(runReducer(atGym(), endRun('defeat')));

        expect(state.run?.phase).toBe('ended');
        expect(state.run?.outcome).toBe('defeat');
    });

    it('finishGauntlet refuses before the last fight', () => {
        const state = atGym();
        expect(runReducer(state, finishGauntlet())).toEqual(state);
        expect(runReducer({ run: null }, finishGauntlet()).run).toBeNull();
    });

    it('leaves the run byte-identical on every refusal', () => {
        // The slice's standing convention: a reducer has no error channel, so an invalid dispatch
        // changes nothing at all rather than changing something slightly.
        const state = atGym();
        const before = JSON.stringify(state);

        runReducer(state, beginGauntlet());
        runReducer(state, finishGauntlet());
        runReducer(state, reviveGauntletMember({ memberId: 'nobody', hp: 5 }));

        expect(JSON.stringify(state)).toBe(before);
    });
});
