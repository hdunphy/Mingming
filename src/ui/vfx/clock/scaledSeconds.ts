/**
 * A duration in framer-motion seconds, shortened by the battle clock's multiplier — ticket 189a.
 *
 * Used for motion that stays on framer's own engine (the played card's flight and discard), so the
 * speed tiers and Instant (0) still apply to it, at the moment it starts.
 */

import { isInstantSpeed } from './speedPolicy';

export function scaledSeconds(ms: number, multiplier: number): number {
    if (isInstantSpeed(multiplier)) return 0;
    const m = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    return ms / 1000 / m;
}
