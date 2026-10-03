/**
 * THE CAST SEQUENCE — ticket 146c, *"the row most of the feel lives in"*, and since ticket 189b THE
 * PRESENTER: one ordered queue for everything the board shows.
 *
 * Ruling 5, in Henry's words: *"Player card flies to the lane, then the animations play, then go to
 * discard … on a fire card a flame shoots across the screen in front of the card in the lane, hits
 * the target and 'explodes', then statuses get applied, then the card zooms to the discard."*
 *
 * Five steps, in order, with the card sitting BEHIND the effects. This module owns steps 2-4 — the
 * trail, the impact and the status tells — which is where the feel actually is; the card's own
 * flight and discard are `PlayedCardReveal`'s, because the card is a React element and these are
 * particles.
 *
 * # WHY THE STATUSES HAVE TO BE BUFFERED
 *
 * The engine resolves a whole cast synchronously inside the reducer: `PROGRAM_PLAYED`,
 * `DAMAGE_TAKEN` and every `STATUS_APPLIED` arrive in the same tick, microseconds apart, before a
 * single frame has rendered. Played as they arrive, the entire sequence would happen at once and
 * ruling 5's ORDER — trail, then impact, then statuses — would be invisible.
 *
 * So a cast opens a window: every status that lands while the window is open belongs to that cast
 * and is replayed on the clock rather than on arrival. The window closes on the next
 * `PROGRAM_PLAYED` or when the sequence has played out.
 *
 * # WHY A QUEUE
 *
 * §2c: *"a second cast queues behind the first (the AI can cast faster than the sequence plays)"*.
 * The AI resolves its whole turn in one synchronous burst — at 3v3 that can be seven casts before
 * the browser paints once. Without a queue they would all animate on top of each other and the
 * player would see one composite flash instead of seven plays.
 *
 * # TICKET 189b — ONE LINE FOR THE WHOLE STAGE
 *
 * Casts were queued, but a DoT tick, an expiry, a recoil or a death played the instant it arrived —
 * so a Burn tick at a turn boundary could play in front of an impact still on its way, and every
 * hook tell of a seven-cast burst played at once. Everything is a `Beat` now (`presenter/`), played
 * by `PresenterQueue` on the battle clock, and this hook is the COLLECTOR: it sorts a synchronous
 * burst of bus events into a cast window (or a loose burst, when no card is behind them), builds
 * the beat, and enqueues it. The timeline of a beat is `presenter/castBeat.ts`. The hook returns
 * the `CastPresenter` handle: `isIdle()` and `whenIdle()` for the enemy loop and the battle-end
 * banner (189e).
 */


import { useEffect, useMemo, useRef } from 'react';

import { globalBattleEventBus, type BattleEvent } from '../../engine/events';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getModifierBreakdown } from '../../engine/combatUtils';
import { loadSettings, resolveVfxGates } from '../settings/settings';
import type { IBattleEntity, IBattleState } from '../../engine/types';
import type { TrailElement } from './trails';
import { isHookStatus } from './hookStatusBeat';
import { battleClock } from './clock/battleClockRuntime';
import { type BoardOp, type BoardWhen, applyBoardOp } from './displayed/boardOps';
import { displayedBoard } from './displayed/displayedBoardRuntime';
import { RESISTED_AT, SUPER_EFFECTIVE_AT } from './impact/impactMath';
import { type MomentDraft, emitStageMoment, finishMoment } from './impact/stageMoments';
import { effectivenessAgainst } from '../audio/battleCues';
import { barkPointsFor } from '../components/stage/barkShield';
import { PresenterQueue } from './presenter/PresenterQueue';
import {
    type LooseBurst, type PendingCast, buildCardBeat, buildCastBeat, buildLooseBeat, emptyCast, emptyLoose, isLooseEmpty,
} from './presenter/castBeat';
import { nextCardKey } from './presenter/cardSignals';
import { isContactCard } from './choreo/contactCards';
import type { PlayedCardAnnouncement } from '../hooks/useBattleVfx';

// Kept here so every existing importer (the reveal, the tests) still finds them.
export { FLIGHT_MS, STATUS_TELL_STAGGER_MS } from './presenter/castBeat';

/** What the rest of the screen asks the presenter. */
export interface CastPresenter {
    /** True when nothing is playing, nothing is queued and no burst is waiting to be queued. */
    isIdle(): boolean;
    /** Resolves when `isIdle()` is true. With vfx off it resolves at once. */
    whenIdle(): Promise<void>;
    /** Beats waiting behind the one playing: what catch-up (190a) reads as "queued". */
    queued(): number;
}

