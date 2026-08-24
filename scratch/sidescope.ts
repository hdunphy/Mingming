/**
 * TICKET 114 — SIDE-SCOPING, MEASURED PROPERLY, plus a headroom scan on four other levers.
 *
 * WHY THIS EXISTS WHEN `scratch/coverage.ts` ALREADY RAN. That probe answered a NEARBY question and
 * two things about it disqualify it from answering this one:
 *
 *   1. It ADDED four side-scoped cards (2x `winters_grasp`, 2x `ink_cloud`) to control's pile and
 *      compared them against the same four cards flipped to Single. That measures "are side cards
 *      better than single cards", which is worth knowing, but it does NOT measure "what happens if
 *      control's EXISTING answers reached the whole side" - the deck it measured is not the deck
 *      that ships.
 *   2. It ran at AI_LITE. The three-tier protocol is screen with lite, CONFIRM WITH FULL, and never
 *      read a band verdict off lite. Nothing ever confirmed it. Its headline (+11.7 points from
 *      scope) has been quoted in ticket 114 as though it were a measurement; it is a screen.
 *
 * This runs at FULL tier on the SHIPPED decks and changes exactly one property per arm.
 *
 * IT ALSO SHARES `weakarms.ts`'s SEEDS (`weakarms:w<width>`) and its sides - control is the player
 * side, zoo the enemy. So the SHIPPED arm here MUST reproduce weakarms' SHIPPED (66.7% at 1v1,
 * 13.3% at 3v3). If it does not, something is wrong with the harness and no other row is readable.
 *
 * WHAT THE CENSUS FOUND BEFORE ANY ARM RAN, and it reframes the whole question: the enemy-facing
 * Weakened/Dazed axis in `panel-control` lives almost entirely in ONE deck.
 *
 *     kraken_v1   0 enemy-facing debuff cards
 *     huldra_v1   1 (`hexbloom`, Poison) - her Weakened comes from ALLURE_PROXY firmware, not cards
 *     draugr_v2   6 (`ice_spear` `killing_frost` `numbing_gale` `rimefrost` `frost_bite` `glacial_slam`)
 *
 * So "control's debuffs" has meant draugr_v2's six cards throughout this arc. Scope rules and stack
 * counts are both being applied to a third of the panel.
 *
 * ARMS. Each mutates `ProgramRegistry` / `MingmingRegistry`, which are the mutable sources -
 * `GetProgramData` inflates a fresh copy per call and would discard a mutation silently, a trap that
 * has already cost one dead arm in this arc. `GetMingmingData` by contrast returns the live object.
 * Every arm throws if it did not take, and every arm restores in a `finally`.
 *
 *   SHIPPED    as printed. Also the harness check described above.
 *   SIDE       every control-deck card that applies enemy-facing Weakened/Dazed gets card-level
 *              `target: 'Side'`. NOTE this is the only side-scoping the engine can express: action
 *              targets are strictly 'SELF' | 'TARGET' and scope is a CARD property, so the card's
 *              DAMAGE goes side-wide too. That is not a flaw in the arm, it is what a side-scoped
 *              card IS in this engine, and it is what any "more side targets" design would ship.
 *   SIDE_ALL   the same flip widened to every enemy-facing debuff - adds `hexbloom`'s Poison and
 *              `glacial_slam`'s Stun. Separates "the duality debuffs need scope" from "answers
 *              need scope".
 *   FREE       those same cards cost 0 Energy. Uptime rather than coverage: if control's problem is
 *              that it cannot afford to answer three attackers, this is the arm that moves.
 *   TANK       control's three species get +50% HP. The control question: is control losing because
 *              its answers are too narrow, or because it dies before they matter? If TANK moves the
 *              needle further than SIDE, coverage is the wrong diagnosis.
 *   BIGDMG     control's card ATTACK power x1.5. The other control: is this a debuff problem at all,
 *              or just a damage deficit wearing a debuff costume?
 *
 * TANK and BIGDMG are deliberately UNSHIPPABLE magnitudes. They are not proposals - they are there to
 * find which axis has headroom, because an axis that does nothing at +50% will do nothing at +5%.
 *
 * env: ITER=<n>  ARMS=...  WIDTHS=1,3  OUT=<path>
 * Run: ITER=30 AI_BEAM=8 npx vite-node scratch/sidescope.ts
 */
import { runPairedBatch, type RunTelemetry } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import fs from 'node:fs';

type Member = readonly [string, string];

const ZOO: Member[] = [
    ['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1'],
];
const CTL: Member[] = [
    ['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2'],
];

