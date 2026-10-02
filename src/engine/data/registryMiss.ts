/**
 * TICKET 154a — **A BAD ID STOPS IN DEVELOPMENT AND TRAVELS IN A SHIPPED BUILD.**
 *
 * `GetMingmingData` and `GetProgramData` answer an unknown id with a WELL-FORMED object —
 * `{ id: 'missing', primaryElement: 'None', baseCost: 99, actions: [] }` — and a `console.warn`.
 * The sentinel's reasoning is sound and is not being thrown away: a player mid-run should not get a
 * white screen because one id is wrong, and a hollow unit is a better failure than a crash.
 *
 * **The cost is that the value does not stop — it PROPAGATES.** `'None'` is a real element and `99`
 * is a real cost, so nothing downstream can tell either from data. Ticket 142d is the worked
 * example: `gym.leaderComp` holds FIRMWARE ids (`kraken_v1`), the biome builder asked
 * `GetMingmingData` for them, took `.primaryElement`, got `'None'` three times, and built a biome
 * advertising an element no species pool contains. It surfaced three files away as a test claiming
 * a run had read the wall clock.
 *
 * Two things about that incident are the argument for this file rather than for a louder warning:
 *
 *  1. **The warning printed NINE TIMES in the same test output being read**, beside a failing
 *     assertion about a clock, and was taken for noise. A `console.warn` in a run that is normally
 *     noisy is not a signal.
 *  2. **It was then written up wrong twice** — first as "returns undefined", then as "fails
 *     silently". A failure mode the person who just debugged it still describes incorrectly is one
 *     that will be rediscovered.
 *
 * So: **throw where somebody is watching, warn where nobody is.** `import.meta.env.DEV` is the same
 * switch `App.tsx` already uses to mount the debug root, so the convention is not new. A production
 * build behaves exactly as it does today, byte for byte — same sentinel, same warning, same
 * recovery — which is why 154a needed no call-site changes and could ship ahead of the honest type
 * (154c) and the branded ids that would make 142d a compile error (154d).
 *
 * THE MESSAGE CARRIES THE DIAGNOSIS, not just the id. The 142d bug is a CATEGORY confusion —
 * a firmware id where a species id was wanted — and it is by far the likeliest way either lookup
 * misses, so the throw says so rather than leaving the reader to rediscover it for a third time.
 */

/**
 * THE ONE ESCAPE HATCH, and the reason it is not a config flag.
 *
 * Some code MEANS to ask for an id that is not there — `stackHand` skipping a card the registry has
 * since dropped from a saved run, `rewardCardPool` falling back to the element pool when the party
 * contributes nothing — and the tests that pin those behaviours have to reach the sentinel to see
 * it. A handful of older fixtures also build battle entities with invented `definitionId`s
 * (`def1`, `test_def`) that were never meant to be registry-backed; those are the warnings ticket
 * 154 §2 says printed nine times and read as noise.
 *
 * So a suite can say, once, that a miss is the thing it is measuring:
 *
 *     beforeAll(() => allowRegistryMisses('stackHand skips a card the registry dropped'));
 *
 * `beforeAll` uses the returned function as its teardown, so the tolerance is scoped to the file
 * and cannot leak into the next one. It is DELIBERATELY not a global switch, a `.env` entry or a
 * vitest `setupFile`: a blanket opt-out would turn this whole file back into a `console.warn`, and
 * the whole value of 154a is that a bad id stops in the suite that produced it.
 *
 * `reason` is not read by anything. It is there so the line says why, in the file that needs it.
 */
let tolerated = 0;

export function allowRegistryMisses(reason: string): () => void {
    void reason;
    tolerated += 1;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        tolerated -= 1;
    };
}

/** What a caller was asking for, which decides which mistake the message suggests first. */
export type RegistryKind = 'Mingming' | 'Program';

const HINT: Record<RegistryKind, string> = {
    // Ticket 142d, exactly: `kraken_v1` is firmware, `kraken` is the species that runs it.
    Mingming: 'If this looks like firmware (`<species>_v1`), you want `speciesOwningFirmware` in `run/gyms.ts` first — `MingmingRegistry` is keyed by SPECIES.',
    // Ticket 162a renamed thirteen ids; `GetProgramData` resolves those itself, so a miss here is
    // a card that does not exist under any spelling rather than one that moved.
    Program: 'Collection v2 renamed thirteen ids and `resolveProgramId` has already been consulted, so this id is not a card under any spelling. Deleted cards live in `data/archive/programs-v1.json`.',
};

/**
 * Report a registry miss: throw in development, warn in a shipped build.
 *
 * Returns `void` so that the two accessors keep their shape — the sentinel construction stays where
 * it is, next to the type it has to satisfy, rather than moving into this file where it would need
 * both registries' types and drift from them.
 */
export function reportRegistryMiss(kind: RegistryKind, id: string): void {
    const what = id === '' ? '(empty string)' : id;
    const message = `${kind} ID not found: ${what}`;

    if (import.meta.env.DEV && tolerated === 0) {
        /*
         * An empty id used to get a `console.trace()`. A thrown Error carries the same stack and is
         * read by the test runner instead of being scrolled past, so the special case is gone.
         */
        throw new Error(
            `${message}\n\n${HINT[kind]}\n\n` +
            'This throws in DEV only (ticket 154a). A shipped build returns the hollow sentinel and logs a warning, as it always has.',
        );
    }

    console.warn(message);
    if (!id) console.trace();
}
