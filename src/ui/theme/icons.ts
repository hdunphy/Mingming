/**
 * ICON NAMES - ticket 34, swapped to Tabler by ticket 200d. The data half of the icon set; `Icon.tsx`
 * is the component half.
 *
 * They are separate files because `react-refresh/only-export-components` is a lint error in this
 * repo (blocking in CI since ticket 55) and it is right to be: a module that exports both a
 * component and constants breaks fast refresh, and `regionLayout.ts` - which is deliberately a pure
 * `.ts` module with no React in it - needs `IconName` without importing a component to get it.
 *
 * # WHERE THE SHAPES COME FROM
 *
 * Nowhere in this file. Every icon is a human-drawn Tabler Icon (MIT, Pawel Kuna), named here and
 * drawn from `tabler.generated.ts` by `TablerGlyph`. No path data is typed by hand: the standing
 * rule is that no AI-generated art ships, and an agent-typed path counted as one. If a name is
 * missing from the generated file, add it to `scripts/tabler-icons.names.json` and run
 * `npm run icons`; never draw a replacement. Trace (`blueprint`) is two layered Tabler icons, so it
 * lives in `traceGlyph.ts` and is not in this map.
 *
 * The set is deliberately small and CLOSED: `IconName` is a union, so a screen asking for an icon
 * that does not exist is a type error rather than an empty box - which is the failure emoji had.
 */

import type { TablerOutlineName } from './tabler.generated';

export type IconName =
    // Top-level navigation and the ranch's five sections.
    | 'ranch' | 'debug' | 'expedition' | 'roster' | 'assembly' | 'vault' | 'codex'
    // The region-node kinds (`engine/runTypes.NodeKind`).
    | 'wild' | 'rival' | 'elite' | 'alpha' | 'ambush' | 'marketplace' | 'workshop' | 'town' | 'event' | 'gym'
    // Not a node kind: the node the run starts on (a `wild` underneath - see `regionLayout.isRunStart`).
    | 'start'
    // Chrome.
    | 'sound-on' | 'sound-off' | 'search' | 'settings' | 'warning' | 'check' | 'grave' | 'trophy'
    | 'door' | 'swap' | 'scrap' | 'blueprint'
    // The three stat-roll glyphs and the two resource ones. These read at 12px, so they are the
    // simplest shapes in the set - a stat line is scanned, not looked at.
    | 'attack' | 'defense' | 'hp' | 'energy' | 'firmware'
    // TICKET 182a: a card's element (the word on its face became one of these) and who it aims at.
    | 'el-fire' | 'el-water' | 'el-nature' | 'el-none' | 'target-enemy' | 'target-self';

/** Trace is the one name that is not a single Tabler icon: see `traceGlyph.ts`. */
type SingleGlyphName = Exclude<IconName, 'blueprint'>;

/** The Tabler outline icon each name draws (ticket 200, every pick ruled by Henry 2026-10-05/06). */
export const ICON_TABLER: Readonly<Record<SingleGlyphName, TablerOutlineName>> = {
    // navigation
    ranch: 'home-heart', debug: 'bug', expedition: 'map', roster: 'paw', assembly: 'sparkles-2', vault: 'vault', codex: 'book',
    // node kinds
    wild: 'sword', rival: 'swords', elite: 'star', alpha: 'crown', ambush: 'eye', marketplace: 'building-store',
    workshop: 'campfire', town: 'building-cottage', event: 'help-circle', start: 'flag', gym: 'building-bank',
    // chrome
    'sound-on': 'volume', 'sound-off': 'volume-off', search: 'search', settings: 'settings', warning: 'alert-triangle',
    check: 'check', grave: 'grave-2', trophy: 'trophy', door: 'door', swap: 'arrows-exchange', scrap: 'hexagons',
    // stats and resources
    attack: 'sword', defense: 'shield', hp: 'heart', energy: 'bolt', firmware: 'cpu',
    // card faces
    'el-fire': 'flame', 'el-water': 'droplet', 'el-nature': 'leaf', 'el-none': 'circle-off',
    'target-enemy': 'crosshair', 'target-self': 'user',
};

/** Every drawable name, for the sweep in `Icon.test.tsx`. */
export const ICON_NAMES: ReadonlyArray<IconName> = [...(Object.keys(ICON_TABLER) as SingleGlyphName[]), 'blueprint'];
