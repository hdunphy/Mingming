/**
 * THE ONE WRITER — ticket 59.
 *
 * # WHY A MIDDLEWARE AND NOT CALL SITES
 *
 * Every event the run log wants is already a dispatched action, and a log written from call sites
 * is a log that is complete on the day it ships and lossy by the third feature after it. The
 * middleware sees the action AND the state on both sides of it, so most rows are derived from what
 * changed rather than from someone remembering to announce it — a scrap sink added next month is
 * logged before anyone remembers this file exists.
 *
 * # WHY NOT `setActionTap`
 *
 * Ticket 59 says not to, and the reason is in `store.ts`'s own docblock: the tap is **one slot,
 * last caller wins**, and the debug action tape holds it. A production consumer taking that slot
 * would silently disable the tape, and opening the debug panel would silently disable the log.
 * `useCodexRecorder` documents the same trap from the other side. So this is a real middleware in
 * the chain, concatenated alongside the tap rather than competing for it.
 *
 * # THE ONE THING IT CANNOT SEE
 *
 * A DECLINED card pick. Skipping lives in `BattleReport`'s component state and never reaches a
 * reducer — `handleContinue` receives only what was taken, so "three offered, none taken" and
 * "no rewards this fight" are the same action from here. That is a fact the store genuinely does
 * not hold, so `BattleArena` reports it with `logRunEvent`, a logging-only action no reducer
 * handles. One call site, and it is the only one.
 *
 * # FAILURE IS SILENT AND CHEAP
 *
 * Every branch is wrapped: instrumentation must not be able to break a dispatch. A run log that
 * throws while recording a card purchase would cost the purchase, which is a strictly worse outcome
 * than losing the row. The write itself is deferred to a quiet window (`TrailingFlush`) — a scrap change and
 * the three rows around it are one write, not four, and a click is none.
 */

import { createAction } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';

