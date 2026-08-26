/**
 * TICKET 112 — the OS proc census: turn the static width audit into measured numbers.
 *
 * The audit read guards off the code and predicted trigger-rate multipliers at 3v3. A ×3 trigger rate
 * is an upper bound on OPPORTUNITY, not an outcome: TREACHERY_KERNEL needs three enemies actually
 * attacking three living allies, and BLOOD_SCENT needs six half-HP crossings to exist. This counts what
 * really happens.
 *
 * HOW IT COUNTS. Each hook's phase handler is wrapped in place, after `getOSBehavior()` has populated
 * `FIRMWARE_REGISTRY` (the ticket-103 lesson: the registry is EMPTY until that call, so wrapping before
 * it wraps nothing). Two counters per hook:
 *
 *   OFFERS — the handler was invoked. On the broadcast path (`executeResolutionStack`) every living
 *            entity on BOTH sides is offered every event, so offers measure how often the engine even
 *            asks. This is the quantity the audit's ×3/×6 predictions are about.
 *   FIRES  — the handler actually changed something: it returned a different state object, or a
 *            different number on the damage/heal-modifier path. A hook whose `when` guard rejects
 *            returns its input untouched, so this separates "asked" from "did".
 *
 * 0-AI-SIM-COUNTS: `TacticalAI` scores candidate plays by pushing them through the real
 * `battleReducer`, so every counter here is gated on `globalBattleEventBus.isLive` — false throughout
 * the AI's search. Without the gate this counts the AI's imagination, which at 3v3 is thousands of
 * speculative plays per real one.
 *
 * env:
 *   ITER=<n>      iterations per pairing; both orders run, so games = 2 x ITER
 *   ONLY=<id,..>  restrict to these subject OS ids
 *   OUT=<path>    JSON results (resumed if present)
 *
 * Run: ITER=10 AI_BEAM=8 npx vite-node scratch/oscensus.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { getOSBehavior } from '../src/engine/data/firmwareRegistry';
import { getHook } from '../src/engine/core/HookRegistry';
import { globalBattleEventBus } from '../src/engine/events';
import fs from 'node:fs';

type Member = readonly [string, string];

/**
 * One row per flagged OS. `solo` is the width-1 case; `team` adds two teammates that do NOT hold a
 * flagged OS, so the only thing changing between the two rows is body count.
 */
interface Subject {
    os: string;
    note: string;
    solo: Member;
    mates: readonly [Member, Member];
}

const SUBJECTS: readonly Subject[] = [
    {
        os: 'skoll_v1',
        note: 'TREACHERY_KERNEL: source OPPONENT + target ALLY. Predicted x3 - three attackers, three allies.',
        solo: ['skoll', 'skoll_v1'],
        mates: [['fafnir', 'fafnir_v2'], ['gullinbursti', 'gullinbursti_v1']],
    },
    {
        os: 'nidhoggr_v2',
        note: 'BLOOD_SCENT_OS: no guard at all. Predicted x3 - six units can cross half HP, not two.',
        solo: ['nidhoggr', 'nidhoggr_v2'],
        mates: [['fafnir', 'fafnir_v2'], ['gullinbursti', 'gullinbursti_v1']],
    },
    {
        os: 'audhumbla_v2',
        note: 'PRIMORDIAL_MILK: guarded on target SELF, not source SELF. A teammate healing her fills her battery.',
        solo: ['audhumbla', 'audhumbla_v2'],
        // A deliberate second healer, because the leak is exactly "an ally heals her".
        mates: [['audhumbla', 'audhumbla_v1'], ['gullinbursti', 'gullinbursti_v1']],
    },
    {
        os: 'kraken_v1',
        note: 'ABYSSAL_INK_SYS: source ALLY on a SHARED deck. Predicted x3 procs, effect diluted 1/3.',
        solo: ['kraken', 'kraken_v1'],
        mates: [['fafnir', 'fafnir_v2'], ['gullinbursti', 'gullinbursti_v1']],
    },
    {
        os: 'ratatoskr_v1',
        note: 'GOSSIP_NODE: owner-scoped trigger, ALLIES effect. Predicted x3 in VALUE, not in rate.',
        solo: ['ratatoskr', 'ratatoskr_v1'],
        mates: [['fafnir', 'fafnir_v2'], ['gullinbursti', 'gullinbursti_v1']],
    },
    {
        os: 'nidhoggr_v1',
        note: 'ROOT_CORRUPTION: source OPPONENT on a per-entity onTurnEnd loop. Predicted x3 coverage.',
        solo: ['nidhoggr', 'nidhoggr_v1'],
        mates: [['fafnir', 'fafnir_v2'], ['gullinbursti', 'gullinbursti_v1']],
    },
];

/** A fixed opponent, mixed roles and elements, holding no flagged OS. */
const OPPONENT: readonly Member[] = [
    ['fenrir', 'fenrir_v2'], ['hel', 'hel_v2'], ['huldra', 'huldra_v1'],
];

