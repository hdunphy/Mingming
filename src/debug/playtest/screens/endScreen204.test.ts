/**
 * TICKET 204 — the tool's end screen carries the game's short-handed line word for word, so an agent
 * that lost at the gym with one Mingming reads why, as a player does.
 */
import { describe, expect, it } from 'vitest';

import { createRun } from '../../../engine/run/createRun';
import { offerGyms } from '../../../engine/run/gyms';
import { shortHandedGymLine } from '../../../engine/run/shortHandedGymLine';
import type { IRunState } from '../../../engine/runTypes';
import type { IMingmingState } from '../../../engine/types';
import type { World } from '../types';
import { endScreen } from './endScreen';

const MEMBER: IMingmingState = { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 };
const BASE = createRun({ seed: 'end-204', offer: offerGyms('offer-204')[0], party: [MEMBER], startedAt: 1 });
const GYM = BASE.nodes.find((n) => n.kind === 'gym')!;

/** Only what `endScreen` reads: the run, and an empty view. */
const worldFor = (run: IRunState): World => ({
    store: { getState: () => ({ run: { run } }) },
    view: { news: [], fight: null, reward: null },
} as unknown as World);

describe('204 — the tool’s end screen', () => {
    it('prints the short-handed line after a solo gym defeat, and not with a full team', () => {
        const solo: IRunState = { ...BASE, phase: 'ended', outcome: 'defeat', currentNodeId: GYM.id, partyIds: ['mm1'] };
        expect(endScreen(worldFor(solo)).body).toContain(shortHandedGymLine(solo));
        const full: IRunState = { ...solo, partyIds: ['mm1', 'mm2', 'mm3'] };
        expect(endScreen(worldFor(full)).body.join('\n')).not.toContain("gym's three");
    });
});
