/**
 * TICKET 190e - HOW MANY PARTICLES A HIT THROWS. `round((12 + 26 s) x matchup x particleScale)`: a chip
 * is a puff of 12, a full-strength hit is 38, a super-effective hit throws half again as many and a
 * resisted one half as many, and the tier's `particleScale` (Slow 1.5, Showy 1.3, Snappy 0.85) has the
 * last word. One function so the test and the burst cannot disagree.
 */

export type Matchup = 'super' | 'resisted' | 'normal';

export const MATCHUP_PARTICLES: Readonly<Record<Matchup, number>> = { super: 1.5, resisted: 0.5, normal: 1 };

/** The card says so: it was a super-effective (`doubled`) or a resisted hit. */
export const matchupOf = (doubled: boolean, resisted: boolean): Matchup =>
    resisted ? 'resisted' : doubled ? 'super' : 'normal';

export const impactCount = (s: number, matchup: Matchup, particleScale: number): number =>
    Math.round((12 + 26 * s) * MATCHUP_PARTICLES[matchup] * particleScale);
