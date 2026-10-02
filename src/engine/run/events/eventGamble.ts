/**
 * TICKET 168c — the gamble: a seeded roll that turns a `GAMBLE` outcome into the outcomes of the
 * branch it landed on.
 *
 * The roll comes from the node's seed (`nodeSeed(run, node, 'event-gamble')`, forked by the
 * outcome's index), so it is fixed for the node: backing out of a card pick and coming back, or
 * closing the app and resuming, lands on the same branch. A player cannot re-roll by reloading.
 *
 * Engine module: no React, no Redux, no `Math.random()`.
 */

import { SeedStream } from '../../core/SeedStream';
import { nodeSeed } from '../nodeSeed';
import type { IRegionNode, IRunState } from '../../runTypes';
import type { EventChoice, EventOutcome } from './eventSchema';

export interface GambleContext {
    readonly run: IRunState;
    readonly node: IRegionNode;
}

/** Whether the gamble at this outcome index wins: a roll of 0-99 under `chance`. */
export function gambleWins(ctx: GambleContext, index: number, chance: number): boolean {
    const stream = new SeedStream(new SeedStream(nodeSeed(ctx.run, ctx.node, 'event-gamble')).fork(String(index)));
    return stream.nextInt(0, 99) < chance;
}

/**
 * The choice with every `GAMBLE` replaced by the outcomes of the branch it rolled. A choice with no
 * gamble comes back as it went in, so this is safe to call on any choice and twice in a row.
 *
 * A negative SCRAP inside a branch is capped at what the run holds, here, so every caller sees the
 * price that will really be charged.
 */
export function resolveGambles(ctx: GambleContext, choice: EventChoice): EventChoice {
    if (!choice.outcomes.some((outcome) => outcome.type === 'GAMBLE')) return choice;
    const outcomes: EventOutcome[] = choice.outcomes.flatMap((outcome, index) => {
        if (outcome.type !== 'GAMBLE') return [outcome];
        const branch = gambleWins(ctx, index, outcome.chance) ? outcome.win : outcome.lose;
        // A price inside a branch is taken as far as the run can pay. The button could not be greyed
        // for a price that only lands on a lost roll, so it must never fail silently to charge.
        return branch.map((inner): EventOutcome => (
            inner.type === 'SCRAP' && inner.amount < 0
                ? { ...inner, amount: -Math.min(-inner.amount, ctx.run.scrap) }
                : inner
        ));
    });
    return { ...choice, outcomes };
}
