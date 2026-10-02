/**
 * THE ROUTE LINE — ticket 183g. One road between two nodes, drawn in the map's own coordinates, so
 * it is an SVG `<line>` the map places inside its `<svg>`. Flat: no glow, no dash but the detour's.
 *
 * Four looks, from the mock: the road already walked is the gold path (8px, yellow); a road still
 * ahead is 6px in its fight's element colour (navy when no element is known); a road the party has
 * passed by, or that leads off the path, is the same line at 35%; a detour is dashed and 5px.
 */
import type { ReactElement } from 'react';

import './map.css';
import { elementKey } from '../../theme/kit/elementGlyphs';
import { ROUTE_WIDTH, type RouteState } from './routeStyle';

export interface RouteLineProps {
    readonly from: { readonly x: number; readonly y: number };
    readonly to: { readonly x: number; readonly y: number };
    readonly state: RouteState;
    /** The element of the fight the road leads to, when known. */
    readonly element?: string;
}

export function RouteLine({ from, to, state, element }: RouteLineProps): ReactElement {
    return (
        <line
            className="k-route"
            data-state={state}
            data-element={element !== undefined ? elementKey(element) : undefined}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            strokeWidth={ROUTE_WIDTH[state]}
            strokeLinecap="round"
            strokeDasharray={state === 'detour' ? '10 8' : undefined}
        />
    );
}
