/**
 * The multiplier that means "resolve every wait and play at once". Its own file so the tier table
 * and the speed policy can both import it without importing each other.
 */
export const INSTANT = Number.POSITIVE_INFINITY;
