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
 *
 * TICKET 189d puts the rest of "a hit landed" on the same instant: the same action that moves the
 * board hands the screen a MOMENT (the number, the sounds, the hit-stop, the shake). Nothing says
 * "hit" on the event any more.
 */

import type { IBattleEntity, StatusType } from '../../../engine/types';
import { type EmitAt, anchorFor, emitEffect, emitImpact, emitOrb, emitSeeds, emitSpeedLines, emitTrail, stageScale } from '../emit';
import { emitHookTell } from '../osTells';
import { HOOK_BEAT_GAP_MS } from '../hookStatusBeat';
import { scheduleStatusTells } from '../statusBurst';
import {
    emitDeath, emitSelfCost, emitShieldAbsorb, emitStatusApplied, emitStatusRemoved, emitStatusTick, statusColor,
} from '../statusTells';
import { TRAIL_STAGGER_MS, elementColor, type TrailElement } from '../trails';
import { buildCastAttack } from '../attacks/buildAttack';
import { spriteShakes, stageDim, wakeImpactFx } from '../impact/impactRuntime';
import { loadSettings, resolveVfxGates } from '../../settings/settings';
import { muzzleOf } from '../attacks/AttackEffect';
import { chargeSparks, dimKeys, hitScale, isBigHit } from '../choreo/bigHit';
import { DASH_STOPS_SHORT_PX, attackPose, statusPose } from '../choreo/attackPose';
import { type CastKind, castTimes } from '../choreo/castTimes';
import { emitAttackPose } from '../choreo/poseSignals';
import { damageScale } from '../tiers/tierProfiles';
import { activeProfile } from '../tiers/activeTier';
import { type BoardSink, type LooseOp, type TimedBoardOp, applyBoardOp } from '../displayed/boardOps';
import { BARK_SETTLE_MS } from '../landings/barkLanding';
import { displayedBoard } from '../displayed/displayedBoardRuntime';
import { type StageMoment, emitStageMoment, finishMoment } from '../impact/stageMoments';
import type { PlayedCardAnnouncement } from '../../hooks/useBattleVfx';
import { type Beat, type TimedAction, beatDuration } from './beat';
import { emitCardSignal } from './cardSignals';

/**
 * §2c: the hand card reaches the lane in 180ms. Showy's number: since 190c the beat reads the ACTIVE
 * tier's `cardInMs`, and the element no longer waits for the card (the wind-up runs while it flies).
 */
export const FLIGHT_MS = 180;
/** §2c: status tells land this far apart, after the impact. */
export const STATUS_TELL_STAGGER_MS = 60;
/** A loose burst (a tick, an expiry, a death with no card) holds the stage this long. */
export const LOOSE_BEAT_MS = 200;
/**
 * TICKET 189e (Henry, 2026-10-02: *"Before makes more sense"*): the enemy's card arrives and HOVERS
 * this long so it can be read, and only then does its attack play.
 */
export const ENEMY_HOVER_MS = 1000;
/** The card's flight out of the lane (§2c's 200 ms, Showy's 160 since 190b's table). The beat reads the active tier's. */
export const CARD_LEAVE_MS = 200;
/** How many speed-line puffs trail a contact card's dash, and how many streaks each throws. */
const SPEED_LINE_PUFFS = 4;
const SPEED_LINES_PER_PUFF = 2;

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
    readonly statuses: Array<{ targetId: string; status: StatusType; stacks?: number }>;
    /** TICKET 171f: statuses a hook applied during this cast — played as their own beat after it. */
    readonly hookStatuses: Array<{ hookId: string; targetId: string; status: StatusType; stacks?: number }>;
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
    /**
     * TICKET 189e: the card behind this cast. It flies in as the beat starts, hovers (the enemy's, for
     * `ENEMY_HOVER_MS`), launches the element, and leaves when the sequence ends. Absent: no card.
     */
    readonly card?: PlayedCardAnnouncement;
    /**
     * TICKET 190c: is this card an Attack? A card that is not, and dealt no damage, is status-only:
     * it wiggles and lobs an orb instead of lunging. Default true (a bare cast is an attack).
     */
    readonly attack: boolean;
    /** TICKET 190d: a Side / All card gets the wall, the wave or the cloud instead of a beam, a jet or a vine. */
    readonly spread: boolean;
    /** TICKET 190c: a contact card (single-target Attack, element None) dashes all the way in. */
    readonly contact: boolean;
    /** TICKET 190c: the direct hits, which set how long the effect runs (the biggest one counts). */
    readonly hits: Array<{ targetId: string; applied: number; maxHp: number; isKill: boolean }>;
}

