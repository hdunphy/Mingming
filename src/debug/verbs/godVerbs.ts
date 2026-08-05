/**
 * God-tool verbs — the v1 mid-battle command set.
 *
 * Specified by docs/wayfinder/debug-toolkit/tickets/05-live-manipulation-command-set.md
 * section 1, built by ticket 15.
 *
 * Every verb is a pure `(state: IBattleState, args) => IBattleState` function that
 *
 *   1. delegates the actual transition to `battleReducer(state, action)` — the reducer
 *      stays the single source of truth for state transitions, so a debug-staged board
 *      is indistinguishable from one the game produced, hooks and all; and
 *   2. appends one `[DEBUG] ...` line to `state.logs` on top of whatever the engine
 *      wrote itself, so an exported repro says which verb touched the board.
 *
 * `battleReducer` is a plain exported function, not a slice, so nothing here needs a new
 * `battleSlice` action: the panel dispatches `setBattleState(verb(current, args))`.
 * Nothing here imports React — these are headlessly testable and reusable by the batch sim.
 *
 * SOURCE ATTRIBUTION. Every damage-shaped verb takes a `sourceId`. It is never defaulted
 * to the target: retaliation and thorns-style hooks read source-vs-target to decide whether
 * to fire, so self-attribution would silently misfire exactly the reactive hooks most worth
 * debugging. The caller picks; `sourceDefaults.ts` derives the pre-filled suggestion.
 */

import { battleReducer, type BattleAction } from '../../engine/battleReducer';
import type { IBattleState, IBattleEntity, IMove, StatusType } from '../../engine/types';

/** Every verb-written log line starts with this. Also how the panel finds its own last line. */
export const DEBUG_LOG_PREFIX = '[DEBUG]';

/**
 * Appended when the reducer handed back the identical state object. Each of these
 * actions returns `state` by identity when it refuses (unknown entity, unusable
 * sourceId, nothing to remove, wrong phase), so a rejected verb is detectable and
 * says so instead of logging a change that never happened.
 */
export const DEBUG_NO_OP_SUFFIX = ' — no-op (engine rejected it)';

// --- Helpers ---

function findEntity(state: IBattleState, entityId: string): IBattleEntity | undefined {
    return state.playerParty.find((e) => e.id === entityId)
        ?? state.enemyParty.find((e) => e.id === entityId);
}

/** `Hero (p1)`, falling back to the bare id for units that are not on the board. */
export function unitLabel(state: IBattleState, entityId: string | null | undefined): string {
    if (!entityId) return 'nobody';
    const entity = findEntity(state, entityId);
    return entity ? `${entity.name} (${entityId})` : entityId;
}

/**
 * The one mutation path: run the engine action, then log. `describe` is built from the
 * PRE-action state so names and the turn counter read as they did when the verb was issued.
 */
function apply(state: IBattleState, action: BattleAction, describe: string): IBattleState {
    const next = battleReducer(state, action);
    const line = `${DEBUG_LOG_PREFIX} ${describe}${next === state ? DEBUG_NO_OP_SUFFIX : ''}`;
    return { ...next, logs: [...next.logs, line] };
}

// --- Verb argument shapes ---

export interface SetHpArgs {
    readonly entityId: string;
    readonly hp: number;
    /** Damage-shaped: an HP decrease runs the post-damage hooks against this unit. */
    readonly sourceId: string;
}

export interface SetEnergyArgs {
    readonly entityId: string;
    readonly energy: number;
    /**
     * Fires nothing — the engine has no energy trigger — but `SET_VITALS` still validates
     * it, and rejects the whole action when it is not a real unit.
     */
    readonly sourceId: string;
}

export interface SetTempHpArgs {
    readonly entityId: string;
    readonly tempHp: number;
    /** Inert, like `SetEnergyArgs.sourceId`, and validated the same way. */
    readonly sourceId: string;
}

export interface ApplyStatusArgs {
    readonly targetId: string;
    readonly status: StatusType;
    readonly stacks: number;
    /** Optional in the engine action; the panel always supplies one. */
    readonly sourceId?: string;
}

export interface ClearStatusArgs {
    readonly entityId: string;
    /** Omit to clear every status on the unit. */
    readonly status?: StatusType;
}

