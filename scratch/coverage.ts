/**
 * TICKET 110 follow-up — IS ANSWER COVERAGE ACTUALLY THE LEVER?
 *
 * The width probe measured that control's total debuff output is flat in body count, so coverage per
 * attacker collapses to ×0.29 at 3v3. That is a DIAGNOSIS, not a prescription: it says what is
 * different, not that fixing it would fix control. The only nearby data point argues the other way —
 * ticket 109's `tag-sidewide-burn` comp came mid-table at 45.8% — but that comp was side-wide DAMAGE,
 * and the quantity that divides is the DEBUFFS (Weakened ×0.37, Sharp ×0.36, Poison ×0.26 per body).
 * So it does not test this hypothesis at all.
 *
 * THE DESIGN. Three arms, all `panel-control` vs `panel-zoo` at 3v3, report-only (extras ride in the
 * scenario, never the registry - the ticket-109 rule):
 *
 *   BASE    control as it ships.
 *   SIDE    control + 2x `winters_grasp` + 2x `ink_cloud` - as PRINTED, target Side.
 *   SINGLE  the SAME four cards, with `target` flipped to 'Single' IN MEMORY.
 *
 * SIDE vs SINGLE is the measurement. Same cards, same costs, same power, same slots - the ONLY
 * difference is whether the answer reaches one attacker or three. BASE is there because adding four
 * good cards to a pile helps regardless of scope, and without it a SIDE-beats-BASE result proves
 * nothing. Mutating the registry in memory for an arm is the ticket-62 `BURN_CONFIG` precedent; the
 * committed values are untouched and restored at the end.
 *
 * WHAT EACH OUTCOME MEANS
 *   SIDE >> SINGLE   coverage IS the lever. Shape C is real, and the fix is a scope rule for answer
 *                    cards rather than more power.
 *   SIDE ~= SINGLE   coverage is NOT the lever - control's problem is that its answers are weak or
 *                    slow, not that they are narrow, and side-scoping is wasted design effort.
 *   both ~= BASE     control cannot be fixed with cards at all at this width, which points at the OS
 *                    layer or at the deck, and is the outcome that would most change the plan.
 *
 * Two copies of each extra is deliberate and now legal: Henry removed the copy cap on 2026-08-21.
 *
 * env: ITER=<n>  ARMS=BASE,SIDE,SINGLE  OUT=<path>
 * Run: ITER=30 AI_LITE=1 AI_BEAM=8 npx vite-node scratch/coverage.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { statusCensus, statusCensusReset } from '../src/engine/statusCensus';
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import fs from 'node:fs';
import { ENV } from './_env';

type Member = readonly [string, string];

const ZOO: Member[] = [
    ['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1'],
];
const CTL: Member[] = [
    ['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2'],
];

/** Side-scoped ANSWER cards that already exist in the pool - no new card design needed to test this. */
const EXTRAS = ['winters_grasp', 'winters_grasp', 'ink_cloud', 'ink_cloud'];

const ITER = Number(ENV.ITER ?? 30);
const ARMS = (ENV.ARMS ?? 'BASE,SIDE,SINGLE').split(',').filter(Boolean);
const OUT = ENV.OUT ?? '/root/probe/coverage.json';

/**
 * Flip the extras' target scope in memory. Returns a restore function.
 *
 * NOTE: mutate `ProgramRegistry`, NOT what `GetProgramData` returns - that call inflates a fresh copy
 * every time (`{...rawData, ...}`), so a mutation there is silently discarded and the arm reads
 * byte-identical to its control. Same family as the `isAttack` dead-schema trap.
 */
function setScope(scope: 'Side' | 'Single'): () => void {
    const saved: Array<[string, unknown]> = [];
    for (const id of new Set(EXTRAS)) {
        const data = ProgramRegistry[id] as unknown as Record<string, unknown>;
        saved.push([id, data.target]);
        data.target = scope;
    }
    return () => {
        for (const [id, prev] of saved) {
            (ProgramRegistry[id] as unknown as Record<string, unknown>).target = prev;
        }
    };
}

interface Row {
    arm: string; tier: string;
    /** ZOO's win rate - so LOWER is better for control. */
    zooWin: number;
    games: number; turns: number; truncated: number; ftk: number;
    dot: Record<string, number>;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => r.arm));

function runArm(arm: string): Row {
    let restore = () => { };
    let extras: string[] | undefined;
    if (arm === 'SIDE') { extras = EXTRAS; }
    if (arm === 'SINGLE') { extras = EXTRAS; restore = setScope('Single'); }
    try {
        statusCensusReset();
        const r = runPairedBatch(teamScenario({
            player: ZOO, enemy: CTL, enemyExtras: extras,
            seed: `coverage:${arm}`,
        }), { iterations: ITER });
        return {
            arm, tier: `${AI_TIER}/beam${ENV.AI_BEAM ?? 0}`,
            zooWin: r.pooled.decisiveWinRate, games: r.pooled.iterations,
            turns: +r.pooled.averageTurns.toFixed(2),
            truncated: r.pooled.truncatedCount, ftk: r.pooled.ftkCount,
            dot: { ...statusCensus.dotDamage },
        };
    } finally {
        restore();
    }
}

for (const arm of ARMS) {
    if (done.has(arm)) continue;
    const row = runArm(arm);
    rows.push(row);
    fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
    console.error(`${arm.padEnd(7)} ZOO win ${(row.zooWin * 100).toFixed(1)}%  ` +
        `(control wins ${(100 - row.zooWin * 100).toFixed(1)}%)  turns ${row.turns}  ` +
        `trunc ${row.truncated}  ftk ${row.ftk}  [${row.tier}]`);
}

const get = (a: string) => rows.find(r => r.arm === a);
const [b, s, g] = [get('BASE'), get('SIDE'), get('SINGLE')];
if (b && s && g) {
    console.error('\n=== the comparison that matters ===');
    console.error(`  BASE   control wins ${(100 - b.zooWin * 100).toFixed(1)}%`);
    console.error(`  SINGLE control wins ${(100 - g.zooWin * 100).toFixed(1)}%   (+${((b.zooWin - g.zooWin) * 100).toFixed(1)} from four extra cards)`);
    console.error(`  SIDE   control wins ${(100 - s.zooWin * 100).toFixed(1)}%   (+${((g.zooWin - s.zooWin) * 100).toFixed(1)} from SCOPE alone)`);
    console.error(`\n  scope is worth ${((g.zooWin - s.zooWin) * 100).toFixed(1)} points; the cards themselves are worth ${((b.zooWin - g.zooWin) * 100).toFixed(1)}.`);
}
console.error(`\n-> ${OUT}`);
