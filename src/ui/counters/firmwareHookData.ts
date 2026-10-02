/**
 * TICKET 184c — a body's firmware hooks as DATA, with its patch applied, for reading gates.
 *
 * The engine does the same in `entityHooks` (raw data → each patch's transform → built hook). The
 * pip needs the data rather than the built hook, so it repeats the two steps — the same two
 * functions, so the gate it reads is the gate the engine fires on.
 */

import { rawFirmwareHooks } from '../../engine/data/firmwareRegistry';
import { applyPatchesToFirmware, getPatch, type PatchDefinition } from '../../engine/data/patchRegistry';
import type { HookData } from './counterTypes';

export function patchedFirmwareHooks(osId: string, patchIds: ReadonlyArray<string>): ReadonlyArray<HookData> {
    const riders = patchIds.map(getPatch).filter((patch): patch is PatchDefinition => patch !== undefined);
    // 184d: the same call the engine makes, so a per-firmware override changes the pip too.
    return applyPatchesToFirmware(osId, riders, rawFirmwareHooks(osId));
}
