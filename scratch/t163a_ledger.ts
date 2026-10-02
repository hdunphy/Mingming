/**
 * TICKET 163a — THE `+` LEDGER. **RUN ONCE; THE REVIEW IT WAS BUILT FOR IS RETIRED.**
 *
 * §2 asked for it: *"the scorer prices `<id>+` as its own row; the ledger flags any `+` more than
 * one band above its base."* It was built, run, and put in front of Henry with twelve cards flagged
 * at two rungs or more — Ember Ward+ at +439%, because the rule turned "the attacker gains 1 Burn"
 * into 4 on a hook that fires every time you are hit.
 *
 * Henry, 2026-09-24: *"upgrades are supposed to be broken. So no need to score them."* The flag is
 * retired, `powerscale.isBandExempt` carries the ruling, and no `+` row is audited anywhere.
 *
 * # WHY THE FILE IS STILL HERE
 *
 * Two reasons, and neither is "in case he changes his mind".
 *
 * It is the RECORD of a measurement, which is what `results/t163/LEDGER-PLUS.txt` is beside every
 * other report in `results/` — a ruling is worth reading next to the number it overrode.
 *
 * And it is what found the bug. `SHARP_STACKS`, `STRENGTH_STACKS` and `TARGET_STATUS_STACKS` fell
 * off the end of `powerscale`'s ATTACK chain and contributed a silent zero on six SHIPPED cards —
 * Flashover priced as "50 power" with its +15-per-Burn invisible. Nothing found that in the two
 * tickets those cards lived through, because no report ever asked a question whose answer had to
 * move. This one did: it moved every scaler's rider at once and five of them reported a lift of
 * exactly nothing. That is a technique worth keeping the shape of, on a pool where the scorer's
 * blind spots are the expensive kind of wrong.
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
