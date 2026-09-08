/**
 * TICKET 149 (3c) — fold the cast-probe rows for the consume family into the tables.
 *
 * For each watched card: casts/game, the pile READ at cast (mean / median / p90 / share of casts
 * with an empty pile), the pile CONSUMED (`state.lastStatusConsumed`), the output delivered
 * (HP healed, %maxHp; damage; stacks applied), and the pile on turns the card was HELD but not
 * cast, so "held for a big pile" is answered from the same games. Then each card's shipped
 * powerscale score re-derived with the measured pile in place of the constant (the formulas are
 * the scorer's own tables - `statusPileValue` / `burnPower` - re-applied along the exact path
 * `calculatePowerscale` takes for the card, reproduced here because the ASSUMED_* constants are
 * locals of that function and cannot be patched from outside).
 *
 * Run: npx vite-node scratch/t149_consume_report.ts -- --files results/t149_consume/w1_nidhoggr_v2_s.jsonl,... --cards umbral_feast,bloodwrath
 */
import fs from 'node:fs';
import { arg } from './_env';
import { calculatePowerscale, budgetBandFor, statusPileValue, burnPower } from '../src/debug/balance/powerscale';
import { GetProgramData } from '../src/engine/data/programRegistry';
import { numericBaseCost } from '../src/engine/types';

const FILES = arg('files').split(',').filter(Boolean);
const CARDS = arg('cards').split(',').filter(Boolean);
const LABEL = arg('label', FILES[0]);

interface Cast { card: string; turn: number; target: string; pre: Record<string, number>; post: Record<string, number> }
interface Game { owner: string; opponent: string; winner: string; turns: number; ownerMaxHp: number; casts: Cast[]; samples?: Array<Record<string, number | string>> }
const games: Game[] = [];
for (const f of FILES) for (const line of fs.readFileSync(f, 'utf8').split('\n')) if (line.trim()) games.push(JSON.parse(line));

const mean = (xs: number[]): number => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const q = (xs: number[], p: number): number => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = (x: number): string => Number.isFinite(x) ? x.toFixed(1) : '-';
const f2 = (x: number): string => Number.isFinite(x) ? x.toFixed(2) : '-';

/** Which pile the card reads, and where it lives. */
const PILE: Record<string, { key: string; heldKey: string; status: string; name: string }> = {
    umbral_feast: { key: 'selfPoison', heldKey: 'selfPoison', status: 'Poison', name: 'self Poison' },
    bloodwrath: { key: 'selfPoison', heldKey: 'selfPoison', status: 'Poison', name: 'self Poison' },
    ash_communion: { key: 'selfBurn', heldKey: 'selfBurn', status: 'Burn', name: 'self Burn' },
    contagion: { key: 'tgtPoison', heldKey: 'foePoison', status: 'Poison', name: 'target Poison' },
    hexbloom: { key: 'tgtWeak', heldKey: 'foeWeak', status: 'Weakened', name: 'target Weakened' },
    corrosive_leak: { key: 'selfPoison', heldKey: 'selfPoison', status: 'Poison', name: 'self Poison (pile it adds to)' },
    sun_devourer: { key: 'selfStr', heldKey: 'selfStr', status: 'Strengthened', name: 'self Strengthened' },
    momentum_crash: { key: 'selfStr', heldKey: 'selfStr', status: 'Strengthened', name: 'self Strengthened' },
    drink_deep: { key: 'selfRegen', heldKey: 'selfRegen', status: 'Regen', name: 'self Regen' },
};
/** The constant the shipped scorer uses for the card's pile (powerscale.ts L556-L569, L826). */
const CONSTANT: Record<string, number> = {
    umbral_feast: 8, bloodwrath: 8, ash_communion: 1.5, contagion: 6.57, hexbloom: 5, corrosive_leak: 0,
    sun_devourer: 8, momentum_crash: 8, drink_deep: 10,
};

