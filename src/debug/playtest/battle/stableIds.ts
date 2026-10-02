/**
 * TICKET 180d — GIVING THE ENGINE'S RANDOM IDS NAMES THAT A REPLAY WILL REPEAT.
 *
 * A session is replayed from its log, and a replay must land on the same battle, move key for move
 * key. Two places in the engine name things with `crypto.randomUUID()` instead of the battle's seed:
 * every status effect instance (`StatusBehaviors.createInstance`) and every card a card makes
 * (`effectHandlers`' add-to-hand). The first replay of a played battle would then disagree about the
 * id of a generated card, and a logged move that plays it would be refused.
 *
 * The playtester may not change the engine, so it renames at its own edge: after every step, each
 * UUID in the state becomes `tok_<n>`, numbered in the order the state mentions them and carried on
 * from the battle's own count. The walk is a faithful copy (same shape, `undefined` kept) that
 * touches only strings and object keys, and a state with no UUID in it is returned as it came.
 * Logged in the report as an engine finding: the engine's own battles are not bit-for-bit repeatable.
 */
import type { IBattleState } from '../../../engine/types';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

export interface Stabilized {
    readonly state: IBattleState;
    /** How many ids have been named so far in this battle. */
    readonly minted: number;
}

export function stabilizeIds(state: IBattleState, minted: number): Stabilized {
    const names = new Map<string, string>();
    const rename = (text: string): string => text.replace(UUID, (uuid) => {
        let name = names.get(uuid);
        if (name === undefined) {
            name = `tok_${minted + names.size}`;
            names.set(uuid, name);
        }
        return name;
    });
    const walk = (value: unknown): unknown => {
        if (typeof value === 'string') return rename(value);
        if (Array.isArray(value)) return value.map(walk);
        if (value !== null && typeof value === 'object') {
            const copy: Record<string, unknown> = {};
            for (const [key, inner] of Object.entries(value as Record<string, unknown>)) copy[rename(key)] = walk(inner);
            return copy;
        }
        return value;
    };
    const next = walk(state) as IBattleState;
    return names.size === 0 ? { state, minted } : { state: next, minted: minted + names.size };
}
