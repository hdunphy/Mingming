/**
 * TICKET 162b — THE LEDGER: collection v2's 98 cards through the 149c scorer.
 *
 * §5: *"162b — score. 149c over the 99; ledger to Henry; MANUAL REVIEW rows ruled."*
 *
 * # WHY IT PRINTS TWO BANDS AND NOT ONE
 *
 * `powerscale.BUDGET_BANDS` is the curve the whole repo is audited against — 1.0 / 3.0 / 6.5 / 10.5
 * in scorer units, i.e. 10 / 30 / 65 / 105 power. Henry's v2.1 review (162 §4b, 2026-09-23) ruled a
 * different one for collection v2, the SLOT TAX: *"0e ≈ 12, 1e ≈ 30, 2e at least 70, 3e ≥ 120 — you
 * pay for the cost of playing 1 card"*, with the rule behind it that a 2e or 3e card must beat two
 * 1e cards because it spends a slot as well as the Energy.
 *
 * Those disagree at three of the four costs. Scoring v2 against the old curve would measure it
 * against a rule Henry replaced; MOVING `BUDGET_BANDS` would reprice all 268 registry entries,
 * including the 170 v1 cards twenty post-EA species still field, which is a far larger change than
 * the row that asked for a ledger. So this prints both, and where they disagree is a decision for
 * Henry rather than one this script makes.
 *
 * # WHAT THE SCORER CANNOT SEE, STATED ONCE
 *
 * Firmware. `powerscale` prices card data, and an OS multiplier is not card data — so every card in
 * a deck whose OS boosts it is worth more than its score says (kraken_v2's Water 2e+ cards are +30%;
 * TOXIN_FANG pays jormungandr_v2's attacks +10 per Poison stack). A card that reads UNDER band in
 * one of those decks is not necessarily under-powered, and the ledger says which decks those are.
 *
 * # THE WIDTH RULE, HONOURED
 *
 * 149c §4.2: a `Side`/`All` card is priced at BOTH widths and **the verdict is the worse of the
 * two**, because a card that is fine at one width and egregious at the other is still a card Henry
 * has to see. `PowerscaleResult.score` is the 1v1 reading, so a ledger that printed only that would
 * under-report every side card in the collection by the 3v3 multiplier.
 *
 * `PowerscaleResult.manualReview` is the scorer's own list of action types it cannot honestly
 * price — CLEANSE, SEARCH, TRIGGER_STATUS and friends. A low score with entries there is
 * **unscored, not underpowered**, and that is the distinction 162b's "MANUAL REVIEW rows" is about.
 *
 * Run: npx vite-node scratch/t162b_ledger.ts            (the report)
 *      npx vite-node scratch/t162b_ledger.ts -- --tsv   (the diffable form)
 */
import fs from 'node:fs';
import path from 'node:path';
import { getInflatedProgramRegistry } from '../src/engine/data/programRegistry';
import { budgetBandFor, calculatePowerscale, bandVerdict } from '../src/debug/balance/powerscale';
import { SPECIES_CARD_POOLS, RUN_ONLY_CARDS } from '../src/engine/data/speciesPools';
import { MingmingRegistry, LAUNCH_SPECIES, getDeckForOS } from '../src/engine/data/mingmingRegistry';
import { numericBaseCost, type ProgramData } from '../src/engine/types';

const TSV = process.argv.includes('--tsv');

/**
 * Henry's v2.1 slot tax, in scorer units (the scorer counts /10 power).
 *
 * Deliberately a LOCAL table and not a change to `powerscale.BUDGET_BANDS` — see the header. The
 * 1e rung is the one both curves agree on, which is the reason the disagreement is legible at all.
 */
const SLOT_TAX: Readonly<Record<number, number>> = { 0: 1.2, 1: 3.0, 2: 7.0, 3: 12.0 };
const slotTaxFor = (cost: number): number => SLOT_TAX[Math.min(3, Math.max(0, cost))];

/** Which OS runs this card, so a firmware-boosted score can be read as one. */
const OWNERS: Map<string, string[]> = (() => {
    const m = new Map<string, string[]>();
    const add = (id: string, os: string) => m.set(id, [...(m.get(id) ?? []), os]);
    for (const species of LAUNCH_SPECIES) {
        for (const os of MingmingRegistry[species]?.availableOS ?? []) {
            for (const id of new Set(getDeckForOS(species, os))) add(id, os);
            for (const id of SPECIES_CARD_POOLS[os] ?? []) add(id, `${os}*`);
        }
    }
    return m;
})();

/** The 98: every kit card, every pool card, every run-only card. */
const COLLECTION: string[] = (() => {
    const ids = new Set<string>(RUN_ONLY_CARDS);
    for (const [os, pool] of Object.entries(SPECIES_CARD_POOLS)) {
        for (const id of pool) ids.add(id);
        const species = LAUNCH_SPECIES.find((s) => (MingmingRegistry[s]?.availableOS ?? []).includes(os));
        if (species) for (const id of getDeckForOS(species, os)) ids.add(id);
    }
    return [...ids].sort();
})();

