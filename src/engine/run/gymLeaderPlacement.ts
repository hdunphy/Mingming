/**
 * TICKET 207 — **WHICH LEADER INSTINCTS WALK OUT IN GYM FIGHTS 1 AND 2.**
 *
 * Henry, 2026-10-08: *"Add some of the leader cards so you get to see them before the fight. This
 * means we need to add leader card for each instinct and then ensure that all three instincts show
 * up at least once in fights one and two but don't let the party be exactly the same as the final
 * 3rd fight. That should be the hardest because it has good synergy."*
 *
 * So across the six enemies of fights 1 and 2, each of the leader's three Instincts appears once
 * (that species, running that Instinct, carrying its leader card), and no fight holds all three.
 * One fight gets two of them, the other gets one; which ones, and which fight gets two, is drawn
 * once per gym visit from the gym node's seed, so fight 2 agrees with fight 1 about what is left.
 * The rolled bodies around them never run a leader Instinct (`gauntlet.ts`), which is what keeps
 * the full trio out of fights 1 and 2.
 *
 * Engine module: no React, no Redux, no `Math.random()`, no `Date.now()`.
 */

import { SeedStream } from '../core/SeedStream';
import type { IRegionNode, IRunState } from '../runTypes';
import { authoredBossFor } from './bosses';
import { nodeSeed } from './nodeSeed';

/**
 * The leader members (indices into `AUTHORED_BOSSES[gym].members`) placed in each of fights 1 and 2,
 * as `[fight1, fight2]`. Empty lists for a gym with no authored team.
 */
export function leaderPlacement(run: IRunState, node: IRegionNode): readonly [number[], number[]] {
    const boss = authoredBossFor(run.gymId);
    if (!boss || boss.members.length === 0) return [[], []];
    const stream = new SeedStream(new SeedStream(nodeSeed(run, node, 'gauntlet:leaders')).fork('gauntlet-leaders'));
    const order = stream.shuffle(boss.members.map((_, index) => index));
    const pairFirst = stream.nextInt(0, 1) === 0;
    const pair = order.slice(0, 2).sort((a, b) => a - b);
    const single = order.slice(2);
    return pairFirst ? [pair, single] : [single, pair];
}

/** The leader members placed in one gauntlet fight. Empty for the boss fight and past fight 2. */
export function leadersInFight(run: IRunState, node: IRegionNode, fightIndex: number): number[] {
    if (fightIndex < 0 || fightIndex > 1) return [];
    return leaderPlacement(run, node)[fightIndex];
}
