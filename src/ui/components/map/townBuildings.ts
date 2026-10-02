/**
 * THE FOUR BUILDINGS — ticket 183g. Name, symbol and colour of each button on the town square, from
 * `research/183-mocks/183-town-square.html`. The colour is an element token (water, nature, fire,
 * none) used as a building's colour, not as an element. Words go through 183h's `labels.ts`.
 */

export type TownBuilding = 'shop' | 'upgrades' | 'den' | 'loadout';

export interface TownBuildingLook {
    readonly label: string;
    readonly glyph: string;
    readonly element: 'water' | 'nature' | 'fire' | 'none';
}

export const TOWN_BUILDINGS: Readonly<Record<TownBuilding, TownBuildingLook>> = {
    shop: {
        label: 'Shop',
        glyph: 'M3 5h3l2 10h10l2-7H7M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2M17 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
        element: 'water',
    },
    upgrades: { label: 'Upgrades', glyph: 'M12 20V8M6 14l6-6 6 6M6 4h12', element: 'nature' },
    den: { label: 'Den', glyph: 'M3 20h18M4 20c0-7 4-12 8-12s8 5 8 12M9 20v-5h6v5', element: 'fire' },
    loadout: { label: 'Loadout', glyph: 'M7 4h10v14H7zM4 7v14h10', element: 'none' },
};
