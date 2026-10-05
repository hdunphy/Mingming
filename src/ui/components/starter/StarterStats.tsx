/**
 * THE STARTER'S STATS — ticket 183f. Three rows, label · bar · number, in the slot a card keeps for
 * its rules text. The bar is the element's colour on a pale track, so two starters compare by eye.
 */
import type { ReactElement } from 'react';

import { STARTER_STAT_SCALE, starterStats } from './starterStatValues';

export function StarterStats({ speciesId }: { readonly speciesId: string }): ReactElement {
    return (
        <span className="starter-stats" data-testid={`starter-stats-${speciesId}`}>
            {starterStats(speciesId).map((stat) => (
                <span key={stat.key} className="starter-stat" data-stat={stat.key}>
                    <span className="starter-stat-label k-display">{stat.label}</span>
                    <span className="starter-stat-track">
                        <span
                            className="starter-stat-fill"
                            style={{ width: `${Math.min(100, (stat.value / STARTER_STAT_SCALE) * 100)}%` }}
                        />
                    </span>
                    <span className="starter-stat-value k-display">{stat.value}</span>
                </span>
            ))}
        </span>
    );
}
