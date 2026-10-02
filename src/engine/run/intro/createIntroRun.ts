/**
 * TICKET 182c — BUILD THE INTRO RUN.
 *
 * It is `createRun` with a different map: the same deck rule (the starter's five-card engine plus
 * three generics), the same opening scrap, empty macros, no drivers, tier 0, no modifiers. Only the
 * graph, the biomes, the gym and the `mode` differ, so a change to what a run opens with reaches the
 * intro for free.
 *
 * The intro biome is the one the starter beats (`introOffer`). No driver stakes are dealt: the map
 * has no elite or ambush to pay one.
 */

import { GetMingmingData } from '../../data/mingmingRegistry';
import type { IMingmingState } from '../../types';
import type { IRunState } from '../../runTypes';
import { createRun } from '../createRun';
import { introOffer } from './introBiome';
import { buildIntroNodes, INTRO_START_ID } from './introMap';

export interface CreateIntroRunInput {
    readonly seed: string;
    /** The starter the player picked, already assembled on its v1 firmware. */
    readonly starter: IMingmingState;
    /** Epoch ms, injected by the caller (the engine never reads the clock). */
    readonly startedAt: number;
}

export function createIntroRun(input: CreateIntroRunInput): IRunState {
    const { seed, starter, startedAt } = input;
    const element = GetMingmingData(starter.definitionId).primaryElement;
    const offer = introOffer(seed, element);

    const ordinary = createRun({ seed, offer, party: [starter], startedAt, tier: 0, modifiers: [] });
    return {
        ...ordinary,
        mode: 'intro',
        nodes: buildIntroNodes(),
        currentNodeId: INTRO_START_ID,
    };
}
