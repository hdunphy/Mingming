
/**
 * Simple Seeded Pseudo-Random Number Generator (LCG algorithm)
 * Provides deterministic randomness for shuffling and encounters.
 */
/**
 * What a PRNG hands back as the next seed: the same *kind* it was constructed with.
 *
 * Ticket 55 typed this. It was `any` in four places, which was not laziness so much as the shape
 * being genuinely two-valued — `formatSeed` returns a string for a string-seeded generator and a
 * number for a number-seeded one, so that `new PRNG(nextSeed)` reproduces the same sequence either
 * way. Naming the union says that out loud and costs no caller anything: every consumer either
 * feeds it straight back into a constructor (which takes `string | number`) or stores it.
 */
export type PrngSeed = string | number;

/**
 * Generic over the seed KIND, so the invariant is proved rather than asserted.
 *
 * `new PRNG(state.seed)` where `IBattleState.seed` is a `string` yields `nextSeed: string`, which is
 * what the three call sites that feed it straight back into `state.seed` need. Before ticket 55 they
 * type-checked because `nextSeed` was `any`; typing it as the bare union broke all three, and adding
 * `String(...)` at each would have restated a fact the class already knows. The parameter carries it
 * instead.
 */
export class PRNG<S extends PrngSeed = PrngSeed> {
    private seed: number;
    private isStringSeed: boolean;

    constructor(seed: S) {
        this.isStringSeed = typeof seed === 'string';
        if (typeof seed === 'string') {
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash |= 0;
            }
            this.seed = Math.abs(hash);
        } else {
            this.seed = seed;
        }
    }

    private formatSeed(newSeed: number): S {
        return (this.isStringSeed ? newSeed.toString() : newSeed) as S;
    }

    public next(): { value: number; nextSeed: S } {
        const m = 0x80000000;
        const a = 1103515245;
        const c = 12345;

        this.seed = (a * this.seed + c) % m;
        return {
            value: this.seed / (m - 1),
            nextSeed: this.formatSeed(this.seed)
        };
    }

    public nextInt(min: number, max: number): { value: number; nextSeed: S } {
        const { value, nextSeed } = this.next();
        const range = max - min + 1;
        return {
            value: Math.floor(value * range) + min,
            nextSeed
        };
    }

    public shuffle<T>(array: T[]): { shuffled: T[]; nextSeed: S } {
        const result = [...array];
        let currentSeed: S = this.formatSeed(this.seed);

        for (let i = result.length - 1; i > 0; i--) {
            const { value: j, nextSeed } = new PRNG(currentSeed).nextInt(0, i);
            [result[i], result[j]] = [result[j], result[i]];
            currentSeed = nextSeed;
        }

        return {
            shuffled: result,
            nextSeed: currentSeed
        };
    }
}