type CastBase = Pick<PendingCast, 'element' | 'sourceId' | 'targetIds' | 'doubled' | 'resisted' | 'card'>
    & Partial<Pick<PendingCast, 'attack' | 'contact' | 'spread'>>;

export function emptyCast(base: CastBase): PendingCast {
    return {
        attack: true, contact: false, spread: false,
        ...base, statuses: [], hookStatuses: [], hookTells: [], startTells: [],
        shields: [], deaths: [], selfCosts: [], removals: [], ticks: [], ops: [], hits: [],
    };
}

/** Which of the three timelines this cast plays: a hit of any size makes it an attack. */
export function castKindOf(cast: PendingCast): CastKind {
    if (!cast.attack && cast.hits.length === 0) return 'status';
    return cast.contact ? 'contact' : 'attack';
}

/** Steps 2-4 of ruling 5 for one cast, plus everything that rides on its timeline. */
export function buildCastBeat(
    cast: PendingCast,
    board: BoardSink = displayedBoard,
    say: (moment: StageMoment) => void = emitStageMoment,
): Beat {
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

    /*
     * TICKET 190c — THE CHOREOGRAPHY. When everything of this cast happens comes from the tier
     * profile (`choreo/castTimes`): the wind-up starts with the card (the enemy's card arrives and
     * hovers a second first), the element leaves when the lunge ends, the hit lands when it arrives
     * (a contact card's dash ends in the hit), the attacker holds the pose through the knock-back
     * and walks back as the card leaves. The freeze is real time and is not in these numbers.
     */
    const profile = activeProfile();
    const kind = castKindOf(cast);
    const biggest = biggestDealt(cast.hits);
    const times = castTimes(profile, {
        kind,
        fromPlayer: cast.card ? cast.card.fromPlayer : true,
        damage: biggest?.applied ?? 0,
        maxHp: biggest?.maxHp ?? 0,
        isKill: cast.hits.some((hit) => hit.isKill),
    });
    const statusOnly = kind === 'status';

    if (cast.card) {
        const card = cast.card;
        actions.push({ at: times.cardInAtMs, label: 'card-in', run: () => emitCardSignal({ kind: 'in', card }) });
        actions.push({ at: times.launchAtMs, label: 'launch', run: () => emitCardSignal({ kind: 'launch', card }) });
    }

    // The caster's pose: the whole wind-up, lunge, hold and return (or the wiggle) as one animation
    // on its sprite, started now. Built here, when the anchors are known, from the same plan.
    actions.push({
        at: times.poseAtMs, label: 'pose',
        run: () => {
            const from = anchorFor(cast.sourceId);
            const to = anchorFor(cast.targetIds[0] ?? cast.sourceId);
            const direction = headingOf(cast, from, to);
            if (times.statusPlan) {
                emitAttackPose({ sourceId: cast.sourceId, pose: statusPose(times.statusPlan, { direction }) });
            } else if (times.attackPlan) {
                const dashPx = kind === 'contact' ? dashDistance(from, to) : undefined;
                emitAttackPose({ sourceId: cast.sourceId, pose: attackPose(times.attackPlan, profile, { direction, dashPx }) });
            }
        },
    });

    /*
     * TICKET 190g - THE BIG-HIT EXTRAS. A hit whose damage scale `s` is big (the tier's
     * `chargeFrom` / `dimFrom`, on `s` since 194k-2; Snappy and Fast have none) charges up: sparks converge on the caster's
     * mouth through the wind-up. A bigger one also dims the stage across the wind-up (up to 0.4 x s,
     * gone with the Flashes setting). Both start with the pose; the camera punch is the impact's.
     */
    const share = hitScale(biggest?.applied ?? 0, biggest?.maxHp ?? 0);
    const plan = times.attackPlan;
    if (plan && isBigHit(share, profile.chargeFrom)) {
        actions.push({
            at: times.poseAtMs, label: 'charge',
            run: () => {
                const from = anchorFor(cast.sourceId);
                const to = anchorFor(cast.targetIds[0] ?? cast.sourceId);
                if (!from) return;
                const heading = headingOf(cast, from, to);
                const body = { id: cast.sourceId, x: from.x, y: from.y, w: from.w ?? 0, h: from.h ?? 0 };
                emitSeeds(chargeSparks({
                    muzzle: muzzleOf(body, heading), durationMs: plan.game.windupEndMs, s: plan.scale,
                    particleScale: profile.particleScale, color: elementColor(cast.element),
                }));
            },
        });
    }
    if (plan && isBigHit(share, profile.dimFrom) && resolveVfxGates(loadSettings()).flashes) {
        actions.push({
            at: times.poseAtMs, label: 'dim',
            run: () => { stageDim.run(dimKeys(plan.game, plan.scale)); wakeImpactFx(); },
        });
    }

    // A contact card throws speed lines behind it as it runs.
    if (kind === 'contact') {
        for (let i = 0; i < SPEED_LINE_PUFFS; i += 1) {
            const along = (i + 1) / (SPEED_LINE_PUFFS + 1);
            actions.push({
                at: times.launchAtMs + (times.impactAtMs - times.launchAtMs) * along, label: 'speed-lines',
                run: () => {
                    const from = anchorFor(cast.sourceId);
                    const to = anchorFor(cast.targetIds[0] ?? cast.sourceId);
                    if (!from || !to) return;
                    const direction = headingOf(cast, from, to);
                    // The attacker is `along` squared of the way in (the dash eases in).
                    const x = centreX(from) + direction * (dashDistance(from, to) ?? 0) * stageScale() * along * along;
                    emitSpeedLines({ x, y: from.y, w: 0, h: from.h }, direction, SPEED_LINES_PER_PUFF);
                },
            });
        }
    }

    /*
     * TICKET 190d — THE ELEMENT ATTACK. Fire, Water and Nature have an attack of their own (a beam, a
     * jet, a vine; a wall, a wave, a cloud for a Side or All card). It tells us when it reaches each
     * body, and the hit lands then. Every other element sends the tinted streak, 40 ms apart.
     */
    const element = kind === 'attack'
        ? buildCastAttack({
            element: cast.element, spread: cast.spread, sourceId: cast.sourceId, targetIds: cast.targetIds,
            direction: headingOf(cast, anchorFor(cast.sourceId), anchorFor(cast.targetIds[0] ?? cast.sourceId)),
            profile, scale: times.attackPlan?.scale ?? 0,
            tremble: (id, px) => { spriteShakes.tremble(id, px); wakeImpactFx(); },
        })
        : null;
    const reachesAt = new Map((element?.hits ?? []).map((hit) => [hit.targetId, Math.round(times.launchAtMs + hit.atMs)]));
    if (element) actions.push({ at: times.launchAtMs, label: 'attack', run: () => emitEffect(element.effect) });

    let firstImpact: number | null = null;
    cast.targetIds.forEach((targetId, index) => {
        // §2c: *"Side/All cards send one trail per target, 40 ms apart."* The stagger is what makes
        // a three-target card read as three hits rather than as one wide flash.
        const offset = times.launchAtMs + index * TRAIL_STAGGER_MS;
        const impactAt = reachesAt.get(targetId) ?? times.impactAtMs + index * TRAIL_STAGGER_MS;
        firstImpact ??= impactAt;
        impactAtTarget.set(targetId, impactAt);

        if (statusOnly) {
            // The orb in the status colour (the element's, for a card that put no status on anyone).
            const tint = cast.statuses[0] ? statusColor(cast.statuses[0].status) : elementColor(cast.element);
            actions.push({
                at: offset, label: 'orb',
                run: () => {
                    const from = anchorFor(cast.sourceId);
                    const to = anchorFor(targetId);
                    if (from && to) emitOrb(from, to, tint, times.impactAtMs - times.launchAtMs, targetId === cast.sourceId);
                },
            });
        } else {
            if (kind !== 'contact' && !element) {
                actions.push({
                    at: offset, label: 'trail',
                    run: () => {
                        const from = anchorFor(cast.sourceId);
                        const to = anchorFor(targetId);
                        if (from && to) emitTrail(cast.element, from, to, times.travelMs);
                    },
                });
            }
            actions.push({
                at: impactAt, label: 'impact',
                run: () => {
                    const to = anchorFor(targetId);
                    if (!to) return;
                    // What this body took sizes its burst (a body the card hit twice, both hits).
                    const taken = cast.hits.filter((hit) => hit.targetId === targetId);
                    emitImpact(cast.element, to, {
                        damage: taken.reduce((sum, hit) => sum + hit.applied, 0),
                        maxHp: taken[0]?.maxHp ?? 0,
                        doubled: cast.doubled,
                        resisted: cast.resisted,
                        isKill: taken.some((hit) => hit.isKill),
                        direction: headingOf(cast, anchorFor(cast.sourceId), to),
                    });
                },
            });
        }
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

    // Step 4: the statuses. TICKET 166b: ONE tell per status, fired on every body that got it at the
    // same instant (Henry: "don't stagger between mingmings"), 60 ms between different statuses,
    // measured from a fixed base.
    const afterImpact = last;
    /*
     * TICKET 190f: WHEN the landings begin. A status a card adds after its damage (a rider) lands while
     * the attacker walks back, as its own beat: it starts WITH the walk back and overlaps it, so it adds
     * only the 60 ms between statuses to the sequence, not its own length. A status-only card lands its
     * status when the orb arrives. Either way the first status starts at the base (no gap), the next
     * 60 ms after it.
     */
    const landingBase = statusOnly ? afterImpact : Math.max(times.returnAtMs, afterImpact);

    // TICKET 189c: the displayed board moves with the thing that moves it. A hit or a heal lands
    // with the impact on its body (the last impact, for a body the card did not name); the price of
    // the cast with the first impact; a tick or a Bark Shield with the statuses, after the last.
    for (const { when, op, moment } of cast.ops) {
        const at = when === 'first' ? (firstImpact ?? last)
            : when === 'after' ? afterImpact
                : when === 'landing' ? landingBase + Math.min(BARK_SETTLE_MS, profile.statusOnly.landingMs)
                    : (impactAtTarget.get(op.id) ?? last);
        // Which target of the card this is spaces its sound; how many there are scales its freeze.
        const context = { sourceId: cast.sourceId, step: Math.max(0, cast.targetIds.indexOf(op.id)), targets: cast.targetIds.length };
        actions.push({
            at, label: 'board',
            run: () => {
                applyBoardOp(board, op);
                if (moment) say(finishMoment(moment, context));
            },
        });
    }

    for (const id of cast.removals) {
        actions.push({ at: afterImpact, label: 'status-removed', run: () => emitStatusRemoved(id) });
    }
    for (const tick of cast.ticks) {
        actions.push({ at: afterImpact, label: 'tick', run: () => emitStatusTick(tick.status, tick.targetId) });
    }
    for (const tell of scheduleStatusTells(landingBase, cast.statuses, STATUS_TELL_STAGGER_MS, 0)) {
        actions.push({
            at: tell.at, label: 'status-tell',
            run: () => { for (const targetId of tell.targetIds) emitStatusApplied(tell.status, targetId, false, tell.stacks[targetId]); },
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
                for (const entry of statuses) emitStatusApplied(entry.status, entry.targetId, true, entry.stacks ?? 1);
            },
        });
        if (index === hookIds.length - 1) last = at;
    });

    /*
     * TICKET 189e / 190c: the card leaves as the attacker starts walking back (or when the landing
     * is over), unless something later is still playing; and the beat holds until the attacker is
     * home and the card has gone, so the next sequence never starts on top of this one.
     */
    if (cast.card) {
        const card = cast.card;
        const leaveAt = Math.max(times.cardOutAtMs, beatDuration(actions, last));
        actions.push({ at: leaveAt, label: 'card-out', run: () => emitCardSignal({ kind: 'out', card }) });
        return { label: 'cast', actions, durationMs: Math.max(times.endAtMs, leaveAt + profile.cardOutMs) };
    }

    return { label: 'cast', actions, durationMs: Math.max(times.endAtMs, beatDuration(actions, last)) };
}

