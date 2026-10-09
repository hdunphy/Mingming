/**
 * TICKET 205 - the icon at the start of each card effect line in the hover tooltip. One Tabler name
 * per `ActionType`; the type is a `Record`, so a new action type is a compile error here instead of a
 * line with no icon.
 *
 * The bolt means ENERGY and nothing else (ticket 200): only `ENERGY` and `MAX_ENERGY` draw it, and
 * `inlineIconMaps.test.ts` holds that. A pick Henry dislikes is a one-word change plus `npm run
 * icons`. Where two actions share an icon (the discards, the energy pair) they share a meaning.
 */

import type { ActionType } from '../../engine/types';
import type { TablerOutlineName } from '../theme/tabler.generated';

export const EFFECT_ICON: Readonly<Record<ActionType, TablerOutlineName>> = {
    ATTACK: 'sword',
    HEAL: 'heart',
    STATUS: 'point',
    CLEANSE: 'x',
    ENERGY: 'bolt',
    MAX_ENERGY: 'bolt',
    DRAW: 'cards',
    DISCARD: 'trash',
    FORCE_DISCARD: 'trash',
    EXHAUST: 'flame',
    RETURN: 'arrow-back-up',
    SEARCH: 'search',
    GENERATE_CARD: 'sparkles',
    MULTIPLY_STATUS: 'multiplier-2x',
    TRIGGER_STATUS: 'stopwatch',
    PLAY_LAST_CARD: 'repeat',
    TAUNT: 'shield',
    BUFF_NEXT_PROGRAM: 'arrow-up',
    REDIRECT_TARGET: 'arrow-ramp-right',
    SHIFT_STANCE: 'contrast',
    REVIVE: 'recycle',
};