interface Row {
    id: string; name: string; cost: number; score: number; score3v3: number; wide: boolean;
    band: number; pct: number; state: string;
    tax: number; taxPct: number; taxState: string;
    unpriced: string[];
    owners: string;
}

const registry = getInflatedProgramRegistry();
const rows: Row[] = [];
for (const id of COLLECTION) {
    const card = registry[id] as ProgramData | undefined;
    if (!card) { console.error(`[162b] missing from the registry: ${id}`); continue; }
    const scored = calculatePowerscale(card);
    const cost = numericBaseCost(card.baseCost);
    const band = budgetBandFor(cost).over;
    const tax = slotTaxFor(cost);
    // §4.2: a side card is judged on the WORSE of its two widths, not on the 1v1 reading.
    const wide = card.target === 'Side' || card.target === 'All';
    const judged = wide ? Math.max(scored.score1v1, scored.score3v3) : scored.score1v1;
    const v = bandVerdict(judged, band);
    const t = bandVerdict(judged, tax);
    rows.push({
        id, name: card.name, cost,
        score: +judged.toFixed(2), score3v3: +scored.score3v3.toFixed(2), wide,
        band, pct: v.pct, state: v.state,
        tax, taxPct: t.pct, taxState: t.state,
        unpriced: [...scored.manualReview],
        owners: (OWNERS.get(id) ?? []).join(' '),
    });
}

if (TSV) {
    console.log(['id', 'cost', 'score', 'score3v3', 'band', 'pct', 'state', 'tax', 'taxPct', 'taxState', 'unpriced'].join('\t'));
    for (const r of rows) {
        console.log([r.id, r.cost, r.score, r.score3v3, r.band, r.pct, r.state, r.tax, r.taxPct, r.taxState, r.unpriced.join(',')].join('\t'));
    }
} else {
    const line = (r: Row) =>
        `${r.id.padEnd(17)} ${String(r.cost)}e ${r.wide ? '≋' : ' '} ${String(r.score).padStart(6)}   `
        + `curve ${(r.pct >= 0 ? '+' : '') + r.pct + '%'} ${r.state.padEnd(17)}  `
        + `tax ${String(r.tax).padStart(4)} ${((r.taxPct >= 0 ? '+' : '') + r.taxPct + '%').padStart(6)} ${r.taxState.padEnd(17)}  `
        + `${r.unpriced.length ? 'UNPRICED:' + r.unpriced.join(',') + '  ' : ''}${r.owners}`;

    console.log(`# 162b LEDGER — collection v2, ${rows.length} cards\n`);
    for (const cost of [0, 1, 2, 3]) {
        const at = rows.filter((r) => r.cost === cost);
        if (at.length === 0) continue;
        console.log(`\n## ${cost}e — ${at.length} cards, repo curve ${budgetBandFor(cost).over}, Henry's slot tax ${slotTaxFor(cost)}\n`);
        for (const r of [...at].sort((a, b) => b.taxPct - a.taxPct)) console.log(line(r));
    }

    const manual = rows.filter((r) => r.taxState === 'MANUAL REVIEW' || r.unpriced.length > 0);
    const over = rows.filter((r) => r.taxState === 'OUT OF BAND' && r.taxPct > 0);
    const under = rows.filter((r) => r.taxState === 'IN BAND' && r.taxPct <= -25);
    const disagree = rows.filter((r) => r.state !== r.taxState);

    console.log(`\n\n## Summary\n`);
    console.log(`cards                     ${rows.length}`);
    console.log(`MANUAL REVIEW             ${manual.length}   ${manual.map((r) => r.id).join(' ')}`);
    console.log(`  …of which UNPRICED       ${rows.filter((r) => r.unpriced.length > 0).length}   (the scorer says so itself)`);
    console.log(`  …of which score <= 0     ${rows.filter((r) => r.taxState === 'MANUAL REVIEW').length}`);
    console.log(`side cards judged at 3v3  ${rows.filter((r) => r.wide).length}   (≡ in the tables above)`);
    console.log(`OUT OF BAND (over)        ${over.length}`);
    console.log(`25%+ under the slot tax   ${under.length}`);
    console.log(`the two curves disagree   ${disagree.length}   ${disagree.map((r) => r.id).join(' ')}`);
    for (const cost of [0, 1, 2, 3]) {
        const at = rows.filter((r) => r.cost === cost);
        if (!at.length) continue;
        const med = [...at].map((r) => r.taxPct).sort((a, b) => a - b)[Math.floor(at.length / 2)];
        console.log(`median vs slot tax, ${cost}e  ${med >= 0 ? '+' : ''}${med}%   (n=${at.length})`);
    }

    const out = path.join('results', 't162', 'LEDGER.tsv');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, ['id\tcost\tscore\tscore3v3\tband\tpct\tstate\ttax\ttaxPct\ttaxState\tunpriced',
        ...rows.map((r) => [r.id, r.cost, r.score, r.score3v3, r.band, r.pct, r.state, r.tax, r.taxPct, r.taxState, r.unpriced.join(',')].join('\t'))].join('\n') + '\n');
    console.log(`\n-> ${out}`);
}
