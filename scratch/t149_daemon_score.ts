/**
 * TICKET 149 (3b) — DAEMONS and DRAW, the static half.
 *
 *   1. Daemon inventory: every `category: 'Daemon'` card, its hooks (trigger / when / source), which
 *      shipped deck runs it, its current powerscale score against its ceiling, and the per-proc
 *      score the scorer multiplies by `EXPECTED_DAEMON_PROCS = 4`.
 *   2. Play-turn pricing: given a measured proc rate per turn-alive (from `t149_daemon_procs.ts`, passed
 *      as `--rates results/t149_daemons/rates.json`) and a mean game length, the score at cast turns
 *      1/2/3 = perProc x rate x (gameLen - castTurn) x 1.5 (daemon premium) x 0.9 (exhaust).
 *   3. DRAW value: mean powerscale score of a card in each shipped deck (what one draw is worth
 *      there) vs the flat 1.5 (= DRAW 15 power / 10) the scorer charges for the first draw.
 *   4. The `score === 0` guard: score an in-memory daemon carrying both an on-cast action and a hook.
 *
 * Run: npx vite-node scratch/t149_daemon_score.ts -- --rates results/t149_daemons/rates.json
 */
import fs from 'node:fs';
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry, GetProgramData } from '../src/engine/data/programRegistry';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import HOOKS from '../src/engine/data/lib/hooks.json';
import type { ProgramData } from '../src/engine/types';
import { arg } from './_env';

const RATES = arg('rates', '');
const OUT = arg('out', 'results/t149_daemons/score.md');

type HookDef = { id: string; trigger: string; when?: Record<string, unknown>; do?: Array<{ type: string }>; multiplier?: number; scaling?: string };
const hookById = new Map<string, HookDef>();
for (const entry of Object.values(HOOKS as Record<string, { hooks?: HookDef[] }>))
    for (const h of entry.hooks ?? []) hookById.set(h.id, h);

const decks: Record<string, string[]> = {};
for (const m of Object.values(MingmingRegistry) as Array<{ availableOS?: string[]; decks?: Record<string, string[]> }>)
    for (const os of m.availableOS ?? []) if (m.decks?.[os]) decks[os] = m.decks[os];

type Raw = ProgramData & { baseCost: number; hooks?: string[] };
const daemons = Object.values(ProgramRegistry as unknown as Record<string, Raw>).filter(c => c.category === 'Daemon');

const lines: string[] = [];
const say = (s = ''): void => { lines.push(s); console.log(s); };

// ---- 1. inventory -------------------------------------------------------------------------------
say('## 1. Daemon inventory (programs.json, category Daemon)');
say();
say('| id | cost | ceiling | score | per-proc | hook id | trigger | when | shipped decks | shape |');
say('|---|---|---|---|---|---|---|---|---|---|');
interface Inv { id: string; cost: number; ceiling: number; score: number; perProc: number; triggers: string[] }
const inv: Inv[] = [];
for (const d of daemons) {
    const r = calculatePowerscale(d);
    const ceiling = budgetBandFor(d.baseCost).over;
    const hooks = (d.hooks ?? []).map(id => hookById.get(id)).filter((h): h is HookDef => !!h);
    const inDecks = Object.entries(decks).filter(([, c]) => c.includes(d.id)).map(([k]) => k).join(', ') || '—';
    // per-proc = the hook `do` scored as a Skill, i.e. score / (4 * 1.5 * 0.9) for hook-only daemons.
    const perProc = d.actions.length === 0 && r.score > 0 ? r.score / (4 * 1.5 * 0.9) : 0;
    const shape = d.actions.length > 0 ? `own actions: ${d.actions.map(a => a.type).join(',')}`
        : hooks.every(h => h.do === undefined) ? 'modifier (no `do`) - scores 0' : 'hook `do`';
    const hookCells = hooks.map(h => `${h.id} | ${h.trigger} | ${JSON.stringify(h.when ?? {})}`);
    say(`| ${d.id} | ${d.baseCost}e | ${ceiling} | ${r.score.toFixed(1)} | ${perProc.toFixed(2)} | ${hookCells.join('<br>') || '— (no hooks)'} | ${inDecks} | ${shape} |`);
    inv.push({ id: d.id, cost: d.baseCost, ceiling, score: r.score, perProc, triggers: hooks.map(h => h.trigger) });
}
say();
say('Score = perProc x 4 (EXPECTED_DAEMON_PROCS) x 1.5 (Daemon premium) x 0.9 (exhaust); ceiling = BUDGET_BANDS[cost].over.');

// ---- 2/3. play-turn pricing ---------------------------------------------------------------------
if (RATES && fs.existsSync(RATES)) {
    type Rate = { rate: number; gameLen: number; n: number; width: number; note?: string };
    const rates = JSON.parse(fs.readFileSync(RATES, 'utf8')) as Record<string, Rate[]>;
    say();
    say('## 3. Play-turn pricing: perProc x rate x (gameLen - castTurn) x 1.5 x 0.9');
    say();
    say('| daemon | width | rate/turn-alive (n unit-turns) | game len | per-proc | t1 | t2 | t3 | ceiling | band (0.8-1.0x) at t3? | shipped |');
    say('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const d of inv) {
        const rows = (rates[d.id] ?? []).filter(r => !(r.width === 1 && r.note?.startsWith('pool')))
            .sort((a, b) => (Number(!/^(field|pool)/.test(a.note ?? '')) - Number(!/^(field|pool)/.test(b.note ?? ''))) || (a.note ?? '').localeCompare(b.note ?? '') || a.width - b.width);
        for (const r of rows) { // 1v1 pool is owner-deck-weighted; the field row is the clean one
            const at = (t: number): number => d.perProc * r.rate * Math.max(0, r.gameLen - t) * 1.5 * 0.9;
            const t3 = at(3);
            const band = t3 >= 0.8 * d.ceiling && t3 <= d.ceiling ? 'yes' : t3 > d.ceiling ? `over (${(t3 / d.ceiling).toFixed(2)}x)` : `under (${(t3 / d.ceiling).toFixed(2)}x)`;
            say(`| ${d.id} | ${r.width}v${r.width} | ${r.rate.toFixed(3)} (${r.n}) | ${r.gameLen.toFixed(2)} | ${d.perProc.toFixed(2)} | ${at(1).toFixed(2)} | ${at(2).toFixed(2)} | ${t3.toFixed(2)} | ${d.ceiling} | ${band} | ${d.score.toFixed(1)}${r.note ? ` (${r.note})` : ''} |`);
        }
    }
}

