/**
 * THE FOUR BUILDINGS - ticket 183g. Name and colour of each button on the town square, from
 * `research/183-mocks/183-town-square.html`. The colour is an element token (water, nature, fire,
 * none) used as a building's colour, not as an element. Words go through 183h's `labels.ts`. The
 * symbols are in `townIcons.ts` (ticket 200d).
 */

export type TownBuilding = 'shop' | 'upgrades' | 'den' | 'loadout';

export interface TownBuildingLook {
    readonly label: string;
    readonly element: 'water' | 'nature' | 'fire' | 'none';
}

export const TOWN_BUILDINGS: Readonly<Record<TownBuilding, TownBuildingLook>> = {
    shop: { label: 'Shop', element: 'water' },
    upgrades: { label: 'Upgrades', element: 'nature' },
    den: { label: 'Den', element: 'fire' },
    loadout: { label: 'Loadout', element: 'none' },
};
