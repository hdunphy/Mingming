/**
 * TICKET 202c — ONE RUN OF A SESSION, as the morning report reads it.
 *
 * A session plays up to two runs. The report's session line, its party table and its summary count RUNS, so each
 * run is read off its own world when it ends (or when the session stops inside it) and kept as a leg of the
 * session's fact. A session with no second run has one leg, and a fact that carries no legs (the report's older
 * stand-ins) is read as one.
 */
import { decisionsIn } from '../world';
import { endFactsOf, type EndFacts } from './endFacts';
import type { World } from '../types';
import { runOf } from '../types';
import type { RunFact } from './facts';

export interface RunLeg extends EndFacts {
    readonly number: 1 | 2;
    /** The run's outcome, or `budget`, or `unfinished` for a run that stopped mid-way. */
    readonly outcome: string;
    readonly fights: number;
    readonly biome: string;
    readonly deckSize: number;
    readonly scrap: number;
    /** The decisions made in this run alone. */
    readonly decisions: number;
}

/** The run `world` is in, as it stands. */
export function legOf(world: World): RunLeg {
    const run = runOf(world);
    const here = run.nodes.find((n) => n.id === run.currentNodeId);
    const biomeIndex = here?.biomeIndex ?? 0;
    return {
        number: world.runNumber,
        outcome: world.view.cutShort ?? (run.phase === 'ended' ? (run.outcome ?? 'ended') : 'unfinished'),
        fights: run.fightsResolved,
        biome: `${biomeIndex + 1} of ${run.biomes.length}${run.biomes[biomeIndex] ? ` (${run.biomes[biomeIndex].name})` : ''}`,
        deckSize: run.deck.length,
        scrap: run.scrap,
        decisions: decisionsIn(world.log.slice(world.runStart)),
        ...endFactsOf(world),
    };
}

/** The runs a session played, in order: its legs, or one made from the fact's own end-of-session numbers. */
export function legsOf(run: RunFact): ReadonlyArray<RunLeg> {
    if (run.legs !== undefined) return run.legs;
    return [{
        number: 1, outcome: run.outcome, fights: run.fights, biome: run.biome, deckSize: run.deckSize, scrap: run.scrap,
        decisions: run.decisions, partySize: run.partySize, blueprints: run.blueprints, endedAt: run.endedAt, reachedGym: run.reachedGym,
    }];
}
