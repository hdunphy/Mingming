/**
 * A CAST AS A BEAT — ticket 189b. The timeline of one card, and of one loose burst, as data.
 *
 * This is `playCast` from ticket 146c lifted out of the hook and made pure: given what the collector
 * gathered, it returns a `Beat` of timed actions instead of scheduling timers. The numbers are 146c's
 * and unchanged; what is new is WHAT ELSE rides on a cast's timeline now that the presenter owns the
 * whole stage:
 *
 * - a hook's tell that applied no status plays as the card starts (it used to play at arrival, i.e.
 *   all at once for every cast of a burst);
 * - a shield absorbing, and a body dying, play AT the impact on that body (they used to play at
 *   arrival, before the trail had even left);
 * - recoil and toll play with the first impact (the price lands when the card does);
 * - a status falling off plays with the statuses, after the last impact.
 *
 * TICKET 189c adds the displayed board to the timeline: the HP bar, the HP text and the Bark band
 * move at the impact on that body (not at play), and a tick's damage with its tell.
 */

import type { IBattleEntity, StatusType } from '../../../engine/types';
import { anchorFor, emitImpact, emitTrail } from '../emit';
import { emitHookTell } from '../osTells';
import { HOOK_BEAT_GAP_MS } from '../hookStatusBeat';
import { scheduleStatusTells } from '../statusBurst';
import {
    emitDeath, emitSelfCost, emitShieldAbsorb, emitStatusApplied, emitStatusRemoved, emitStatusTick,
} from '../statusTells';
import { TRAIL_MS, TRAIL_STAGGER_MS, type TrailElement } from '../trails';
import { type BoardOp, type BoardSink, type TimedBoardOp, applyBoardOp } from '../displayed/boardOps';
import { displayedBoard } from '../displayed/displayedBoardRuntime';
import { type Beat, type TimedAction, beatDuration } from './beat';

/** §2c: the hand card reaches the lane in 180ms, and the trail leaves after it. */
export const FLIGHT_MS = 180;
/** §2c: status tells land this far apart, after the impact. */
export const STATUS_TELL_STAGGER_MS = 60;
/** A loose burst (a tick, an expiry, a death with no card) holds the stage this long. */
export const LOOSE_BEAT_MS = 200;

export interface HookTellInfo {
    readonly hookId: string;
    readonly owner: IBattleEntity | undefined;
    readonly osId?: string;
    readonly daemonId?: string;
}

export interface PendingCast {
    readonly element: TrailElement;
    readonly sourceId: string;
    readonly targetIds: string[];
    readonly doubled: boolean;
    readonly resisted: boolean;
    readonly statuses: Array<{ targetId: string; status: StatusType }>;
    /** TICKET 171f: statuses a hook applied during this cast — played as their own beat after it. */
    readonly hookStatuses: Array<{ hookId: string; targetId: string; status: StatusType }>;
    /** TICKET 171f: the tell of each hook that applied one of those, held to play with them. */
    readonly hookTells: HookTellInfo[];
    /** TICKET 189b: tells of hooks that applied no status; they play as the card starts. */
    readonly startTells: HookTellInfo[];
    /** TICKET 189b: bodies whose shield took a hit, bodies that died, recoil/toll payers, expiries. */
    readonly shields: string[];
    readonly deaths: string[];
    readonly selfCosts: string[];
    readonly removals: string[];
    /** Damage-over-time ticks that landed inside this cast's window (a status dealing damage as it lands). */
    readonly ticks: Array<{ status: StatusType; targetId: string }>;
    /** TICKET 189c: what each hit, heal, price and shield does to the displayed board, and when. */
    readonly ops: TimedBoardOp[];
}

export function emptyCast(base: Pick<PendingCast, 'element' | 'sourceId' | 'targetIds' | 'doubled' | 'resisted'>): PendingCast {
    return {
        ...base, statuses: [], hookStatuses: [], hookTells: [], startTells: [],
        shields: [], deaths: [], selfCosts: [], removals: [], ticks: [], ops: [],
    };
}

