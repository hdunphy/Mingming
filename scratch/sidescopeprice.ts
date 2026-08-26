/**
 * TICKET 115 — price the six side-scoped control cards BEFORE any of them ship.
 *
 * Henry ruled 2026-08-24: *"I think the side change for all non stun debuffs is good."* and, on the
 * framing, *"it's not a rule we're just buffing some cards to target the side instead of the single"*.
 * So this is six specific cards changing one field, not a scope system.
 *
 * WHY A LEDGER STEP AT ALL. The scorer multiplies an enemy-facing action by **2.2** for `Side` scope
 * (`powerscale.ts`, "Target Scope Multiplier"). Flipping a card from Single to Side therefore raises
 * its score by 120% before anything else changes - every one of the six lands well over its cost
 * band. That is not a technicality: the band is what has kept this roster's cards comparable, and
 * shipping six cards at ~2x their cost is how a format gets a mandatory pile.
 *
 * THE DECISION THIS TABLE EXISTS TO INFORM, and it is Henry's, not mine:
 *
 *   (a) SHIP AS-IS, over band. The 3v3 measurement was taken on exactly these cards at exactly these
 *       numbers - control 10% -> 55%. And because Side collapses to Single at width 1, the 1v1 grid
 *       is bit-identical, so nothing on the existing roster moves. The cost is that six cards are
 *       knowingly mispriced and the band stops meaning what it means everywhere else.
 *
 *   (b) RE-PRICE DOWN to band, walking power down in fives per Henry's rule.
 *       **This is where the 1v1 bill actually appears, and it is worth being blunt about it.** The
 *       SCOPE change costs 1v1 nothing. Re-pricing for the scope change costs 1v1 plenty: at width 1
 *       a Side card hits one body, so a card whose power was cut to pay for reaching three bodies is
 *       simply a weaker card in every 1v1 on the roster - and ticket 114 question 2 already has
 *       control as the WEAKEST role at 1v1 (44.2% on 98 neutral cells). Option (b) makes that worse
 *       to fix a problem control only has at 3v3.
 *
 *   (c) RAISE COST instead of cutting power. Keeps the card's 1v1 profile intact and pays for the
 *       scope with tempo, which only bites when you actually want the card. Costed cards also get
 *       cast less often, which is the CONDITION-shaped answer `0-NO-CAPS` prefers over a ceiling.
 *
 * This script prints, per card: the printed score and verdict, the Side score at unchanged stats,
 * the highest power in fives that stays in band at Side scope, and what one extra Energy would buy.
 * It mutates nothing - `scratch/sidescope.ts` runs the arms, and only Henry's sign-off ships a card.
 *
 * Run: npx vite-node scratch/sidescopeprice.ts
 */
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import type { ProgramData } from '../src/engine/types';

/** The six Henry approved: every enemy-facing SOFT debuff card in the control decks. No hard CC -
 *  `glacial_slam`'s side-wide Stun is deliberately excluded and stays Single. */
const CARDS = ['ice_spear', 'killing_frost', 'numbing_gale', 'rimefrost', 'frost_bite', 'hexbloom'];

type Mut = { target?: string; baseCost?: number; actions?: Array<Record<string, unknown>> };
const clone = (id: string): ProgramData =>
    JSON.parse(JSON.stringify(ProgramRegistry[id])) as ProgramData;

function variant(id: string, opts: { side?: boolean; power?: number; cost?: number }): ProgramData {
    const c = clone(id);
    const m = c as unknown as Mut;
    if (opts.side) m.target = 'Side';
    if (opts.cost !== undefined) m.baseCost = opts.cost;
    if (opts.power !== undefined) {
        for (const a of m.actions ?? []) {
            if (a.type === 'ATTACK' && typeof a.power === 'number') a.power = opts.power;
        }
    }
    return c;
}

const attackPower = (id: string): number | null => {
    const a = (clone(id) as unknown as Mut).actions?.find(x => x.type === 'ATTACK');
    return a && typeof a.power === 'number' ? a.power : null;
};

const verdict = (score: number, cost: number): string => {
    const b = budgetBandFor(cost);
    return score > b.over ? `OVER  (band ${b.under}-${b.over})`
        : score < b.under ? `under (band ${b.under}-${b.over})`
            : `in band (${b.under}-${b.over})`;
};

console.log('Side scope multiplier in the scorer: x2.2 on every enemy-facing action.\n');

interface Plan { id: string; cost: number; printed: number; side: number; power: number | null; keep: number | null; upcost: number | null }
const plans: Plan[] = [];

