
import type { Element, IDamageRecord, StatusType, TurnPhase } from './types';

export type BattleEventType =
    | 'BATTLE_STARTED'
    | 'BATTLE_ENDED'
    | 'programs_initialized' // Optional: if we want to track initialization separate from start
    | 'PROGRAM_PLAYED'
    | 'PROGRAM_DISCARDED'
    | 'DAMAGE_TAKEN'
    | 'HEAL'
    | 'STATUS_APPLIED'
    | 'STATUS_REMOVED'
    | 'PHASE_START'
    | 'PHASE_END'
    | 'DECK_SHUFFLED'
    | 'CARD_DRAWN'
    | 'TURN_START' // Explicit turn start event
    | 'TURN_END' // Explicit turn end event
    | 'LEVEL_UP'
    | 'DRIVER_PROC';

export interface BaseEvent {
    readonly type: BattleEventType;
    readonly timestamp: number;
}

export interface BattleStartedEvent extends BaseEvent {
    readonly type: 'BATTLE_STARTED';
    readonly sessionId: string;
}

export interface BattleEndedEvent extends BaseEvent {
    readonly type: 'BATTLE_ENDED';
    readonly winnerSide: 'PLAYER' | 'ENEMY';
}

export interface ProgramPlayedEvent extends BaseEvent {
    readonly type: 'PROGRAM_PLAYED';
    readonly sourceId: string;
    readonly targetId: string;
    readonly programId: string;
}

export interface ProgramDiscardedEvent extends BaseEvent {
    readonly type: 'PROGRAM_DISCARDED';
    readonly ownerId: string;
    readonly cardId: string; // The specific instance ID or data ID? Usually instance if from hand.
    readonly manual: boolean; // Was it manually discarded or end-of-turn cleanup?
}

export interface DamageTakenEvent extends BaseEvent {
    readonly type: 'DAMAGE_TAKEN';
    readonly targetId: string;
    /**
     * Post-shield, pre-floor damage. **Not** the number to put on a card face — it is what got past
     * the shield, so a fully absorbed hit reports 0. Left with its original meaning so that adding
     * `damage` below changed no existing listener.
     */
    readonly amount: number;
    readonly element: Element;
    readonly isCritical?: boolean;
    /**
     * The full accounting of this hit — raw, absorbed, applied. Optional only because a few test
     * fixtures hand-build this event; `handleAttack`, the sole production emitter, always sets it.
     * Read this, not `amount`, whenever the question is "how much did that hit for".
     */
    readonly damage?: IDamageRecord;
}

export interface HealEvent extends BaseEvent {
    readonly type: 'HEAL';
    readonly targetId: string;
    readonly amount: number;
    readonly sourceId?: string; // Optional source
}

export interface StatusAppliedEvent extends BaseEvent {
    readonly type: 'STATUS_APPLIED';
    readonly targetId: string;
    readonly status: StatusType;
    readonly stacks: number;
}

export interface StatusRemovedEvent extends BaseEvent {
    readonly type: 'STATUS_REMOVED';
    readonly targetId: string;
    readonly status: StatusType;
}

export interface PhaseEvent extends BaseEvent {
    readonly type: 'PHASE_START' | 'PHASE_END';
    readonly phase: TurnPhase;
}

export interface CardDrawnEvent extends BaseEvent {
    readonly type: 'CARD_DRAWN';
    readonly ownerId: string;
    readonly cardId: string;
}

export interface DeckShuffledEvent extends BaseEvent {
    readonly type: 'DECK_SHUFFLED';
    readonly ownerId: string;
}

export interface TurnEvent extends BaseEvent {
    readonly type: 'TURN_START' | 'TURN_END';
    readonly turnNumber: number;
    readonly activeSide: 'PLAYER' | 'ENEMY';
}

export interface LevelUpEvent extends BaseEvent {
    readonly type: 'LEVEL_UP';
    readonly targetId: string;
    readonly newLevel: number;
}

/**
 * TICKET 16 — a Driver just did its thing, and the player is meant to see it.
 *
 * `macros-and-drivers.md`: *"Driver law: PROC-VISIBLE, not merely small. Flat percents rejected as
 * INVISIBLE (the 2%-status disease) ... Every driver names a trigger moment the player watches."*
 * The engine's half of that law is this event, emitted by `HookFactory` when a hook flagged
 * `proc: true` passes its condition. The UI's half is the chip flash in `BattleTopBar` and the
 * float on the owner (`useBattleVfx`).
 *
 * Emitted by the hook's OWNER — the party member whose copy of the Driver fired — so a party-wide
 * Driver that fires per member (OVERKILL RECOVERY heals each) announces once per member, which is
 * the truth of what happened. Muted with the rest of the bus under a preview, and never emitted
 * inside the AI's search (`isSimulating`).
 */
export interface DriverProcEvent extends BaseEvent {
    readonly type: 'DRIVER_PROC';
    /** The Driver, e.g. `driver_first_blood`. */
    readonly driverId: string;
    /** The hook that fired, e.g. `driver_first_blood_fire`. */
    readonly hookId: string;
    /** The member whose copy of the Driver fired. */
    readonly ownerId: string;
    /** Whose side the owner is on. */
    readonly fromPlayer: boolean;
}

export type BattleEvent =
    | DriverProcEvent
    | BattleStartedEvent
    | BattleEndedEvent
    | ProgramPlayedEvent
    | ProgramDiscardedEvent
    | DamageTakenEvent
    | HealEvent
    | StatusAppliedEvent
    | StatusRemovedEvent
    | PhaseEvent
    | CardDrawnEvent
    | DeckShuffledEvent
    | TurnEvent
    | LevelUpEvent;

export type EventListener = (event: BattleEvent) => void;

/**
 * Simple Event Bus for the Battle Engine.
 * Allows systems (like UI logging or Achievements) to subscribe to core engine events.
 */
export class BattleEventBus {
    private listeners: EventListener[] = [];
    private enabled: boolean = true;

    public subscribe(listener: EventListener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    public emit(event: BattleEvent): void {
        if (!this.enabled) return;
        this.listeners.forEach(listener => listener(event));
    }

    /**
     * Is the bus live? TICKET 109 needs this as the **0-AI-SIM-COUNTS predicate**.
     *
     * Any counter placed inside the reducer is also executed by `TacticalAI`'s speculative plays -
     * it runs whole card sequences through the real reducer to score them - so a naive counter
     * measures the AI's imagination alongside the battle, inflating every rate by the branching
     * factor. The AI runs that search muted, which makes "is the bus live" exactly the predicate
     * that separates a real play from a simulated one.
     */
    public get isLive(): boolean {
        return this.enabled;
    }

    public mute(): void {
        this.enabled = false;
    }

    public unmute(): void {
        this.enabled = true;
    }

    /**
     * TICKET 104. `mute`/`unmute` are a boolean, not a counter, so a nested muted section
     * un-mutes the OUTER one when it finishes. The AI already runs whole card sequences
     * through the reducer under `mute()`, and the damage preview now does the same - so a
     * preview computed from inside an AI simulation would have let the AI's remaining
     * candidate plays emit real events into the UI.
     *
     * Use this instead of a bare mute/unmute pair for any new muted section: it restores
     * whatever the previous state was, so nesting is safe in either order.
     */
    public runMuted<T>(fn: () => T): T {
        const wasEnabled = this.enabled;
        this.enabled = false;
        try {
            return fn();
        } finally {
            this.enabled = wasEnabled;
        }
    }
}

export const globalBattleEventBus = new BattleEventBus();
