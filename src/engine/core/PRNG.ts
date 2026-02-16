
/**
 * Simple Seeded Pseudo-Random Number Generator (LCG algorithm)
 * Provides deterministic randomness for shuffling and encounters.
 */
export class PRNG {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    /**
     * Returns a random float between 0 and 1
     */
    public next(): { value: number; nextSeed: number } {
        // LCG Parameters (Numerical Recipes)
        const m = 0x80000000; // 2^31
        const a = 1103515245;
        const c = 12345;

        this.seed = (a * this.seed + c) % m;
        return {
            value: this.seed / (m - 1),
            nextSeed: this.seed
        };
    }

    /**
     * Returns a random integer between min and max (inclusive)
     */
    public nextInt(min: number, max: number): { value: number; nextSeed: number } {
        const { value, nextSeed } = this.next();
        const range = max - min + 1;
        return {
            value: Math.floor(value * range) + min,
            nextSeed
        };
    }

    /**
     * Seeded Fisher-Yates Shuffle
     */
    public shuffle<T>(array: T[]): { shuffled: T[]; nextSeed: number } {
        const result = [...array];
        let currentSeed = this.seed;

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