/**
 * What one body took from the card, summed over its hits (a multi-hit card is one long attack on
 * it), and the body that took the most: its share of max HP sets how long the effect runs.
 */
function biggestDealt(hits: PendingCast['hits']): { applied: number; maxHp: number } | null {
    const byBody = new Map<string, { applied: number; maxHp: number }>();
    for (const hit of hits) {
        const body = byBody.get(hit.targetId) ?? { applied: 0, maxHp: hit.maxHp };
        body.applied += hit.applied;
        byBody.set(hit.targetId, body);
    }
    let best: { applied: number; maxHp: number } | null = null;
    for (const body of byBody.values()) {
        if (!best || damageScale(body.applied, body.maxHp) > damageScale(best.applied, best.maxHp)) best = body;
    }
    return best;
}

const centreX = (at: EmitAt): number => (at.w ? at.x + at.w / 2 : at.x);

/** +1 when the caster acts toward the right (an ally), -1 toward the left (an enemy). */
function headingOf(cast: PendingCast, from: EmitAt | null, to: EmitAt | null): 1 | -1 {
    if (cast.card) return cast.card.fromPlayer ? 1 : -1;
    if (from && to && centreX(to) !== centreX(from)) return centreX(to) > centreX(from) ? 1 : -1;
    return 1;
}