/** Steps 2-4 of ruling 5 for one cast, plus everything that rides on its timeline. */
export function buildCastBeat(cast: PendingCast, board: BoardSink = displayedBoard): Beat {
    const actions: TimedAction[] = [];
    let last = 0;
    /** When each target is hit, so an op can land with the hit on its body. */
    const impactAtTarget = new Map<string, number>();

    // The tell of a hook that did something but applied no status: as the card starts.
    for (const tell of cast.startTells) {
        actions.push({
            at: 0, label: 'hook-tell',
            run: () => emitHookTell(tell.owner, tell.osId, tell.daemonId, cast.targetIds[0]),
        });
    }

    let firstImpact: number | null = null;
    cast.targetIds.forEach((targetId, index) => {
        // §2c: *"Side/All cards send one trail per target, 40 ms apart."* The stagger is what makes
        // a three-target card read as three hits rather than as one wide flash.
        const offset = FLIGHT_MS + index * TRAIL_STAGGER_MS;
        const impactAt = offset + TRAIL_MS;
        firstImpact ??= impactAt;
        impactAtTarget.set(targetId, impactAt);

        actions.push({
            at: offset, label: 'trail',
            run: () => {
                const from = anchorFor(cast.sourceId);
                const to = anchorFor(targetId);
                if (from && to) emitTrail(cast.element, from, to);
            },
        });
        actions.push({
            at: impactAt, label: 'impact',
            run: () => {
                const to = anchorFor(targetId);
                if (to) emitImpact(cast.element, to, cast.doubled, cast.resisted);
            },
        });
        if (cast.shields.includes(targetId)) {
            actions.push({ at: impactAt, label: 'shield', run: () => emitShieldAbsorb(targetId) });
        }
        if (cast.deaths.includes(targetId)) {
            actions.push({ at: impactAt, label: 'death', run: () => emitDeath(targetId) });
        }
        last = Math.max(last, impactAt);
    });

    // A body that died or took a shield hit without being a target (a redirect, a self-hit): with
    // the last impact rather than never.
    const targeted = new Set(cast.targetIds);
    for (const id of cast.shields) {
        if (!targeted.has(id)) actions.push({ at: last, label: 'shield', run: () => emitShieldAbsorb(id) });
    }
    for (const id of cast.deaths) {
        if (!targeted.has(id)) actions.push({ at: last, label: 'death', run: () => emitDeath(id) });
    }

    // Recoil and toll: the price lands when the card does.
    for (const id of cast.selfCosts) {
        actions.push({ at: firstImpact ?? last, label: 'self-cost', run: () => emitSelfCost(id) });
    }

    // Step 4: the statuses, after the last impact. TICKET 166b: ONE tell per status, fired on every
    // body that got it at the same instant (Henry: "don't stagger between mingmings"), 60 ms between
    // different statuses, measured from a fixed base.
    const afterImpact = last;

    // TICKET 189c: the displayed board moves with the thing that moves it. A hit or a heal lands
    // with the impact on its body (the last impact, for a body the card did not name); the price of
    // the cast with the first impact; a tick or a Bark Shield with the statuses, after the last.
    for (const { when, op } of cast.ops) {
        const at = when === 'first' ? (firstImpact ?? last)
            : when === 'after' ? afterImpact
                : (impactAtTarget.get(op.id) ?? last);
        actions.push({ at, label: 'board', run: () => applyBoardOp(board, op) });
    }

    for (const id of cast.removals) {
        actions.push({ at: afterImpact, label: 'status-removed', run: () => emitStatusRemoved(id) });
    }
    for (const tick of cast.ticks) {
        actions.push({ at: afterImpact, label: 'tick', run: () => emitStatusTick(tick.status, tick.targetId) });
    }
    for (const tell of scheduleStatusTells(afterImpact, cast.statuses, STATUS_TELL_STAGGER_MS)) {
        actions.push({
            at: tell.at, label: 'status-tell',
            run: () => { for (const targetId of tell.targetIds) emitStatusApplied(tell.status, targetId); },
        });
        last = Math.max(last, tell.at);
    }

    /*
     * TICKET 171f — the hook beat, after the card. Henry: *"Its own animation that shows the status
     * being added after the card."* One beat per hook, in the order they fired: the firmware's own
     * signature tell, then its statuses pulse on the bodies they landed on. The float that names it
     * ("+1 Burn · EMBER_FUSE") is `useBattleVfx`'s, on `HOOK_BEAT_DELAY_MS`.
     */
    const hookIds = [...new Set(cast.hookStatuses.map((entry) => entry.hookId))];
    hookIds.forEach((hookId, index) => {
        const at = last + HOOK_BEAT_GAP_MS * (index + 1);
        const statuses = cast.hookStatuses.filter((entry) => entry.hookId === hookId);
        const tell = cast.hookTells.find((entry) => entry.hookId === hookId);
        actions.push({
            at, label: 'hook-beat',
            run: () => {
                if (tell) emitHookTell(tell.owner, tell.osId, tell.daemonId, statuses[0]?.targetId);
                for (const entry of statuses) emitStatusApplied(entry.status, entry.targetId, true);
            },
        });
        if (index === hookIds.length - 1) last = at;
    });

    return { label: 'cast', actions, durationMs: beatDuration(actions, last) };
}