const PHASES = [
    'onActionStart', 'onActionEnd', 'onCardDraw', 'onTurnStart', 'onTurnEnd', 'onStatusApplied',
    'onStatusRemoved', 'onPostDamage', 'onDiscarded', 'onDeckShuffled', 'onHeal',
    'onHpThresholdCrossed', 'onUnitFainted',
] as const;
/** These take (value, context, owner) and return a number, and are collected only from source+target. */
const VALUE_PHASES = ['onDamageCalculated', 'onHealCalculated', 'onStatusDamageCalculated', 'onCostCalculated'] as const;

const counts: Record<string, { offers: number; fires: number }> = {};
const bump = (id: string, fired: boolean) => {
    if (!globalBattleEventBus.isLive) return;   // 0-AI-SIM-COUNTS
    const c = counts[id] ?? (counts[id] = { offers: 0, fires: 0 });
    c.offers++;
    if (fired) c.fires++;
};

/** Wrap every hook of every subject OS, in place, AFTER the registry is populated. */
function instrument(): void {
    for (const s of SUBJECTS) {
        const os = getOSBehavior(s.os);
        if (!os) { console.error(`!! no OS behaviour for ${s.os}`); continue; }
        for (const h of os.hooks) {
            const def = getHook(h.id) as Record<string, unknown> | undefined;
            if (!def) { console.error(`!! hook ${h.id} not registered`); continue; }
            if ((def as { __censused?: boolean }).__censused) continue;
            (def as { __censused?: boolean }).__censused = true;

            for (const phase of PHASES) {
                const orig = def[phase] as ((c: { state: unknown }, o: unknown) => { state: unknown }) | undefined;
                if (typeof orig !== 'function') continue;
                def[phase] = (context: { state: unknown }, owner: unknown) => {
                    const before = context.state;
                    const r = orig(context, owner);
                    bump(`${s.os}:${phase}`, r.state !== before);
                    return r;
                };
            }
            for (const phase of VALUE_PHASES) {
                const orig = def[phase] as ((v: number, c: unknown, o: unknown) => number) | undefined;
                if (typeof orig !== 'function') continue;
                def[phase] = (value: number, context: unknown, owner: unknown) => {
                    const r = orig(value, context, owner);
                    bump(`${s.os}:${phase}`, r !== value);
                    return r;
                };
            }
        }
    }
}

const ITER = Number(process.env.ITER ?? 10);
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const OUT = process.env.OUT ?? '/root/probe/oscensus.json';

instrument();

interface Row {
    os: string; width: number; games: number; turns: number;
    winRate: number;
    /** offers / fires per GAME, per hook phase. */
    offersPerGame: Record<string, number>;
    firesPerGame: Record<string, number>;
    note: string;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.os}|${r.width}`));

function run(s: Subject, width: number): Row {
    for (const k of Object.keys(counts)) delete counts[k];
    const player: Member[] = width === 1 ? [s.solo] : [s.solo, ...s.mates];
    const enemy = OPPONENT.slice(0, width);
    const r = runPairedBatch(teamScenario({
        player, enemy: enemy as Member[], seed: `oscensus:${s.os}:w${width}`,
    }), { iterations: ITER });
    const games = r.pooled.iterations || 1;
    const offersPerGame: Record<string, number> = {};
    const firesPerGame: Record<string, number> = {};
    for (const [k, v] of Object.entries(counts)) {
        if (!k.startsWith(s.os + ':')) continue;
        offersPerGame[k.split(':')[1]] = +(v.offers / games).toFixed(2);
        firesPerGame[k.split(':')[1]] = +(v.fires / games).toFixed(2);
    }
    return {
        os: s.os, width, games, turns: +r.pooled.averageTurns.toFixed(2),
        winRate: r.pooled.decisiveWinRate, offersPerGame, firesPerGame, note: s.note,
    };
}

for (const s of SUBJECTS) {
    if (ONLY.length && !ONLY.includes(s.os)) continue;
    for (const width of [1, 3]) {
        if (done.has(`${s.os}|${width}`)) continue;
        const row = run(s, width);
        rows.push(row);
        fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
        const fires = Object.entries(row.firesPerGame).map(([k, v]) => `${k}=${v}`).join(' ') || 'none';
        console.error(`${s.os.padEnd(14)} w${width}  ${row.games} games, ${row.turns} turns, ` +
            `win ${(row.winRate * 100).toFixed(1)}%  FIRES/game: ${fires}`);
    }
}

console.error('\n=== width multipliers (fires per game, w3 / w1) ===');
for (const s of SUBJECTS) {
    const a = rows.find(r => r.os === s.os && r.width === 1);
    const b = rows.find(r => r.os === s.os && r.width === 3);
    if (!a || !b) continue;
    for (const phase of Object.keys(b.firesPerGame)) {
        const x = a.firesPerGame[phase] ?? 0, y = b.firesPerGame[phase] ?? 0;
        const mult = x > 0 ? `x${(y / x).toFixed(2)}` : '(0 at 1v1 - new at width)';
        console.error(`  ${s.os.padEnd(14)} ${phase.padEnd(22)} ${x.toFixed(2)} -> ${y.toFixed(2)}   ${mult}`);
    }
}
console.error(`\n-> ${OUT}`);
