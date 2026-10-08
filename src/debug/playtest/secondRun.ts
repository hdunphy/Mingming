/**
 * TICKET 202c — THE SECOND RUN OF A SESSION.
 *
 * Henry: "Maybe we make each agent perform 2 runs? The second time they can try to use what they learned."
 * Decision D2, confirmed 2026-10-08: run 2 carries exactly what the game's own save carries.
 *
 * So the carry-over is not a rule of the tool's. The ended run goes through `teardownRun`, the one path
 * every ending takes in the game (`ui/store/runTeardown.ts`: the codex merge, and on a win the gym and tier
 * unlock), and the ranch that comes out is what the new run starts from: the roster (a won run's party
 * included, as the game keeps it), the banked Traces, the codex, `traceHintShown`, and the rest of the
 * ranch with them. The run itself (map, deck, amber, party) is not in the ranch and is new.
 *
 * Run 2's map is drawn on the seed family `pt<date>:<i>:2` (run 1 keeps the plan's seed). The gym offer is
 * drawn per seed in its own order, so "the same gym" is looked up by gym, not copied as an index.
 */
import { offerGyms } from '../../engine/run/gyms';
import { teardownRun } from '../../ui/store/runTeardown';
import { gymOfferSeed } from './gymOfferSeed';
import type { SecondRun, SessionHeader, World } from './types';
import { runOf } from './types';
import { createWorld } from './world';

export const SECOND_RUN_SEED_SUFFIX = ':2';

/** A session plays two runs, no more. */
export const RUNS_A_SESSION = 2;

export const secondRunSeed = (seed: string): string => `${seed}${SECOND_RUN_SEED_SUFFIX}`;

/** Run 2's plan, from run 1's ended world: its seed, the same gym's place in that seed's offer, and where its moves begin. */
export function secondRunFor(first: World): SecondRun {
    const seed = secondRunSeed(first.header.seed);
    const gymId = runOf(first).gymId;
    const index = offerGyms(gymOfferSeed(seed)).findIndex((offer) => offer.gym.id === gymId);
    return { seed, gymIndex: index >= 0 ? index : first.header.gymIndex, atMove: first.log.length };
}

/** What run 2 is started with: the session's starter, mode, tier, modifiers and budget, on run 2's seed and gym. */
export const secondRunHeader = (header: SessionHeader, run2: SecondRun): SessionHeader => ({
    seed: run2.seed, starter: header.starter, gymIndex: run2.gymIndex, mode: header.mode, tier: header.tier,
    modifiers: header.modifiers, ...(header.budget === undefined ? {} : { budget: header.budget }), twoRuns: true,
});

/**
 * Run 2's world, built from run 1's ended one. Ends run 1 the way the game does (and so changes `first`'s store:
 * the world it was is spent), then starts a fresh run on the ranch that leaves. The move log carries on, so a
 * move keeps one index for the whole session.
 */
export function beginSecondRun(first: World, run2: SecondRun): World {
    const ended = runOf(first);
    if (ended.phase !== 'ended') throw new Error('run 1 has not ended');
    teardownRun({ run: ended, dispatch: first.store.dispatch });
    return createWorld(secondRunHeader(first.header, run2), { ranch: first.store.getState().game, log: first.log });
}
