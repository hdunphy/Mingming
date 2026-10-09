/**
 * TICKET 202c — WHAT THE AGENT IS TOLD WHEN A RUN ENDS, in one place.
 *
 * The end-of-run screen prints this line, and the two briefs (docs/playtest/agent-player.md and
 * agent-player-primed.md) quote it, so the agent reads the same words in both. The words are the game's:
 * Amber, Trace, Den and Summon are never renamed here, and no old word is used.
 */
export const AGAIN_COMMAND = 'npm run playtest -- again --session <your session> --results <your results folder>';

/** The sentence under a finished run: run 1 points at `again`, run 2 is the end of the session. */
export function runOverLine(run: 1 | 2): string {
    return run === 1
        ? `Run 1 is over. Start run 2 with: ${AGAIN_COMMAND}`
        : 'Run 2 is over. The session is over: write your last note and stop.';
}
