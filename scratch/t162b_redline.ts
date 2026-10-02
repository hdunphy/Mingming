/**
 * THE REDLINE — every collection-v2 card that needs a human decision, and why.
 *
 * Henry, 2026-09-23: *"Keep my numbers. And add a list of redlined cards to review later."*
 *
 * # WHY IT IS GENERATED AND NOT WRITTEN
 *
 * A hand-kept list of "cards to look at" goes stale the first time a number moves, and goes stale
 * SILENTLY — it keeps naming a card that was fixed and stops naming one that broke. This reads the
 * live registry through the live scorer every time, so the list is always the list.
 *
 * What is hand-kept is the only part that has to be: `RULINGS`. A card Henry has looked at stays on
 * the page with his verdict next to it rather than disappearing, because "this was checked and it
 * is fine" is the single most useful thing a review list can tell the next reader, and a list that
 * drops ruled cards asks the same question every time it is regenerated.
 *
 * # THE FOUR REASONS A CARD IS ON IT
 *
 * - **UNPRICED** — the scorer says *itself* it cannot price this (`PowerscaleResult.manualReview`:
 *   SEARCH, TRIGGER_STATUS, MULTIPLY_STATUS, MAX_ENERGY, a daemon's hooks). A low number here means
 *   **unscored, not underpowered**, and conflating those two is how a card gets "fixed" into being
 *   overpowered. These need a number from a person, not a knob.
 * - **GUESSED** — the scorer produced a number but had to ASSUME a board: the card consumes, scales
 *   on, or multiplies a pile, and `ASSUMED_STATUS_COUNT` is three. The figure is a FLOOR against an
 *   average board, not a price. `bark_smash` reads 7 power because the model does not know what
 *   wall Huldra v2 builds. Separated from UNDER because pooling the two is exactly the mistake that
 *   produced a "the 2e rung is 36% light" headline that was not true.
 * - **OVER** — reads above its band by more than the ±15% tolerance, and the scorer can read it.
 * - **UNDER** — reads below its band, the scorer can genuinely read it, **and the card is not an
 *   enabler**. That last clause is the one that makes this list short enough to be worth reading:
 *   158 §2 builds a kit from *"2 enablers + 1 consume + 1 scalar + 1 glue"*, so an enabler being
 *   cheap is the design working. A card whose own `shape` tag says `scalar`, `consume`, `converter`
 *   or `hate` and which still reads short is the case worth a look.
 * - **KIT** — nothing to do with the card's own price: 158 §2 says a kit needs a consume/scalar
 *   pair and this deck has not got one. Carried here because it is the finding most likely to be
 *   mistaken for a pricing problem and answered with the wrong tool.
 *
 * Run: npx vite-node scratch/t162b_redline.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { getInflatedProgramRegistry } from '../src/engine/data/programRegistry';
import { budgetBandFor, calculatePowerscale, bandVerdict, BAND_TOLERANCE_PCT } from '../src/debug/balance/powerscale';
import { SPECIES_CARD_POOLS, RUN_ONLY_CARDS } from '../src/engine/data/speciesPools';
import { MingmingRegistry, LAUNCH_SPECIES, getDeckForOS } from '../src/engine/data/mingmingRegistry';
import { numericBaseCost, type ProgramData } from '../src/engine/types';

const OUT = path.join('docs', 'wayfinder', 'deck-archetypes', 'collection-v2', 'REDLINE.md');
const REGISTRY_EXPORT = path.join('docs', 'wayfinder', 'deck-archetypes', 'collection-v2', 'registry.json');

/**
 * 158 §2's shape vocabulary, per card — `enabler`, `scalar`, `consume`, `glue`, `hate`, `converter`.
 *
 * It lives in the design file rather than the engine (the engine has no field for "what job does
 * this card do"), and `npm run decks` carries it into `registry.json`. Read from there so this
 * script sees the same tags the browser does. Missing tags degrade to `''`, which sorts a card into
 * the REVIEWED list rather than quietly excusing it.
 */
const SHAPES: Record<string, string> = (() => {
    try {
        const reg = JSON.parse(fs.readFileSync(REGISTRY_EXPORT, 'utf8')) as { cards: Array<{ id: string; shape?: string }> };
        return Object.fromEntries(reg.cards.map((c) => [c.id, c.shape ?? '']));
    } catch {
        console.warn('[redline] no registry.json — run `npm run decks` first; shapes unavailable.');
        return {};
    }
})();

/** Shapes whose job is to BUY the payoff, so reading under band is the design rather than a fault. */
const CHEAP_BY_DESIGN = new Set(['enabler', 'glue']);

/** The card's value depends on a board the scorer cannot see, so its number is a floor. */
const readsAPile = (card: ProgramData): boolean =>
    (card.actions ?? []).some((a) => a.consume === true || typeof a.scaling === 'string' || a.type === 'MULTIPLY_STATUS');

/**
 * Cards Henry has already looked at. **Add a line here when he rules, never delete a row above.**
 *
 * The date matters as much as the verdict: a ruling is against the numbers that were on the page
 * when it was made, so a card whose score has moved a long way since is worth re-asking about even
 * though it is marked ruled. The generator flags that automatically.
 */
