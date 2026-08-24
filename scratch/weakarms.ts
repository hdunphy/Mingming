/**
 * TICKET 114 — is control's problem the EFFECT of its debuffs, or the APPLICATION of them?
 *
 * `scratch/hitmath.ts` established that the per-card math Henry wanted already exists and is strong:
 * two Weakened halves a spam deck's output and five zeroes it, while a single big card barely
 * notices. So the effect is not the gap. This asks what is.
 *
 * THREE ARMS, at BOTH widths, same seeds — only the number of Weakened/Dazed stacks that enemy-facing
 * cards apply changes:
 *
 *   NONE      every enemy-facing Weakened/Dazed application set to 0 stacks.
 *             The value of the whole debuff axis: what does control lose without it?
 *   SHIPPED   as printed.
 *   DOUBLE    every such application doubled — Henry's proposed lever, "increase the number of
 *             stacks applied for debuffs", measured before it is designed.
 *
 * Buffs are untouched, and self-targeted applications are untouched: only debuffs aimed at an
 * opponent move, which is exactly the axis under discussion.
 *
 * WHAT EACH OUTCOME MEANS
 *   NONE ~= SHIPPED    the debuffs are barely doing anything even at 1v1. Their uptime or their
 *                      targeting is the problem, and more stacks will not fix a card that is not
 *                      being cast or is hitting the wrong body.
 *   DOUBLE >> SHIPPED  stacks ARE the lever, and the question becomes what it costs the 1v1 grid.
 *   DOUBLE ~= SHIPPED at 3v3 but not 1v1   coverage, not rate — one application still covers one of
 *                      three attackers however big it is, which is ticket 110's finding.
 *
 * Also censused: Weakened/Dazed stacks that actually LAND on the enemy side, per enemy body per turn.
 * A stacks-applied number that does not move between widths, next to a win rate that does, separates
 * "not enough applied" from "applied but spread too thin".
 *
 * env: ITER=<n>  ARMS=NONE,SHIPPED,DOUBLE  WIDTHS=1,3  OUT=<path>
 * Run: ITER=15 AI_BEAM=8 npx vite-node scratch/weakarms.ts
 */
import { runPairedBatch, type RunTelemetry } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import fs from 'node:fs';

type Member = readonly [string, string];

const ZOO: Member[] = [
    ['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1'],
];
const CTL: Member[] = [
    ['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2'],
];

/** The two duality debuffs that ride POWER, i.e. the ones that punish card spam. */
const DEBUFFS = new Set(['Weakened', 'Dazed']);
/** Action targets that mean "an enemy". Self/ally applications are left alone. */
const ENEMY_TARGETS = new Set(['TARGET', 'RANDOM_ENEMY', 'ENEMIES', 'OPPONENT']);

interface Touched { card: string; index: number; original: number }

/**
 * Scale every enemy-facing Weakened/Dazed application. Mutates `ProgramRegistry`, which is the
 * mutable source — `GetProgramData` inflates a fresh copy per call and would discard this silently,
 * a trap that has already cost one dead arm in this arc. Returns a restore function.
 */
function scaleDebuffs(factor: number): () => void {
    const touched: Touched[] = [];
    for (const [cardId, card] of Object.entries(ProgramRegistry)) {
        const actions = (card as unknown as { actions?: Array<Record<string, unknown>> }).actions;
        if (!actions) continue;
        actions.forEach((a, i) => {
            if (a.type !== 'STATUS' && a.type !== 'APPLY_STATUS') return;
            if (!DEBUFFS.has(String(a.status))) return;
            if (!ENEMY_TARGETS.has(String(a.target))) return;
            if (typeof a.stacks !== 'number') return;
            touched.push({ card: cardId, index: i, original: a.stacks });
            a.stacks = Math.round(a.stacks * factor);
        });
    }
    if (!touched.length) throw new Error('ARM DID NOT TAKE: no enemy-facing Weakened/Dazed applications found');
    return () => {
        for (const t of touched) {
            const actions = (ProgramRegistry[t.card] as unknown as { actions: Array<Record<string, unknown>> }).actions;
            actions[t.index].stacks = t.original;
        }
    };
}

