/**
 * TICKET 205 - the icon on an enemy's intent badge: what it plans to do next turn. A sword for an
 * attack, a shield for a defend, a flask (the old potion) for a debuff, and a star for everything
 * else (a buff, a special, an unknown), which is what the old glowing star stood for.
 *
 * One Tabler name per `IntentType`; a pick Henry dislikes is a one-word change plus `npm run icons`.
 */

import type { IntentType } from '../../engine/types';
import type { TablerOutlineName } from '../theme/tabler.generated';

export const INTENT_ICON: Readonly<Record<IntentType, TablerOutlineName>> = {
    Attack: 'sword',
    Defend: 'shield',
    Debuff: 'flask',
    Buff: 'star',
    Special: 'star',
    Unknown: 'star',
};