const RULINGS: Record<string, { verdict: string; when: string; scoreThen: number }> = {
    // 2026-09-23, on the over-band list as it was reported to him: *"Those cards you mentioned as
    // over are fine."* Only the cards actually named in that report are recorded — the rest of the
    // over list was not put in front of him and is not his to have ruled on.
    contagion: { verdict: 'FINE — over is fine', when: '2026-09-23', scoreThen: 20.4 },
    sun_devourer: { verdict: 'FINE — over is fine', when: '2026-09-23', scoreThen: 20.4 },
    ragnarok_edge: { verdict: 'FINE — over is fine', when: '2026-09-23', scoreThen: 7.0 },
    capacitor: { verdict: 'FINE — over is fine', when: '2026-09-23', scoreThen: 9.5 },
    riptide: { verdict: 'FINE — over is fine', when: '2026-09-23', scoreThen: 11.9 },
    surge_protection: { verdict: 'FINE — over is fine', when: '2026-09-23', scoreThen: 5.0 },
    tide_pool: { verdict: 'FINE — over is fine', when: '2026-09-23', scoreThen: 5.0 },
};

/** Findings that are about a KIT rather than a card — 162c, from `scratch/t162c_shape.ts`. */
const KIT_FINDINGS: Array<{ os: string; note: string }> = [
    {
        os: 'skoll_v1',
        note: 'Makes Strength (`fury_strike` ×2, `howl`) and holds nothing that reads it — `brute_force` is in '
            + 'her POOL. 158 §2 requires a consume/scalar pair in the kit. Measured: her comp is the joint-weakest '
            + 'of six at 3v3 (20%) and swapping her for `ratatoskr_v1` in an otherwise identical comp improves it.',
    },
    {
        os: 'kraken_v2',
        note: 'Also carries neither a consume nor a scalar. Unlike sköll_v1 it does not seem to hurt — 75.2% at '
            + '1v1, and its comp reads 80% at 3v3 — so this is recorded rather than raised.',
    },
];

const speciesOf = (osId: string) =>
    LAUNCH_SPECIES.find((s) => (MingmingRegistry[s]?.availableOS ?? []).includes(osId));

/** Which OS runs a card, so a row says whose problem it is. `*` marks a pool card. */
const OWNERS = new Map<string, string[]>();
for (const species of LAUNCH_SPECIES) {
    for (const os of MingmingRegistry[species]?.availableOS ?? []) {
        for (const id of new Set(getDeckForOS(species, os))) OWNERS.set(id, [...(OWNERS.get(id) ?? []), os]);
        for (const id of SPECIES_CARD_POOLS[os] ?? []) OWNERS.set(id, [...(OWNERS.get(id) ?? []), `${os}*`]);
    }
}

const COLLECTION = (() => {
    const ids = new Set<string>(RUN_ONLY_CARDS);
    for (const [os, pool] of Object.entries(SPECIES_CARD_POOLS)) {
        for (const id of pool) ids.add(id);
        const sp = speciesOf(os);
        if (sp) for (const id of getDeckForOS(sp, os)) ids.add(id);
    }
    return [...ids].sort();
})();

type Reason = 'UNPRICED' | 'GUESSED' | 'OVER' | 'UNDER' | 'CHEAP BY DESIGN';
interface Row {
    id: string; name: string; cost: number; power: number; band: number; pct: number;
    reason: Reason; detail: string; owners: string; shape: string;
}

const registry = getInflatedProgramRegistry();
const rows: Row[] = [];

for (const id of COLLECTION) {
    const card = registry[id] as ProgramData | undefined;
    if (!card) continue;
    const scored = calculatePowerscale(card);
    const cost = numericBaseCost(card.baseCost);
    const band = budgetBandFor(cost).over;
    // 149c §4.2: a side card is judged on the worse of its two widths.
    const wide = card.target === 'Side' || card.target === 'All';
    const judged = wide ? Math.max(scored.score1v1, scored.score3v3) : scored.score1v1;
    const v = bandVerdict(judged, band);
    const owners = (OWNERS.get(id) ?? []).join(' ') || '—';
    const shape = SHAPES[id] ?? '';
    const base = { id, name: card.name, cost, power: Math.round(judged * 10), band: band * 10, pct: v.pct, owners, shape };

    if (scored.manualReview.length > 0) {
        rows.push({ ...base, reason: 'UNPRICED', detail: scored.manualReview.join(', ') });
    } else if (v.state === 'OUT OF BAND') {
        rows.push({ ...base, reason: 'OVER', detail: card.description });
    } else if (v.pct < -BAND_TOLERANCE_PCT) {
        // Order matters: a card can be BOTH a pile-reader and an enabler, and "the scorer is
        // guessing" is the more useful thing to say about it.
        const reason: Reason = readsAPile(card) ? 'GUESSED'
            : CHEAP_BY_DESIGN.has(shape) ? 'CHEAP BY DESIGN'
            : 'UNDER';
        rows.push({ ...base, reason, detail: card.description });
    }
}

