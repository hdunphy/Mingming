/** TICKET 180a — the run is over. No moves: a finished run is the end of a session, not a soft-lock. */
import { countedDeckSize } from '../../../engine/run/junk';
import { shortHandedGymLine } from '../../../engine/run/shortHandedGymLine';
import { nodeLabel } from '../gameText';
import { runOverLine } from '../runOver';
import type { Screen, World } from '../types';
import { runOf } from '../types';
import { fightReportLines } from './fightReportLines';

export function endScreen(world: World): Screen {
    const run = runOf(world);
    const here = run.nodes.find((n) => n.id === run.currentNodeId);
    const body: string[] = [];
    if (world.view.fight) body.push(...fightReportLines(world.view.fight));
    const outcome = world.view.cutShort ?? run.outcome ?? 'ended';
    body.push(`RUN OVER: ${outcome}${world.view.cutShort ? ' (the session\'s decision budget ran out)' : ''}. ${run.fightsResolved} fights won, ${countedDeckSize(run.deck)} cards in the deck, ${run.scrap} amber left${here ? `, ended at ${nodeLabel(here)}` : ''}.`);
    // TICKET 202c: a session that allows two runs says what comes next. Sessions written before it say nothing.
    if (world.header.twoRuns === true) body.push(runOverLine(world.runNumber));
    // TICKET 202l (built as 204a): the game's defeat screen line, word for word.
    const shortHanded = shortHandedGymLine(run);
    if (shortHanded) body.push(shortHanded);
    if (world.view.engineError) body.push(`ENGINE ERROR: the game's own code threw during the last fight (${world.view.engineError}). The run was cut short; this is a game bug to report.`);
    return { id: 'end', body, moves: [] };
}
