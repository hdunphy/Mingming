/**
 * TICKET 170c — where the walker dies. A REPORT, not a check: it prints the death tables and
 * asserts only that every seed was walked.
 *
 * Every EA starter, 30 seeds each, at tier 0 with no modifiers and WITHOUT the ghost rule (a lost
 * fight ends the walk, as it does in every other measurement). The seeds are the tier ladder's own
 * (`tier-ladder:<starter>:<i>`), so a walk here is the same walk as the ladder's Tier 0 row.
 *
 * Knobs, as in `tierLadder.balance.ts`: `WALKER_DEATHS_SEEDS` (default 30), `TIER_LADDER_STARTERS`
 * (a comma list; default all twelve) and `BALANCE_CACHE_DIR` (`walkCache.ts`; use a fresh directory
 * for every commit you measure). `docs/balance/walker-deaths-170.md` records a run and reads it.
 */
import { describe, expect, it } from 'vitest';

import { eaStarters, walkRun } from './runWalker';
import { cached, cacheDirFromEnv } from './walkCache';
import { deathDigest, formatDeathReport } from './walkerDeaths';
import type { DeathDigest } from './walkerDeaths';

const LABEL = 'tier-ladder';
const SEEDS = Number(process.env.WALKER_DEATHS_SEEDS ?? 30);
const STARTERS = process.env.TIER_LADDER_STARTERS
    ? process.env.TIER_LADDER_STARTERS.split(',').map((s) => s.trim()).filter(Boolean)
    : eaStarters();

describe('170c — where the walker dies', () => {
    const byStarter = new Map<string, DeathDigest[]>();
    const cacheDir = cacheDirFromEnv();

    for (const starter of STARTERS) {
        it(`${starter}: ${SEEDS} real walks, no ghost rule`, () => {
            const digests: DeathDigest[] = [];
            for (let i = 0; i < SEEDS; i += 1) {
                digests.push(cached<DeathDigest>(cacheDir, ['walker-deaths', starter, i], () =>
                    deathDigest(walkRun({ seed: `${LABEL}:${starter}:${i}`, starter, gymIndex: i % 3, reportLeftovers: true }))));
            }
            byStarter.set(starter, digests);
            expect(digests).toHaveLength(SEEDS);
        });
    }

    it('prints the death report', () => {
        const digests = STARTERS.flatMap((starter) => byStarter.get(starter) ?? []);
        console.log(`\nWalker deaths: ${STARTERS.length} starters x ${SEEDS} seeds, tier 0, no modifiers, no ghost rule, label "${LABEL}"\n\n${formatDeathReport(digests)}\n`);
        expect(digests).toHaveLength(STARTERS.length * SEEDS);
    });
});