// ── the page ──────────────────────────────────────────────────────────────────────────────────
const L: string[] = [];
const say = (s = '') => L.push(s);
const RULED = (id: string) => RULINGS[id];

say('# The redline — collection v2 cards to review');
say();
say('**Generated by `npx vite-node scratch/t162b_redline.ts`. Do not hand-edit — edit `RULINGS` in');
say('that script and regenerate.** A hand-kept list of "cards to look at" goes stale silently: it');
say('keeps naming a card that was fixed and stops naming one that broke. This reads the live');
say('registry through the live scorer, so the list is always the list.');
say();
say(`Bands are Henry's slot tax, ruled 2026-09-23: **12 / 30 / 70 / 120 power** for 0/1/2/3 Energy,`);
say(`with a ±${BAND_TOLERANCE_PCT}% tolerance either side (149c §4.3 — the band is a target, not a cliff).`);
say();

const byReason = (r: Reason) => rows.filter((x) => x.reason === r).sort((a, b) => b.pct - a.pct);
const table = (list: Row[], detailHeader: string) => {
    say(`| card | cost | reads | band | | shape | whose | ${detailHeader} |`);
    say('| --- | ---: | ---: | ---: | ---: | --- | --- | --- |');
    for (const r of list) {
        const ruled = RULED(r.id);
        const moved = ruled && Math.abs(r.power / 10 - ruled.scoreThen) > 0.5;
        const mark = ruled
            ? `✔ ${ruled.verdict} (${ruled.when})${moved ? ' — **SCORE HAS MOVED SINCE, re-ask**' : ''}`
            : '';
        say(`| \`${r.id}\` | ${r.cost}e | ${r.power} | ${r.band} | ${r.pct >= 0 ? '+' : ''}${r.pct}% `
            + `| ${r.shape || '—'} | ${r.owners} | ${mark || r.detail} |`);
    }
    say();
};

say('## 1. UNPRICED — the scorer says itself it cannot price these');
say();
say('**A low number here means *unscored*, not *underpowered*.** These need a value from a person,');
say('not a knob — "fixing" one by raising its printed numbers until the score moves is how a card');
say('becomes overpowered while the audit reports it as healthy.');
say();
table(byReason('UNPRICED'), 'what the scorer cannot see');

say('## 2. OVER — reads above band by more than the tolerance');
say();
table(byReason('OVER'), 'card text / ruling');

say('## 3. GUESSED — the scorer produced a number against an ASSUMED board');
say();
say('Every card here consumes, scales on, or multiplies a pile, and the model assumes three stacks.');
say('**The figure is a floor against an average board, not a price.** `bark_smash` reads 7 power');
say('because nothing static knows what wall Huldra v2 builds. Measuring these properly needs the');
say('deck they sit in, which is the comp probe\'s job (`scratch/t162c_comps.ts`), not the scorer\'s.');
say();
table(byReason('GUESSED'), 'card text');

say('## 4. UNDER — the scorer can read it, it is short, and it is not an enabler');
say();
say('**This is the short list, and the filtering is what makes it worth reading.** 158 §2 builds a');
say('kit from two enablers, a consume, a scalar and a glue — so an enabler reading under band is the');
say('design working, not a fault, and those are in §5. What is left is a card whose own `shape` tag');
say('claims it is a payoff or an answer, which the model claims to understand, reading short anyway.');
say();
{
    const under = byReason('UNDER');
    const daemons = under.filter((r) => (registry[r.id] as ProgramData).category === 'Daemon');
    if (under.length > 0 && daemons.length === under.length) {
        say(`**All ${under.length} are DAEMONS**, and that is the finding rather than a coincidence: a daemon's`);
        say('price is a TRIGGER RATE (149c-6 measures procs per game per OS), so these are the only cards');
        say('in the collection whose number is short for a reason the model half-understands. Collection v2');
        say('has no ordinary card that the scorer can read and calls under-priced.');
        say();
    }
}
table(byReason('UNDER'), 'card text');

say('## 5. CHEAP BY DESIGN — enablers and glue below band, recorded not raised');
say();
say('158 §2: a kit is *"2 enablers + 1 consume + 1 scalar + 1 glue"*. These buy the payoff; being');
say('under band is their job. Listed so the count is visible and so a card that changes shape shows');
say('up somewhere, but nothing here is a question.');
say();
table(byReason('CHEAP BY DESIGN'), 'card text');

say('## 6. KIT — not a pricing problem, and answering it with a number would be a mistake');
say();
for (const k of KIT_FINDINGS) say(`- **\`${k.os}\`** — ${k.note}`);
say();

say('## Counts');
say();
say(`| reason | cards |`);
say(`| --- | ---: |`);
for (const r of ['UNPRICED', 'OVER', 'GUESSED', 'UNDER', 'CHEAP BY DESIGN'] as Reason[]) {
    say(`| ${r} | ${byReason(r).length} |`);
}
say(`| ruled already | ${rows.filter((r) => RULED(r.id)).length} |`);
say(`| **collection** | **${COLLECTION.length}** |`);
say();

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, L.join('\n') + '\n', 'utf8');
console.log(L.join('\n'));
console.log(`\n-> ${OUT}`);
