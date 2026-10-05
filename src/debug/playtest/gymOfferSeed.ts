/**
 * The seed a session's gym offer is drawn from. `createWorld` and the night plan both ask for it here, so
 * the gym the plan picks by index is the gym the world then starts in (ticket 195k).
 */
export const gymOfferSeed = (seed: string): string => `${seed}:gyms`;
