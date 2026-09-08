/**
 * TICKET 149 (3a) — SIDE SCOPE: what `scope === 'SIDE'` x2.2 (powerscale.ts ~L872) should be, at
 * which width. Measures the five ticket-115 Ice cards that flipped Single -> Side
 * (`frost_bite`, `numbing_gale`, `killing_frost`, `rimefrost`, `ice_spear`; all in `draugr_v2`,
 * `ice_spear` also in `ymir_v1` and `draugr_v1`) under their shipped `Side` scope and under a
 * temporary in-memory `Single`.
 *
 * ARMS. `SHIPPED` (as printed), `SINGLE:<id>` (one card flipped to Single), `SINGLE_ALL` (all five).
 * The flip mutates `ProgramRegistry[id].target` - the raw record `GetProgramData` inflates from - and
 * then calls `clearProgramDataCache()` (ticket 144d memoises the inflated card by id, so without the
 * clear the flip is a dead arm). Every arm asserts it took and restores in `finally`. Nothing on
 * disk is touched.
 *
 * WHAT IS READ. Win rate (paired, both turn orders) AND `telemetry: true`, which gives per card:
 * casts, direct damage across the cast, and status stacks that landed. Damage-per-cast and
 * stacks-per-cast are the quantity the scope multiplier actually prices, and they converge in tens
 * of casts where a win rate needs hundreds of games - at 3v3 beamless a game is ~160 s on this box,
 * so the 3v3 win-rate cell count is small and the per-cast numbers carry the measurement.
 *
 * WIDTHS.
 *   --width 1  draugr_v2 (player) vs the standard 1v1 opponent set (every other species x every
 *              OS, 30 opponents), `--iter` paired iterations each (2 x iter games per opponent).
 *              `--owner ymir_v1` runs ymir instead (only ice_spear applies).
 *   --width 3  the owning deck in a panel comp: `control` = huldra_v2+ratatoskr_v2+jormungandr_v2
 *              with draugr_v2 swapped in for ratatoskr_v2 (`control_d`), vs the ticket-140 panel
 *              comps named in `--opps`, `--iter` paired iterations a cell.
 *
 * Run: npx vite-node scratch/t149_width.ts -- --width 1 --arm SHIPPED --iter 20 --out results/t149_width/w1.jsonl
 *      npx vite-node scratch/t149_width.ts -- --width 3 --arm SINGLE_ALL --iter 4 --opps ink_loop,zoo,fire_pair --out results/t149_width/w3.jsonl
 */
import fs from 'node:fs';
import { runPairedBatch, type RunTelemetry } from '../src/debug/balance/runBatch';
import { matchupScenario, teamScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ProgramRegistry, clearProgramDataCache, GetProgramData } from '../src/engine/data/programRegistry';
import { arg } from './_env';

const WIDTH = Number(arg('width', '1'));
const ARM = arg('arm', 'SHIPPED');
const ITER = Number(arg('iter', WIDTH === 1 ? '20' : '4'));
const OUT = arg('out', `results/t149_width/w${WIDTH}.jsonl`);
const OWNER = arg('owner', 'draugr_v2');
const OPPS = arg('opps', 'ink_loop,zoo,fire_pair').split(',').filter(Boolean);
const OPP_LIMIT = Number(arg('opplimit', '0'));

export const ICE_FIVE = ['frost_bite', 'numbing_gale', 'killing_frost', 'rimefrost', 'ice_spear'] as const;

type Member = readonly [string, string];
const speciesOf = (fw: string): string => fw.replace(/_v[12]$/, '');
const members = (comp: string): Member[] => comp.split('+').map(fw => [speciesOf(fw), fw] as const);

/** The ticket-140 panel comps, plus the owning comp (control with draugr_v2 swapped in for ratatoskr_v2). */
export const COMPS: Record<string, string> = {
    ink_loop: 'kraken_v1+jormungandr_v1+huldra_v2',
    fire_pair: 'fenrir_v1+skoll_v1+jormungandr_v1',
    control: 'huldra_v2+ratatoskr_v2+jormungandr_v2',
    zoo: 'ratatoskr_v1+huldra_v1+kraken_v1',
    ref_solo_a: 'kraken_v1+skoll_v1+huldra_v2',
    control_d: 'huldra_v2+draugr_v2+jormungandr_v2',
};

interface Prog { target?: string }
const prog = (id: string): Prog => ProgramRegistry[id] as unknown as Prog;