/** The duality debuffs that ride POWER - the ones that punish card spam. */
const DUALITY_DEBUFFS = new Set(['Weakened', 'Dazed']);
/** Every debuff a card can aim at an enemy. */
const ALL_DEBUFFS = new Set(['Weakened', 'Dazed', 'Poison', 'Burn', 'Vulnerable', 'Stunned', 'Asleep']);
/**
 * Everything in ALL_DEBUFFS except HARD CC. `SIDE_ALL` sweeps in `glacial_slam`, whose Side form
 * stuns all three attackers at once, and a side-wide Stun is a categorically different card from a
 * side-wide Weakened - it removes turns rather than shrinking them. Without this arm the headline
 * number cannot be attributed: "scope answers" and "let control stun the board" would be the same
 * result.
 */
const SOFT_DEBUFFS = new Set(['Weakened', 'Dazed', 'Poison', 'Burn', 'Vulnerable']);

interface Prog { target?: string; baseCost?: number; actions?: Array<Record<string, unknown>> }
const prog = (id: string) => ProgramRegistry[id] as unknown as Prog;

/** Every distinct card id across the three control decks. */
function controlCards(): string[] {
    const ids = new Set<string>();
    for (const [species, os] of CTL) {
        const def = MingmingRegistry[species] as unknown as { decks?: Record<string, string[]> };
        for (const id of def.decks?.[os] ?? []) ids.add(id);
    }
    return [...ids];
}

/** Control-deck cards that aim `which` debuffs at an enemy, and are not already Side-scoped. */
function debuffCards(which: Set<string>): string[] {
    return controlCards().filter(id => {
        const p = prog(id);
        if (!p || p.target === 'Side' || p.target === 'Self') return false;
        return (p.actions ?? []).some(a =>
            (a.type === 'STATUS' || a.type === 'APPLY_STATUS')
            && which.has(String(a.status)) && a.target === 'TARGET');
    });
}

type Restore = () => void;

function armSetScope(which: Set<string>): Restore {
    const cards = debuffCards(which);
    if (!cards.length) throw new Error('ARM DID NOT TAKE: no single-scoped control debuff cards found');
    const saved = cards.map(id => [id, prog(id).target] as const);
    for (const id of cards) prog(id).target = 'Side';
    console.error(`   scoped to Side: ${cards.join(' ')}`);
    return () => { for (const [id, t] of saved) prog(id).target = t; };
}

function armFreeCost(): Restore {
    const cards = debuffCards(ALL_DEBUFFS);
    const saved = cards.map(id => [id, prog(id).baseCost] as const);
    let moved = 0;
    for (const id of cards) { if (prog(id).baseCost) moved++; prog(id).baseCost = 0; }
    if (!moved) throw new Error('ARM DID NOT TAKE: every control debuff card was already 0 cost');
    console.error(`   cost -> 0: ${cards.join(' ')}`);
    return () => { for (const [id, c] of saved) prog(id).baseCost = c; };
}

/**
 * HP lives at `baseStats.hp`, NOT at the top level. The first version of this arm wrote to
 * `def.hp`, produced `undefined -> NaN`, and returned a number bit-identical to SHIPPED - a dead
 * arm that reads exactly like a real "this lever does nothing" result. Hence the explicit throw.
 */
function armTank(factor: number): Restore {
    const stats = (s: string) => (MingmingRegistry[s] as unknown as { baseStats?: { hp?: number } }).baseStats;
    const saved: Array<readonly [string, number]> = [];
    for (const [species] of CTL) {
        const st = stats(species);
        if (!st || typeof st.hp !== 'number' || !Number.isFinite(st.hp)) {
            throw new Error(`ARM DID NOT TAKE: ${species} has no numeric baseStats.hp`);
        }
        saved.push([species, st.hp]);
        st.hp = Math.round(st.hp * factor);
    }
    console.error(`   hp x${factor}: ${saved.map(([s, h]) => `${s} ${h}->${stats(s)!.hp}`).join(', ')}`);
    return () => { for (const [s, hp] of saved) stats(s)!.hp = hp; };
}

function armBigDamage(factor: number): Restore {
    const saved: Array<{ id: string; i: number; power: number }> = [];
    for (const id of controlCards()) {
        (prog(id).actions ?? []).forEach((a, i) => {
            if (a.type !== 'ATTACK' || typeof a.power !== 'number') return;
            saved.push({ id, i, power: a.power });
            a.power = Math.round(a.power * factor);
        });
    }
    if (!saved.length) throw new Error('ARM DID NOT TAKE: no ATTACK powers found in the control decks');
    console.error(`   power x${factor} on ${saved.length} actions across ${new Set(saved.map(s => s.id)).size} cards`);
    return () => { for (const s of saved) (prog(s.id).actions as Array<Record<string, unknown>>)[s.i].power = s.power; };
}

