/**
 * TICKET 170a — what a walk leaves at the gym gate, so many tiers can play the gauntlet from it.
 *
 * Types only, in their own file so `runWalker.ts` (which builds one) and `ghostWalk.ts` (which hands
 * one back to `runWalker.ts`) can both name it without importing each other's values.
 *
 * A snapshot is the run exactly as the walker stood at the gym node, BEFORE the gate's free upgrade
 * and patch: the `IRunState`, the roster that `partyIds` index into, the fight records and log so
 * far, and two counts. It is plain data. Nothing in it is mutated by playing from it; every play
 * starts from a deep copy.
 */

import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';
import type { IRunLog } from '../../engine/run/runLog';
import type { FightRecord } from './runWalker';

export interface GymSnapshot {
    /** What the walk was asked, so a resumed play rebuilds the same gym, offer and policy. */
    readonly input: {
        readonly seed: string;
        readonly starter: string;
        readonly gymIndex: number;
        readonly upgrades?: boolean;
        readonly patchPrice?: number;
    };
    /** The run at the gym gate, standing on the gym node. Its `tier` is the tier the map was walked at. */
    readonly run: IRunState;
    /** Every body the walker holds, party or not. `run.partyIds` index into it. */
    readonly roster: ReadonlyArray<IMingmingState>;
    /** The fights played on the way, ghost fights included (marked `ghost: true`). */
    readonly fights: ReadonlyArray<FightRecord>;
    /** Fights lost for real and carried on as wins by the ghost rule. */
    readonly ghostFights: number;
    /** Fights the walker really won on the way. */
    readonly realFightsWon: number;
    readonly log: IRunLog;
    /** The log's next `seq`, so a resumed play continues the numbering. */
    readonly seq: number;
}
