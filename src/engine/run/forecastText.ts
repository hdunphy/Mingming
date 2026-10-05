/**
 * TICKET 193j — the two ways the forecast is printed: the gym card's hover and the tool's block.
 *
 * Kept apart from `runForecast.ts` so that file stays the facts and this one is only layout. Neither
 * adds a word of its own beyond the block's heading.
 */
import type { RunForecast } from './runForecast';

/** The detail lines, one to a line, for a hover. The sentence is the screen's paragraph, not repeated. */
export function forecastHover(forecast: RunForecast): string {
    return forecast.details.join('\n');
}

/** The playtester's forewarning: a heading, the sentence, then the details as a list. */
export function forecastBlock(forecast: RunForecast): string {
    return ['RUN FORECAST', forecast.sentence, ...forecast.details.map((d) => `- ${d}`)].join('\n');
}
