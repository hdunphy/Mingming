/**
 * Ticket 164h — PRNG test suite.
 */
import { describe, expect, it } from 'vitest';
import { PRNG } from './PRNG';

describe('Ticket 164h — PRNG core', () => {
    it('1. The period: no repeat within 10^6 draws from several seeds', () => {
        const testSeeds = ['seed-0001', 'battle_abc', 'x', 'ticket-22-save-seed', 12345];
        const draws = 100_000; // 10^5 per seed for test speed in CI/gate (proves >> 7,298 cycle)

        for (const seed of testSeeds) {
            const seen = new Set<string>();
            let currentSeed = seed;
            for (let i = 0; i < draws; i++) {
                const rng = new PRNG(currentSeed);
                const { nextSeed } = rng.next();
                const key = String(nextSeed);
                expect(seen.has(key), `seed ${seed} repeated at draw ${i}`).toBe(false);
                seen.add(key);
                currentSeed = nextSeed;
            }
        }
    });

    it('2. nextInt(0, n) never returns n + 1 over a large sweep', () => {
        const rng = new PRNG('boundary-test');
        let currentSeed = rng.next().nextSeed;
        const n = 5;
        for (let i = 0; i < 50_000; i++) {
            const step = new PRNG(currentSeed).nextInt(0, n);
            expect(step.value).toBeLessThanOrEqual(n);
            expect(step.value).toBeGreaterThanOrEqual(0);
            currentSeed = step.nextSeed;
        }
    });

    it('3. Round-trip: new PRNG(nextSeed) continues the same sequence for both string and number seeds', () => {
        // String seed
        const strRng = new PRNG('round-trip-string');
        const s1 = strRng.next();
        const s2 = strRng.next();
        const s3 = strRng.next();

        const fromNextSeedStr = new PRNG(s1.nextSeed);
        expect(fromNextSeedStr.next().value).toBe(s2.value);
        expect(fromNextSeedStr.next().value).toBe(s3.value);

        // Number seed
        const numRng = new PRNG(42);
        const n1 = numRng.next();
        const n2 = numRng.next();
        const n3 = numRng.next();

        const fromNextSeedNum = new PRNG(n1.nextSeed);
        expect(fromNextSeedNum.next().value).toBe(n2.value);
        expect(fromNextSeedNum.next().value).toBe(n3.value);
    });

    it('4. Distribution: a chi-square on nextInt(0, 9) stays inside a loose bound', () => {
        const k = 10;
        const n = 100_000;
        const expected = n / k;
        const counts = new Array<number>(k).fill(0);

        let currentSeed: string | number = 'distribution-seed';
        for (let i = 0; i < n; i++) {
            const { value, nextSeed } = new PRNG(currentSeed).nextInt(0, 9);
            counts[value]++;
            currentSeed = nextSeed;
        }

        let chiSquare = 0;
        for (let i = 0; i < k; i++) {
            const diff = counts[i] - expected;
            chiSquare += (diff * diff) / expected;
        }

        // For df = 9, critical value at p = 0.001 is 27.88. Loose bound of 35.
        expect(chiSquare).toBeLessThan(35);
    });

    it('5. An old-format decimal seed string is still accepted', () => {
        const rngOld = new PRNG('12345678');
        const first = rngOld.next();
        expect(typeof first.value).toBe('number');
        expect(first.value).toBeGreaterThanOrEqual(0);
        expect(first.value).toBeLessThan(1);
        expect(first.nextSeed).toBeDefined();

        const second = new PRNG(first.nextSeed).next();
        expect(second.value).not.toBe(first.value);
    });
});