/** How far a contact card runs, in stage px: the gap between the two bodies, less where it stops short. */
function dashDistance(from: EmitAt | null, to: EmitAt | null): number | undefined {
    if (!from || !to) return undefined;
    return Math.max(0, Math.abs(centreX(to) - centreX(from)) / stageScale() - DASH_STOPS_SHORT_PX);
}

/**
 * A card with nothing else to draw (the cast sequence is off): it still flies in, hovers (the
 * enemy's), launches and leaves, so the enemy's turn is still readable one card at a time.
 */
export function buildCardBeat(card: PlayedCardAnnouncement): Beat {
    const profile = activeProfile();
    const launchAt = profile.cardInMs + (card.fromPlayer ? 0 : profile.enemyHoverMs);
    const actions: TimedAction[] = [
        { at: 0, label: 'card-in', run: () => emitCardSignal({ kind: 'in', card }) },
        { at: launchAt, label: 'launch', run: () => emitCardSignal({ kind: 'launch', card }) },
        { at: launchAt, label: 'card-out', run: () => emitCardSignal({ kind: 'out', card }) },
    ];
    return { label: 'card', actions, durationMs: launchAt + profile.cardOutMs };
}

/**
 * Things that happen with no card behind them: a damage-over-time tick, an expiry, a body going
 * down to a tick, a recoil with no cast window. Collected from one synchronous burst and played as
 * ONE beat, so the three ticks of one turn boundary read as one moment.
 */