/** Flip the named cards to Single. Throws if any was not Side to begin with (dead-arm guard). */
function applyArm(arm: string): () => void {
    const ids = arm === 'SHIPPED' ? [] : arm === 'SINGLE_ALL' ? [...ICE_FIVE]
        : arm.startsWith('SINGLE:') ? arm.slice('SINGLE:'.length).split(',') : null;
    if (ids === null) throw new Error(`unknown arm ${arm}`);
    const saved = ids.map(id => [id, prog(id).target] as const);
    for (const [id, t] of saved) {
        if (t !== 'Side') throw new Error(`ARM DID NOT TAKE: ${id} is '${t}', not 'Side'`);
        prog(id).target = 'Single';
    }
    clearProgramDataCache();
    for (const id of ids) {
        if (GetProgramData(id).target !== 'Single') throw new Error(`ARM DID NOT TAKE: GetProgramData(${id}) still Side`);
    }
    console.error(`arm ${arm}: flipped to Single: ${ids.join(' ') || '(none)'}`);
    return () => { for (const [id, t] of saved) prog(id).target = t; clearProgramDataCache(); };
}

interface CardTally { casts: number; damage: number; stacks: Record<string, number>; seen: number; handEntries: number }
const tallyOf = (m: Map<string, CardTally>, id: string): CardTally => {
    let t = m.get(id);
    if (!t) { t = { casts: 0, damage: 0, stacks: {}, seen: 0, handEntries: 0 }; m.set(id, t); }
    return t;
};
/** Fold the PLAYER side's telemetry for the watched cards into `m`. */
function fold(m: Map<string, CardTally>, t: RunTelemetry | undefined, watch: readonly string[]): void {
    if (!t) return;
    const s = t.PLAYER;
    for (const id of watch) {
        const c = tallyOf(m, id);
        c.casts += s.played[id] ?? 0;
        c.damage += s.directDamage[id] ?? 0;
        c.seen += s.seen[id] ?? 0;
        c.handEntries += s.handEntries[id] ?? 0;
        for (const [st, n] of Object.entries(s.statuses[id] ?? {})) c.stacks[st] = (c.stacks[st] ?? 0) + n;
    }
}

interface Row {
    width: number; arm: string; owner: string; opponent: string; games: number; decisive: number;
    win: number; turns: number; truncated: number; ms: number;
    cards: Record<string, CardTally>;
}

const restore = applyArm(ARM);
fs.mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
try {
    if (WIDTH === 1) {
        const species = speciesOf(OWNER);
        const opponents: Array<{ sp: string; deck: string }> = [];
        for (const sp of BALANCE_SPECIES) if (sp !== species)
            for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });
        const list = OPP_LIMIT > 0 ? opponents.filter((_, i) => i % Math.max(1, Math.floor(opponents.length / OPP_LIMIT)) === 0).slice(0, OPP_LIMIT) : opponents;
        for (const o of list) {
            const t0 = Date.now();
            const r = runPairedBatch(matchupScenario({
                player: species, enemy: o.sp, playerOS: OWNER, enemyOS: o.deck, seed: `t149w:${OWNER}:${o.deck}`,
            }), { iterations: ITER, telemetry: true });
            const m = new Map<string, CardTally>();
            for (const run of r.pooled.runs) fold(m, run.telemetry, ICE_FIVE);
            const row: Row = {
                width: 1, arm: ARM, owner: OWNER, opponent: o.deck, games: r.pooled.iterations,
                decisive: r.pooled.decisive, win: r.pooled.decisiveWinRate, turns: r.pooled.averageTurns,
                truncated: r.pooled.truncatedCount, ms: Date.now() - t0, cards: Object.fromEntries(m),
            };
            fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
            console.error(`  w1 ${ARM} vs ${o.deck.padEnd(16)} win ${(row.win * 100).toFixed(1)}%  n ${row.games}  ${row.ms} ms`);
        }
    } else {
        const owner = OWNER === 'draugr_v2' ? COMPS.control_d : OWNER;
        for (const oppId of OPPS) {
            const opp = COMPS[oppId] ?? oppId;
            const t0 = Date.now();
            const r = runPairedBatch(teamScenario({
                player: members(owner), enemy: members(opp), seed: `t149w3:${owner}:${opp}`,
            }), { iterations: ITER, telemetry: true });
            const m = new Map<string, CardTally>();
            for (const run of r.pooled.runs) fold(m, run.telemetry, ICE_FIVE);
            const row: Row = {
                width: 3, arm: ARM, owner, opponent: opp, games: r.pooled.iterations,
                decisive: r.pooled.decisive, win: r.pooled.decisiveWinRate, turns: r.pooled.averageTurns,
                truncated: r.pooled.truncatedCount, ms: Date.now() - t0, cards: Object.fromEntries(m),
            };
            fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
            console.error(`  w3 ${ARM} vs ${oppId.padEnd(10)} win ${(row.win * 100).toFixed(1)}%  n ${row.games}  turns ${row.turns.toFixed(1)}  ${(row.ms / 1000).toFixed(0)} s`);
        }
    }
} finally {
    restore();
}
console.error(`-> ${OUT}`);
