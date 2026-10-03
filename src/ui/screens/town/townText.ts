/**
 * TICKET 176c — the town screen's words, in one place so the square, the rail and the tests read
 * the same sentences.
 */
import type { TownTab } from '../../../engine/runTypes';

const NUMBER_WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];

/** The upgrade bench's one-line heading for an allowance: "UPGRADE — UP TO THREE CARDS IN YOUR DECK". */
export function upgradeHeading(allowance: number): string {
    const word = NUMBER_WORDS[allowance] ?? String(allowance);
    return `UPGRADE — UP TO ${word} CARD${allowance === 1 ? '' : 'S'} IN YOUR DECK`;
}

/** What each building is called on the square and the rail. */
export const TOWN_TAB_LABEL: Readonly<Record<Exclude<TownTab, 'square'>, string>> = {
    shop: 'Shop',
    upgrades: 'Upgrades',
    // 183h's naming pass: the workshop is the Den on screen. The tab id stays `workshop`.
    workshop: 'Den',
    loadout: 'Loadout',
};

/** The buildings, in the order the square and the rail list them. */
export const TOWN_BUILDINGS = ['shop', 'upgrades', 'workshop', 'loadout'] as const;
