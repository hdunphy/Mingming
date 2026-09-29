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
 */
import { describe, expect, it } from 'vitest';

import { eaStarters, walkStarter } from './runWalker';
import { MODIFIERS } from '../../engine/run/modifiers/modifierRegistry';
import { MAX_TIER } from '../../engine/run/tiers/tierRegistry';
import { digest, firstEasierStep, formatLadder, ladderRow } from './tierLadderTable';
import type { RunDigest } from './tierLadderTable';

const LABEL = 'tier-ladder';
const SEEDS = Number(process.env.TIER_LADDER_SEEDS ?? 30);
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
