/**
 * THE GYM GAUNTLET'S BOSS TEAMS, GATED — ticket 18's Done-when.
 *
 * > "FTK/stall gates hold for the boss comps (`teamComps.ts` reused)."
 *
 * Every team the boss draw can produce (`teamComps.BOSS_COMPS` — all eight of them, which is the
 * whole space rather than a sample) is run against the six-comp reference panel, and two redlines
 * from `docs/balance_testing.md` are asserted on the pooled result:
 *
 * - **FTK (§2.1's rule, applied here):** a boss team must not kill on turn one before the player has
 *   acted. It matters more at the gym than anywhere else in the run: the player arrives on carried
 *   HP with no heal between the three fights, so a turn-one kill is a run ended by the draw.
 * - **STALL (§2.2: "if turns > 30, the archetype is too slow/stalling"):** `boss_relic_water` heals
 *   the whole boss side 5% max HP whenever any of them is hit, which is an anti-damage engine that
 *   scales with how hard the player swings. Three bodies behind it is the unkillable shape.
 *
 * **The first smoke run said something worth chasing.** One paired seed per matchup against the
 * whole panel (12 battles, `boss-fenrir-kraken-ratatoskr`): **FTK 0, no stalls, average 4.6 turns —
 * and the boss team won 12 of 12.** The sample is far too small to be a number, but it is the right
 * shape to point a real measurement pass at: three tuned decks behind three signature relics, versus
 * a panel comp holding no drivers, may simply be over the line. Flagged for ticket 25's playtest and
 * for ticket 28, which authors the leaders these placeholders stand in for.
 *
 * The win rate is **printed, not redlined**, and that is deliberate. §2.2's 70% cap is stated about
 * an archetype measured against the field; a gym boss is *supposed* to beat the reference panel more
 * often than it loses — it is the run's final exam, fought by a party that has already spent two
 * fights' worth of HP that this harness cannot model (`ComposedSetup` has no gauntlet HP carry, and
 * inventing one would make the number mean something else again). Capping it here would flag the
 * design as a bug. What the number is for is the diff: ticket 25's playtest reads it next to what
 * players actually report.
 *
 * # WHAT THIS SUITE COSTS, AND WHY THE SEED COUNT IS SMALL
 *
 * A 3v3 battle in this harness costs **~300x a 1v1 one** (measured while writing this: ~60ms for a
 * 1v1 base-deck battle, ~20s for a 3v3 one — `TacticalAI` searches every living caster against every
 * card in a 27-card shared pile, and the cost is combinatorial in party size). That is a property of
 * ticket 98's team harness, not of anything ticket 18 added, but it decides the shape of this file:
 * at the mirror suite's 200 seeds this would be a multi-day run.
 *
 * So the defaults are deliberately modest — `SEEDS` paired seeds per matchup, eight boss comps
 * against six panel comps, i.e. `8 x 6 x 2 x SEEDS` battles — and both knobs are env-overridable so
 * a real measurement pass can buy more sample without editing the file. Note the balance config's
 * **per-test** timeout is 30 minutes and each boss comp is one test (`6 x 2 x SEEDS` battles), which
 * is what the default is sized against:
 *
 *   npm run balance                                   # everything, including this
 *   npx vitest run --config vitest.balance.config.ts src/debug/balance/gauntlet-boss.balance.ts
 *   GAUNTLET_BOSS_SEEDS=20 npx vitest run --config vitest.balance.config.ts src/debug/balance/gauntlet-boss.balance.ts
 *   GAUNTLET_BOSS_ONLY=boss-skoll-jormungandr-huldra ... # one comp, for a fast repro
 *
 * # WHY IT DOES NOT RECORD INTO THE AUDITOR
 *
 * `balanceReport.SuiteId` is a closed union of the three suites `EXPECTED_SUITES` demands a fragment
 * from, and the auditor treats a missing one as a broken run. Adding a fourth suite id would make
 * every scoped `BALANCE_ONLY` run expect a report section from a suite it did not run. This file
 * therefore asserts and prints locally; folding it into the committed report is a change to the
 * auditor's contract and belongs with whoever makes that call.
 */

import { afterAll, describe, expect, it } from 'vitest';

import { teamScenario } from './balanceScenarios';
import { quietly, summarizeBatch } from './balanceReporting';
import { MATCHUP_THRESHOLDS } from './balanceReport';
import { aggregate, runPairedBatch, type RunResult } from './runBatch';
import { BOSS_COMPS, REFERENCE_PANEL, type Comp } from './teamComps';