// ---- 4. DRAW value -------------------------------------------------------------------------------
say();
say('## 4. DRAW: what a card in each shipped deck scores (= what one draw is worth there) vs the flat 1.5');
say();
say('| deck | cards | mean score | median | mean 0e-card score | mean cost | draw-1 charge | ratio (mean/1.5) |');
say('|---|---|---|---|---|---|---|---|');
const deckRows: Array<{ deck: string; mean: number }> = [];
for (const [deck, ids] of Object.entries(decks).sort()) {
    const scores = ids.map(id => calculatePowerscale(GetProgramData(id)).score);
    const costs = ids.map(id => Number((GetProgramData(id) as Raw).baseCost) || 0);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mcost = costs.reduce((a, b) => a + b, 0) / costs.length;
    const zero = ids.filter((_, i) => costs[i] === 0).map(id => calculatePowerscale(GetProgramData(id)).score);
    const zmean = zero.length ? zero.reduce((a, b) => a + b, 0) / zero.length : NaN;
    deckRows.push({ deck, mean });
    say(`| ${deck} | ${ids.length} | ${mean.toFixed(2)} | ${median.toFixed(2)} | ${zero.length ? zmean.toFixed(2) + ' (' + zero.length + ')' : '—'} | ${mcost.toFixed(2)} | 1.5 | ${(mean / 1.5).toFixed(2)} |`);
}
const all = deckRows.map(r => r.mean);
say(`| **all decks** | ${deckRows.length} | ${(all.reduce((a, b) => a + b, 0) / all.length).toFixed(2)} | | | | 1.5 | ${(all.reduce((a, b) => a + b, 0) / all.length / 1.5).toFixed(2)} |`);
say();
say('Cards drawing more than one (whole pool):');
say();
say('| card | cost | draw | score | ceiling | decks |');
say('|---|---|---|---|---|---|');
for (const c of Object.values(ProgramRegistry as unknown as Record<string, Raw>)) {
    const n = (c.actions ?? []).filter(a => a.type === 'DRAW').reduce((s, a) => s + ((a as { amount?: number }).amount ?? (a as { count?: number }).count ?? 1), 0);
    if (n <= 1) continue;
    const inDecks = Object.entries(decks).filter(([, d]) => d.includes(c.id)).map(([k]) => k).join(', ') || '—';
    say(`| ${c.id} | ${c.baseCost}e | ${n} | ${calculatePowerscale(c).score.toFixed(1)} | ${budgetBandFor(c.baseCost).over} | ${inDecks} |`);
}
// the ticket-131 whirlpool_v2 case
const wp = ProgramRegistry['whirlpool_v2'] as unknown as Raw;
const wpArm: Raw = { ...wp, actions: [{ type: 'DRAW', amount: 2, target: 'SELF' }, { type: 'STATUS', status: 'Dazed', stacks: 1, target: 'TARGET' }] } as Raw;
say();
say(`whirlpool_v2 shipped (8 power, draw 1, 2 Dazed): score ${calculatePowerscale(wp).score.toFixed(2)}; arm "draw 2, 1 Dazed, no power": ${calculatePowerscale(wpArm).score.toFixed(2)}; ceiling ${budgetBandFor(wp.baseCost).over}`);

// ---- 5. the score === 0 guard --------------------------------------------------------------------
say();
say('## 5. `score === 0` guard (powerscale.ts L959)');
say();
const fl = ProgramRegistry['feedback_loop_daemon'] as unknown as Raw;
const hookOnly = calculatePowerscale(fl).score;
const withAction: Raw = { ...fl, id: 't149_probe_daemon', actions: [{ type: 'ATTACK', power: 10, target: 'TARGET' }] } as Raw;
const both = calculatePowerscale(withAction).score;
const actionOnly = calculatePowerscale({ ...withAction, hooks: [] } as Raw).score;
say(`feedback_loop_daemon as shipped (hook only): ${hookOnly.toFixed(2)}`);
say(`same daemon + an on-cast ATTACK 10: ${both.toFixed(2)}`);
say(`the on-cast ATTACK alone, no hook: ${actionOnly.toFixed(2)}`);
say(both < hookOnly ? `=> CONFIRMED: adding an on-cast action DROPS the score by ${(hookOnly - both).toFixed(2)} - the hook value is lost because score !== 0 skips the hook branch.` : '=> guard not reproduced');
const bp = ProgramRegistry['battery_pack'] as unknown as Raw;
say(`battery_pack (own ENERGY action, no hooks): ${calculatePowerscale(bp).score.toFixed(2)} - unaffected today because it has no hook, but it is the shape the guard would break.`);

fs.mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.error(`-> ${OUT}`);