export function useCastSequence(battleState: IBattleState | null): CastPresenter {
    /*
     * ── TICKET 155a — WHY THIS IS A REF AND THE EFFECT IS MOUNT-SCOPED ───────────────────────
     *
     * This hook shipped with `[battleState]` as its dependency, and that one array made every
     * row of 146 dead on arrival. The sequence is worth spelling out because it fails in a way
     * that leaves the whole suite green:
     *
     *   1. A card is played. The reducer emits `PROGRAM_PLAYED` SYNCHRONOUSLY inside the dispatch.
     *   2. The handler below opens a cast window and arms `setTimeout(…, 0)` to close it at the
     *      end of the reducer's burst.
     *   3. The dispatch returns a NEW `battleState`. React re-renders and, because the dependency
     *      changed, runs this effect's CLEANUP FIRST — which nulls `open`, empties the queue and
     *      clears every timer.
     *   4. The 0ms closure fires, sees a closed window, and drops the cast.
     *
     * Every play. No trail, no impact, no queued status tell — while `useBattleVfx` kept working,
     * because it is mount-scoped with a `stateRef`, which is the pattern this now copies.
     *
     * The tests passed because `useImpactFeedback.test.tsx` mounted once with a constant state
     * object and never re-rendered. A test that never does the thing the user does cannot fail the
     * way the user does; the re-render is now part of both test files.
     */
    const stateRef = useRef(battleState);
    useEffect(() => {
        stateRef.current = battleState;
    });

    // The queue and the collector's "is anything waiting" probe outlive an effect re-run, so the
    // handle the screen holds stays valid.
    const queue = useMemo(() => new PresenterQueue(battleClock), []);
    const pendingRef = useRef<() => boolean>(() => false);

    const presenter = useMemo<CastPresenter>(() => {
        const idle = (): boolean => !pendingRef.current() && queue.isIdle();
        return {
            isIdle: idle,
            queued: () => queue.queuedCount(),
            whenIdle: async () => {
                for (;;) {
                    if (pendingRef.current()) {
                        // A burst is collected and closes on the next task; look again after it.
                        await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
                        continue;
                    }
                    if (queue.isIdle()) return;
                    await queue.whenIdle();
                }
            },
        };
    }, [queue]);

    useEffect(() => {
        // Read once per fight, as `useImpactFeedback` does and for the same reason.
        const gates = resolveVfxGates(loadSettings());
        /*
         * TICKET 189d: with the cast sequence off (vfx off, reduced motion) there is no timeline to
         * play a hit on, but the numbers, the sounds and the bars still have to say it — and the
         * displayed board still has to move. They land the instant the event arrives, as they always
         * did, through the same moments; nothing is queued and nothing is drawn.
         */
        const immediate = gates.vfx !== 'full';

        const timers: ReturnType<typeof setTimeout>[] = [];
        let open: PendingCast | null = null;
        let loose: LooseBurst | null = null;
        /** HP of each body as the burst has played it, so two hits that kill TOGETHER read as a kill. */
        const burstHp = new Map<string, number>();
        pendingRef.current = () => open !== null || loose !== null;

        const findEntity = (id: string): IBattleEntity | undefined => {
            const state = stateRef.current;
            return state?.playerParty.find((e) => e.id === id)
                ?? state?.enemyParty.find((e) => e.id === id);
        };

        const flushOpen = (): void => {
            if (!open) return;
            const cast = open;
            open = null;
            queue.enqueue(buildCastBeat(cast));
        };
        const flushLoose = (): void => {
            if (!loose) return;
            const burst = loose;
            loose = null;
            if (!isLooseEmpty(burst)) queue.enqueue(buildLooseBeat(burst));
        };
        const looseBurst = (): LooseBurst => (loose ??= emptyLoose());

        /**
         * TICKET 189c: what the displayed board does for this event, and when on the cast's
         * timeline. With no card behind it, it lands as the loose burst plays.
         */
        const recordOp = (op: BoardOp, when: BoardWhen, moment?: MomentDraft): void => {
            if (immediate) {
                applyBoardOp(displayedBoard, op);
                if (moment) emitStageMoment(finishMoment(moment, { sourceId: undefined, step: 0, targets: 1 }));
                return;
            }
            if (open) open.ops.push({ when, op, moment });
            else looseBurst().ops.push({ op, moment });
        };

        /** Did this hit take the body down? Tracks the burst's own HP, so a second hit counts. */
        const takesDown = (targetId: string, applied: number): boolean => {
            const victim = findEntity(targetId);
            if (!victim || applied <= 0) return false;
            const before = burstHp.get(targetId) ?? victim.currentHp;
            const after = before - applied;
            burstHp.set(targetId, after);
            return before > 0 && after <= 0;
        };

        const handle = (event: BattleEvent): void => {
            if (immediate && event.type !== 'DAMAGE_TAKEN' && event.type !== 'HEAL' && event.type !== 'STATUS_APPLIED' && event.type !== 'PROGRAM_PLAYED') return;
            switch (event.type) {
                case 'PROGRAM_PLAYED': {
                    // The previous cast's window closes here: anything still open belonged to it.
                    flushLoose();
                    flushOpen();

                    const data = GetProgramData(event.programId);
                    const source = findEntity(event.sourceId);
                    const target = findEntity(event.targetId);

                    /*
                     * TICKET 189e: THE CARD IS THE PRESENTER'S. It flies in as this cast's turn in
                     * the line begins, hovers if it is the enemy's, and leaves when the sequence
                     * ends. The announcement is built here, off the pre-burst state.
                     */
                    const card: PlayedCardAnnouncement = {
                        key: nextCardKey(),
                        dataId: event.programId,
                        sourceId: event.sourceId,
                        targetId: event.targetId,
                        fromPlayer: stateRef.current?.playerParty.some((e) => e.id === event.sourceId) ?? false,
                        sourceName: source?.name ?? '',
                        targetName: target?.name ?? '',
                    };
                    if (immediate) {
                        queue.enqueue(buildCardBeat(card));
                        return;
                    }

                    /*
                     * The effectiveness read, from the engine's own decomposition rather than a
                     * second type chart in the UI. §2c makes this a gameplay tell — a player who
                     * can see the matchup landing does not have to hold the chart in their head —
                     * so it has to agree with the damage, not merely look plausible.
                     */
                    const breakdown = source && target
                        ? getModifierBreakdown(source, target, data)
                        : null;
                    const effectiveness = breakdown?.effectiveness ?? 1;

                    open = emptyCast({
                        element: (data.element ?? 'None') as TrailElement,
                        sourceId: event.sourceId,
                        targetIds: [event.targetId],
                        doubled: effectiveness >= SUPER_EFFECTIVE_AT,
                        resisted: effectiveness <= RESISTED_AT,
                        card,
                        // 190c: a card that is not an Attack and deals no damage wiggles and lobs an
                        // orb; a single-target Attack with no element runs in and hits.
                        attack: data.category === 'Attack',
                        contact: isContactCard(data),
                    });
                    return;
                }
                case 'HEAL': {
                    // A heal moves the bar with the card that cast it, on the body it heals.
                    recordOp(
                        { kind: 'heal', id: event.targetId, amount: event.amount }, 'impact',
                        event.amount > 0 ? { kind: 'heal', targetId: event.targetId, amount: event.amount } : undefined,
                    );
                    return;
                }
                case 'STATUS_APPLIED': {
                    // A Bark Shield is the brown band on the HP bar: it grows with the statuses.
                    if (event.status === 'BarkShield') {
                        const holder = findEntity(event.targetId);
                        if (holder) {
                            recordOp({ kind: 'bark', id: event.targetId, points: barkPointsFor(event.stacks, holder.maxHp) }, 'after');
                        }
                    }
                    if (immediate) return;
                    // Belongs to the cast whose window is open. A status that lands with no window
                    // is an engine expiry or a turn-boundary effect: a loose beat, queued behind
                    // whatever is still playing (189b) rather than played over it.
                    if (open && isHookStatus(event.source)) {
                        open.hookStatuses.push({ hookId: event.source.hookId, targetId: event.targetId, status: event.status });
                    } else if (open) open.statuses.push({ targetId: event.targetId, status: event.status });
                    else looseBurst().applied.push({ status: event.status, targetId: event.targetId });
                    return;
                }
                case 'STATUS_REMOVED': {
                    // §2f: the badge shrinks and a grey puff leaves the sprite. With the cast that
                    // consumed it, or as its own beat at a turn boundary.
                    (open ? open.removals : looseBurst().removals).push(event.targetId);
                    return;
                }
                case 'DAMAGE_TAKEN': {
                    const applied = event.damage?.applied ?? event.amount;
                    const absorbed = event.damage?.absorbed ?? 0;
                    const dies = takesDown(event.targetId, applied);
                    const hit: BoardOp = { kind: 'damage', id: event.targetId, applied, absorbed };
                    const victim = findEntity(event.targetId);
                    // What the screen says when it lands (189d), read off the PRE-burst snapshot.
                    const common = {
                        targetId: event.targetId, applied, absorbed, element: event.element,
                        maxHp: victim?.maxHp ?? 0, isLethal: dies, definitionId: victim?.definitionId,
                    };

                    /*
                     * §2f's tick, and the recoil/toll pulse. Each is its own beat now (or rides on
                     * the cast it belongs to), queued behind whatever is still playing: a tick at
                     * a turn boundary no longer plays in front of an impact still on its way.
                     */
                    if (event.cause === 'status' && event.status) {
                        const status = event.status;
                        const stacks = victim?.statusEffects.find((effect) => effect.type === status)?.stacks ?? 0;
                        recordOp(hit, 'after', { kind: 'tick', ...common, status, stacks });
                        if (immediate) return;
                        (open ? open.ticks : looseBurst().ticks).push({ status: event.status, targetId: event.targetId });
                        if (dies) (open ? open.deaths : looseBurst().deaths).push(event.targetId);
                        return;
                    }
                    if (event.cause === 'recoil' || event.cause === 'toll') {
                        recordOp(hit, 'first', { kind: 'cost', ...common, cause: event.cause });
                        if (immediate) return;
                        (open ? open.selfCosts : looseBurst().selfCosts).push(event.targetId);
                        if (dies) (open ? open.deaths : looseBurst().deaths).push(event.targetId);
                        return;
                    }
                    recordOp(hit, 'impact', {
                        kind: 'hit', ...common, isCritical: event.isCritical === true,
                        effectiveness: effectivenessAgainst(event.element, victim),
                    });
                    if (immediate) return;
                    // 190c: the biggest direct hit sets how long the attack runs.
                    open?.hits.push({ targetId: event.targetId, applied, maxHp: victim?.maxHp ?? 0, isKill: dies });
                    if (absorbed > 0) {
                        (open ? open.shields : looseBurst().shields).push(event.targetId);
                    }

                    /*
                     * TICKET 155, DEEP DIVE 9 — THE DEATH FX 146 WAS SUPPOSED TO HAVE.
                     *
                     * There is no death EVENT on the bus, so the predicate is derived: events fire
                     * synchronously inside the reducer, so the ref holds the HP from BEFORE the
                     * burst, and `burstHp` carries what the burst has already taken off it.
                     *
                     * TICKET 189b: it plays AT THE IMPACT on that body (it used to play at arrival,
                     * before the trail had left).
                     */
                    if (dies) (open ? open.deaths : looseBurst().deaths).push(event.targetId);

                    /*
                     * A Side or All card hits several targets, and the engine tells us who only
                     * through the damage. Collected here rather than read off the card's `target`
                     * field, because the card says "Side" and the BOARD says which three bodies
                     * that was — after deaths, after a taunt redirect, after everything.
                     */
                    if (open && !open.targetIds.includes(event.targetId)) {
                        open.targetIds.push(event.targetId);
                    }
                    return;
                }
                case 'HOOK_FIRED': {
                    /*
                     * TICKET 146g, 171f, 189b. A hook that put a STATUS on someone during this cast
                     * is held and played with that status, after the card (171f, Henry's ruling).
                     * Its statuses arrive before this event in the same burst, so they are already
                     * in the window. Every other hook is part of the cast it fired in and plays as
                     * that card starts (it used to play at arrival, which for a burst of casts
                     * meant all of them at once); with no cast behind it, it is its own beat.
                     */
                    const owner = findEntity(event.ownerId);
                    const info = { hookId: event.hookId, owner, osId: event.osId, daemonId: event.daemonId };
                    if (open && !open.hookTells.some((t) => t.hookId === event.hookId)
                        && open.hookStatuses.some((entry) => entry.hookId === event.hookId)) {
                        open.hookTells.push(info);
                        return;
                    }
                    if (open?.hookTells.some((t) => t.hookId === event.hookId)) return;
                    if (open) open.startTells.push(info);
                    else looseBurst().hookTells.push({ ...info, targetId: undefined });
                    return;
                }
                case 'TURN_END':
                case 'TURN_START': {
                    // A turn boundary closes any cast window: nothing more is coming for that cast.
                    flushOpen();
                    return;
                }
                default:
            }
        };

        const unsubscribe = globalBattleEventBus.subscribe((event) => {
            handle(event);
            /*
             * The window closes at the end of the synchronous burst the reducer produced, which is
             * what a zero-delay timeout waits for: every event of one cast has arrived by the time
             * the task queue gets a turn. Cheaper and more honest than guessing a duration. This is
             * the one real-time timer left here: it batches a burst, it does not time a picture.
             */
            if (open || loose || burstHp.size > 0) {
                const closingCast = open;
                const closingLoose = loose;
                timers.push(setTimeout(() => {
                    if (closingCast && open === closingCast) flushOpen();
                    if (closingLoose && loose === closingLoose) flushLoose();
                    if (!open && !loose) burstHp.clear();
                }, 0));
            }
        });

        return () => {
            unsubscribe();
            for (const id of timers) clearTimeout(id);
            timers.length = 0;
            queue.clear();
            open = null;
            loose = null;
            pendingRef.current = () => false;
        };
        // MOUNT-SCOPED. See the note at the top of this hook: a dependency here tears the cast
        // window down inside the dispatch that opened it.
    }, [queue]);

    return presenter;
}
