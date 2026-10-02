/**
 * TICKET 169e/169f — the run's tier, and its modifiers when it has any: "Tier 2", or
 * "Tier 2 · 2 modifiers" with the names in the hover text. One component for both places the run
 * screen prints it (the map header and the gauntlet header), so they cannot drift apart.
 */

import type { ReactNode } from 'react';

import { activeModifierNames } from '../../engine/run/modifiers/modifierRegistry';
import type { IRunState } from '../../engine/runTypes';

export default function RunTierLabel({ run }: { readonly run: Pick<IRunState, 'tier' | 'modifiers'> }): ReactNode {
    const names = activeModifierNames(run);
    if (names.length === 0) return <>Tier {run.tier}</>;
    return (
        <span title={names.join(', ')}>
            Tier {run.tier} · {names.length} modifier{names.length === 1 ? '' : 's'}
        </span>
    );
}
