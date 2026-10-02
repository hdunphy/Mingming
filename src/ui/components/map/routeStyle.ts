/**
 * THE ROUTE LINES' LOOKS — ticket 183g. The data half of `RouteLine`, in its own `.ts` because
 * `react-refresh/only-export-components` is an error in this repo.
 */

export type RouteState = 'taken' | 'ahead' | 'passed' | 'detour';

/** Stroke width per look, in the map's own units. The gold path is the heaviest. */
export const ROUTE_WIDTH: Readonly<Record<RouteState, number>> = { taken: 8, ahead: 6, passed: 6, detour: 5 };
