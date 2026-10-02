/**
 * TICKET 180d — THE BATTLE, WHEN THE AGENT PLAYS IT (`turn` and `card` mode).
 *
 * Both sides with their HP, shield, energy, statuses and (for the enemy) intent; the hand with each
 * card's cost and full text; the piles and the macro rack. Moves are the game's own legal plays
 * (`legalActions`, 177a), the macros that will land, and END TURN last: it is always legal, so a
 * battle screen can never be a soft-lock.
 */
import { PLAYTEST_MAX_TURNS } from '../battleSim';
import { END_TURN_KEY } from '../battle/keys';
import { endTurn } from '../battle/play';
import { macroMoves } from '../battle/macroMoves';
import { playMoves } from '../battle/playMoves';
import { nodeKindLabel } from '../gameText';
import type { Screen, World } from '../types';
import { runOf } from '../types';
import { handLines, rackLines } from './battle/handLines';
import { sideLines, statusLegend } from './battle/sideLines';

export function battleScreen(world: World): Screen {
    const flow = world.view.battle!;
    const { state } = flow;
    const legend = statusLegend(state);
    const rack = runOf(world).macros;
    return {
        id: 'battle',
        body: [
            `BATTLE: ${nodeKindLabel(flow.fought.kind)}, turn ${state.turn} (a fight that passes turn ${PLAYTEST_MAX_TURNS} is lost). Your turn.`,
            ...sideLines(state),
            ...(legend.length > 0 ? ['STATUSES IN PLAY:', ...legend] : []),
            ...handLines(state),
            ...rackLines(rack),
        ],
        moves: [
            ...playMoves(state),
            ...macroMoves(state, rack),
            { key: END_TURN_KEY, label: 'END TURN (the enemy plays its turn, then it is yours again)', apply: endTurn },
        ],
    };
}
