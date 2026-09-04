/**
 * TICKET 116 — can kraken's and huldra's FIRMWARE carry side-wide debuffs?
 *
 * Henry, 2026-08-24: *"I'd be curious about adding some side debuffs to kraken and huldra before we
 * look to change the deck. so do some OS testing then try swapping some cards"*. So: the OS layer
 * first, deck lists untouched.
 *
 * WHY THESE TWO. Ticket 115's census found the whole answer package lives in `draugr_v2`:
 * `kraken_v1` runs ZERO enemy-facing debuff CARDS and `huldra_v1` runs one, and it is Poison. What
 * they do have is firmware - and both pieces of firmware apply their debuff to a **RANDOM enemy**:
 *
 *   ABYSSAL_INK_SYS (kraken_v1)  on a non-natural draw by an ally -> 1 Dazed to RANDOM_ENEMY
 *   ALLURE_PROXY    (huldra_v1)  on a buff she puts on her own side -> 1 Weakened to RANDOM_ENEMY
 *
 * `RANDOM_ENEMY` is ticket 110's coverage collapse written directly into the firmware: at 3v3 the
 * proc fires just as often but lands on one of three bodies, so each attacker sees a third of it.
 * The engine already supports `ENEMIES` as a hook action target (`HookTypes.ts`, `HookFactory.ts`),
 * so this needs no engine work - it is the same one-field change ticket 115 made to six cards,
 * applied to two hooks.
 *
 * ARMS: SHIPPED (post-115 baseline) / KRAKEN / HULDRA / BOTH.
 *
 * HOW THE MUTATION WORKS, and why this file is shaped oddly. `firmwareRegistry` compiles every hook
 * ONCE through `HookFactory.createHook` and registers it globally, behind an `isInitialized` latch
 * that is module-private. Mutating anything after that point is silently discarded. So the raw
 * `hooks.json` is imported STATICALLY (all static imports run before any module body), mutated, and
 * only then are the heavy modules pulled in with `await import(...)`, by which time the registry
 * reads the already-mutated data. That also means ONE ARM PER PROCESS - there is no way to restore
 * a compiled hook, so `ARM` is read from the environment and the caller runs the script once per arm.
 *
 * Every arm asserts the mutation took and prints what it touched. Two arms in `sidescope.ts` died
 * silently in this arc - one wrote to a field that did not exist and produced NaN, one filtered out
 * the very cards it meant to charge - and both returned rows bit-identical to their control, which
 * reads exactly like a real "this lever does nothing" result. The stacks-landed column is the second
 * check: if an arm took, debuff stacks per game must move.
 *
 * env: ARM=SHIPPED|KRAKEN|HULDRA|BOTH  ITER=<n>  WIDTH=1|3  LEAD=kraken|huldra|draugr  OUT=<path>
 * Run: ARM=BOTH ITER=10 WIDTH=3 AI_BEAM=8 npx vite-node scratch/controlosarms.ts
 */
import HOOKS from '../src/engine/data/lib/hooks.json';
import fs from 'node:fs';
import { ENV } from './_env';

const ARM = ENV.ARM ?? 'SHIPPED';
const ITER = Number(ENV.ITER ?? 10);
const WIDTH = Number(ENV.WIDTH ?? 3);
const LEAD = ENV.LEAD ?? 'kraken';
const OUT = ENV.OUT ?? '/root/probe/osarms.json';

/** Which firmware each arm widens. */
const ARM_TARGETS: Record<string, string[]> = {
    SHIPPED: [], KRAKEN: ['kraken_v1'], HULDRA: ['huldra_v1'], BOTH: ['kraken_v1', 'huldra_v1'],
};