export interface AddCardToHandArgs {
    readonly side: 'PLAYER' | 'ENEMY';
    readonly dataId: string;
}

export interface SetIntentArgs {
    readonly entityId: string;
    /** `null` clears the telegraph. */
    readonly move: IMove | null;
}

export interface ExecuteIntentArgs {
    /** The unit that acts. `EXECUTE_INTENT` only resolves for enemy-party units. */
    readonly entityId: string;
}

export interface KillEntityArgs {
    readonly entityId: string;
    /** Mandatory: `calculateDeathXp` needs a real receiver to award XP. */
    readonly sourceId: string;
}

// --- The ten verbs ---

/** Set a unit's current HP. A decrease is damage (hooks + death processing); an increase heals. */
export function setHp(state: IBattleState, args: SetHpArgs): IBattleState {
    const { entityId, hp, sourceId } = args;
    return apply(
        state,
        { type: 'SET_VITALS', payload: { entityId, hp, sourceId } },
        `SET_VITALS: ${unitLabel(state, entityId)} HP → ${hp} (source: ${unitLabel(state, sourceId)})`,
    );
}

/** Set a unit's current energy. Fires nothing. */
export function setEnergy(state: IBattleState, args: SetEnergyArgs): IBattleState {
    const { entityId, energy, sourceId } = args;
    return apply(
        state,
        { type: 'SET_VITALS', payload: { entityId, energy, sourceId } },
        `SET_VITALS: ${unitLabel(state, entityId)} energy → ${energy}`,
    );
}

/** Set a unit's shield. Fires nothing. */
export function setTempHp(state: IBattleState, args: SetTempHpArgs): IBattleState {
    const { entityId, tempHp, sourceId } = args;
    return apply(
        state,
        { type: 'SET_VITALS', payload: { entityId, tempHp, sourceId } },
        `SET_VITALS: ${unitLabel(state, entityId)} shield → ${tempHp}`,
    );
}

/** Apply a status with stacks. Rides the PRE-EXISTING `APPLY_STATUS` action. */
export function applyStatus(state: IBattleState, args: ApplyStatusArgs): IBattleState {
    const { targetId, status, stacks, sourceId } = args;
    const attribution = sourceId ? ` (source: ${unitLabel(state, sourceId)})` : ' (unattributed)';
    return apply(
        state,
        { type: 'APPLY_STATUS', payload: { targetId, status, stacks, sourceId } },
        `APPLY_STATUS: ${status} x${stacks} → ${unitLabel(state, targetId)}${attribution}`,
    );
}

/** Remove one status, or every status when `status` is omitted. */
export function clearStatus(state: IBattleState, args: ClearStatusArgs): IBattleState {
    const { entityId, status } = args;
    const what = status ?? 'all statuses';
    return apply(
        state,
        { type: 'REMOVE_STATUS', payload: { entityId, status } },
        `REMOVE_STATUS: cleared ${what} from ${unitLabel(state, entityId)}`,
    );
}

/** Put a card in a side's hand. Subject to the engine's hand-size limit. */
export function addCardToHand(state: IBattleState, args: AddCardToHandArgs): IBattleState {
    const { side, dataId } = args;
    return apply(
        state,
        { type: 'ADD_CARD_TO_HAND', payload: { side, dataId } },
        `ADD_CARD_TO_HAND: ${dataId} → ${side} hand`,
    );
}

/** Telegraph a unit's next move (or clear it with `null`). Fires nothing: a plan is not an event. */
export function setIntent(state: IBattleState, args: SetIntentArgs): IBattleState {
    const { entityId, move } = args;
    return apply(
        state,
        { type: 'SET_INTENT', payload: { entityId, move } },
        `SET_INTENT: ${unitLabel(state, entityId)} → ${move ? move.name : '(cleared)'}`,
    );
}

/**
 * Make a unit act on its telegraphed intent right now. Rides the PRE-EXISTING
 * `EXECUTE_INTENT` action, which resolves only for enemy-party units holding an intent
 * during the ACTION phase — anything else is a no-op.
 */
