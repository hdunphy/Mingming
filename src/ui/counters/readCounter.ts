/**
 * TICKET 184c — the three questions the battle screen asks: what does this body's FIRMWARE pip
 * say, what does this DAEMON's pip say, what does this DRIVER's pip say. Each finds its reader in
 * the registry and hands it the right hook data; none of them knows any counter by name.
 */

import HOOKS_DATA from '../../engine/data/lib/hooks.json';
import type { IBattleEntity, IBattleState } from '../../engine/types';
import { DAEMON_COUNTERS, DRIVER_COUNTERS, FIRMWARE_COUNTERS } from './counterDisplays';
import { patchedFirmwareHooks } from './firmwareHookData';
import type { CounterReading, HookData } from './counterTypes';

const LIBRARY = HOOKS_DATA as unknown as Record<string, { hooks?: HookData[] }>;
const libraryHooks = (id: string): ReadonlyArray<HookData> => LIBRARY[id]?.hooks ?? [];

export function readFirmwareCounter(entity: IBattleEntity, state: IBattleState): CounterReading | null {
    const reader = entity.activeOS ? FIRMWARE_COUNTERS[entity.activeOS] : undefined;
    if (!reader || !entity.activeOS) return null;
    return reader({ owner: entity, state, hooks: patchedFirmwareHooks(entity.activeOS, entity.patches ?? []) });
}

export function readDaemonCounter(entity: IBattleEntity, daemonId: string, state: IBattleState): CounterReading | null {
    const reader = DAEMON_COUNTERS[daemonId];
    return reader ? reader({ owner: entity, state, hooks: libraryHooks(daemonId) }) : null;
}

/** A Driver belongs to the PLAYER's whole party; its SIDE counters resolve off any member. */
export function readDriverCounter(driverId: string, state: IBattleState): CounterReading | null {
    const reader = DRIVER_COUNTERS[driverId];
    const owner = state.playerParty[0];
    return reader && owner ? reader({ owner, state, hooks: libraryHooks(driverId) }) : null;
}
