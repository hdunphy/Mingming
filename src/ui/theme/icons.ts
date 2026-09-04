/**
 * ICON GEOMETRY — ticket 34. The data half of the icon set; `Icon.tsx` is the component half.
 *
 * They are separate files because `react-refresh/only-export-components` is a lint error in this
 * repo (blocking in CI since ticket 55) and it is right to be: a module that exports both a
 * component and constants breaks fast refresh, and `regionLayout.ts` — which is deliberately a pure
 * `.ts` module with no React in it — needs `IconName` without importing a component to get it.
 *
 * # DRAWING RULES, IF YOU ADD ONE
 *
 * 24x24 viewBox. Stroke only, no fills, so an icon reads on any surface. 1.7 stroke at 24, which
 * lands on the pixel grid at the sizes actually used (12, 16, 18, 20). Round caps and joins.
 * Everything inside a 2px margin, so a 16px icon in a 20px slot never touches its neighbour.
 *
 * The set is deliberately small and CLOSED: `IconName` is a union, so a screen asking for an icon
 * that does not exist is a type error rather than an empty box — which is the failure emoji had.
 */

export type IconName =
    // Top-level navigation and the ranch's five sections.
    | 'ranch' | 'debug' | 'expedition' | 'roster' | 'assembly' | 'vault' | 'codex'
    // The eight region-node kinds (`engine/runTypes.NodeKind`).
    | 'wild' | 'elite' | 'alpha' | 'ambush' | 'marketplace' | 'workshop' | 'event' | 'gym'
    // Chrome.
    | 'sound-on' | 'sound-off' | 'search' | 'settings' | 'warning' | 'check' | 'skull' | 'trophy'
    | 'door' | 'swap' | 'scrap' | 'blueprint'
    // The three stat-roll glyphs and the two resource ones. These read at 12px, so they are the
    // simplest shapes in the set — a stat line is scanned, not looked at.
    | 'attack' | 'defense' | 'hp' | 'energy' | 'firmware';

/**
 * Path data per icon. Kept as data rather than as components so the whole set can be swept by a
 * test (every `IconName` has geometry) without rendering twenty-six React trees.
 */
