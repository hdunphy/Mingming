// @vitest-environment jsdom
/**
 * TICKET 202a — the Den tile on the town square says how many Traces are held and where to spend them.
 *
 * Henry (2026-10-07): "a small tag line to the den: N traces held, summon here". With at least one Trace held the
 * tile reads "N Traces held · summon here"; with none it reads as it did before.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { TownSquare } from './TownSquare';
import { createEmptyRanch } from '../../store/gameSlice';
import { createRun } from '../../../engine/run/createRun';
import { offerGyms } from '../../../engine/run/gyms';
import type { IRanchMember, IRanchState } from '../../../engine/runTypes';
import type { IMingmingState } from '../../../engine/types';

const MEMBER: IMingmingState = { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 };
const ROSTER: IRanchMember[] = [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }];
const RUN = createRun({ seed: 'den-202a-seed', offer: offerGyms('offer-seed')[0], party: [MEMBER], startedAt: 1 });

const ranch = (blueprints: Record<string, number>): IRanchState => ({ ...createEmptyRanch(), roster: ROSTER, blueprints });

function denTile(blueprints: Record<string, number>): string {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<TownSquare run={RUN} node={RUN.nodes[0]} ranch={ranch(blueprints)} onOpen={() => {}} />);
    return host.querySelector('.town-building[data-tab="workshop"] .town-building-st')!.textContent!;
}

describe('202a — the Den tile', () => {
    it('says "2 Traces held · summon here" with two Traces held', () => {
        expect(denTile({ fenrir: 1, huldra: 1 })).toContain('2 Traces held · summon here');
    });

    it('counts every Trace, not every species', () => {
        expect(denTile({ fenrir: 2, huldra: 1 })).toContain('3 Traces held · summon here');
    });

    it('does not say "summon here" with none held', () => {
        expect(denTile({})).not.toContain('summon here');
    });
});
