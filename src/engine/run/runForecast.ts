/**
 * TICKET 193j — THE RUN FORECAST: what a run is, in one sentence, and the detail lines behind it.
 *
 * Henry, 2026-10-04: *"We need some description of what to expect on the run so players and the agent
 * can plan for the boss. Keep it short and ideally in game."* Two nights of the playtester showed why:
 * agents walked into the gym with one mingming, no repairs to count on and scrap unspent, because
 * nothing before the run said what the run asks for.
 *
 * **Nothing here is typed in.** The elite count is the number of biomes minus the last (a biome's exit
 * is an elite, the last biome's is the gym, `REGION_PARAMS.biomeExitKind`), the gauntlet's length is
 * `GAUNTLET_FIGHTS`, the repair is `GAUNTLET_HEAL_PERCENT`, and the boss rule is read from the same
 * table the gauntlet fields (`gymSignatures` over `authoredBossFor`). Ticket 176 is redrawing the map
 * and ticket 28a is the warning about a preview with a table of its own, so a layer number or a node
 * name must never be written into this text.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports.
 */
import { GAUNTLET_FIGHTS, gymSignatures } from './gauntlet';
import { GAUNTLET_HEAL_PERCENT } from './gauntletHeal';
import { authoredBossFor } from './bosses';

/** The numbers the forecast is built from. Held as a value so a test can change one and see the text move. */
export interface ForecastShape {
    readonly fights: number;
    readonly repairPercent: number;
}

export const DEFAULT_SHAPE: ForecastShape = { fights: GAUNTLET_FIGHTS, repairPercent: GAUNTLET_HEAL_PERCENT };

export interface RunForecast {
    /** One sentence, at most the copy budget's 140 characters. */
    readonly sentence: string;
    /** The lines behind it: the gauntlet's shape and the boss's rule. Hover text, not a paragraph. */
    readonly details: ReadonlyArray<string>;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
export const word = (n: number): string => WORDS[n] ?? String(n);

/** "Two elites guard the road" / "One elite guards the road" / "No elite guards the road". */
function guardClause(gates: number): string {
    if (gates <= 0) return 'The gym is at the end of the road';
    return gates === 1 ? 'One elite guards the road to the gym' : `${word(gates)[0].toUpperCase()}${word(gates).slice(1)} elites guard the road to the gym`;
}

function repairClause(percent: number): string {
    return percent > 0 ? 'with only light repairs between' : 'with no healing between them';
}

/** The sentence: the road's guards, the gauntlet's length and its repair, and what to bring. */
function sentenceFor(biomeCount: number, shape: ForecastShape): string {
    const gates = Math.max(0, biomeCount - 1);
    return `${guardClause(gates)}, where ${word(shape.fights)} fights come back to back ${repairClause(shape.repairPercent)}. Bring a full team.`;
}

function detailsFor(biomes: ReadonlyArray<{ readonly elements: ReadonlyArray<string> }>, gymId: string, shape: ForecastShape): string[] {
    const lines = [`The gym is ${word(shape.fights)} fights in a row, the boss last.`];
    if (shape.repairPercent > 0) lines.push(`Every member still standing repairs ${shape.repairPercent}% between fights; a downed one stays down.`);
    else lines.push('Nothing is repaired between fights.');
    if (authoredBossFor(gymId)) {
        // The boss's team is not named here: the offer screen telegraphs the RULE (ticket 68 ruling 4),
        // and the scout shows the team mid-run (ticket 142b).
        for (const s of gymSignatures(gymId, biomes)) lines.push(`Boss rule, ${s.name}: ${s.description}`);
    } else {
        lines.push('The boss fields one species from each biome of the run, in biome order.');
    }
    return lines;
}

/** The forecast of a run through these biomes to this gym. Pure: the same inputs, the same text. */
export function runForecast(
    biomes: ReadonlyArray<{ readonly elements: ReadonlyArray<string> }>,
    gymId: string,
    shape: ForecastShape = DEFAULT_SHAPE,
): RunForecast {
    return {
        sentence: sentenceFor(biomes.length, shape),
        details: detailsFor(biomes, gymId, shape),
    };
}