/**
 * Paired seeds per matchup — so 2 x SEEDS battles per (boss, panel) pair, since each pair is run
 * under both turn orders and pooled. See the cost note in the header before raising it.
 */
const SEEDS = Number.parseInt(process.env.GAUNTLET_BOSS_SEEDS ?? '', 10) || 3;

/**
 * Battle length cap. Above §2.2's 30-turn stall redline on purpose: a cap *at* the redline would
 * truncate every stalling matchup at exactly the number the assertion reads, so a stall would show
 * up as "averageTurns = 30" whether it was 31 turns long or unwinnable.
 */
const MAX_TURNS = 40;

/** `GAUNTLET_BOSS_ONLY=id,id` scopes the run to named boss comps, for a fast repro. */
const only = (process.env.GAUNTLET_BOSS_ONLY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const COMPS: ReadonlyArray<Comp> = only.length === 0
    ? BOSS_COMPS
    : BOSS_COMPS.filter((comp) => only.includes(comp.id));

/** §2.2: "If turns > 30, the archetype is too slow/stalling (unfun)." */
const STALL_TURN_LIMIT = MATCHUP_THRESHOLDS.stallTurnLimit;

const lines: string[] = [];

/**
 * One boss comp against the whole panel, pooled.
 *
 * Pooled rather than asserted per matchup for the archetype gauntlet's reason: a redline on a single
 * matchup would flag intentional rock-paper-scissors as a bug, and a boss team is *meant* to be
 * lopsided against some panel comps. FTK is the exception — a turn-one kill is a redline wherever it
 * happens — so it is counted across every run rather than averaged.
 */
function runBossComp(boss: Comp) {
    const runs: RunResult[] = [];

    for (const panel of REFERENCE_PANEL) {
        const setup = teamScenario({
            // The boss team is the ENEMY side, which is where it sits in the game. It matters:
            // `runPairedBatch` swaps who moves first, but the deck flattening and the AI are the
            // same either way, so the only thing this fixes is which side the printed win rate is
            // about — the player's.
            player: panel.members,
            enemy: boss.members,
            playerExtras: panel.extras,
            seed: `gauntlet-boss:${boss.id}-vs-${panel.id}`,
        });

        const paired = quietly(() => runPairedBatch(setup, { iterations: SEEDS, maxTurns: MAX_TURNS }));
        runs.push(...paired.pooled.runs);
        lines.push(summarizeBatch(`${boss.id} vs ${panel.id}`, paired.pooled));
    }

    return aggregate(runs);
}

// Printed in `afterAll` so a red gate still reports its numbers — a batch that only ever existed
// inside a failed test is invisible in the diff the report exists to produce.
afterAll(() => {
    if (lines.length > 0) {
        console.log(`\n--- gym gauntlet boss comps (${SEEDS} paired seeds, max ${MAX_TURNS} turns) ---`);
        for (const line of lines) console.log(line);
    }
});

describe('gym gauntlet boss comps (ticket 18)', () => {
    it('there are eight of them, and they are the whole boss space', () => {
        // 2x2x2: two launch species per element, one drawn per biome, every run walking all three
        // elements (`gyms.offerGyms` rule 3). A ninth entry here means the draw changed and this
        // gate stopped covering it.
        expect(BOSS_COMPS).toHaveLength(8);
        for (const comp of BOSS_COMPS) {
            expect(comp.members).toHaveLength(3);
            for (const [, os] of comp.members) expect(os.startsWith('boss_relic_')).toBe(true);
            // Three distinct signatures per team — `gauntlet.bossFirmwareFor`'s de-duplication.
            expect(new Set(comp.members.map(([, os]) => os)).size).toBe(3);
        }
    });

    it.each([...COMPS])('$id: never kills on turn one, and does not stall the fight out', (boss) => {
        const pooled = runBossComp(boss);

        // FTK: the gym is the one fight a player cannot re-enter on full HP, so a turn-one kill is
        // the run ended by the draw rather than by the fight.
        expect(
            pooled.ftkCount,
            `${boss.id} scored ${pooled.ftkCount} first-turn kills in ${pooled.iterations} battles`,
        ).toBe(0);

        // Stall: `boss_relic_water` heals the boss side on every hit it takes. An unkillable final
        // exam is the failure mode this comp set exists to watch.
        expect(
            pooled.averageTurns,
            `${boss.id} averaged ${pooled.averageTurns.toFixed(1)} turns against the panel`,
        ).toBeLessThanOrEqual(STALL_TURN_LIMIT);
    });
});
