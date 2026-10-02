/**
 * TICKET 149 (3a) — fold `t149_width.ts` rows into the per-card table.
 * Run: npx vite-node scratch/t149_width_report.ts -- --dir results/t149_width
 */
import fs from 'node:fs';
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';
import { arg } from './_env';

const DIR = arg('dir', 'results/t149_width');
const ICE = ['frost_bite', 'numbing_gale', 'killing_frost', 'rimefrost', 'ice_spear'];

interface Tally { casts: number; damage: number; stacks: Record<string, number>; seen: number; handEntries: number }
interface Row { width: number; arm: string; owner: string; opponent: string; games: number; decisive: number; win: number; turns: number; truncated: number; cards: Record<string, Tally> }

const load = (f: string): Row[] => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as Row) : [];

interface Agg { cells: number; games: number; decisive: number; wins: number; winMean: number; turns: number; cards: Record<string, Tally> }
function agg(rows: Row[]): Agg {
    const cards: Record<string, Tally> = {};
    let games = 0, decisive = 0, wins = 0, winSum = 0, turns = 0;
    for (const r of rows) {
        games += r.games; decisive += r.decisive; wins += r.win * r.decisive; winSum += r.win; turns += r.turns * r.games;
        for (const [id, t] of Object.entries(r.cards)) {
            const c = cards[id] ?? (cards[id] = { casts: 0, damage: 0, stacks: {}, seen: 0, handEntries: 0 });
            c.casts += t.casts; c.damage += t.damage; c.seen += t.seen; c.handEntries += t.handEntries;
            for (const [s, n] of Object.entries(t.stacks)) c.stacks[s] = (c.stacks[s] ?? 0) + n;
        }
    }
    return { cells: rows.length, games, decisive, wins, winMean: rows.length ? winSum / rows.length : NaN, turns: games ? turns / games : NaN, cards };
}
const pct = (x: number) => Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : 'n/a';
/** Wilson-ish 95% half-width on a proportion. */
const ci = (p: number, n: number) => n > 0 ? 1.96 * Math.sqrt(p * (1 - p) / n) : NaN;
const perCast = (t: Tally | undefined) => {
    if (!t || !t.casts) return { dmg: NaN, stacks: NaN, casts: 0 };
    const st = Object.values(t.stacks).reduce((a, b) => a + b, 0);
    return { dmg: t.damage / t.casts, stacks: st / t.casts, casts: t.casts };
};
const f1 = (x: number) => Number.isFinite(x) ? x.toFixed(1) : 'n/a';
const f2 = (x: number) => Number.isFinite(x) ? x.toFixed(2) : 'n/a';

const out: string[] = [];
const say = (s = '') => { out.push(s); console.log(s); };

// ---- scorer ----
say('## Scorer: Side vs Single');
say('');
say('| card | cost | ceiling | score Side | score Single | scorer ratio | Side vs ceiling | Single vs ceiling |');
say('|---|---|---|---|---|---|---|---|');
const scorer: Record<string, { side: number; single: number; ceiling: number; cost: number }> = {};
for (const id of [...ICE, 'ink_cloud', 'spreading_rot', 'tidal_battery']) {
    const raw = ProgramRegistry[id] as unknown as ProgramData & { baseCost: number };
    const side = calculatePowerscale(raw).score;
    const single = calculatePowerscale({ ...raw, target: 'Single' } as ProgramData).score;
    const ceiling = budgetBandFor(raw.baseCost).over;
    scorer[id] = { side, single, ceiling, cost: raw.baseCost };
    say(`| ${id} | ${raw.baseCost}e | ${ceiling} | ${f1(side)} | ${f1(single)} | ${f2(side / single)} | ${((side / ceiling - 1) * 100).toFixed(0)}% | ${((single / ceiling - 1) * 100).toFixed(0)}% |`);
}

