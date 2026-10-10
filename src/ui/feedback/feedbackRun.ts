/**
 * TICKET 181c — what an ended run tells the feedback form: the starter, how far it got, which run
 * it was and how long it took. Pure: the clock reading is passed in (the run summary reads it once).
 *
 *  - starter: the species name of the run's first party member, the one it started with.
 *  - reached: "area 1 / 2 / 3", "gym" when it ended at the gym, "beat the gym" on a victory. The
 *    intro run (182c) reads "intro (won)" or "intro (lost)".
 *  - run: the ranch's completed-run count; "intro" for the intro, which does not count as one.
 *  - minutes: whole minutes from the run's start to the moment it ended.
 */

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { introRules } from '../../engine/run/intro/introRules';
import type { IRanchState, IRunState } from '../../engine/runTypes';
import type { FeedbackRun } from './feedbackLink';

function starterName(run: IRunState, ranch: Pick<IRanchState, 'roster'>): string {
    const memberId = run.partyIds[0];
    const speciesId = ranch.roster.find((member) => member.id === memberId)?.definitionId;
    if (!speciesId) return '';
    return MingmingRegistry[speciesId]?.name ?? speciesId;
}

function reachedOf(run: IRunState): string {
    if (introRules(run).intro) return run.outcome === 'victory' ? 'intro (won)' : 'intro (lost)';
    if (run.outcome === 'victory') return 'beat the gym';
    const here = run.nodes.find((node) => node.id === run.currentNodeId);
    if (here?.kind === 'gym') return 'gym';
    return `area ${(here?.biomeIndex ?? 0) + 1}`;
}

function minutesOf(run: IRunState, endedAt: number): string {
    const ms = endedAt - run.startedAt;
    return String(Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60_000)) : 0);
}

export function feedbackRunOf(run: IRunState, ranch: Pick<IRanchState, 'roster' | 'runsCompleted'>, endedAt: number): FeedbackRun {
    return {
        starter: starterName(run, ranch),
        reached: reachedOf(run),
        run: introRules(run).intro ? 'intro' : String(ranch.runsCompleted ?? 0),
        minutes: minutesOf(run, endedAt),
    };
}