export function executeIntent(state: IBattleState, args: ExecuteIntentArgs): IBattleState {
    const { entityId } = args;
    return apply(
        state,
        { type: 'EXECUTE_INTENT', payload: { sourceId: entityId } },
        `EXECUTE_INTENT: ${unitLabel(state, entityId)} acts now`,
    );
}

/** End the active side's turn. Rides the PRE-EXISTING `END_TURN` action, DoT and draws included. */
export function skipTurn(state: IBattleState): IBattleState {
    return apply(
        state,
        { type: 'END_TURN' },
        `END_TURN: skipped ${state.activeSide} on turn ${state.turn}`,
    );
}

/**
 * Drop a unit to 0 HP with full death processing — on-death hooks, XP award, `levelUpQueue`.
 * Covers insta-win and insta-lose, since victory is derived from `currentHp <= 0` everywhere.
 */
export function killEntity(state: IBattleState, args: KillEntityArgs): IBattleState {
    const { entityId, sourceId } = args;
    return apply(
        state,
        { type: 'KILL_ENTITY', payload: { entityId, sourceId } },
        `KILL_ENTITY: ${unitLabel(state, entityId)} killed by ${unitLabel(state, sourceId)}`,
    );
}

// --- Catalog ---

export type GodVerbId =
    | 'setHp' | 'setEnergy' | 'setTempHp' | 'applyStatus' | 'clearStatus'
    | 'addCardToHand' | 'setIntent' | 'executeIntent' | 'skipTurn' | 'killEntity';

/** How a verb attributes its effect, which is what the panel's source picker keys off. */
export type SourceRequirement =
    /** Damage-shaped and mandatory. */
    | 'required'
    /** The action accepts a source; the panel pre-fills one anyway. */
    | 'optional'
    /** The engine validates it but nothing reads it (energy / shield). */
    | 'inert'
    /** No source in the payload at all. */
    | 'none';

export interface GodVerbMeta {
    readonly id: GodVerbId;
    readonly label: string;
    readonly action: BattleAction['type'];
    /**
     * `true` = the action shipped with ticket 14 alongside this overlay; `false` = it
     * predates the debug toolkit and is exercised by ordinary play.
     *
     * This is not trivia: it changes what a repro proves. A bug reproduced through
     * `APPLY_STATUS` / `END_TURN` / `EXECUTE_INTENT` is a bug in a code path the game
     * itself runs every turn. A bug reproduced through one of the new actions might be
     * a bug in that action instead, so confirm it against a naturally reached board
     * before filing it against the system under test.
     */
    readonly isNewAction: boolean;
    readonly source: SourceRequirement;
}

/** Display order in the panel; also the checklist for "did all ten ship?". */
export const GOD_VERBS: readonly GodVerbMeta[] = [
    { id: 'setHp', label: 'Set HP', action: 'SET_VITALS', isNewAction: true, source: 'required' },
    { id: 'setEnergy', label: 'Set energy', action: 'SET_VITALS', isNewAction: true, source: 'inert' },
    { id: 'setTempHp', label: 'Set shield', action: 'SET_VITALS', isNewAction: true, source: 'inert' },
    { id: 'applyStatus', label: 'Apply status', action: 'APPLY_STATUS', isNewAction: false, source: 'optional' },
    { id: 'clearStatus', label: 'Clear status', action: 'REMOVE_STATUS', isNewAction: true, source: 'none' },
    { id: 'addCardToHand', label: 'Add card to hand', action: 'ADD_CARD_TO_HAND', isNewAction: true, source: 'none' },
    { id: 'setIntent', label: 'Set intent', action: 'SET_INTENT', isNewAction: true, source: 'none' },
    { id: 'executeIntent', label: 'Act now', action: 'EXECUTE_INTENT', isNewAction: false, source: 'none' },
    { id: 'skipTurn', label: 'Skip turn', action: 'END_TURN', isNewAction: false, source: 'none' },
    { id: 'killEntity', label: 'Insta-kill', action: 'KILL_ENTITY', isNewAction: true, source: 'required' },
] as const;

/** Lookup used by the panel to badge each control with its engine action. */
export const GOD_VERBS_BY_ID: Readonly<Record<GodVerbId, GodVerbMeta>> = Object.fromEntries(
    GOD_VERBS.map((verb) => [verb.id, verb]),
) as Record<GodVerbId, GodVerbMeta>;
