/**
 * TICKET 195b — THE FIRST TRACE SAYS WHAT IT IS FOR.
 *
 * Henry's line, in his words: **"Summon it in the Den."** It shows directly under a Trace on the first
 * Trace a save ever gains, wherever it is gained (a fight's reward, the Wild Tracks event, the shop, the
 * gym's payout), and never again. A wiped save shows it again; a Trace gained on a save that has shown it
 * does not. The flag is `IRanchState.traceHintShown`, in the persistent save beside the Trace counts and
 * the codex, set when the line has been shown.
 *
 * This is the one module every place asks: the game's screens through `useFirstTraceLine`, and the
 * playtest tool through `src/debug/playtest/firstTrace.ts`. Both read the sentence from here, so the agent
 * and a player see one sentence.
 */

export const FIRST_TRACE_LINE = 'Summon it in the Den.';

/** Has this save not yet shown the line? (A save written before the field has not.) */
export const traceHintDue = (ranch: { readonly traceHintShown?: boolean }): boolean => ranch.traceHintShown !== true;
