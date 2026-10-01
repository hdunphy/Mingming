/**
 * TICKET 169j — every tier is harder than the one below it, and what each modifier does.
 *
 * Runs under `npm run balance`, not the unit gate: it walks whole runs. For each tier 0..3 it walks
 * every EA starter on the SAME seeds (label `tier-ladder`, 30 per starter), so the graph, the enemy
 * rolls and the offers are identical across tiers and the only thing that differs is the tier. The
 * seeds are fixed, so the assertion is deterministic rather than flaky.
 *
 * THE ASSERTION: mean fights won per run never rises from one tier to the next. If it fails, DO NOT
 * TUNE anything: the numbers are the finding, and they go to Henry. (A tier never scales a stat, so a
 * tier that is not harder is a fact about the ladder, not a knob to turn until it passes.)
 *
 * THE MODIFIER REPORT is print-only: tier 0 with each modifier alone, on the same seeds, against
 * tier 0 with none, with mean scrap unspent added. It asserts nothing; a modifier earns only a
 * label and is not required to be harder.
 *
 * Both print markdown tables to the console; `docs/balance/tier-ladder-169.md` records a run.
 *
 * Knobs, for a cheaper look (a full walk is tens of seconds, so 30 seeds x 12 starters x 4 tiers is
 * hours): `TIER_LADDER_SEEDS` (default 30), `TIER_LADDER_MODIFIER_SEEDS` (default: the same),
 * `TIER_LADDER_STARTERS` (a comma list of starter firmware ids; default all twelve).
 *
 * TICKET 170b adds `TIER_LADDER_GYM_SEEDS` (default 30): the gauntlet-only table below. Each starter
 * is walked to the gym gate once per seed with the ghost rule (`walkToGym`), and every tier then
 * plays the three gauntlet fights from that one snapshot, so only the tier differs. It asserts that
 * gauntlet fights won never rises from one tier to the next and that the top tier is not a wall
 * (`gauntletLadderProblem`). A full run is hours: each starter is its own test, so a timeout cannot
 * swallow the whole table; pass `--testTimeout` to `vitest` if a starter outlasts the 30 minutes.
 *
 * `BALANCE_CACHE_DIR` (see `walkCache.ts`) stores each starter-seed unit as it finishes, so the run
 * can be stopped and resumed, or split across processes by `TIER_LADDER_STARTERS` and then read
 * back whole. Use a fresh directory for every commit you measure.
 */
import { describe, expect, it } from 'vitest';

import { eaStarters, walkStarter } from './runWalker';
import { MODIFIERS } from '../../engine/run/modifiers/modifierRegistry';
import { MAX_TIER } from '../../engine/run/tiers/tierRegistry';
import {
    digest, firstEasierStep, formatGauntlet, formatLadder, formatProvenance, gauntletLadderProblem, gauntletRows, ladderRow, provenanceRow,
} from './tierLadderTable';
import type { GauntletDigest, RunDigest } from './tierLadderTable';
import { playGauntlet, walkToGym } from './ghostWalk';
import { cached, cacheDirFromEnv } from './walkCache';

const LABEL = 'tier-ladder';
/** 170b: the gauntlet-only table's own seeds, so it is not a second reading of the whole-run ladder's walks. */
const GYM_LABEL = 'tier-ladder-gym';
const SEEDS = Number(process.env.TIER_LADDER_SEEDS ?? 30);
const GYM_SEEDS = Number(process.env.TIER_LADDER_GYM_SEEDS ?? 30);
const MODIFIER_SEEDS = Math.min(Number(process.env.TIER_LADDER_MODIFIER_SEEDS ?? SEEDS), SEEDS);
const STARTERS = process.env.TIER_LADDER_STARTERS
    ? process.env.TIER_LADDER_STARTERS.split(',').map((s) => s.trim()).filter(Boolean)
    : eaStarters();

/** One configuration's walks, per starter and in seed order, so a smaller sample is a prefix of a larger one. */
type Walks = Map<string, RunDigest[]>;

function walkAll(seeds: number, tier: number, modifiers?: ReadonlyArray<string>): Walks {
    const out: Walks = new Map();
    for (const starter of STARTERS) {
        out.set(starter, walkStarter(starter, seeds, LABEL, false, undefined, tier, modifiers).map(digest));
    }
    return out;
}

const flat = (walks: Walks, first?: number): RunDigest[] =>
    [...walks.values()].flatMap((runs) => (first === undefined ? runs : runs.slice(0, first)));

const tierLabel = (tier: number): string => `Tier ${tier}`;