for (const id of CARDS) {
    const card = clone(id);
    const m = card as unknown as Mut;
    const cost = m.baseCost ?? 0;
    const power = attackPower(id);
    const printed = calculatePowerscale(card).score;
    const side = calculatePowerscale(variant(id, { side: true })).score;

    console.log(`=== ${id}  (${cost}e)`);
    console.log(`    "${(card as unknown as { description?: string }).description ?? ''}"`);
    console.log(`    printed, Single          score ${printed.toFixed(1)}   ${verdict(printed, cost)}`);
    console.log(`    same card, Side          score ${side.toFixed(1)}   ${verdict(side, cost)}`
        + `   (x${(side / printed).toFixed(2)})`);

    // (b) walk power down in FIVES at Side scope, same cost
    let keep: number | null = null;
    if (power !== null) {
        const b = budgetBandFor(cost);
        for (let p = power; p >= 0; p -= 5) {
            const s = calculatePowerscale(variant(id, { side: true, power: p })).score;
            const mark = s <= b.over ? '  <-- highest in-band power' : '';
            if (s <= b.over && keep === null) keep = p;
            console.log(`      Side @ ${String(p).padStart(3)} power   score ${s.toFixed(1)}${mark}`);
            if (keep !== null) break;
        }
        if (keep === null) console.log(`      no power in fives lands in band - the STATUS half carries this card`);
    } else {
        console.log(`      (no ATTACK action - power is not a dial on this card)`);
    }

    // (c) one more Energy, stats untouched
    const up = calculatePowerscale(variant(id, { side: true, cost: cost + 1 })).score;
    const upOk = up <= budgetBandFor(cost + 1).over;
    console.log(`      Side at ${cost + 1}e, stats unchanged   score ${up.toFixed(1)}   `
        + `${verdict(up, cost + 1)}${upOk ? '  <-- cost alone pays for it' : ''}`);

    // (d) the STATUS dial. The scorer keeps saying "the status half carries this card", so walk the
    // debuff stacks down one at a time - the only dial left on the cards that have no ATTACK action.
    const stackCounts = (v: ProgramData): number[] =>
        ((v as unknown as Mut).actions ?? [])
            .filter(a => a.type === 'STATUS' && typeof a.stacks === 'number')
            .map(a => a.stacks as number);
    const base = stackCounts(card);
    if (base.length && Math.max(...base) > 1) {
        for (let cut = 1; cut < Math.max(...base); cut++) {
            const v = variant(id, { side: true });
            for (const a of (v as unknown as Mut).actions ?? []) {
                if (a.type === 'STATUS' && typeof a.stacks === 'number') {
                    a.stacks = Math.max(1, (a.stacks as number) - cut);
                }
            }
            const s = calculatePowerscale(v).score;
            const ok = s <= budgetBandFor(cost).over;
            console.log(`      Side, stacks -${cut} (${base.join('/')} -> ${stackCounts(v).join('/')})`
                + `   score ${s.toFixed(1)}   ${ok ? 'in band  <-- stacks pay for it' : 'still over'}`);
            if (ok) break;
        }
    }
    console.log();

    plans.push({ id, cost, printed, side, power, keep, upcost: upOk ? cost + 1 : null });
}

console.log('=== summary: what each option costs ===\n');
console.log('card              cost   printed   as Side   (b) power cut     (c) cost bump');
console.log('----------------------------------------------------------------------------');
for (const p of plans) {
    const bTxt = p.keep === null ? 'none in band'
        : p.power === null ? 'n/a'
            : `${p.power} -> ${p.keep}`;
    console.log(`${p.id.padEnd(16)} ${String(p.cost + 'e').padStart(4)}   `
        + `${p.printed.toFixed(1).padStart(7)}   ${p.side.toFixed(1).padStart(7)}   `
        + `${bTxt.padEnd(16)}  ${p.upcost === null ? 'still over' : `${p.cost}e -> ${p.upcost}e`}`);
}

const cuts = plans.filter(p => p.keep !== null && p.power !== null);
const lost = cuts.reduce((s, p) => s + (p.power! - p.keep!), 0);
console.log(`\nOption (b) removes ${lost} total attack power across ${cuts.length} cards. At width 1 that is a`);
console.log('straight nerf to the role ticket 114 already measures as the weakest at 1v1 (44.2%).');
console.log('Option (c) leaves every 1v1 damage profile untouched and pays in tempo instead.');
