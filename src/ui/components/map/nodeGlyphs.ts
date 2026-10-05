/**
 * THE MAP'S SYMBOLS — ticket 183g. One stroked glyph per kind of node, on a 24 grid, white on the
 * navy disc. The paths are the ones drawn in `research/183-mocks/183-map.html` and
 * `183-town-square.html`; the two the mock does not draw (the gym's crown) are marked below.
 *
 * `NodeIconKind` is the picture's vocabulary, not the engine's: `iconKindFor` maps an engine
 * `NodeKind` onto it. A separate `.ts` file from the components because
 * `react-refresh/only-export-components` is an error in this repo.
 */
import type { NodeKind } from '../../../engine/runTypes';

export type NodeIconKind = 'start' | 'fight' | 'rival' | 'event' | 'elite' | 'gym' | 'detour' | 'town';

export const NODE_GLYPHS: Readonly<Record<NodeIconKind, string>> = {
    start: 'M5 21V4h11l-2 4 2 4H5',
    fight: 'M4 20L20 4M20 20L4 4',
    rival: 'M7 20V4h6a4 4 0 0 1 0 8H7M12 12l6 8',
    event: 'M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.4-1.5 2.4M12 18h.01',
    elite: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z',
    // The mock has no gym node (its biomes end at an elite gate). A crown: mine, for Henry to see.
    gym: 'M4 18L3 7l5 4 4-7 4 7 5-4-1 11z',
    detour: 'M17 9c-1-2-3-3-5-3-3 0-5 3-5 6s2 6 5 6c2 0 4-1 5-3M17 9l1 9',
    town: 'M3 21h18M5 21V10l7-6 7 6v11M10 21v-6h4v6',
};

/** The words under a node, from the mock. 183h will route them through `labels.ts`. */
export const NODE_WORD: Readonly<Record<NodeIconKind, string>> = {
    start: 'Start',
    fight: 'Wild',
    rival: 'Rival',
    event: 'Event',
    elite: 'Elite gate',
    gym: 'Gym',
    detour: 'Alpha · detour',
    town: 'Town',
};

/** Elite gates and the gym are drawn larger than the route's nodes (176e). */
export const NODE_SIZE: Readonly<Record<NodeIconKind, number>> = {
    start: 60, fight: 60, rival: 60, event: 60, elite: 76, gym: 76, detour: 60, town: 60,
};

/**
 * Which picture an engine node gets. A marketplace and a workshop both become the Town (176c
 * merges them); an ambush is a fight; an alpha is the detour's creature. `start` is not a
 * `NodeKind` (the run's first node is a wild; `isRunStart` says so), so the caller passes it.
 */
export function iconKindFor(kind: NodeKind, isStart = false): NodeIconKind {
    if (isStart) return 'start';
    switch (kind) {
        case 'wild': case 'ambush': return 'fight';
        case 'rival': return 'rival';
        case 'elite': return 'elite';
        case 'gym': return 'gym';
        case 'alpha': return 'detour';
        case 'event': return 'event';
        case 'marketplace': case 'workshop': case 'town': return 'town';
    }
}
