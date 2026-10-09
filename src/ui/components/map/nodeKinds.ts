/**
 * THE MAP'S NODE KINDS - ticket 183g; the glyphs went in ticket 200d. This file used to hold a
 * second, hand-typed set of node symbols (an "R" for a rival, an X for a fight) that no live screen
 * drew. Now a node kind has ONE icon, the `icons.ts` one the region map already uses, and
 * `NODE_ICON_NAME` says which.
 *
 * `NodeIconKind` is the picture's vocabulary, not the engine's: `iconKindFor` maps an engine
 * `NodeKind` onto it. A separate `.ts` file from the components because
 * `react-refresh/only-export-components` is an error in this repo.
 */
import type { NodeKind } from '../../../engine/runTypes';
import type { IconName } from '../../theme/icons';

export type NodeIconKind = 'start' | 'fight' | 'rival' | 'event' | 'elite' | 'gym' | 'detour' | 'town';

/** The `icons.ts` icon each kind draws: one icon per kind, on the map and on the design sheet. */
export const NODE_ICON_NAME: Readonly<Record<NodeIconKind, IconName>> = {
    start: 'start',
    fight: 'wild',
    rival: 'rival',
    event: 'event',
    elite: 'elite',
    gym: 'gym',
    detour: 'alpha',
    town: 'town',
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
