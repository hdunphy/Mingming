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
 * than losing the row. The write itself is coalesced onto a microtask — a scrap change and the
 * three rows around it are one write, not four.
 */

import { createAction } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';

import {
    appendRunEvent,
    emptyRunLog,
    runLogKeyFor,
    writeRunLog,
    type IRunLog,
    type RunEventInput,
} from '../../engine/run/runLog';
import type { IBattleState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

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
let flushQueued = false;

function flushSoon(): void {
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(() => {
        flushQueued = false;
        if (current) writeRunLog(current);
    });
}

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
    flushSoon();
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
    current = found ?? emptyRunLog(run.seed, run.startedAt);
    seq = current.events.reduce((highest, event) => Math.max(highest, event.seq), 0);
}

/** Test seam: forget the in-memory transcript. Nothing in the app calls this. */
export function resetRunLogRecorder(): void {
    current = null;
    seq = 0;
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

export function createRunLogMiddleware(readLogs: () => IRunLog[]): Middleware {
    return (store) => (next) => (action) => {
        const before = store.getState() as LoggedState;
        const result = next(action);
        if (!isAction(action)) return result;

        try {
            const after = store.getState() as LoggedState;
            const runBefore = before.run.run;
            const runAfter = after.run.run;

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
                        });
                    }
                }
                return result;
            }

            if (!current) return result;

            if (action.type === 'run/endRun' && runAfter) {
                record(runAfter, {
                    kind: 'RUN_ENDED',
                    outcome: runAfter.outcome ?? 'abandoned',
                    biomeReached: nodeOf(runAfter, runAfter.currentNodeId)?.biomeIndex ?? 0,
                });
                // The one write that is not coalesced: the run is over and the next thing that
                // happens may be teardown, a reload, or the player closing the game.
                writeRunLog(current);
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
                record(runAfter, {
                    kind: 'FIGHT_STARTED',
                    nodeKind: node?.kind ?? 'wild',
                    enemies: battleAfter.enemyParty.map((entity) => entity.definitionId),
                });
            }
            if (battleBefore && !battleAfter) {
                // `battleBefore` is the last live board, so the HP and turn count are the fight's
                // final ones. Reading them after the clear would find nothing at all.
                const partyHp: Record<string, number> = {};
                for (const member of battleBefore.playerParty) partyHp[member.id] = member.currentHp;
                record(runAfter, {
                    kind: 'FIGHT_ENDED',
                    turns: battleBefore.turn,
                    won: battleBefore.enemyParty.every((entity) => entity.currentHp <= 0),
                    partyHp,
                });
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
                case 'run/removeRunCardForScrap': {
                    const instanceId = String(payload?.instanceId ?? '');
                    const gone = runBefore?.deck.find((card) => card.instanceId === instanceId);
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
                case 'run/consumeMacro': {
                    const slot = Number(payload ?? -1);
                    record(runAfter, { kind: 'MACRO_FIRED', macroId: runBefore?.macros[slot] ?? 'unknown' });
                    break;
                }
                case 'run/rerollMarketStock': {
                    record(runAfter, { kind: 'REROLLED', price: Number(payload?.price ?? 0) });
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
