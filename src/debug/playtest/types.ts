/**
 * TICKET 180 — the shared shapes of the agent playtester.
 *
 * A **session** is a seed plus a log of moves (`SessionFile`). Everything else is rebuilt from it by
 * replaying: a fresh store, `createRun`, then every logged move in order. The engine is
 * deterministic, so a replay is exact and any session file is a perfect bug reproduction.
 *
 * A **screen** is what the player would see right now (`body`, plain text) and the legal moves from
 * it (`moves`). A **move** has a stable `key`; the log stores keys, never menu numbers, because a
 * number only means something against the screen it was printed on.
 */
import type { EnhancedStore } from '@reduxjs/toolkit';

import type { IRanchState, IRunState, NodeKind } from '../../engine/runTypes';
import type { RunSliceState } from '../../ui/store/runSlice';
import type { HitTotal } from './battleSim';

export type PlaytestMode = 'run' | 'turn' | 'card';

/** What a session is started with. Everything about the run follows from these. */
export interface SessionHeader {
    readonly seed: string;
    /** A firmware id: one of the twelve Early Access starters. */
    readonly starter: string;
    readonly gymIndex: number;
    readonly mode: PlaytestMode;
    readonly tier: number;
    readonly modifiers: ReadonlyArray<string>;
}

/** One applied move: its stable key, the agent's one-sentence reason, and an optional prediction. */
export interface LoggedMove {
    readonly key: string;
    readonly why: string;
    readonly expect?: unknown;
}

/** A free-form note, pinned to how many moves had been made when it was written. */
export interface LoggedNote {
    readonly atMove: number;
    readonly text: string;
}

export interface SessionFile extends SessionHeader {
    readonly moves: ReadonlyArray<LoggedMove>;
    readonly notes: ReadonlyArray<LoggedNote>;
}

export type PlaytestStore = EnhancedStore<{ game: IRanchState; run: RunSliceState }>;

// ---- the view: everything the replay holds that is not in the redux state ----------------------

export interface FightReport {
    readonly nodeId: string;
    readonly kind: NodeKind;
    readonly won: boolean;
    readonly turns: number;
    readonly truncated: boolean;
    readonly party: ReadonlyArray<{ readonly name: string; readonly hp: number; readonly maxHp: number }>;
    readonly foes: ReadonlyArray<{ readonly name: string }>;
    /** The five biggest hits of the fight, by total damage. */
    readonly hits: ReadonlyArray<HitTotal>;
}

export interface RewardCardChoice {
    readonly from: string;
    readonly options: ReadonlyArray<{ readonly instanceId: string; readonly dataId: string }>;
}

/** One answered reward decision. Decisions are asked in order: card choices, then patch, then macro. */
export type RewardAnswer =
    | { readonly kind: 'card'; readonly picked: number | null; readonly store: boolean }
    | { readonly kind: 'patch'; readonly memberId: string | null }
    | { readonly kind: 'macro'; readonly macroId: string | null; readonly replaceSlot?: number };

/** A won fight's pay, waiting to be claimed. Blueprints are already banked, as the arena banks them. */
export interface RewardFlow {
    readonly nodeId: string;
    readonly scraps: number;
    readonly blueprints: ReadonlyArray<string>;
    readonly driver: string | null;
    readonly cardChoices: ReadonlyArray<RewardCardChoice>;
    readonly patchOffers: ReadonlyArray<{ readonly memberId: string; readonly patchId: string }>;
    readonly macroOffers: ReadonlyArray<string>;
    readonly answers: ReadonlyArray<RewardAnswer>;
}

export interface View {
    /** Lines about what the last move did, shown above the next screen and cleared by the move after. */
    news: string[];
    /** The fight just played, shown with its rewards. */
    fight: FightReport | null;
    reward: RewardFlow | null;
    /**
     * The node id of the last stall (market or workshop) the player walked out of. This is
     * `RunScreen`'s `closedNodeId`: stepping back onto that same node shows the map with a
     * button to go back in, not the stall itself.
     */
    closedStall: string | null;
    /** `nodeId:visit` of the last event the player walked out of (`RunScreen`'s `leftEventKey`). */
    leftEvent: string | null;
}

/** What a section of a screen contributes: some lines of text and the moves that go with them. */
export interface Section {
    readonly lines: ReadonlyArray<string>;
    readonly moves: ReadonlyArray<Move>;
}

export interface World {
    readonly header: SessionHeader;
    readonly store: PlaytestStore;
    view: View;
    /** Moves applied so far, in order. This is the session's log. */
    readonly log: LoggedMove[];
}

export interface Move {
    readonly key: string;
    readonly label: string;
    readonly apply: (world: World) => void;
}

export interface Screen {
    readonly id: string;
    readonly body: ReadonlyArray<string>;
    readonly moves: ReadonlyArray<Move>;
}

export const runOf = (world: World): IRunState => world.store.getState().run.run!;
