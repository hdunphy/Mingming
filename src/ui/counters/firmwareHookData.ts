/**
 * TICKET 184c — a body's firmware hooks as DATA, with its patch applied, for reading gates.
 *
 * The engine does the same in `entityHooks` (raw data → each patch's transform → built hook). The
 * pip needs the data rather than the built hook, so it repeats the two steps — the same two
 * functions, so the gate it reads is the gate the engine fires on.
 */

import { rawFirmwareHooks } from '../../engine/data/firmwareRegistry';
import { getPatch, type PatchDefinition } from '../../engine/data/patchRegistry';
import type { HookData } from './counterTypes';

export function patchedFirmwareHooks(osId: string, patchIds: ReadonlyArray<string>): ReadonlyArray<HookData> {
    const riders = patchIds.map(getPatch).filter((patch): patch is PatchDefinition => patch !== undefined);
    return rawFirmwareHooks(osId).map((hook) => riders.reduce((data, rider) => rider.apply(data), hook));
}
