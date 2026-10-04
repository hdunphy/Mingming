/**
 * A MIRROR FIGHT'S TWO UNITS NEED TWO NAMES.
 *
 * Every combat log line names a unit by its `name`, so when an enemy is the same species as a party
 * member (Kraken against Kraken) `→ Kraken takes 706 damage` could be either. An enemy that shares a
 * name with a party member is named `<name> (foe)` as the battle is built, which fixes the log, the
 * hit table and the nameplates in one place without touching a single log site.
 *
 * Pure: it returns a new list and leaves the bodies alone but for the name. An enemy that already
 * carries the tag, or that shares no name with the party, is returned as it came.
 */
import type { IBattleEntity } from '../types';

export const FOE_TAG = ' (foe)';

export function tagMirrorFoes(
    party: ReadonlyArray<Pick<IBattleEntity, 'name'>>,
    enemies: ReadonlyArray<IBattleEntity>,
): IBattleEntity[] {
    const mine = new Set(party.map((member) => member.name));
    return enemies.map((foe) => (mine.has(foe.name) ? { ...foe, name: `${foe.name}${FOE_TAG}` } : foe));
}
