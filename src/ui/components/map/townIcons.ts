/**
 * THE TOWN SQUARE'S ICONS - ticket 200d. The one place that says which Tabler icon each building
 * wears. The live town square (`TownSquare.tsx`) and the design-sheet `TownButton` both read it;
 * the two older paths (a `BUILDING_ICON` map of `icons.ts` keys, and a hand-typed `glyph` per
 * building) are gone. Henry ruled every pick (2026-10-06); Tabler has no cave, so the Den is a
 * campfire, and Upgrades is a bar-and-arrow rather than the attack sword it used to borrow.
 */
import type { TablerOutlineName } from '../../theme/tabler.generated';
import type { TownBuilding } from './townBuildings';

export const TOWN_ICON: Readonly<Record<TownBuilding, TablerOutlineName>> = {
    shop: 'building-store',
    upgrades: 'arrow-bar-to-up',
    den: 'campfire',
    loadout: 'paw',
};
