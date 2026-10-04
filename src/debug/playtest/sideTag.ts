import type { IBattleState } from '../../engine/types';

/**
 * A unit's name as the playtester prints it in a fight (TICKET 193f).
 *
 * Hit lines name units by name only, so a mirror fight (Kraken against Kraken) read
 * `Kraken's Ink Stream on Kraken: 706` and three agents asked whether their Kraken was hitting itself.
 * When an enemy unit shares its name with a party unit it is printed `Kraken (foe)`. Anything else is
 * its plain name, so a fight between different species reads exactly as before.
 */
export function fightName(state: IBattleState, id: string): string {
    const mine = state.playerParty.find((e) => e.id === id);
    if (mine) return mine.name;
    const foe = state.enemyParty.find((e) => e.id === id);
    if (!foe) return id;
    return state.playerParty.some((p) => p.name === foe.name) ? `${foe.name} (foe)` : foe.name;
}
