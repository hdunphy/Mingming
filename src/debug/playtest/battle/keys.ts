/**
 * TICKET 180d — A BATTLE MOVE'S STABLE KEY.
 *
 * The session log stores keys, never menu numbers, and a battle's moves change every turn, so the
 * key names what the move does in the game's own ids: which card instance, cast by whom, at whom.
 * Instance and entity ids are the engine's and do not change while a battle runs, which is what lets
 * `moves 3,5,9` resolve its numbers to keys up front and stay true as the hand shrinks.
 */
import type { BattleAction } from '../../../engine/battleReducer';

export const END_TURN_KEY = 'battle:end';

export function battleKeyOf(action: BattleAction): string {
    switch (action.type) {
        case 'PLAY_PROGRAM':
            return `battle:play:${action.payload.programId}:${action.payload.sourceId}:${action.payload.targetId}`;
        case 'END_TURN':
            return END_TURN_KEY;
        default:
            throw new Error(`the playtester has no key for a "${action.type}" action`);
    }
}

export const macroKey = (slot: number, sourceId: string, targetId: string): string =>
    `battle:macro:${slot}:${sourceId}:${targetId}`;

export type ParsedBattleKey =
    | { readonly kind: 'play'; readonly programId: string; readonly sourceId: string; readonly targetId: string }
    | { readonly kind: 'macro'; readonly slot: number; readonly sourceId: string; readonly targetId: string }
    | { readonly kind: 'end' };

export function parseBattleKey(key: string): ParsedBattleKey | null {
    if (key === END_TURN_KEY) return { kind: 'end' };
    const parts = key.split(':');
    if (parts[0] !== 'battle' || parts.length !== 5) return null;
    if (parts[1] === 'play') return { kind: 'play', programId: parts[2], sourceId: parts[3], targetId: parts[4] };
    if (parts[1] === 'macro') return { kind: 'macro', slot: Number(parts[2]), sourceId: parts[3], targetId: parts[4] };
    return null;
}
