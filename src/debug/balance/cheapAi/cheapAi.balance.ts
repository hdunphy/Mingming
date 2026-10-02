/**
 * TICKET 177d — `npm run balance` entry for the cheap-AI measurement.
 *
 * It MEASURES and writes `docs/balance/cheap-ai-177.md`; it does not assert C2. The bar is read off
 * the report's verdict line, and a missed bar is a result, not a failure.
 *
 * The cost is large and says so: every tier plays hundreds of games against the full AI (a 3v3 game
 * costs the full AI up to two minutes), and the agreement and speed half replays recorded fights.
 * Set nothing and it runs everything in this one process. To split it over two cores, or to resume,
 * use `runCheapAiMeasure.ts` with a cache directory; this file reads the same cache if
 * `results/cheap-ai/measure` has been filled.
 */
import { describe, it } from 'vitest';
import { DEFAULT_OUT_DIR } from './recordTeacher';
import { runUnits, writeReport } from './cheapAiRun';

const CACHE = `${DEFAULT_OUT_DIR}/measure`;

describe('177d — the cheap AI against full, lite and greedy', () => {
    it('measures agreement, strength and speed, and writes docs/balance/cheap-ai-177.md', () => {
        runUnits({ cacheDir: CACHE });
        const path = writeReport({ cacheDir: CACHE });
        console.log(`[177d] wrote ${path}`);
    });
});
