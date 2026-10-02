/**
 * TICKET 182c — THE INTRO'S ONE UI ENTRY POINT.
 *
 * What picking a starter does while the intro is on: the starter goes straight onto the roster on
 * its v1 firmware (no firmware modal, no ranch visit) and the intro run starts at once. The
 * blueprint is granted and spent in the same breath, so the vault ends where it began.
 *
 * Everything else about the intro lives in `src/engine/run/intro/`. To remove the intro, stop
 * calling this (the starter screen goes back to `addBlueprint`) and delete that folder.
 */

import type { Dispatch } from '@reduxjs/toolkit';

import { rollSeed } from '../../engine/core/SeedStream';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { createRanchMember } from '../../engine/gameTypes';
import { toMingmingState } from '../../engine/run/battleSetup';
import { createIntroRun } from '../../engine/run/intro/createIntroRun';
import { addBlueprint, assembleMingming } from '../store/gameSlice';
import { startRun } from '../store/runSlice';

export function startIntroRun(dispatch: Dispatch, speciesId: string): void {
    const member = createRanchMember(speciesId, GetMingmingData(speciesId).availableOS[0]);
    dispatch(addBlueprint(speciesId));
    dispatch(assembleMingming(member));
    dispatch(startRun(createIntroRun({
        seed: rollSeed(),
        starter: toMingmingState(member),
        startedAt: Date.now(),
    })));
}