/**
 * Things that happen with no card behind them: a damage-over-time tick, an expiry, a body going
 * down to a tick, a recoil with no cast window. Collected from one synchronous burst and played as
 * ONE beat, so the three ticks of one turn boundary read as one moment.
 */
export interface LooseBurst {
    readonly ticks: Array<{ status: StatusType; targetId: string }>;
    readonly applied: Array<{ status: StatusType; targetId: string }>;
    readonly removals: string[];
    readonly selfCosts: string[];
    readonly shields: string[];
    readonly deaths: string[];
    readonly hookTells: Array<HookTellInfo & { targetId?: string }>;
    /** TICKET 189c: board changes with no card behind them; they land as the burst plays. */
    readonly ops: BoardOp[];
}

export const emptyLoose = (): LooseBurst => ({
    ticks: [], applied: [], removals: [], selfCosts: [], shields: [], deaths: [], hookTells: [], ops: [],
});

export const isLooseEmpty = (burst: LooseBurst): boolean =>
    burst.ticks.length + burst.applied.length + burst.removals.length + burst.selfCosts.length
    + burst.shields.length + burst.deaths.length + burst.hookTells.length + burst.ops.length === 0;

export function buildLooseBeat(burst: LooseBurst, board: BoardSink = displayedBoard): Beat {
    const actions: TimedAction[] = [];
    for (const op of burst.ops) {
        actions.push({ at: 0, label: 'board', run: () => applyBoardOp(board, op) });
    }
    for (const tell of burst.hookTells) {
        actions.push({ at: 0, label: 'hook-tell', run: () => emitHookTell(tell.owner, tell.osId, tell.daemonId, tell.targetId) });
    }
    for (const tick of burst.ticks) {
        actions.push({ at: 0, label: 'tick', run: () => emitStatusTick(tick.status, tick.targetId) });
    }
    for (const entry of burst.applied) {
        actions.push({ at: 0, label: 'status-tell', run: () => emitStatusApplied(entry.status, entry.targetId) });
    }
    for (const id of burst.removals) {
        actions.push({ at: 0, label: 'status-removed', run: () => emitStatusRemoved(id) });
    }
    for (const id of burst.selfCosts) {
        actions.push({ at: 0, label: 'self-cost', run: () => emitSelfCost(id) });
    }
    for (const id of burst.shields) {
        actions.push({ at: 0, label: 'shield', run: () => emitShieldAbsorb(id) });
    }
    for (const id of burst.deaths) {
        actions.push({ at: 0, label: 'death', run: () => emitDeath(id) });
    }
    return { label: 'loose', actions, durationMs: LOOSE_BEAT_MS };
}
