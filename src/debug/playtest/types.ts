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

import type { IRanchState, IRegionNode, IRunState, NodeKind } from '../../engine/runTypes';
import type { IBattleState } from '../../engine/types';
import type { RunSliceState } from '../../ui/store/runSlice';
import type { EventDefinition } from '../../engine/run/events/eventSchema';
import type { OutcomePick } from '../../ui/events/outcomePicks';
import type { HitTotal } from './battleSim';
import type { PlayRecord } from './expect/outcome';
import type { Finding } from './findings';

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
    /** How many decisions a run may take before the session stops with outcome `budget`. Left out, `DEFAULT_BUDGET`. */
    readonly budget?: number;
}

/** One applied move: its stable key, the agent's one-sentence reason, and an optional prediction. */
export interface LoggedMove {
    readonly key: string;
    readonly why: string;
    readonly expect?: unknown;
    /**
     * True on the second and later moves of one `moves` call. A decision is a call, not a move: a
     * whole battle turn sent as a list is one decision, and only unchained moves count against the budget.
     */
    readonly chained?: true;
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
    /** In a gauntlet: each member's HP as the fight left it, for `advanceGauntlet`. */
    readonly carried?: ReadonlyArray<{ readonly memberId: string; readonly hp: number; readonly maxHp: number }>;
    readonly scraps: number;
    readonly blueprints: ReadonlyArray<string>;
    readonly driver: string | null;
    readonly cardChoices: ReadonlyArray<RewardCardChoice>;
    readonly patchOffers: ReadonlyArray<{ readonly memberId: string; readonly patchId: string }>;
    readonly macroOffers: ReadonlyArray<string>;
    readonly answers: ReadonlyArray<RewardAnswer>;
}

/**
 * An event in progress. The event is drawn once, on arrival, and kept here for the visit: a draw
 * reads the run, and the run changes while a choice is being made, so redrawing would change the
 * event under the player's feet (`EventNode` holds its draw in a ref for the same reason).
 */
export interface EventFlow {
    readonly visitKey: string;
    /** `null` is the Empty Relay, the node's fallback when nothing is eligible. */
    readonly event: EventDefinition | null;
    /** The choice taken and awaiting its picks, or null while the choices are on offer. */
    readonly choiceId: string | null;
    readonly outcomeIndex: number;
    readonly picks: Readonly<Record<number, OutcomePick>>;
    /** Cards ticked so far in a multi-card step. */
    readonly selected: ReadonlyArray<string>;
    /** The Overclock Rig's free upgrade bench is open. */
    readonly upgrading: boolean;
}

/** The loadout editor, open over whatever screen opened it. */
export interface EditorState {
    /** A benched member picked up, waiting for a slot. */
    readonly swapping: string | null;
    readonly confirmWarned: boolean;
}

/**
 * A battle the agent is playing (`turn` and `card` mode). The state lives here, in the view, because
 * the run slice holds no battle; a replay rebuilds it by playing the log again.
 */
export interface BattleFlow {
    /** A gauntlet fight is claimed differently from a node's (HP carried, then `advanceGauntlet`). */
    readonly context: 'node' | 'gauntlet';
    /** The node the party is standing on (an event node, for an Ambush Bait fight). */
    readonly nodeId: string;
    /** The node the fight counts as (`fightNodeFor`): the encounter's kind and its reward. */
    readonly fought: IRegionNode;
    readonly state: IBattleState;
    /** Every hit of the fight so far, merged by source, target and card. */
    readonly hits: ReadonlyArray<HitTotal>;
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
    event: EventFlow | null;
    editor: EditorState | null;
    /** The battle in progress, in `turn` and `card` mode. */
    battle: BattleFlow | null;
    /** Why the session was stopped by the tool rather than by the game (`budget`: the decision budget ran out). */
    cutShort: 'budget' | null;
    /** Set when the game's own code threw during a fight. The run is cut short and the message is kept for the report. */
    engineError: string | null;
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
    /** Surprises and invariant failures found so far (180e). Rebuilt by every replay, never saved. */
    readonly findings: Finding[];
    /** The card or macro the agent played in the move being applied, for `--expect` to read. Cleared before each move. */
    lastPlay: PlayRecord | null;
}

export interface Move {
    readonly key: string;
    readonly label: string;
    readonly apply: (world: World) => void;
    /**
     * What this move is about, for the morning report (180f): the kind of choice and the game's own
     * names of the things it is between. Only the choices the report tallies carry one: a card taken,
     * stored or passed over at a reward, a card or macro bought, a card upgraded.
     */
    readonly about?: MoveAbout;
}

export interface MoveAbout {
    readonly verb: 'take' | 'store' | 'skip' | 'buy' | 'upgrade';
    /** One name for take, store, buy and upgrade; every option on offer for skip. */
    readonly items: ReadonlyArray<string>;
}

export interface Screen {
    readonly id: string;
    readonly body: ReadonlyArray<string>;
    readonly moves: ReadonlyArray<Move>;
}

export const runOf = (world: World): IRunState => world.store.getState().run.run!;
