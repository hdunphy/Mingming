/**
 * TICKET 177d — THE SMALL STATISTICS THE REPORT NEEDS, AND NOTHING ELSE.
 *
 * Plain functions over numbers: a Wilson interval for a win rate, a normal interval for a mean (and
 * so for a paired difference), and the mean and 95th percentile of a list of timings. They live
 * apart from the measurement so a test can check them against numbers worked out by hand.
 */

export interface Interval {
    readonly estimate: number;
    readonly lo: number;
    readonly hi: number;
    readonly n: number;
}

const Z = 1.959964; // two-sided 95%

/**
 * Wilson score interval for a proportion. `successes` may be fractional: a drawn game counts as a
 * half win, so a win rate here is "points won / games played".
 */
export function wilson(successes: number, n: number): Interval {
    if (n <= 0) return { estimate: 0, lo: 0, hi: 0, n: 0 };
    const p = successes / n;
    const z2 = Z * Z;
    const denom = 1 + z2 / n;
    const centre = (p + z2 / (2 * n)) / denom;
    const half = (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
    return { estimate: p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half), n };
}

/** Mean of `values` with a normal-approximation 95% interval (sample standard deviation). */
export function meanInterval(values: ReadonlyArray<number>): Interval {
    const n = values.length;
    if (n === 0) return { estimate: 0, lo: 0, hi: 0, n: 0 };
    const mean = values.reduce((a, b) => a + b, 0) / n;
    if (n === 1) return { estimate: mean, lo: mean, hi: mean, n };
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    const half = Z * Math.sqrt(variance / n);
    return { estimate: mean, lo: mean - half, hi: mean + half, n };
}

/** Nearest-rank percentile (p in 0..1) of `values`. Empty gives 0. */
export function percentile(values: ReadonlyArray<number>, p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    return sorted[rank];
}

export interface TimingSummary {
    readonly n: number;
    readonly mean: number;
    readonly p95: number;
}

export function summariseTimings(ms: ReadonlyArray<number>): TimingSummary {
    return { n: ms.length, mean: ms.length === 0 ? 0 : ms.reduce((a, b) => a + b, 0) / ms.length, p95: percentile(ms, 0.95) };
}

export const pct = (x: number, places = 1): string => `${(100 * x).toFixed(places)}%`;
export const pctInterval = (i: Interval): string => `${pct(i.estimate)} (${pct(i.lo)} to ${pct(i.hi)})`;
