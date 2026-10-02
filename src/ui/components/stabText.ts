/**
 * THE STAB SENTENCE — ticket 183c. STAB has no tag on the card: the frame turns the element's
 * colour and the card's hover says why. The multiplier is read from `STAB_BONUS`, never typed, so
 * the sentence cannot disagree with the damage the engine deals.
 */
import { STAB_BONUS } from '../../engine/combatUtils';
import { formatMultiplier } from './elementMatchups';

export const stabTitle = (): string =>
    `STAB: Same Type Attack Bonus. This card matches the caster's element: ×${formatMultiplier(STAB_BONUS)} power.`;
