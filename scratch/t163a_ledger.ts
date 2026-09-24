/**
 * TICKET 163a — THE `+` LEDGER: what each upgrade is worth, and which ones jumped a rung.
 *
 * §2: *"The scorer prices `<id>+` as its own row; the ledger flags any `+` more than one band
 * above its base."*
 *
 * # WHY THE BAND IS NOT THE QUESTION HERE
 *
 * 162b's ledger asks "is this card priced for its cost?" and that question has no answer for an
 * upgrade: a `+` is over its cost band by construction, and Henry ruled that intended — *"upgrades
 * are supposed to be broken"*. `powerscale.isBandExempt` is where that ruling lives, and the card
 * budget audit skips these rows entirely.
 *
 * So this ledger asks the only question that CAN be wrong: **how far did the upgrade move the
 * card, and is that distance in line with every other upgrade?** The generator applied one rule per
 * shape — status stacks +(1 + cost), raw numbers +40%, one more hit, one more card — and those
 * rules were written to feel comparable. Where they are not, the number says so, and it is a
 * printing to look at rather than a band to argue with.
 *
 * # THE RUNG
 *
 * A `+` that scores past the band TWO costs above its own is the ticket's flag: a 1e card that
 * prices like a 3e card is not an upgrade any more, it is a different card sharing a name. One
 * rung up is expected and unremarkable — that IS the pass.
 *
 * Side and All cards are judged on the worse of their two widths, 149c §4.2, exactly as 162b does.
 *
 * Run: npx vite-node scratch/t163a_ledger.ts
 *      npx vite-node scratch/t163a_ledger.ts -- --tsv
 */
import fs from 'node:fs';
import path from 'node:path';
import { getInflatedProgramRegistry } from '../src/engine/data/programRegistry';
import { budgetBandFor, calculatePowerscale, isBandExempt } from '../src/debug/balance/powerscale';
import { numericBaseCost, type ProgramData } from '../src/engine/types';

const TSV = process.argv.includes('--tsv');
const registry = getInflatedProgramRegistry();

/** 149c §4.2 — a Side/All card's verdict is the WORSE (higher) of its two width readings. */
const judged = (card: ProgramData): number => {
    const s = calculatePowerscale(card);
    return card.target === 'Side' || card.target === 'All'
        ? Math.max(s.score1v1, s.score3v3)
        : s.score1v1;
};

interface Row {
    id: string; name: string; cost: number;
    base: number; plus: number; lift: number; liftPct: number;
    band: number; rungs: number; unpriced: string[];
}

const rows: Row[] = [];
for (const id of Object.keys(registry).sort()) {
    const card = registry[id] as ProgramData;
    if (!isBandExempt(card)) continue;
    const baseCard = registry[card.upgradeOf!] as ProgramData;
    const cost = numericBaseCost(card.baseCost);
    const base = judged(baseCard);
    const plus = judged(card);
    /*
     * How many COST RUNGS the upgraded score clears. Measured against the band table rather than
     * against a ratio, because that is the ticket's own phrasing ("a band above its base") and
     * because a ratio on a card scoring near zero says nothing useful.
     */
    let rungs = 0;
    for (let c = cost + 1; c <= cost + 3; c += 1) {
        if (plus > budgetBandFor(c).over) rungs += 1;
    }
    rows.push({
        id, name: card.name, cost,
        base: +base.toFixed(2), plus: +plus.toFixed(2),
        lift: +(plus - base).toFixed(2),
        liftPct: base > 0 ? Math.round((plus / base - 1) * 100) : 0,
        band: budgetBandFor(cost).over,
        rungs,
        unpriced: [...calculatePowerscale(card).manualReview],
    });
}

if (TSV) {
    console.log(['id', 'cost', 'base', 'plus', 'lift', 'liftPct', 'band', 'rungs', 'unpriced'].join('\t'));
    for (const r of rows) {
        console.log([r.id, r.cost, r.base, r.plus, r.lift, r.liftPct, r.band, r.rungs, r.unpriced.join(',')].join('\t'));
    }
} else {
    const line = (r: Row) =>
        `${r.id.padEnd(20)} ${r.cost}e  base ${String(r.base).padStart(6)} -> ${String(r.plus).padStart(6)}   `
        + `lift ${(r.lift >= 0 ? '+' : '') + r.lift}`.padEnd(13)
        + `${r.base > 0 ? ((r.liftPct >= 0 ? '+' : '') + r.liftPct + '%').padStart(6) : '     .'}  `
        + `${r.rungs >= 2 ? `** ${r.rungs} RUNGS **` : r.rungs === 1 ? 'one rung' : ''}`
        + `${r.unpriced.length ? '  UNPRICED:' + r.unpriced.join(',') : ''}`;

    console.log(`# 163a — the \`+\` ledger, ${rows.length} upgraded cards\n`);
    for (const cost of [0, 1, 2, 3]) {
        const at = rows.filter((r) => r.cost === cost);
        if (!at.length) continue;
        console.log(`\n## ${cost}e — ${at.length} cards, band ${budgetBandFor(cost).over}, next rung ${budgetBandFor(cost + 1).over}\n`);
        for (const r of [...at].sort((a, b) => b.lift - a.lift)) console.log(line(r));
    }

    const jumped = rows.filter((r) => r.rungs >= 2);
    const flat = rows.filter((r) => r.lift <= 0);
    console.log('\n\n## Summary\n');
    console.log(`upgraded cards          ${rows.length}`);
    console.log(`median lift             +${[...rows].map((r) => r.lift).sort((a, b) => a - b)[Math.floor(rows.length / 2)]}`);
    console.log(`§2's flag: 2+ rungs      ${jumped.length}   ${jumped.map((r) => r.id).join(' ')}`);
    console.log(`one rung (expected)     ${rows.filter((r) => r.rungs === 1).length}`);
    console.log(`scored NO HIGHER        ${flat.length}   ${flat.map((r) => r.id).join(' ')}`);
    console.log(`  — an upgrade the scorer cannot see is not the same as one that does nothing:`);
    console.log(`    check the UNPRICED column before reading a flat row as a dud upgrade.`);
    for (const cost of [0, 1, 2, 3]) {
        const at = rows.filter((r) => r.cost === cost);
        if (!at.length) continue;
        const med = [...at].map((r) => r.liftPct).sort((a, b) => a - b)[Math.floor(at.length / 2)];
        console.log(`median lift, ${cost}e        ${med >= 0 ? '+' : ''}${med}%   (n=${at.length})`);
    }

    const out = path.join('results', 't163', 'LEDGER-PLUS.tsv');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, ['id\tcost\tbase\tplus\tlift\tliftPct\tband\trungs\tunpriced',
        ...rows.map((r) => [r.id, r.cost, r.base, r.plus, r.lift, r.liftPct, r.band, r.rungs, r.unpriced.join(',')].join('\t'))].join('\n') + '\n');
    console.log(`\n-> ${out}`);
}
