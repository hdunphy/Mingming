/** TICKET 180a — the party as a fight sees it: ranch members on their effective firmware, in run order. */
import { toMingmingState } from '../../engine/run/battleSetup';
import { withEffectiveOS } from '../../engine/run/effectiveOS';
import type { IMingmingState } from '../../engine/types';
import type { World } from './types';
import { runOf } from './types';

export function partyOf(world: World): IMingmingState[] {
    const run = runOf(world);
    const { roster } = world.store.getState().game;
    const out: IMingmingState[] = [];
    for (const id of run.partyIds) {
        const member = roster.find((m) => m.id === id);
        if (member) out.push(toMingmingState(withEffectiveOS(run, member)));
    }
    return out;
}
