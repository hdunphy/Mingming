/**
 * THE HP BAR'S COLOUR STEPS — ticket 183a. Henry (2026-10-01): the bar goes green, then yellow,
 * then red as it drops.
 *
 * Above 50% of max is green; 50% down to 20% is yellow; under 20% is red. The boundaries are
 * ratios of max HP, never absolute points, so a 1125-HP body and a 200-HP body turn at the same
 * place on the bar. The ratio is clamped, so over-heal and a negative never leave the table.
 */

export type HpStep = 'hi' | 'mid' | 'low';

export function hpRatio(cur: number, max: number): number {
    if (!(max > 0)) return 0;
    return Math.min(1, Math.max(0, cur / max));
}

export function hpStep(cur: number, max: number): HpStep {
    const ratio = hpRatio(cur, max);
    if (ratio > 0.5) return 'hi';
    if (ratio >= 0.2) return 'mid';
    return 'low';
}
