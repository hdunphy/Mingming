/**
 * TICKET 183f — the three numbers a starter card shows where a card prints its rules text.
 *
 * Henry's 172 ruling: a player choosing a first monster should see what it IS, in numbers they can
 * compare across the three cards. The species' BASE stats are the comparable ones: an individual's
 * stats add a random roll at assembly, so printing a rolled figure here would be a number no
 * starter keeps.
 */
import { GetMingmingData } from '../../../engine/data/mingmingRegistry';

export interface StarterStat {
    readonly key: 'hp' | 'attack' | 'defense';
    readonly label: string;
    readonly value: number;
}

/** The bar's full width. The highest base stat in the registry is 110, so 120 leaves every bar short of the end. */
export const STARTER_STAT_SCALE = 120;

const LABELS: ReadonlyArray<readonly [StarterStat['key'], string]> = [
    ['hp', 'HP'], ['attack', 'Attack'], ['defense', 'Defense'],
];

export function starterStats(speciesId: string): ReadonlyArray<StarterStat> {
    const { baseStats } = GetMingmingData(speciesId);
    return LABELS.map(([key, label]) => ({ key, label, value: baseStats[key] }));
}
