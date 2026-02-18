
/**
 * Simple Seeded Pseudo-Random Number Generator (LCG algorithm)
 * Provides deterministic randomness for shuffling and encounters.
 */
export class PRNG {
    private seed: number;
    private isStringSeed: boolean;

    constructor(seed: string | number) {
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

    private formatSeed(newSeed: number): string | number {
        return this.isStringSeed ? newSeed.toString() : newSeed;
    }

    public next(): { value: number; nextSeed: any } {
        const m = 0x80000000;
        const a = 1103515245;
        const c = 12345;

        this.seed = (a * this.seed + c) % m;
        return {
            value: this.seed / (m - 1),
            nextSeed: this.formatSeed(this.seed)
        };
    }

    public nextInt(min: number, max: number): { value: number; nextSeed: any } {
        const { value, nextSeed } = this.next();
        const range = max - min + 1;
        return {
            value: Math.floor(value * range) + min,
            nextSeed
        };
    }

    public shuffle<T>(array: T[]): { shuffled: T[]; nextSeed: any } {
        const result = [...array];
        let currentSeed: any = this.formatSeed(this.seed);

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