// ---- the mutation, before ANY heavy import ----
const lib = HOOKS as unknown as Record<string, { hooks?: Array<{ do?: Array<Record<string, unknown>> }> }>;
const touched: string[] = [];
for (const osId of ARM_TARGETS[ARM] ?? []) {
    const entry = lib[osId];
    if (!entry?.hooks?.length) throw new Error(`ARM DID NOT TAKE: no hooks found for ${osId}`);
    for (const hook of entry.hooks) {
        for (const action of hook.do ?? []) {
            if (action.type !== 'STATUS') continue;
            if (action.target !== 'RANDOM_ENEMY') continue;
            action.target = 'ENEMIES';
            touched.push(`${osId}:${action.status}`);
        }
    }
}
if (ARM !== 'SHIPPED' && !touched.length) {
    throw new Error(`ARM DID NOT TAKE: no RANDOM_ENEMY status actions found for ${ARM}`);
}
console.error(`arm ${ARM}: widened ${touched.length ? touched.join(', ') : '(nothing - baseline)'}`);

// ---- only now pull in everything that reads the firmware ----
const { runPairedBatch } = await import('../src/debug/balance/runBatch');
const { teamScenario } = await import('../src/debug/balance/balanceScenarios');
const { AI_TIER } = await import('../src/engine/ai/TacticalAI');
const { FIRMWARE_REGISTRY } = await import('../src/engine/data/firmwareRegistry');

// Post-init proof: the COMPILED hook, not the JSON we edited, is what runs.
for (const osId of ARM_TARGETS[ARM] ?? []) {
    const compiled = JSON.stringify(FIRMWARE_REGISTRY[osId]?.hooks ?? []);
    if (compiled.includes('RANDOM_ENEMY')) {
        throw new Error(`ARM DID NOT TAKE: ${osId} compiled with RANDOM_ENEMY still in it - the `
            + `registry initialised before the mutation`);
    }
}

type Member = readonly [string, string];
const ZOO: Member[] = [
    ['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1'],
];
const CTL_BASE: Member[] = [
    ['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2'],
];
// At width 1 the panel is the FIRST member only, so the lead has to be the mingming whose firmware
// the arm actually changes - otherwise the row measures a matchup the change is not present in.
// That mistake invalidated a set of 1v1 rows earlier in this arc; see sidescope.ts's LEAD comment.
const i = CTL_BASE.findIndex(([s]) => s === LEAD);
if (i === -1) throw new Error(`LEAD=${LEAD} is not a control member`);
const CTL: Member[] = [CTL_BASE[i], ...CTL_BASE.filter((_, j) => j !== i)];

const DEBUFFS = new Set(['Weakened', 'Dazed']);
const sumDebuffs = (t: { PLAYER: { statuses?: Record<string, Record<string, number>> }; ENEMY: { statuses?: Record<string, Record<string, number>> } } | undefined): number => {
    let n = 0;
    for (const side of ['PLAYER', 'ENEMY'] as const)
        for (const byCard of Object.values(t?.[side]?.statuses ?? {}))
            for (const [status, stacks] of Object.entries(byCard))
                if (DEBUFFS.has(status)) n += stacks;
    return n;
};

const r = runPairedBatch(teamScenario({
    player: CTL.slice(0, WIDTH) as Member[],
    enemy: ZOO.slice(0, WIDTH) as Member[],
    seed: `osarms:${LEAD}:w${WIDTH}`,
}), { iterations: ITER, telemetry: true });

const games = r.pooled.iterations || 1;
let landed = 0;
for (const run of r.pooled.runs) landed += sumDebuffs(run.telemetry as never);

const row = {
    arm: ARM, width: WIDTH, lead: LEAD, tier: `${AI_TIER}/beam${ENV.AI_BEAM ?? 0}`,
    widened: touched,
    ctlWin: r.pooled.decisiveWinRate,
    games, turns: +r.pooled.averageTurns.toFixed(2),
    truncated: r.pooled.truncatedCount, ftk: r.pooled.ftkCount,
    debuffLanded: +(landed / games).toFixed(2),
    debuffPerBodyPerTurn: +(landed / games / WIDTH / r.pooled.averageTurns).toFixed(3),
};
const rows = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
rows.push(row);
fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));

console.error(`${ARM.padEnd(8)} w${WIDTH} lead=${LEAD}  CONTROL wins ${(row.ctlWin * 100).toFixed(1)}%  `
    + `turns ${row.turns}  trunc ${row.truncated}  ftk ${row.ftk}  `
    + `W/D stacks/game ${row.debuffLanded}  per body per turn ${row.debuffPerBodyPerTurn}`);
console.error(`-> ${OUT}`);
