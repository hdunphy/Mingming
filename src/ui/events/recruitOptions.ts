/**
 * TICKET 168d — what Stray Mingming may build: the workshop's own legality, listed.
 */

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { workshopBlockFor } from '../../engine/run/workshop';
import type { IRanchState, IRunState } from '../../engine/runTypes';
import type { RecruitPickResult } from './outcomePicks';

/** Every (species, firmware) the workshop would let the player build right now. */
export function recruitOptions(ranch: IRanchState, run: IRunState): RecruitPickResult[] {
    return Object.keys(ranch.blueprints).flatMap((speciesId) => (
        (MingmingRegistry[speciesId]?.availableOS ?? [])
            .filter((osId) => workshopBlockFor(speciesId, ranch, run, osId) === null)
            .map((osId) => ({ speciesId, osId }))
    ));
}
