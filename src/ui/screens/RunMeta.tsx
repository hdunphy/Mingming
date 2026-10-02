import type { ReactNode } from 'react';

import { activeModifierNames } from '../../engine/run/modifiers/modifierRegistry';
import type { IRunState } from '../../engine/runTypes';
import { Icon } from '../theme/Icon';
import RunTierLabel from './RunTierLabel';

/**
 * TICKET 182a — the run header's one line: the biome's name, and scrap with an icon. Nothing else.
 *
 * It was "Biome 1/3 · The Drowned Shelf (Water) · layer 0 · Tier 0 · 0 fights · 20 scrap". The tier
 * (and the modifiers) show only when the player chose one: a Tier above 0, or a modifier, is a
 * decision they made at run start and may want to see; Tier 0 with none is the default and says
 * nothing. Used by the map header and the gauntlet header, so they cannot drift apart.
 */
export default function RunMeta({
    run,
    biomeName,
}: {
    readonly run: Pick<IRunState, 'tier' | 'modifiers' | 'scrap'>;
    readonly biomeName: string | undefined;
}): ReactNode {
    const showTier = run.tier > 0 || activeModifierNames(run).length > 0;
    return (
        <div className="ranch-run-meta">
            <span className="run-biome">{biomeName}</span>
            <span className="run-scrap" title="Scrap"><Icon name="scrap" size={14} /> {run.scrap}</span>
            {showTier && <span className="run-tier"><RunTierLabel run={run} /></span>}
        </div>
    );
}