export const PATHS: Readonly<Record<IconName, ReadonlyArray<string>>> = {
    // --- navigation -----------------------------------------------------------------------
    ranch: ['M3.5 11.2 12 4l8.5 7.2', 'M5.5 10v9h13v-9', 'M10 19v-5h4v5'],
    debug: ['M9 7a3 3 0 0 1 6 0', 'M7 11a5 5 0 0 1 10 0v4a5 5 0 0 1-10 0z', 'M4 10h3', 'M17 10h3', 'M4 18h3', 'M17 18h3', 'M12 11v8'],
    expedition: ['M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z', 'M9 4v13.5', 'M15 6.5V20'],
    roster: ['M9 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6', 'M3.5 19.5a5.5 5.5 0 0 1 11 0', 'M16 5.2a3 3 0 0 1 0 5.6', 'M17 14.6a5.5 5.5 0 0 1 3.5 4.9'],
    assembly: ['M9.5 3.5v5.2L4.6 18a1.4 1.4 0 0 0 1.2 2.1h12.4A1.4 1.4 0 0 0 19.4 18l-4.9-9.3V3.5', 'M8 3.5h8', 'M7.4 14.5h9.2'],
    vault: ['M6.5 3.5h11l3 5.5-8.5 11.5L3.5 9z', 'M3.5 9h17', 'M9.5 3.5 12 9l2.5-5.5', 'M12 9v11.5'],
    codex: ['M5 4.5A1.5 1.5 0 0 1 6.5 3H19v14.5H6.5A1.5 1.5 0 0 0 5 19z', 'M5 19a1.5 1.5 0 0 0 1.5 1.5H19', 'M9 7h6'],

    // --- node kinds -----------------------------------------------------------------------
    /*
     * ONE upright blade, not two crossed ones.
     *
     * Crossed swords is the obvious drawing and it was the first one here. At the size the region
     * map actually uses it — 18px, tinted, on a dark disc — the two strokes collapse into an X,
     * which reads as a CLOSE BUTTON. On the one screen where a node's kind has to be legible from
     * across it, the most common node in the game was drawn as "dismiss". Caught in the ticket-34
     * screenshots, which is what they are for.
     */
    wild: ['M12 3.2v11.3', 'M8.4 12.6h7.2', 'M12 14.5v4.2', 'M9.9 19.6h4.2'],
    // An elite is a wild you can lose to, so it is the skull rather than a bigger sword.
    elite: ['M12 3.5a7 7 0 0 1 7 7v3.2l-1.6 1.4v3.4H6.6v-3.4L5 13.7v-3.2a7 7 0 0 1 7-7z', 'M9.3 10.8h.01', 'M14.7 10.8h.01', 'M10.5 16v2.5', 'M13.5 16v2.5'],
    alpha: ['M3.5 7.5 6 16h12l2.5-8.5-5 3.5L12 4.5 8.5 11z', 'M6 19h12'],
    // A mouth in the ground. Drawn as a rim you can see over and a dark that has no bottom.
    ambush: ['M3.5 9.5c2.4-2.2 14.6-2.2 17 0', 'M5.5 10.4c2.2 7.5 10.8 7.5 13 0', 'M9 14.5v3', 'M15 14.5v3', 'M12 16v3.5'],
    marketplace: ['M3 4.5h2.6l2.3 10.4h9.5l2.1-7.4H6.3', 'M10 19a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6', 'M16.6 19a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6'],
    workshop: ['M15.4 3.5a5 5 0 0 0-4.6 7l-6.6 6.6a1.8 1.8 0 0 0 2.6 2.6l6.6-6.6a5 5 0 0 0 5.9-6.6l-3 3-2.4-2.4z'],
    event: ['M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17', 'M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 4', 'M12 17.2h.01'],
    // Four columns and a pediment. The one building on the map, and the run's destination.
    gym: ['M3 8.5 12 3.5l9 5', 'M4.5 8.5v9', 'M9 8.5v9', 'M15 8.5v9', 'M19.5 8.5v9', 'M3 20.5h18', 'M3 17.5h18'],

    // --- chrome ---------------------------------------------------------------------------
    'sound-on': ['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'M15.5 9.2a4 4 0 0 1 0 5.6', 'M18 6.8a7.5 7.5 0 0 1 0 10.4'],
    'sound-off': ['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'M16 9.8 21 14.4', 'M21 9.8 16 14.4'],
    search: ['M10.8 4.5a6.3 6.3 0 1 1 0 12.6 6.3 6.3 0 0 1 0-12.6', 'M15.4 15.4 20 20'],
    settings: ['M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8', 'M12 2.8v2.6', 'M12 18.6v2.6', 'M4.5 12H2', 'M22 12h-2.5', 'M6.4 6.4 4.6 4.6', 'M19.4 19.4l-1.8-1.8', 'M17.6 6.4l1.8-1.8', 'M4.6 19.4l1.8-1.8'],
    warning: ['M12 3.6 21.3 19.6H2.7z', 'M12 9.6v4.4', 'M12 16.8h.01'],
    check: ['M4.5 12.6 9.6 17.6 19.5 6.8'],
    skull: ['M12 3.5a7 7 0 0 1 7 7v3.2l-1.6 1.4v3.4H6.6v-3.4L5 13.7v-3.2a7 7 0 0 1 7-7z', 'M9.3 10.8h.01', 'M14.7 10.8h.01', 'M10.5 16v2.5', 'M13.5 16v2.5'],
    trophy: ['M7.5 3.5h9v5a4.5 4.5 0 0 1-9 0z', 'M7.5 5H4.6v1.6a3.4 3.4 0 0 0 3 3.3', 'M16.5 5h2.9v1.6a3.4 3.4 0 0 1-3 3.3', 'M12 13v3.6', 'M8.5 20.5h7', 'M9.8 16.6h4.4v3.9H9.8z'],
    door: ['M6 3.5h9v17H6z', 'M12.4 12h.01', 'M15 8.5h3v12h-3'],
    swap: ['M4 8.5h13', 'M13.6 5 17.4 8.5 13.6 12', 'M20 15.5H7', 'M10.4 12 6.6 15.5 10.4 19'],
    // Scrap is run-scoped currency; blueprints are the persistent one. They must not look alike.
    scrap: ['M12 4.2 19.5 8.5v7L12 19.8 4.5 15.5v-7z', 'M12 9.2 15.5 11v3.4L12 16.2 8.5 14.4V11z'],
    blueprint: ['M4 5.5h16v13H4z', 'M4 9h16', 'M8.5 9v9.5', 'M11.5 12.5h5.5', 'M11.5 15.5h3.5'],

    // --- stats and resources ----------------------------------------------------------------
    attack: ['M18.5 3.5 8.6 13.4', 'M14.5 3.5h4v4', 'M4.2 17.8 8.6 13.4', 'M3.5 20.5l3.2-.7-2.5-2.5z'],
    defense: ['M12 3.4 19.5 6v6.2c0 4-3.1 7.1-7.5 8.4-4.4-1.3-7.5-4.4-7.5-8.4V6z'],
    hp: ['M12 20.2 4.6 13a4.7 4.7 0 0 1 7.4-5.7A4.7 4.7 0 0 1 19.4 13z'],
    energy: ['M13.6 3 5.5 13.6h5.4L10.4 21l8.1-10.6h-5.4z'],
    firmware: ['M7.5 7.5h9v9h-9z', 'M5.5 5.5h13v13h-13z', 'M9.5 2.5v3', 'M14.5 2.5v3', 'M9.5 18.5v3', 'M14.5 18.5v3', 'M2.5 9.5h3', 'M2.5 14.5h3', 'M18.5 9.5h3', 'M18.5 14.5h3'],
};


/**
 * The raw geometry, for the one caller that cannot use the component: the region map draws its
 * nodes inside a single `<svg>` and needs the paths in that document's own coordinate space, as a
 * nested `<svg viewBox="0 0 24 24">`. Everything else should use `<Icon>`.
 */
export function iconPaths(name: IconName): ReadonlyArray<string> {
    return PATHS[name];
}

/** Every drawable name, for the sweep in `Icon.test.tsx`. */
export const ICON_NAMES = Object.keys(PATHS) as ReadonlyArray<IconName>;
