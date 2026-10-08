/**
 * TICKET 202l — the defeat screen says why, when the team was short at the gym.
 *
 * Henry (2026-10-07), on whether the full-party goal should be "yellow painted" or discovered: the
 * map shows the gym's three elements (202j) and the header says "Party 1 of 3" (202i), and one line
 * on the defeat screen when the run died at the gym short-handed — *"Sure add it to the defeat-screen
 * line."* The evidence for it: across four agent nights, every solo run that reached the gym died in
 * fight 1 within two turns. That is a wipe, not the narrow first loss Henry wants, and a wipe with
 * no reason given reads as "the gym is unfair" rather than "I needed a team".
 *
 * One job: the line, or null. Only for a defeat at the gym node, outside the intro, with fewer than
 * `PARTY_SIZE` members. The enemy count is `GAUNTLET_ENEMY_COUNT`, read rather than typed.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports.
 */
import { PARTY_SIZE } from '../party';
import type { IRunState } from '../runTypes';
import { GAUNTLET_ENEMY_COUNT } from './gauntlet';
import { introRules } from './intro/introRules';
import { word } from './runForecast';

export function shortHandedGymLine(run: IRunState): string | null {
    if (run.outcome !== 'defeat') return null;
    if (introRules(run).intro) return null;
    const here = run.nodes.find((node) => node.id === run.currentNodeId);
    if (here?.kind !== 'gym') return null;
    const brought = run.partyIds.length;
    if (brought >= PARTY_SIZE) return null;
    return `You fought the gym's ${word(GAUNTLET_ENEMY_COUNT)} with ${word(brought)}.`;
}
