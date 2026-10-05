/**
 * TICKET 193j — THE AGENT'S FOREWARNING.
 *
 * The playtester starts on the map, with no run-start screen, so the run forecast the game prints
 * there reaches the agent here instead: the same sentence and the same detail lines (`runForecast`),
 * passed through `plain` as the game's hover is, in a short block on the first screen of a session.
 * It is for the screen before the first move only; a replay to move 0 shows it again because it is a
 * function of the world, not a thing remembered.
 */
import { forecastBlock } from '../../engine/run/forecastText';
import { runForecast } from '../../engine/run/runForecast';
import { plain } from '../../ui/labels/labels';
import type { World } from './types';
import { runOf } from './types';

/** The block for this world, or null once a move has been made. */
export function forecastFor(world: World): string | null {
    if (world.log.length > 0) return null;
    const run = runOf(world);
    return plain(forecastBlock(runForecast(run.biomes, run.gymId)));
}
