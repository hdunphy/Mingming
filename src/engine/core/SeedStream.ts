import { PRNG } from './PRNG';

/**
 * Creation-path determinism helpers.
 *
 * The battle *reducer* is already seeded end to end; battle *creation* was not.
 * `SeedStream` is the single stateful carrier that lets `createBattleState`
 * thread one seed through every random decision it makes (party size, IVs,
 * shuffles, draws, entity/card ids) instead of reaching for `Math.random()`,
 * `Date.now()` or `crypto.randomUUID()`.
 *
 * It follows the established thread-back contract: every draw constructs a
 * `PRNG` from the current seed, takes `nextSeed`, and writes it back - so
 * `stream.seed` is always the seed the *next* consumer should receive, and it
 * can be handed to (or adopted from) any of the existing `seed`/`nextSeed`
 * APIs (`drawCards`, `generateIntents`, `generateEncounter`).
 */
export class SeedStream {
    private current: string;
    private counter: number;

    constructor(seed: string | number) {
        this.current = seed.toString();
        this.counter = 0;
    }

    /** The current thread seed - safe to hand to any `seed: string` API. */
    public get seed(): string {
        return this.current;
    }

    /**
     * Re-anchor the stream on a seed produced elsewhere. Use immediately after
     * calling an API that returns its own `nextSeed` (e.g. `drawCards`) so the
     * thread stays unbroken.
     */
    public adopt(seed: string | number): void {
        this.current = seed.toString();
    }

    /** Uniform float in [0, 1). Advances the stream. */
    public next(): number {
        const { value, nextSeed } = new PRNG(this.current).next();
        this.current = nextSeed.toString();
        return value;
    }

    /** Uniform integer in [min, max] inclusive. Advances the stream. */
    public nextInt(min: number, max: number): number {
        const { value, nextSeed } = new PRNG(this.current).nextInt(min, max);
        this.current = nextSeed.toString();
        return value;
    }

    /** Seeded Fisher-Yates. Advances the stream. */
    public shuffle<T>(array: ReadonlyArray<T>): T[] {
        const { shuffled, nextSeed } = new PRNG(this.current).shuffle([...array]);
        this.current = nextSeed.toString();
        return shuffled;
    }

    /**
     * Derive a labelled child seed for a subsystem that owns its own PRNG
     * (e.g. `generateEncounter`). The label keeps two subsystems drawing from
     * the same point in the thread from receiving the same seed. Advances the
     * stream, so the caller's thread does not replay the child's numbers.
     */
    public fork(label: string): string {
        const child = new PRNG(`${this.current}_${label}`).next().nextSeed.toString();
        this.next();
        return child;
    }

    /**
     * Seeded, collision-safe id. Collision safety inside one stream comes from
     * the monotonic counter (the PRNG token alone is only 31 bits and may
     * repeat); the token keeps ids from two differently-seeded streams apart.
     * Replaces `crypto.randomUUID()` on the creation path so a recorded run and
     * its replay produce identical entity and card-instance ids.
     */
    public nextId(prefix: string): string {
        const value = this.next();
        this.counter += 1;
        const token = Math.floor(value * 0xffffffff).toString(36).padStart(7, '0');
        return `${prefix}_${token}_${this.counter.toString(36)}`;
    }
}

let rollCounter = 0;

/**
 * The one deliberately non-deterministic call on the creation path: used only
 * when no seed was supplied. Roll once, then thread the result everywhere so
 * the resulting battle is still reproducible from its recorded seed. The
 * counter suffix keeps two rolls in the same millisecond distinct.
 */
export function rollSeed(): string {
    rollCounter += 1;
    return `${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffffff).toString(36)}_${rollCounter.toString(36)}`;
}