const MAKE_ARM: Record<string, () => Restore> = {
    SHIPPED: () => () => { },
    SIDE: () => armSetScope(DUALITY_DEBUFFS),
    SIDE_NOCC: () => armSetScope(SOFT_DEBUFFS),
    SIDE_ALL: () => armSetScope(ALL_DEBUFFS),
    FREE: () => armFreeCost(),
    TANK: () => armTank(1.5),
    BIGDMG: () => armBigDamage(1.5),
};

/** Which arms are worth running at which width. SIDE runs at 1v1 to price the 1v1 BILL: a side-wide
 *  debuff at width 1 is a single-target debuff, so the expectation is "no change" - and an
 *  expectation is only worth having if it is checked. */
const DEFAULT_WIDTHS: Record<string, number[]> = {
    SHIPPED: [1, 3], SIDE: [1, 3], SIDE_NOCC: [3], SIDE_ALL: [3], FREE: [3], TANK: [3], BIGDMG: [3],
};

const ITER = Number(process.env.ITER ?? 30);
const ARMS = (process.env.ARMS ?? 'SHIPPED,SIDE,SIDE_ALL,FREE,TANK,BIGDMG').split(',').filter(Boolean);
const WIDTH_OVERRIDE = process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : null;
const OUT = process.env.OUT ?? '/root/probe/sidescope.json';

interface Row {
    arm: string; width: number; tier: string;
    /** CONTROL's win rate - control is the PLAYER side here, so higher is better for control. */
    ctlWin: number;
    games: number; turns: number; truncated: number; ftk: number;
    /** Weakened + Dazed stacks landed, per game and per enemy body per turn. */
    debuffLanded: number; debuffPerBodyPerTurn: number;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.arm}|${r.width}`));

const sumDebuffs = (t?: RunTelemetry): number => {
    let n = 0;
    for (const side of ['PLAYER', 'ENEMY'] as const)
        for (const byCard of Object.values(t?.[side].statuses ?? {}))
            for (const [status, stacks] of Object.entries(byCard))
                if (DUALITY_DEBUFFS.has(status)) n += stacks;
    return n;
};

console.error(`control deck cards: ${controlCards().length}`);
console.error(`  aiming Weakened/Dazed at an enemy: ${debuffCards(DUALITY_DEBUFFS).join(' ') || '(none)'}`);
console.error(`  aiming any debuff at an enemy:     ${debuffCards(ALL_DEBUFFS).join(' ') || '(none)'}\n`);

for (const arm of ARMS) {
    for (const width of (WIDTH_OVERRIDE ?? DEFAULT_WIDTHS[arm] ?? [3])) {
        if (done.has(`${arm}|${width}`)) continue;
        console.error(`${arm} w${width}:`);
        const restore = MAKE_ARM[arm]();
        try {
            const r = runPairedBatch(teamScenario({
                player: CTL.slice(0, width) as Member[],
                enemy: ZOO.slice(0, width) as Member[],
                seed: `weakarms:w${width}`,          // SHARED with weakarms.ts - see the header
            }), { iterations: ITER, telemetry: true });
            const games = r.pooled.iterations || 1;
            let landed = 0;
            for (const run of r.pooled.runs) landed += sumDebuffs(run.telemetry);
            const row: Row = {
                arm, width, tier: `${AI_TIER}/beam${process.env.AI_BEAM ?? 0}`,
                ctlWin: r.pooled.decisiveWinRate,
                games, turns: +r.pooled.averageTurns.toFixed(2),
                truncated: r.pooled.truncatedCount, ftk: r.pooled.ftkCount,
                debuffLanded: +(landed / games).toFixed(2),
                debuffPerBodyPerTurn: +(landed / games / width / r.pooled.averageTurns).toFixed(3),
            };
            rows.push(row);
            fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
            console.error(`   -> CONTROL wins ${(row.ctlWin * 100).toFixed(1)}%  turns ${row.turns}  ` +
                `trunc ${row.truncated}  ftk ${row.ftk}  ` +
                `W/D stacks/game ${row.debuffLanded}  per body per turn ${row.debuffPerBodyPerTurn}\n`);
        } finally {
            restore();
        }
    }
}

console.error('=== control win rate by lever ===');
for (const width of [1, 3]) {
    const at = rows.filter(r => r.width === width).sort((a, b) => b.ctlWin - a.ctlWin);
    if (!at.length) continue;
    const ship = rows.find(r => r.arm === 'SHIPPED' && r.width === width);
    console.error(`\n  width ${width}:`);
    for (const r of at) {
        const d = ship ? (r.ctlWin - ship.ctlWin) * 100 : NaN;
        console.error(`    ${r.arm.padEnd(9)} ${(r.ctlWin * 100).toFixed(1).padStart(5)}%` +
            (r.arm === 'SHIPPED' ? '   (baseline)' : `   ${d >= 0 ? '+' : ''}${d.toFixed(1)} vs shipped`));
    }
}
console.error(`\n-> ${OUT}`);