/** The scorer's own path for each card, with the pile as a free variable. Verified against the shipped score at the constant. */
function scoreAt(card: string, pile: number): number {
    switch (card) {
        case 'umbral_feast': return statusPileValue('Poison', pile) / 10 * 0.9 * 1.25 + (5 * pile) / 10 * 0.75 * 0.9;
        case 'bloodwrath': return statusPileValue('Poison', pile) / 10 * 0.9 * 1.25 + (10 * pile) / 10;
        case 'ash_communion': return burnPower(pile) / 10 * 0.9 * 1.25 + (30 * pile) / 10 * 0.75 * 0.9;
        case 'contagion': return (statusPileValue('Poison', pile * 2) - statusPileValue('Poison', pile)) / 10;
        // hexbloom: Poison applied = pile (non-consume, priced from zero), then the Weakened consume on the ENEMY
        // priced at consumedCount('Weakened') = 3 and NEGATED. `pile2` = what the consume is priced at.
        case 'hexbloom': return statusPileValue('Poison', pile) / 10 - statusPileValue('Weakened', 3) / 10;
        case 'sun_devourer': return -(statusPileValue('Strengthened', pile) / 10 * 0.9) + (30 * pile) / 10;
        case 'momentum_crash': return -(statusPileValue('Strengthened', pile) / 10 * 0.9) + (8 * pile) / 10;
        case 'drink_deep': return -(statusPileValue('Regen', pile) / 10 * 0.9) + (15 * pile) / 10;
        case 'corrosive_leak': return calculatePowerscale(GetProgramData(card)).score;
        default: return NaN;
    }
}
/** hexbloom with BOTH terms at the measured pile (Poison applied = W, Weakened removed = W). */
const hexbloomBoth = (w: number): number => statusPileValue('Poison', w) / 10 - statusPileValue('Weakened', w) / 10;

