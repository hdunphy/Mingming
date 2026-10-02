/** TICKET 180a — the run is over. No moves: a finished run is the end of a session, not a soft-lock. */
import { countedDeckSize } from '../../../engine/run/junk';
import { nodeLabel } from '../gameText';
import type { Screen, World } from '../types';
import { runOf } from '../types';
import { fightReportLines } from './fightReportLines';

export function endScreen(world: World): Screen {
    const run = runOf(world);
    const here = run.nodes.find((n) => n.id === run.currentNodeId);
    const body: string[] = [];
    if (world.view.fight) body.push(...fightReportLines(world.view.fight));
    body.push(`RUN OVER: ${run.outcome ?? 'ended'}. ${run.fightsResolved} fights won, ${countedDeckSize(run.deck)} cards in the deck, ${run.scrap} scrap left${here ? `, ended at ${nodeLabel(here)}` : ''}.`);
    return { id: 'end', body, moves: [] };
}
