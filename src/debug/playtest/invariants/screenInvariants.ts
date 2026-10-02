/**
 * TICKET 180e — THE SCREEN AND THE FIGHT REPORT.
 *
 * A screen always offers at least one move unless the run is over (no soft-locks), and a fight must
 * finish inside the turn cap.
 */
import type { IRunState } from '../../../engine/runTypes';
import type { FightReport, Screen } from '../types';
import { PLAYTEST_MAX_TURNS } from '../battleSim';
import type { Violation } from './violations';

export function screenInvariants(screen: Screen, run: IRunState): Violation[] {
    return screen.moves.length === 0 && run.phase !== 'ended'
        ? [{ name: 'soft-lock', detail: `the "${screen.id}" screen offers no move and the run is not over` }]
        : [];
}

export function fightInvariants(report: FightReport | null): Violation[] {
    return report?.truncated
        ? [{ name: 'fight-truncated', detail: `a fight at ${report.nodeId} did not finish within ${PLAYTEST_MAX_TURNS} turns (or would not take a move)` }]
        : [];
}