const ITER = Number(process.env.ITER ?? 15);
const ARMS = (process.env.ARMS ?? 'NONE,SHIPPED,DOUBLE').split(',').filter(Boolean);
const WIDTHS = (process.env.WIDTHS ?? '1,3').split(',').map(Number);
const OUT = process.env.OUT ?? '/root/probe/weakarms.json';
const FACTOR: Record<string, number> = { NONE: 0, SHIPPED: 1, DOUBLE: 2 };

interface Row {
    arm: string; width: number; tier: string;
    /** CONTROL's win rate - control is the player side here, so higher is better for control. */
    ctlWin: number;
    games: number; turns: number; truncated: number;
    /** Weakened + Dazed stacks landed, per game and per enemy body per turn. */
    debuffLanded: number; debuffPerBodyPerTurn: number;
    cardsCount: number;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.arm}|${r.width}`));

const sumDebuffs = (t?: RunTelemetry): number => {
    let n = 0;
    for (const side of ['PLAYER', 'ENEMY'] as const)
        for (const byCard of Object.values(t?.[side].statuses ?? {}))
            for (const [status, stacks] of Object.entries(byCard))
                if (DEBUFFS.has(status)) n += stacks;
    return n;
};

for (const arm of ARMS) {
    for (const width of WIDTHS) {
        if (done.has(`${arm}|${width}`)) continue;
        const restore = arm === 'SHIPPED' ? () => { } : scaleDebuffs(FACTOR[arm]);
        try {
            const r = runPairedBatch(teamScenario({
                player: CTL.slice(0, width) as Member[],
                enemy: ZOO.slice(0, width) as Member[],
                seed: `weakarms:w${width}`,
            }), { iterations: ITER, telemetry: true });
            const games = r.pooled.iterations || 1;
            let landed = 0;
            for (const run of r.pooled.runs) landed += sumDebuffs(run.telemetry);
            const row: Row = {
                arm, width, tier: `${AI_TIER}/beam${process.env.AI_BEAM ?? 0}`,
                // CONTROL is the player side here, so `decisiveWinRate` IS control's rate.
                // (An earlier version inverted this and reported control winning 96.7% at 3v3,
                //  which contradicted every other measurement - the tell that it was a sign bug.)
                ctlWin: r.pooled.decisiveWinRate,
                games, turns: +r.pooled.averageTurns.toFixed(2),
                truncated: r.pooled.truncatedCount,
                debuffLanded: +(landed / games).toFixed(2),
                debuffPerBodyPerTurn: +(landed / games / width / r.pooled.averageTurns).toFixed(3),
                cardsCount: 0,
            };
            rows.push(row);
            fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
            console.error(`${arm.padEnd(8)} w${width}  CONTROL wins ${(row.ctlWin * 100).toFixed(1)}%  ` +
                `turns ${row.turns}  debuff stacks/game ${row.debuffLanded}  ` +
                `per body per turn ${row.debuffPerBodyPerTurn}`);
        } finally {
            restore();
        }
    }
}

console.error('\n=== what the debuff axis is worth to control ===');
for (const width of WIDTHS) {
    const g = (a: string) => rows.find(r => r.arm === a && r.width === width);
    const [none, ship, dbl] = [g('NONE'), g('SHIPPED'), g('DOUBLE')];
    if (!none || !ship) continue;
    console.error(`  width ${width}:  NONE ${(none.ctlWin * 100).toFixed(1)}%  ->  ` +
        `SHIPPED ${(ship.ctlWin * 100).toFixed(1)}%  (the debuffs are worth ` +
        `${((ship.ctlWin - none.ctlWin) * 100).toFixed(1)} points)` +
        (dbl ? `  ->  DOUBLE ${(dbl.ctlWin * 100).toFixed(1)}% ` +
            `(doubling adds ${((dbl.ctlWin - ship.ctlWin) * 100).toFixed(1)})` : ''));
}
console.error(`\n-> ${OUT}`);
