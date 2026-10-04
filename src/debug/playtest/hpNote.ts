import type { IRunState } from '../../engine/runTypes';

/**
 * Why HP reads `full` outside a gauntlet (TICKET 193d), as one parenthesis for the status line.
 *
 * It is by design: between ordinary nodes the party is fully healed (`battleSetup`, `runSlice`), and HP
 * carries only inside the gym gauntlet. Nothing told the agents, and they spent real effort on healing
 * they did not need. Empty in a gauntlet, where the status line shows the carried numbers instead. One
 * function, so the wording is not repeated per screen.
 */
export function hpNote(run: Pick<IRunState, 'phase'>): string {
    if (run.phase === 'gauntlet') return '';
    return '(the team is fully healed between fights; HP only carries inside the gym gauntlet)';
}