export interface LooseBurst {
    readonly ticks: Array<{ status: StatusType; targetId: string }>;
    readonly applied: Array<{ status: StatusType; targetId: string; stacks?: number }>;
    readonly removals: string[];
    readonly selfCosts: string[];
    readonly shields: string[];
    readonly deaths: string[];
    readonly hookTells: Array<HookTellInfo & { targetId?: string }>;
    /** TICKET 189c/189d: board changes (and what the screen says about them) with no card behind them. */
    readonly ops: LooseOp[];
}

export const emptyLoose = (): LooseBurst => ({
    ticks: [], applied: [], removals: [], selfCosts: [], shields: [], deaths: [], hookTells: [], ops: [],
});

export const isLooseEmpty = (burst: LooseBurst): boolean =>
    burst.ticks.length + burst.applied.length + burst.removals.length + burst.selfCosts.length
    + burst.shields.length + burst.deaths.length + burst.hookTells.length + burst.ops.length === 0;

export function buildLooseBeat(
    burst: LooseBurst,
    board: BoardSink = displayedBoard,
    say: (moment: StageMoment) => void = emitStageMoment,
): Beat {
    const actions: TimedAction[] = [];
    let hits = 0;
    for (const { op, moment } of burst.ops) {
        // No card behind these: the hits of one burst are a series, with nobody to name as the caster.
        const context = { sourceId: undefined, step: moment?.kind === 'hit' ? hits++ : 0, targets: 1 };
        actions.push({
            at: 0, label: 'board',
            run: () => {
                applyBoardOp(board, op);
                if (moment) say(finishMoment(moment, context));
            },
        });
    }
    for (const tell of burst.hookTells) {
        actions.push({ at: 0, label: 'hook-tell', run: () => emitHookTell(tell.owner, tell.osId, tell.daemonId, tell.targetId) });
    }
    for (const tick of burst.ticks) {
        actions.push({ at: 0, label: 'tick', run: () => emitStatusTick(tick.status, tick.targetId) });
    }
    for (const entry of burst.applied) {
        actions.push({ at: 0, label: 'status-tell', run: () => emitStatusApplied(entry.status, entry.targetId, false, entry.stacks ?? 1) });
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