import {
    ACTIVE_GAP_CAP_MS,
    appendRunEvent,
    emptyRunLog,
    FIGHT_LOG_CAP,
    runLogKeyFor,
    writeRunLog,
    type IRunLog,
    type RunEventInput,
} from '../../engine/run/runLog';
import { battleOutcome, isPlayerVictory } from '../../engine/battleOutcome';
import { fightKindOf } from '../../engine/run/eventFight';
import { fightLogIdFor, writeFightLog } from '../../engine/run/fightLog';
import { loadSettings } from '../settings/settings';
import { isSimulating } from '../../engine/core/simulationDepth';
import { globalBattleEventBus, type BattleEvent } from '../../engine/events';
import type { IBattleState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';
import { activeModifiers } from '../../engine/run/modifiers/modifierRegistry';
import { idleFlushScheduler, TrailingFlush, type FlushScheduler } from './TrailingFlush';
import { flushOnPageLeave } from './pageLeaveFlush';

/**
 * Report something the store does not hold. Handled by no reducer — see the header.
 *
 * Deliberately not exported as part of `runSlice`: it is not run state, and a reader who finds it
 * in the slice would reasonably expect a reducer to answer it.
 */
export const logRunEvent = createAction<RunEventInput>('runLog/event');

/** The shape this middleware needs from the store. Structural, so tests can pass a stub. */
interface LoggedState {
    readonly run: { readonly run: IRunState | null };
    readonly battle: { readonly battle: IBattleState | null };
}

// --- The current run's transcript, held here and written through -------------------------------

let current: IRunLog | null = null;
let seq = 0;

/**
 * THE WRITE IS DEFERRED, NOT PER-DISPATCH.
 *
 * It used to be queued on a microtask after every dispatch (and every row), re-serialising the
 * whole run log each time. In the desktop build that is a synchronous IPC write that blocks the
 * renderer, and it grows with the run: the game slowed down the longer it was played. Now rows
 * and active time are kept in memory and written once per quiet window, and immediately at the
 * moments that matter (fight close, run end, page leave, anyone reading the log back).
 */
let unbindPageLeave: (() => void) | null = null;
let flusher: TrailingFlush = new TrailingFlush(persistCurrent, idleFlushScheduler());

function persistCurrent(): void {
    if (current) writeRunLog(current);
}

/** Write the transcript now if a write is owed. Readers of the stored log call this first. */
export function flushRunLogNow(): void {
    flusher.flushNow();
}

/**
 * IS A FIGHT STILL OPEN — ticket 156 §2.
 *
 * `FIGHT_ENDED` used to be derived from one thing only: `battle.battle` going null. That is true of
 * every fight the player walks out of, and NOT true of the order the two dispatches arrive in on a
 * defeat. `BattleArena.handleDefeat` dispatches `endRun('defeat')` first and `setBattleState(null)`
 * second, and the `run/endRun` branch below returns early — so the transcript read
 *
 *     … FIGHT_STARTED, RUN_ENDED, FIGHT_ENDED
 *
 * with the fight's own row landing AFTER the end of the run, and the non-coalesced write at
 * `RUN_ENDED` persisting a transcript that did not contain it at all. Henry read one of those and
 * filed 156 saying the row was missing; it was there, in the one position nothing looks.
 *
 * So the fight's close is now owned rather than inferred: this flag is raised with `FIGHT_STARTED`
 * and lowered by whichever comes first — the battle clearing, or the run ending with a board still
 * live. `closeFight` is the single writer, so the row cannot be emitted twice.
 */
let fightOpen = false;

function stampFor(run: IRunState | null): { seq: number; fightIndex: number; deckSize: number; scrap: number } {
    seq += 1;
    return {
        seq,
        fightIndex: run?.fightsResolved ?? 0,
        deckSize: run?.deck.length ?? 0,
        scrap: run?.scrap ?? 0,
    };
}

function record(run: IRunState | null, input: RunEventInput): void {
    if (!current) return;
    current = appendRunEvent(current, input, stampFor(run));
    flusher.request();
}

/*
 * ── THE TURN ROWS, FROM THE BUS ───────────────────────────────────────────────────
 *
 * Ticket 156 §2 wants what MOVED during a turn, and a Redux middleware cannot see it: the engine
 * resolves a whole cast synchronously inside one reducer call, so `before`/`after` show the sum of
 * a turn and never its parts. `globalBattleEventBus` is where the parts are.
 *
 * THREE THINGS THIS LISTENER MUST NOT DO, each learned the hard way somewhere else in the tree:
 *
 *  1. **Never dispatch.** It fires synchronously inside the reducer, and Redux throws "You may not
 *     call store.getState() while the reducer is executing" — a throw that unwound through
 *     `applyMutations` and broke every card play in the game on 2026-08-24 (`useCodexRecorder`).
 *     Nothing here touches the store: it accumulates into a plain object and calls `record`, which
 *     only appends to a module-local transcript and queues a microtask.
 *  2. **Never throw.** `BattleEventBus.emit` is a bare `forEach` with no try/catch of its own, so
 *     an exception here would unwind the engine the same way. The body is wrapped.
 *  3. **Never record imagination.** The AI's lookahead runs the reducer ~94,000 times for one 3v3
 *     decision. It mutes the bus, so `emit` short-circuits — but `isSimulating()` is checked too,
 *     because the two predicates are not the same one and `emitHookFired` already treats them as
 *     independent.
 *
 * Subscribed ONCE, at middleware creation, rather than per fight: a subscribe/unsubscribe cycle per
 * fight is a window in which a play can be missed, and the accumulator is keyed on nothing that
 * outlives a turn anyway.
 */
interface TurnAccumulator {
    turn: number;
    side: 'PLAYER' | 'ENEMY';
    cardsPlayed: Array<{ dataId: string; casterId: string; targetId: string }>;
    damageDealt: number;
    damageTaken: number;
    statusesApplied: Array<{ status: string; stacks: number; targetId: string }>;
}

const emptyTurn = (): TurnAccumulator => ({
    turn: 0, side: 'PLAYER', cardsPlayed: [], damageDealt: 0, damageTaken: 0, statusesApplied: [],
});

let turnRows: TurnAccumulator = emptyTurn();
/** The `turnLogs` setting as it stood when the open fight began; see `wantsTurnLogs`. */
let turnLogsOn = true;
/**
 * The last board and run the middleware saw, for the listener to stamp against.
 *
 * The listener cannot read the store — see (1) above — so it reads these. They are written on
 * every middleware pass, which means they are at worst one dispatch stale; and the dispatch they
 * are stale by is the one currently resolving, whose own board is exactly what the turn is about.
 * Whose side a unit is on cannot change mid-fight, which is all the listener asks of them.
 */
let lastBoard: IBattleState | null = null;
let lastRun: IRunState | null = null;

/**
 * When the last dispatch happened — ticket 156 §2, active time.
 *
 * A dispatch is this game's own evidence that somebody is playing: every card, every click and
 * every enemy turn is one. So active time is the sum of the gaps between them, each gap capped at
 * `ACTIVE_GAP_CAP_MS`, and there is no `visibilitychange` listener, no idle timer and no DOM in it
 * at all — a shut laptop simply stops dispatching, which is the same signal by a shorter route.
 *
 * `null` until the first dispatch of a run, so a resumed transcript does not bill the reload gap.
 */
let lastDispatchAt: number | null = null;

const sideOf = (entityId: string): 'PLAYER' | 'ENEMY' =>
    lastBoard?.playerParty.some((entity) => entity.id === entityId) ? 'PLAYER' : 'ENEMY';

/** Flush the accumulated turn as a row, and start the next one. */
function flushTurn(): void {
    const row = turnRows;
    turnRows = emptyTurn();
    if (!fightOpen || !current || !turnLogsOn) return;
    // A turn in which literally nothing happened is not worth a row; an empty enemy turn is common
    // while a unit is stunned or asleep.
    if (row.cardsPlayed.length === 0 && row.damageDealt === 0
        && row.damageTaken === 0 && row.statusesApplied.length === 0) return;

    const partyHp: Record<string, number> = {};
    for (const member of lastBoard?.playerParty ?? []) partyHp[member.id] = member.currentHp;

    record(lastRun, {
        kind: 'FIGHT_TURN',
        turn: row.turn,
        side: row.side,
        cardsPlayed: row.cardsPlayed,
        damageDealt: row.damageDealt,
        damageTaken: row.damageTaken,
        statusesApplied: row.statusesApplied,
        partyHp,
    });
}

function onBattleEvent(event: BattleEvent): void {
    try {
        if (isSimulating() || !fightOpen || !turnLogsOn) return;

        switch (event.type) {
            case 'PROGRAM_PLAYED':
                turnRows.side = sideOf(event.sourceId);
                turnRows.cardsPlayed.push({
                    dataId: event.programId, casterId: event.sourceId, targetId: event.targetId,
                });
                return;
            case 'DAMAGE_TAKEN': {
                /*
                 * `applied` rather than `amount` where the full record is there: `amount` is
                 * post-shield but pre-floor, and a fully absorbed hit reports 0 either way. Dealt
                 * or taken is decided by whose side the TARGET is on against whose turn it is, so
                 * a recoil or a toll lands in `damageTaken` without needing its `cause`.
                 */
                const hit = event.damage?.applied ?? event.amount;
                if (sideOf(event.targetId) === turnRows.side) turnRows.damageTaken += hit;
                else turnRows.damageDealt += hit;
                return;
            }
            case 'STATUS_APPLIED':
                turnRows.statusesApplied.push({
                    status: event.status, stacks: event.stacks, targetId: event.targetId,
                });
                return;
            case 'TURN_END':
                turnRows.turn = event.turnNumber;
                turnRows.side = event.activeSide;
                flushTurn();
                return;
            default:
                return;
        }
    } catch (error) {
        // (2): an exception here unwinds the engine reducer. Instrumentation may not cost a play.
        console.warn('[RunLog] dropped a turn event:', error);
    }
}

/**
 * Does the player want combat transcripts stored — Henry's switch, 2026-09-20.
 *
 * Its own function, and failing to `true`, because a settings read that threw would otherwise end
 * a fight without its row. The default is on: 156 exists because the logs were missing.
 */
function wantsBattleLogs(): boolean {
    try {
        return loadSettings().battleLogs;
    } catch {
        return true;
    }
}

/**
 * Whether the per-turn rows are wanted — the `turnLogs` setting. Read ONCE, when a fight opens,
 * and held in `turnLogsOn`: the listener runs on every battle event and a settings read is a
 * storage read. Same rule as the battle logs: the switch means it from the next fight on. Default
 * on, and on if settings cannot be read.
 */
function wantsTurnLogs(): boolean {
    try {
        return loadSettings().turnLogs;
    } catch {
        return true;
    }
}

/**
 * The fight's closing row, from the last live board — ticket 156 §2.
 *
 * `battleBefore` is that board: by the time `battle` is null there is no turn count and no HP left
 * to read. Called from both closes, and a no-op unless a fight is actually open, so the run ending
 * mid-fight and the arena clearing the board a tick later produce ONE row, in the earlier position.
 */
function closeFight(run: IRunState | null, board: IBattleState): void {
    if (!fightOpen) return;

    // The killing turn never reaches `TURN_END` — the fight is over inside it — so it is flushed
    // here, while `fightOpen` is still true, or the turn that decided the fight is the one turn
    // with no row.
    lastBoard = board;
    turnRows.turn = board.turn;
    flushTurn();

    fightOpen = false;

    /*
     * TICKET 156 §2 — the transcript goes to its OWN key; this row is the pointer.
     *
     * `IBattleState.logs` has no cap of its own and dies with the battle. Truncated from the FRONT:
     * a fight's opening draw is worth less than the turn it ended on, and the ending is what a bug
     * report is about. Measured: a 21-turn 3v3 makes 376 lines, so `FIGHT_LOG_CAP` of 400 keeps all
     * of an ordinary fight and `truncated` is non-zero only on a genuinely long one.
     *
     * The text itself is 12.5 KB of that fight against ~30 KB for a whole run's other rows, and
     * `writeRunLog` re-serialises the entire log on a microtask after every dispatch — so keeping
     * it in the row meant re-stringifying every past fight on every card play. It lives in
     * `fightLog.ts` now, under `logId`, and the export gathers them back into one file.
     *
     * `logId` is null when the player has battle logs off. The counts stay either way: a row that
     * vanished with the setting would make the setting look like a fault.
     */
    const lines = board.logs;
    const kept = lines.length > FIGHT_LOG_CAP ? lines.slice(-FIGHT_LOG_CAP) : [...lines];
    const truncated = Math.max(0, lines.length - FIGHT_LOG_CAP);

    /*
     * Read at the fight's close rather than cached at module scope: the settings screen is a route
     * away from a fight, so a player who turns this off mid-run means it from the next fight on,
     * and one `localStorage` read per FIGHT is not a cost worth optimising. (Per RENDER was — see
     * `PlayedCardReveal`.)
     */
    /*
     * WITH LOGS OFF, THE ROW REPORTS THE FIGHT, NOT THE FILE THAT WAS NOT WRITTEN.
     *
     * `kept`/`truncated` describe a transcript; when none is stored, "400 lines, +17 truncated" is
     * a description of a truncation that never happened. The honest number for the off case is how
     * long the fight actually ran, with nothing truncated because nothing was kept.
     */
    let logId: string | null = null;
    if (!(current && wantsBattleLogs())) {
        record(run, { kind: 'FIGHT_LOG', logId: null, lineCount: lines.length, truncated: 0 });
    } else {
        // WHICH fight of this run, counted off the transcript rather than off `seq`. The row this
        // is about has not been recorded yet, so predicting its `seq` would be predicting the
        // future; the ordinal is already there to be counted, and survives a resumed run.
        const ordinal = current.events.filter((event) => event.kind === 'FIGHT_STARTED').length;
        const id = fightLogIdFor(current.runKey, Math.max(1, ordinal));
        if (writeFightLog({ id, runKey: current.runKey, lines: kept, truncated })) logId = id;

        // A write that failed leaves `logId` null with the transcript's own counts, which reads as
        // "there should be text here and there isn't" — the truth, and visible in the table.
        record(run, { kind: 'FIGHT_LOG', logId, lineCount: kept.length, truncated });
    }

    const partyHp: Record<string, number> = {};
    for (const member of board.playerParty) partyHp[member.id] = member.currentHp;

    record(run, {
        kind: 'FIGHT_ENDED',
        turns: board.turn,
        /*
         * `isPlayerVictory`, not "every enemy is down" — ticket 156 §2, and the same defect
         * `battleOutcome` was written to end. The local expression here called a MUTUAL KILL a win,
         * so a defeat could log `FIGHT_ENDED(won: true)` next to `RUN_ENDED(outcome: 'defeat')` and
         * the transcript contradicted itself on the one fight anybody would go back to read.
         * Henry's ruling of 2026-09-05 is that a draw is a defeat; there is one function that knows
         * it and this is now a caller of it.
         */
        won: isPlayerVictory(board),
        partyHp,
    });
    // A fight is the unit worth keeping: persist it now rather than trust the quiet window.
    flusher.flushNow();
}

/**
 * Begin a transcript, or resume the one already in storage for this run.
 *
 * Resume matters more than it looks: a run survives a reload (save v4 keeps it), so `setRun` fires
 * on every boot with a run in progress. Starting fresh there would silently split one run's
 * transcript into as many logs as the player had sessions, and `writeRunLog` replaces by `runKey`,
 * so the earlier half would be overwritten rather than merely separated.
 */
function beginOrResume(run: IRunState, existing: ReadonlyArray<IRunLog>): void {
    const key = runLogKeyFor(run.seed, run.startedAt);
    const found = existing.find((log) => log.runKey === key);
    current = found ?? emptyRunLog(run.seed, run.startedAt, run.mode);
    seq = current.events.reduce((highest, event) => Math.max(highest, event.seq), 0);
}

/** Test seam: forget the in-memory transcript. Nothing in the app calls this. */
export function resetRunLogRecorder(): void {
    flusher.cancel();
    current = null;
    seq = 0;
    fightOpen = false;
    turnLogsOn = true;
    turnRows = emptyTurn();
    lastBoard = null;
    lastRun = null;
    lastDispatchAt = null;
}

/** Test seam: the transcript as it stands, without a storage round trip. */
export function currentRunLog(): IRunLog | null {
    return current;
}

// --- Derivations --------------------------------------------------------------------------------

const isAction = (action: unknown): action is { type: string; payload?: unknown } =>
    typeof action === 'object' && action !== null && typeof (action as { type?: unknown }).type === 'string';

/** `run/buyMarketCard` → `buyMarketCard`. The reason string on a SCRAP row. */
const shortType = (type: string): string => type.replace(/^[^/]+\//, '');

function nodeOf(run: IRunState | null, nodeId: string | undefined) {
    if (!run || !nodeId) return undefined;
    return run.nodes.find((node) => node.id === nodeId);
}

/**
 * @param now Injectable clock. Production passes nothing; the tests pass a hand-cranked one,
 *            because a duration asserted against `Date.now()` is a duration asserted against how
 *            fast the machine running the suite happens to be.
 */
export function createRunLogMiddleware(
    readLogs: () => IRunLog[],
    now: () => number = () => Date.now(),
    scheduler: FlushScheduler = idleFlushScheduler(),
): Middleware {
    // Rebuilt per store so a test's scheduler is the one that is turned; one store in production.
    flusher.cancel();
    flusher = new TrailingFlush(persistCurrent, scheduler);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        unbindPageLeave?.();
        unbindPageLeave = flushOnPageLeave(flushRunLogNow, window, document);
    }

    // Once for the life of the store. `subscribe` returns an unsubscribe nobody calls, because the
    // middleware outlives every fight and a resubscribe per fight would be a hole to fall through.
    globalBattleEventBus.subscribe(onBattleEvent);

    return (store) => (next) => (action) => {
        const before = store.getState() as LoggedState;
        const result = next(action);
        if (!isAction(action)) return result;

        try {
            const after = store.getState() as LoggedState;
            const runBefore = before.run.run;
            const runAfter = after.run.run;

            // What the bus listener stamps against; see `lastBoard`.
            lastBoard = after.battle.battle;
            lastRun = runAfter;

            // Active time, before anything can return early: every dispatch counts, including the
            // ones this file has no row for.
            const at = now();
            if (current && lastDispatchAt !== null) {
                const gap = at - lastDispatchAt;
                if (gap > 0) {
                    // Memory only: a click is not worth a disk write. The next row, fight close,
                    // run end or page leave persists it.
                    current = { ...current, activeMs: current.activeMs + Math.min(gap, ACTIVE_GAP_CAP_MS) };
                }
            }
            lastDispatchAt = at;

            // --- Run lifecycle ---
            if (action.type === 'run/startRun' || action.type === 'run/setRun') {
                if (runAfter) {
                    beginOrResume(runAfter, readLogs());
                    // Only a genuinely new transcript gets an opening row; a resumed one already
                    // has its own, and a second would read as the run having started twice.
                    if (current && current.events.length === 0) {
                        record(runAfter, {
                            kind: 'RUN_STARTED',
                            gymId: runAfter.gymId,
                            tier: runAfter.tier,
                            party: [...runAfter.partyIds],
                            modifiers: activeModifiers(runAfter),
                        });
                    }
                }
                return result;
            }

            if (!current) return result;

            // TICKET 182c: the intro's ending is `run/endIntroRun` (so the ranch does not count it as a run), and it closes the transcript the same way.
            if ((action.type === 'run/endRun' || action.type === 'run/endIntroRun') && runAfter) {
                /*
                 * A defeat ends the RUN while the board is still on screen — `handleDefeat`
                 * clears it on the next dispatch. Close the fight first so `RUN_ENDED` stays the
                 * last row of every run, defeat included, and so the uncoalesced write below
                 * persists a transcript that already has it.
                 */
                const liveBoard = before.battle.battle;
                if (liveBoard) closeFight(runAfter, liveBoard);

                record(runAfter, {
                    kind: 'RUN_ENDED',
                    outcome: runAfter.outcome ?? 'abandoned',
                    biomeReached: nodeOf(runAfter, runAfter.currentNodeId)?.biomeIndex ?? 0,
                });
                // The one write that is not coalesced: the run is over and the next thing that
                // happens may be teardown, a reload, or the player closing the game.
                flusher.flushNow();
                return result;
            }

            // --- Movement ---
            if (action.type === 'run/enterNode' && runAfter) {
                const node = nodeOf(runAfter, runAfter.currentNodeId);
                if (node) {
                    record(runAfter, {
                        kind: 'NODE_ENTERED', nodeKind: node.kind, biome: node.biomeIndex, layer: node.layer,
                    });
                }
            }

            // --- Fights, from the battle slice rather than the run's ---
            //
            // Both boundaries are STATE TRANSITIONS, not actions: a fight can start from a node, a
            // gauntlet step or the debug launcher, and it ends by the arena clearing the battle
            // however it got there. Watching `battle.battle` go non-null and back is the one
            // condition true of all of them.
            const battleBefore = before.battle.battle;
            const battleAfter = after.battle.battle;
            if (!battleBefore && battleAfter) {
                const node = nodeOf(runAfter, runAfter?.currentNodeId);
                fightOpen = true;
                turnLogsOn = wantsTurnLogs();
                record(runAfter, {
                    kind: 'FIGHT_STARTED',
                    nodeKind: runAfter && node ? fightKindOf(runAfter, node) : 'wild',
                    enemies: battleAfter.enemyParty.map((entity) => entity.definitionId),
                });
                /*
                 * TICKET 156 §2 — what was carried in, beside who was fought.
                 *
                 * Taken from the RUN's deck rather than `battleAfter.playerDeck`, because the
                 * battle's deck is already shuffled into draw pile and hand and the question is
                 * "what did this run own at fight N", not "what order did it come up in". Sorted,
                 * duplicates kept: a multiset that diffs cleanly against the next fight's.
                 */
                record(runAfter, {
                    kind: 'FIGHT_DECK',
                    deck: [...(runAfter?.deck ?? [])].map((card) => card.dataId).sort(),
                    party: battleAfter.playerParty.map((entity) => ({
                        memberId: entity.id,
                        species: entity.definitionId,
                        osId: entity.activeOS ?? null,
                        hp: entity.currentHp,
                        maxHp: entity.maxHp,
                    })),
                    enemies: battleAfter.enemyParty.map((entity) => ({
                        species: entity.definitionId,
                        osId: entity.activeOS ?? null,
                    })),
                    nodeKind: runAfter && node ? fightKindOf(runAfter, node) : 'wild',
                    biome: node?.biomeIndex ?? 0,
                });
            }
            /*
             * THE FIGHT CLOSES WHEN IT IS DECIDED, not when the arena clears — 2026-09-25.
             *
             * The arena clears the board only after the reward screen, so a won fight used to log
             * its SCRAP and CARD_PICKED rows BEFORE its own killing turn and FIGHT_ENDED — and
             * those closing rows were then stamped with the NEXT fight's index, because the run had
             * already counted the win. Seen in the 09-25 Rootfall export (seq 11-15). Closing on
             * the dispatch that decides the board puts the rows in the order they happened.
             */
            if (battleAfter && fightOpen && battleOutcome(battleAfter) !== null) {
                closeFight(runAfter, battleAfter);
            }
            if (battleBefore && !battleAfter) {
                // The fallback close: the arena cleared a board that never read as decided (a
                // debug clear, a quit). Every ordinary fight closed above, and `closeFight` no-ops.
                closeFight(runAfter, battleBefore);
            }

            // --- Named purchases, before the SCRAP row so a reader sees what then cost what ---
            const payload = action.payload as Record<string, unknown> | undefined;
            switch (action.type) {
                case 'run/buyMarketCard': {
                    const card = payload?.card as { dataId?: string } | undefined;
                    record(runAfter, {
                        kind: 'CARD_BOUGHT',
                        dataId: card?.dataId ?? 'unknown',
                        price: Number(payload?.price ?? 0),
                    });
                    break;
                }
                case 'run/upgradeDeckCard': {
                    /*
                     * TICKET 163b. Read off the BEFORE state, because by the time this runs the
                     * instance already points at the `+` id and `from` would be `to`. `price` is
                     * derived the same way the reducer derives it rather than taken from the
                     * payload — the payload carries `free`, not a number, precisely so that no
                     * caller can write a price into the log the player did not pay.
                     */
                    const instanceId = String(payload?.instanceId ?? '');
                    const before = runBefore?.deck.find((card) => card.instanceId === instanceId);
                    const after = runAfter?.deck.find((card) => card.instanceId === instanceId);
                    // A no-op dispatch (unaffordable, ineligible, bench already used) changes
                    // nothing, and a log row for a thing that did not happen is worse than none.
                    if (before && after && before.dataId !== after.dataId) {
                        record(runAfter, {
                            kind: 'CARD_UPGRADED',
                            from: before.dataId,
                            to: after.dataId,
                            price: (runBefore?.scrap ?? 0) - (runAfter?.scrap ?? 0),
                        });
                    }
                    break;
                }
                case 'run/fitPatch': {
                    // TICKET 163d. Only when it TOOK — a full slot or an unknown id is a silent
                    // no-op in the reducer, and a log row for a thing that did not happen is
                    // worse than none. Read off the after-state's own list.
                    const memberId = String(payload?.memberId ?? '');
                    const patchId = String(payload?.patchId ?? '');
                    const before = (runBefore?.patches?.[memberId] ?? []).length;
                    const after = (runAfter?.patches?.[memberId] ?? []).length;
                    if (after > before) record(runAfter, { kind: 'PATCH_TAKEN', memberId, patchId });
                    break;
                }
                case 'run/sellRunCard': {
                    // `CARD_REMOVED` still, because that is what happened to the deck — the card
                    // left it. The paired `SCRAP` row below now carries a POSITIVE delta, which is
                    // the whole difference between this and the paid removal it replaced.
                    const instanceId = String(payload?.instanceId ?? '');
                    const gone = runBefore?.deck.find((card) => card.instanceId === instanceId)
                        ?? runBefore?.collection?.find((card) => card.instanceId === instanceId);
                    record(runAfter, {
                        kind: 'CARD_REMOVED',
                        dataId: gone?.dataId ?? 'unknown',
                        price: Number(payload?.price ?? 0),
                    });
                    break;
                }
                case 'run/recruitIntoParty': {
                    const cards = (payload?.cards ?? []) as ReadonlyArray<{ dataId?: string }>;
                    const memberId = String(payload?.memberId ?? '');
                    record(runAfter, {
                        kind: 'RECRUITED',
                        definitionId: memberId,
                        cards: cards.map((card) => card.dataId ?? 'unknown'),
                    });
                    break;
                }
                case 'game/swapOS': {
                    // `{ id, targetOS }`, not `{ memberId, osId }` — the payload's own names. Read
                    // them wrong and the row records two empty strings, which is worse than no row:
                    // it is a reflash you can see happened and cannot identify.
                    record(runAfter, {
                        kind: 'REFLASHED',
                        memberId: String(payload?.id ?? ''),
                        osId: String(payload?.targetOS ?? ''),
                    });
                    break;
                }
                case 'run/buyMacro': {
                    record(runAfter, {
                        kind: 'MACRO_BOUGHT',
                        macroId: String(payload?.macroId ?? ''),
                        price: Number(payload?.price ?? 0),
                    });
                    break;
                }
                case 'run/takeRewardMacro': {
                    const macroId = String(payload?.macroId ?? '');
                    const hadFreeSlot = (runBefore?.macros ?? []).some((slot) => slot === null);
                    const replaced = hadFreeSlot ? null : (runBefore?.macros[Number(payload?.replaceSlot)] ?? null);
                    if (runAfter?.macros.includes(macroId)) record(runAfter, { kind: 'MACRO_WON', macroId, replaced });
                    break;
                }
                case 'run/consumeMacro': {
                    const slot = Number(payload ?? -1);
                    record(runAfter, { kind: 'MACRO_FIRED', macroId: runBefore?.macros[slot] ?? 'unknown' });
                    break;
                }
                case 'run/rerollMarketStock': {
                    record(runAfter, { kind: 'REROLLED', price: Number(payload?.price ?? 0) });
                    break;
                }
                case 'run/resolveEvent': {
                    // Only when the reducer took it: a refused second resolution changes nothing.
                    if ((runAfter?.eventHistory ?? []).length > (runBefore?.eventHistory ?? []).length) {
                        record(runAfter, {
                            kind: 'EVENT_RESOLVED',
                            eventId: String(payload?.eventId ?? ''),
                            choiceId: String(payload?.choiceId ?? ''),
                        });
                    }
                    break;
                }
                default:
                    break;
            }

            // --- What the store cannot see, reported by its one call site ---
            if (action.type === logRunEvent.type) {
                record(runAfter, action.payload as RunEventInput);
            }

            // --- Scrap, derived. Last, so it reads as the consequence of the row above it ---
            const scrapBefore = runBefore?.scrap ?? 0;
            const scrapAfter = runAfter?.scrap ?? 0;
            if (runBefore && runAfter && scrapAfter !== scrapBefore) {
                record(runAfter, {
                    kind: 'SCRAP', delta: scrapAfter - scrapBefore, reason: shortType(action.type),
                });
            }
        } catch (error) {
            // Instrumentation may not break a dispatch. See the header.
            console.warn('[RunLog] dropped an event:', error);
        }

        return result;
    };
}
