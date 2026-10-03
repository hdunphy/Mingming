/**
 * A BEAT — ticket 189b. One thing the board shows, as data.
 *
 * The engine resolves a card in one synchronous burst; the screen shows it a beat at a time. A beat
 * is a list of timed actions (each a closure that draws, sounds or writes something) and how long
 * the beat occupies the stage before the next one may start. The presenter queue plays beats one
 * after another on the battle clock; nothing else decides when something appears.
 */

export interface TimedAction {
    /** Game milliseconds after the beat starts. 0 (or less) runs synchronously when the beat starts. */
    readonly at: number;
    readonly run: () => void;
    /** What it is ("trail", "impact", "death", ...): for logs and tests, never for behaviour. */
    readonly label?: string;
}

export interface Beat {
    /** For logs and tests: what this beat is ("cast", "ticks", ...). */
    readonly label: string;
    readonly actions: ReadonlyArray<TimedAction>;
    /** Game milliseconds before the next beat may start. At least the last action's `at`. */
    readonly durationMs: number;
}

/** A beat's duration may never end before its own last action. */
export function beatDuration(actions: ReadonlyArray<TimedAction>, minimum = 0): number {
    return Math.max(minimum, ...actions.map((action) => action.at));
}
