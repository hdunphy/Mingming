/**
 * TICKET 202e — the night's resume guard.
 *
 * A session folder with a `session.json` and no `driver.json` was interrupted, and `runNight`
 * (scripts/playtest-night.mjs) picks it up where it stopped. On 2026-10-06 that folder had been left by an
 * earlier launch with other flags, so the night played Kraken at Emberfall in the slot planned for Fenrir at
 * Rootfall. Before anything is resumed, the session file is checked against tonight's plan entry.
 *
 * Plain Node like the rest of scripts/, so the vitest tests load it by path.
 */

/** True when the existing session was started for this plan entry: the same seed, starter and gym. */
export function resumeMatchesPlan(session, entry) {
    return session.seed === entry.seed && session.starter === entry.starter && session.gymIndex === entry.gym;
}

/** What the night prints when it stops, and what to do about it. `folder` is the session's folder, shown with forward slashes. */
export function resumeRefusal(session, entry, folder) {
    const seedDiffers = session.seed !== entry.seed;
    const side = (starter, gym, seed) => `${starter} / gym ${gym}${seedDiffers ? ` / seed ${seed}` : ''}`;
    return `${entry.session} was started with ${side(session.starter, session.gymIndex, session.seed)} but tonight's plan says ${side(entry.starter, entry.gym, entry.seed)}. `
        + `Delete ${folder.replace(/\\/g, '/')} to replay it, or run with the same flags to resume it.`;
}

/** The night stops with this; the script prints its message and nothing else. */
export class ResumeMismatchError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ResumeMismatchError';
    }
}