describe('169j — the tier ladder', () => {
    const byTier: Walks[] = [];

    it('mean fights won per run never rises from one tier to the next', () => {
        for (let tier = 0; tier <= MAX_TIER; tier += 1) byTier.push(walkAll(SEEDS, tier));

        const rows = byTier.map((walks, tier) => ladderRow(tierLabel(tier), flat(walks)));
        console.log(`\nTier ladder: ${STARTERS.length} starters x ${SEEDS} seeds, label "${LABEL}", no modifiers\n\n${formatLadder(rows)}\n`);

        const broken = firstEasierStep(rows);
        expect(
            broken,
            broken
                ? `${broken.to.label} is EASIER than ${broken.from.label}: ${broken.to.meanFightsWon.toFixed(2)} fights won against ${broken.from.meanFightsWon.toFixed(2)}. Do not tune; report the table.`
                : undefined,
        ).toBeNull();
    });

    it('modifier report (print only): tier 0 with each modifier alone', () => {
        // Tier 0 with none is the ladder's own first rung, restricted to the same seeds.
        const baseline = byTier[0] ?? walkAll(SEEDS, 0);
        const rows = [ladderRow('Tier 0, no modifier', flat(baseline, MODIFIER_SEEDS))];
        for (const modifier of MODIFIERS) {
            rows.push(ladderRow(`Tier 0, ${modifier.name}`, flat(walkAll(MODIFIER_SEEDS, 0, [modifier.id]))));
        }
        console.log(`\nModifier report: ${STARTERS.length} starters x ${MODIFIER_SEEDS} seeds, tier 0, one modifier at a time\n\n${formatLadder(rows, { scrap: true })}\n`);
        expect(rows).toHaveLength(MODIFIERS.length + 1);
    });
});

describe('170b — the gauntlet ladder', () => {
    /**
     * One starter on one seed: the walk to the gate, and what each tier did to that party. The
     * snapshot itself is not kept (it is large and only the gauntlets read it), so a unit is small
     * enough to cache. `missing` is a walk that never reached the gate.
     */
    type GymUnit = { missing: true } | { missing: false; ghostFights: number; realFightsWon: number; tiers: GauntletDigest[] };
    const byStarter = new Map<string, GymUnit[]>();
    const cacheDir = cacheDirFromEnv();

    for (const starter of STARTERS) {
        it(`${starter}: ${GYM_SEEDS} seeds walked to the gate, then every tier plays the gauntlet`, () => {
            const units: GymUnit[] = [];
            for (let i = 0; i < GYM_SEEDS; i += 1) {
                units.push(cached<GymUnit>(cacheDir, [GYM_LABEL, starter, i], () => {
                    const snapshot = walkToGym({ seed: `${GYM_LABEL}:${starter}:${i}`, starter, gymIndex: i % 3 });
                    if (!snapshot) return { missing: true };
                    const tiers: GauntletDigest[] = [];
                    for (let tier = 0; tier <= MAX_TIER; tier += 1) {
                        const result = playGauntlet(snapshot, tier);
                        tiers.push({ fightsWon: result.fightsWon, cleared: result.cleared });
                    }
                    return { missing: false, ghostFights: snapshot.ghostFights, realFightsWon: snapshot.realFightsWon, tiers };
                }));
            }
            byStarter.set(starter, units);
            expect(units).toHaveLength(GYM_SEEDS);
        });
    }

    it('gauntlet fights won never rises from one tier to the next, and Tier 3 is not a wall', () => {
        const reached = new Map<string, Array<Extract<GymUnit, { missing: false }>>>();
        let missing = 0;
        for (const starter of STARTERS) {
            const units = byStarter.get(starter) ?? [];
            reached.set(starter, units.filter((unit): unit is Extract<GymUnit, { missing: false }> => !unit.missing));
            missing += units.filter((unit) => unit.missing).length;
        }
        const parties = [...reached.values()].flat();
        const tierRows = gauntletRows(parties, (party, tier) => party.tiers[tier], MAX_TIER);

        const perStarter = STARTERS.map((starter) => {
            const rows = gauntletRows(reached.get(starter) ?? [], (party, tier) => party.tiers[tier], MAX_TIER);
            return `| ${starter} | ${rows[0].parties} | ${rows.map((row) => row.meanFightsWon.toFixed(2)).join(' | ')} |`;
        });
        console.log(
            `\nGauntlet only: ${STARTERS.length} starters x ${GYM_SEEDS} seeds, label "${GYM_LABEL}", one snapshot per seed shared by every tier\n\n${formatGauntlet(tierRows)}\n\n` +
            `${formatProvenance(provenanceRow(parties))}${missing > 0 ? ` ${missing} walks never reached the gate and are not in the table.` : ''}\n\n` +
            `Gauntlet fights won by starter (mean, 0-3)\n\n| Starter | Parties | ${tierRows.map((row) => row.label).join(' | ')} |\n| --- | --- | ${tierRows.map(() => '---').join(' | ')} |\n${perStarter.join('\n')}\n`,
        );

        const problem = gauntletLadderProblem(tierRows);
        expect(problem, problem ?? undefined).toBeNull();
    });
});
