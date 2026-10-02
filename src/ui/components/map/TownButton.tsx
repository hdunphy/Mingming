/**
 * THE TOWN BUTTON — ticket 183g. One of the four buildings on the town square: a large navy plate
 * with a coloured slash on its left, a slanted icon block in the building's colour, the name in
 * display type, one status line, and the building's symbol faint in the corner. `ready` adds the
 * yellow READY tag (the Den, when a trace can be summoned).
 */
import type { CSSProperties, ReactElement } from 'react';

import '../../theme/kit/kit.css';
import './map.css';
import { TOWN_BUILDINGS, type TownBuilding } from './townBuildings';

export interface TownButtonProps {
    readonly building: TownBuilding;
    /** The status line, e.g. `8 cards · Kraken trace · runes`. */
    readonly status: string;
    readonly ready?: boolean;
    readonly onClick?: () => void;
}

export function TownButton({ building, status, ready, onClick }: TownButtonProps): ReactElement {
    const { label, glyph, element } = TOWN_BUILDINGS[building];
    return (
        <button
            type="button"
            className="k-plate k-town-button"
            data-building={building}
            data-ready={ready ? 'true' : undefined}
            style={{ ['--k-cut' as string]: '12px', ['--k-bld' as string]: `var(--el-${element})` } as CSSProperties}
            onClick={onClick}
        >
            <span className="k-town-slash" />
            <span className="k-town-head">
                <span className="k-slant k-town-icon" style={{ ['--k-cut' as string]: '8px' } as CSSProperties}>
                    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true"><path d={glyph} /></svg>
                </span>
                <span className="k-town-text">
                    <span className="k-town-name k-display">{label}</span>
                    <span className="k-town-status k-display">{status}</span>
                </span>
            </span>
            <svg className="k-town-ghost" width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><path d={glyph} /></svg>
            {ready && <span className="k-slant k-town-ready k-display" style={{ ['--k-cut' as string]: '5px' } as CSSProperties}>Ready</span>}
        </button>
    );
}
