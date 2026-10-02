/**
 * Ticket 164h — Mulberry32 Seeded Pseudo-Random Number Generator.
 * Replaces the 16-bit LCG / hash cycle with a 32-bit generator with period 2^32.
 */

/**
 * cyrb53 hash function folded to 32 bits.
 * Fast, non-cryptographic string hash with avalanche characteristics.
 */
function cyrb53(str: string, seed = 0): number {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c64e6d ^ seed;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 ^ h1) >>> 0;
}

/**
 * What a PRNG hands back as the next seed: the same *kind* it was constructed with.
 */
export type PrngSeed = string | number;

/** Canonical regex for mulberry32 state: m1: followed by 8 hex digits. */
const CANONICAL_SEED_REGEX = /^m1:([0-9a-fA-F]{8})$/;

/**
 * Generic over the seed KIND, so the invariant is proved rather than asserted.
 */
export class PRNG<S extends PrngSeed = PrngSeed> {
    private state: number;
    private isStringSeed: boolean;

    constructor(seed: S) {
        this.isStringSeed = typeof seed === 'string';
        if (typeof seed === 'string') {
            const match = CANONICAL_SEED_REGEX.exec(seed);
            if (match) {
                this.state = parseInt(match[1], 16) >>> 0;
            } else {
                this.state = cyrb53(seed) >>> 0;
            }
        } else {
            this.state = ((seed as unknown as number) >>> 0);
        }
    }

    private formatSeed(newState: number): S {
        return (this.isStringSeed
            ? `m1:${(newState >>> 0).toString(16).padStart(8, '0')}`
            : (newState >>> 0)) as S;
    }

    public next(): { value: number; nextSeed: S } {
        this.state = (this.state + 0x6D2B79F5) >>> 0;
        let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const uint32 = (t ^ (t >>> 14)) >>> 0;
        return {
            value: uint32 / 4294967296,
            nextSeed: this.formatSeed(this.state),
        };
    }

    public nextInt(min: number, max: number): { value: number; nextSeed: S } {
        const { value, nextSeed } = this.next();
        const range = max - min + 1;
        return {
            value: Math.floor(value * range) + min,
            nextSeed,
        };
    }

    public shuffle<T>(array: T[]): { shuffled: T[]; nextSeed: S } {
        const result = [...array];
        let currentSeed: S = this.formatSeed(this.state);

        for (let i = result.length - 1; i > 0; i--) {
            const { value: j, nextSeed } = new PRNG(currentSeed).nextInt(0, i);
            [result[i], result[j]] = [result[j], result[i]];
            currentSeed = nextSeed;
        }

        return {
            shuffled: result,
            nextSeed: currentSeed,
        };
    }
}