for (const [label, file, owner] of [['1v1 (draugr_v2 vs 30-opponent field)', `${DIR}/w1.jsonl`, 'draugr_v2'], ['1v1 (ymir_v1 vs field, ice_spear only)', `${DIR}/w1_ymir.jsonl`, 'ymir_v1'], ['3v3 (control_d = huldra_v2+draugr_v2+jormungandr_v2 vs panel)', `${DIR}/w3.jsonl`, 'x']] as const) {
    const rows = load(file);
    if (!rows.length) { say(`\n## ${label}\n\n(no rows yet)`); continue; }
    const arms = [...new Set(rows.map(r => r.arm))];
    say(`\n## ${label}`);
    say('');
    say('| arm | cells | games | decisive | field win (mean of cells) | pooled win | ±95% | turns |');
    say('|---|---|---|---|---|---|---|---|');
    const A: Record<string, Agg> = {};
    for (const arm of arms) {
        const a = agg(rows.filter(r => r.arm === arm)); A[arm] = a;
        say(`| ${arm} | ${a.cells} | ${a.games} | ${a.decisive} | ${pct(a.winMean)} | ${pct(a.wins / a.decisive)} | ±${pct(ci(a.wins / a.decisive, a.decisive))} | ${f2(a.turns)} |`);
    }
    // per-card, per-cast effect under each arm
    say('');
    say('| card | arm | casts | dmg/cast | stacks/cast | cast rate (played/handEntries) |');
    say('|---|---|---|---|---|---|');
    for (const id of ICE) {
        for (const arm of arms) {
            const t = A[arm].cards[id]; const p = perCast(t);
            if (!t) continue;
            say(`| ${id} | ${arm} | ${p.casts} | ${f1(p.dmg)} | ${f2(p.stacks)} | ${t.handEntries ? pct(t.casts / t.handEntries) : 'n/a'} |`);
        }
    }
    // per-card field ratio: SHIPPED (Side) vs SINGLE:<card> and vs SINGLE_ALL
    const ship = A.SHIPPED;
    if (ship) {
        say('');
        say('| card | field Side (SHIPPED) | field Single (SINGLE:card) | Δ pts | ratio Side/Single | field Single (SINGLE_ALL) | dmg/cast Side | dmg/cast Single | dmg ratio | stacks/cast Side | stacks/cast Single | stacks ratio |');
        say('|---|---|---|---|---|---|---|---|---|---|---|---|');
        for (const id of ICE) {
            const one = A[`SINGLE:${id}`]; const all = A.SINGLE_ALL;
            const single = one ?? all; const tag = one ? '' : ' (from SINGLE_ALL)';
            if (!single) continue;
            const s = perCast(ship.cards[id]); const g = perCast(single.cards[id]);
            say(`| ${id} | ${pct(ship.winMean)} | ${pct(single.winMean)}${tag} | ${((ship.winMean - single.winMean) * 100).toFixed(1)} | ${f2(ship.winMean / single.winMean)} | ${all ? pct(all.winMean) : 'n/a'} | ${f1(s.dmg)} | ${f1(g.dmg)} | ${f2(s.dmg / g.dmg)} | ${f2(s.stacks)} | ${f2(g.stacks)} | ${f2(s.stacks / g.stacks)} |`);
        }
        void owner;
    }
}
// ---- 3v3 per-card arms, ink_loop cell only (the most discriminating cell), against the SHIPPED
// and SINGLE_ALL ink_loop cells from the main 3v3 file.
{
    const main = load(`${DIR}/w3.jsonl`).filter(r => r.opponent === 'kraken_v1+jormungandr_v1+huldra_v2');
    const per = load(`${DIR}/w3_percard.jsonl`);
    if (per.length) {
        say('\n## 3v3 per-card arms — ink_loop cell only (control_d vs kraken_v1+jormungandr_v1+huldra_v2)');
        say('');
        say('| arm | games | win | ±95% | turns | flipped card casts | dmg/cast | stacks/cast |');
        say('|---|---|---|---|---|---|---|---|');
        for (const r of [...main, ...per]) {
            const id = r.arm.startsWith('SINGLE:') ? r.arm.slice(7) : null;
            const t = id ? r.cards[id] : undefined; const p = perCast(t);
            say(`| ${r.arm} | ${r.games} | ${pct(r.win)} | ±${pct(ci(r.win, r.decisive))} | ${f1(r.turns)} | ${id ? p.casts : '-'} | ${id ? f1(p.dmg) : '-'} | ${id ? f2(p.stacks) : '-'} |`);
        }
    }
}
// ---- implied multiplier per card: the scorer's Side/Single ratio IS the multiplier (every action on
// the card is scoped), so the multiplier that matches a measured effect ratio is that ratio. For a
// card with an ATTACK half and a STATUS half, weight the measured damage ratio and stacks ratio by
// the scorer's own split of the Single-scope score between those halves.
{
    const w3 = load(`${DIR}/w3.jsonl`); const w1 = load(`${DIR}/w1.jsonl`);
    const S3 = agg(w3.filter(r => r.arm === 'SHIPPED')), G3 = agg(w3.filter(r => r.arm === 'SINGLE_ALL'));
    const S1 = agg(w1.filter(r => r.arm === 'SHIPPED'));
    if (S3.games && G3.games) {
        say('\n## Implied multiplier per card');
        say('');
        say('| card | scorer split ATTACK:STATUS (Single) | 3v3 dmg ratio | 3v3 stacks ratio | implied m (3v3, effect-weighted) | 3v3 field win ratio (all five flipped) | 1v1 field ratio | 3v3 Side casts / 1v1 Side casts (effect per cast: dmg, stacks) |');
        say('|---|---|---|---|---|---|---|---|');
        const G1: Record<string, Agg> = {};
        for (const id of ICE) G1[id] = agg(w1.filter(r => r.arm === `SINGLE:${id}`));
        for (const id of ICE) {
            const raw = ProgramRegistry[id] as unknown as ProgramData;
            const single = { ...raw, target: 'Single' } as ProgramData;
            const sa = calculatePowerscale({ ...single, actions: single.actions.filter(a => a.type === 'ATTACK') } as ProgramData).score;
            const ss = calculatePowerscale({ ...single, actions: single.actions.filter(a => a.type !== 'ATTACK') } as ProgramData).score;
            const s = perCast(S3.cards[id]), g = perCast(G3.cards[id]), o = perCast(S1.cards[id]);
            const dr = s.dmg / g.dmg, sr = s.stacks / g.stacks;
            const m = (sa * (Number.isFinite(dr) ? dr : 0) + ss * (Number.isFinite(sr) ? sr : 0)) / (sa + ss);
            say(`| ${id} | ${f1(sa)}:${f1(ss)} | ${f2(dr)} | ${f2(sr)} | ${f2(m)} | ${f2(S3.winMean / G3.winMean)} | ${f2(S1.winMean / G1[id].winMean)} | ${f2(s.dmg / o.dmg)}, ${f2(s.stacks / o.stacks)} |`);
        }
    }
}
fs.writeFileSync(`${DIR}/tables.md`, out.join('\n') + '\n');