const N = games.length;
console.log(`# ${LABEL}: ${N} games, ${games.filter(g => g.winner === 'PLAYER').length} player wins, mean turns ${f1(mean(games.map(g => g.turns)))}`);
console.log('');
console.log('| card | casts | casts/game | games w/ cast | pile read mean | median | p90 | max | empty% | consumed mean | pile when HELD not cast (mean, n) | held, pile>0, not cast (mean, n) | pile census (all owner turns, mean) | output/cast | output/game |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const summary: Record<string, { pileMean: number; consumedMean: number; castsPerGame: number }> = {};
for (const card of CARDS) {
    const p = PILE[card];
    const casts = games.flatMap(g => g.casts.filter(c => c.card === card).map(c => ({ ...c, maxHp: g.ownerMaxHp, gameTurns: g.turns })));
    const piles = casts.map(c => c.pre[p.key]);
    const consumed = casts.map(c => c.post.consumed).filter(x => x >= 0);
    const gamesWith = games.filter(g => g.casts.some(c => c.card === card)).length;
    // held-not-cast: turn samples where the card is in hand but no cast of it happened that turn in that game
    const heldPiles: number[] = [];
    const censusPiles: number[] = [];
    for (const g of games) for (const s of g.samples ?? []) {
        censusPiles.push(Number(s[p.heldKey]));
        const held = String(s.held).split(',').includes(card);
        const castThisTurn = g.casts.some(c => c.card === card && c.turn === s.turn);
        if (held && !castThisTurn) heldPiles.push(Number(s[p.heldKey]));
    }
    const heldLive = heldPiles.filter(x => x > 0);
    // output
    let outPer = '', outGame = '';
    const per = (xs: number[]): number => mean(xs);
    if (card === 'umbral_feast' || card === 'ash_communion') {
        const heal = casts.map(c => c.post.selfHpDelta);
        const pct = casts.map(c => 100 * c.post.selfHpDelta / c.maxHp);
        outPer = `heal ${f1(per(heal))} HP = ${f2(per(pct))}% maxHp`;
        outGame = `${f1(heal.reduce((a, b) => a + b, 0) / N)} HP`;
    } else if (card === 'bloodwrath' || card === 'sun_devourer' || card === 'momentum_crash' || card === 'drink_deep') {
        const dmg = casts.map(c => c.post.ledgerRaw);
        outPer = `dmg raw ${f1(per(dmg))} HP = ${f2(per(casts.map(c => 100 * c.post.ledgerRaw / c.pre.tgtMaxHp)))}% tgt maxHp`;
        outGame = `${f1(dmg.reduce((a, b) => a + b, 0) / N)} HP`;
    } else if (card === 'contagion') {
        const add = casts.map(c => c.post.tgtPoisonDelta);
        outPer = `+${f2(per(add))} Poison (0-add casts ${(100 * add.filter(x => x === 0).length / Math.max(1, add.length)).toFixed(0)}%)`;
        outGame = `+${f2(add.reduce((a, b) => a + b, 0) / N)} Poison`;
    } else if (card === 'hexbloom') {
        const add = casts.map(c => c.post.tgtPoisonDelta);
        const rem = casts.map(c => -c.post.tgtWeakDelta);
        outPer = `+${f2(per(add))} Poison, -${f2(per(rem))} Weakened (0-add casts ${(100 * add.filter(x => x === 0).length / Math.max(1, add.length)).toFixed(0)}%)`;
        outGame = `+${f2(add.reduce((a, b) => a + b, 0) / N)} Poison`;
    } else if (card === 'corrosive_leak') {
        const poi = casts.map(c => c.post.selfPoisonDelta);
        const en = casts.map(c => c.post.selfEnergizedDelta);
        outPer = `+${f2(per(poi))} self Poison, +${f2(per(en))} Energized`;
        outGame = `+${f2(poi.reduce((a, b) => a + b, 0) / N)} self Poison`;
    }
    summary[card] = { pileMean: mean(piles), consumedMean: mean(consumed), castsPerGame: casts.length / N };
    console.log(`| ${card} | ${casts.length} | ${f2(casts.length / N)} | ${gamesWith}/${N} | ${f2(mean(piles))} | ${q(piles, 0.5)} | ${q(piles, 0.9)} | ${Math.max(...piles, 0)} | ${(100 * piles.filter(x => x === 0).length / Math.max(1, piles.length)).toFixed(0)}% | ${f2(mean(consumed))} | ${f2(mean(heldPiles))} (n ${heldPiles.length}) | ${f2(mean(heldLive))} (n ${heldLive.length}) | ${f2(mean(censusPiles))} (n ${censusPiles.length}) | ${outPer} | ${outGame} |`);
}

console.log('');
console.log('| card | cost | band | shipped score | constant | measured pile-at-cast | score at measured pile | over band at measured | note |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const card of CARDS) {
    const data = GetProgramData(card);
    const shipped = calculatePowerscale(data).score;
    const band = budgetBandFor(numericBaseCost(data.baseCost)).over;
    const k = CONSTANT[card];
    const at = scoreAt(card, k);
    const m = summary[card].pileMean;
    const atM = scoreAt(card, m);
    const note = Math.abs(at - shipped) > 0.06 ? `formula check ${f2(at)} != shipped` : 'formula reproduces shipped';
    let extra = '';
    if (card === 'hexbloom') extra = `; both terms at measured W: ${f2(hexbloomBoth(m))}`;
    console.log(`| ${card} | ${data.baseCost} | ${band} | ${shipped} | ${k} | ${f2(m)} | ${f2(atM)} | ${((atM / band - 1) * 100).toFixed(0)}% | ${note}${extra} |`);
}

// contagion / hexbloom / corrosive_leak: the Poison ADDED is priced by the triangular `poisonPower` as the pile's
// whole lifetime of ticks (1% x stacks per turn, -1 a turn). How many of those ticks the game actually has room for.
const tri = (n: number, t: number): number => { let s = 0; for (let k = 0; k < Math.min(n, t); k++) s += n - k; return s; };
for (const card of CARDS) {
    if (!['contagion', 'hexbloom', 'corrosive_leak'].includes(card)) continue;
    const rows = games.flatMap(g => g.casts.filter(c => c.card === card).map(c => ({ c, g })));
    if (!rows.length) continue;
    let priced = 0, realized = 0;
    for (const { c, g } of rows) {
        const self = card === 'corrosive_leak';
        const P = self ? c.pre.selfPoison : c.pre.tgtPoison;
        const A = self ? c.post.selfPoisonDelta : c.post.tgtPoisonDelta;
        const T = Math.max(0, g.turns - c.turn + (self ? 0 : 1)); // holder turn-starts still to come
        priced += tri(P + A, 999) - tri(P, 999);
        realized += tri(P + A, T) - tri(P, T);
    }
    console.log(`\n${card}: the Poison it adds is priced (poisonPower, triangular lifetime) at ${f1(priced / rows.length)}% maxHp of ticks per cast; within the game's actual remaining turns those stacks tick ${f1(realized / rows.length)}% maxHp per cast (${(100 * realized / Math.max(1, priced)).toFixed(0)}% of the priced lifetime). n ${rows.length} casts, mean game ${f1(mean(games.map(g => g.turns)))} turns.`);
}

// umbral_feast / bloodwrath: how much of the removal price is REALIZED - the Poison ticks the pile would
// have dealt before the game ended (Poison ticks 1% x stacks at owner turn start, -1 stack a turn).
for (const card of CARDS) {
    if (!['umbral_feast', 'bloodwrath', 'ash_communion'].includes(card)) continue;
    const rows = games.flatMap(g => g.casts.filter(c => c.card === card).map(c => ({ c, g })));
    if (!rows.length) continue;
    let lifetime = 0, realized = 0;
    for (const { c, g } of rows) {
        const S = c.post.consumed;
        const turnsLeft = Math.max(0, g.turns - c.turn); // owner turn-starts still to come in this game
        if (card === 'ash_communion') { lifetime += 0; realized += 0; continue; }
        for (let k = 0; k < S; k++) { lifetime += (S - k); if (k < turnsLeft) realized += (S - k); }
    }
    if (card !== 'ash_communion')
        console.log(`\n${card}: removal priced as the FULL triangular lifetime of the pile (${f1(lifetime / rows.length)}% maxHp of ticks avoided per cast on average); with the game's actual remaining turns the avoided ticks are ${f1(realized / rows.length)}% maxHp per cast (${(100 * realized / Math.max(1, lifetime)).toFixed(0)}% of the priced lifetime). n ${rows.length} casts.`);
}
