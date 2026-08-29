/**
 * TICKET 112 follow-up — what is a proc WORTH? (the 0-TURN-THE-OS-OFF diagnostic, at two widths)
 *
 * The proc census counts how often a firmware fires. That is frequency, not value, and Henry's
 * question about BLOOD_SCENT is a value question: *"This makes him powerful in a team setting. We
 * might have to nerf him in a 1v1 setting so his 3v3 doesn't get out of hand."* Deciding that needs
 * the OS's CONTRIBUTION at each width, not its firing rate - `0-OS-CONTRIBUTION-LADDER` measured
 * exactly this at 1v1 for seven decks and it is the instrument that separates "strong deck" from
 * "strong OS".
 *
 * METHOD. Rather than swapping the OS out - which would change the DECK too, since `getDeckForOS`
 * keys the list off the OS id - each subject's hook handlers are replaced in memory with no-ops that
 * return their input untouched. The deck, the frame, the seeds and the opponent are identical between
 * arms; the only difference is whether the firmware does anything. Mutating in memory for an arm is
 * the ticket-62 `BURN_CONFIG` precedent; nothing is written to the registry.
 *
 *   ON  - firmware live.
 *   OFF - every hook neutered.
 *
 * The OS contribution is (ON - OFF) in win-rate points, measured at width 1 and width 3. A firmware
 * that is worth little at 1v1 and a great deal at 3v3 is the shape Henry expects for BLOOD_SCENT and
 * is the case for a width-aware nerf; one worth the same at both widths is a 1v1 problem that width
 * does not touch, which is what the census already suggested for TREACHERY.
 *
 * env: ITER=<n>  ONLY=<os,..>  OUT=<path>
 * Run: ITER=25 AI_BEAM=8 npx vite-node scratch/osvalue.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { getOSBehavior } from '../src/engine/data/firmwareRegistry';
import { getHook } from '../src/engine/core/HookRegistry';
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import fs from 'node:fs';
import { ENV } from './_env';

type Member = readonly [string, string];

interface Subject { os: string; species: string; mates: [Member, Member]; note: string }

const SUBJECTS: Subject[] = [
    {
        os: 'nidhoggr_v2', species: 'nidhoggr',
        mates: [['fafnir', 'fafnir_v2'], ['gullinbursti', 'gullinbursti_v1']],
        note: 'BLOOD_SCENT - unguarded, fires on any of six units crossing half HP. Henry expects it to be worth much more at width.',
    },
    {
        os: 'skoll_v1', species: 'skoll',
        mates: [['fafnir', 'fafnir_v2'], ['gullinbursti', 'gullinbursti_v1']],
        note: 'TREACHERY_KERNEL - the census says the feed rate per TURN is identical at both widths; this asks whether the VALUE is too.',
    },
    {
        os: 'audhumbla_v2', species: 'audhumbla',
        mates: [['audhumbla', 'audhumbla_v1'], ['gullinbursti', 'gullinbursti_v1']],
        note: 'PRIMORDIAL_MILK with a deliberate second healer - how much is the ally-heal leak actually worth?',
    },
];

const OPPONENT: Member[] = [['fenrir', 'fenrir_v2'], ['hel', 'hel_v2'], ['huldra', 'huldra_v1']];

const PHASES = [
    'onActionStart', 'onActionEnd', 'onCardDraw', 'onTurnStart', 'onTurnEnd', 'onStatusApplied',
    'onStatusRemoved', 'onPostDamage', 'onDiscarded', 'onDeckShuffled', 'onHeal',
    'onHpThresholdCrossed', 'onUnitFainted',
] as const;
const VALUE_PHASES = ['onDamageCalculated', 'onHealCalculated', 'onStatusDamageCalculated', 'onCostCalculated'] as const;

/** Neuter every hook of one OS. Returns a restore function. */
function neuter(osId: string): () => void {
    const restores: Array<() => void> = [];
    const os = getOSBehavior(osId);
    if (!os) throw new Error(`no OS behaviour for ${osId}`);
    for (const h of os.hooks) {
        const def = getHook(h.id) as Record<string, unknown> | undefined;
        if (!def) continue;
        for (const phase of PHASES) {
            if (typeof def[phase] !== 'function') continue;
            const orig = def[phase];
            restores.push(() => { def[phase] = orig; });
            // Return the context's state untouched: the hook is offered the event and declines it.
            def[phase] = (context: { state: unknown }) => ({ state: context.state, isCancelled: false });
        }
        for (const phase of VALUE_PHASES) {
            if (typeof def[phase] !== 'function') continue;
            const orig = def[phase];
            restores.push(() => { def[phase] = orig; });
            def[phase] = (value: number) => value;
        }
    }
    return () => { for (const r of restores) r(); };
}

const ITER = Number(ENV.ITER ?? 25);
const ONLY = (ENV.ONLY ?? '').split(',').filter(Boolean);
const OUT = ENV.OUT ?? '/root/probe/osvalue.json';

interface Row {
    os: string; width: number; arm: 'ON' | 'OFF'; tier: string;
    winRate: number; games: number; turns: number; truncated: number; note: string;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.os}|${r.width}|${r.arm}`));

function run(s: Subject, width: number, arm: 'ON' | 'OFF'): Row {
    const restore = arm === 'OFF' ? neuter(s.os) : () => { };
    try {
        const player: Member[] = width === 1 ? [[s.species, s.os]] : [[s.species, s.os], ...s.mates];
        const r = runPairedBatch(teamScenario({
            player, enemy: OPPONENT.slice(0, width) as Member[],
            seed: `osvalue:${s.os}:w${width}`,   // SAME seed both arms - the only difference is the firmware
        }), { iterations: ITER });
        return {
            os: s.os, width, arm, tier: `${AI_TIER}/beam${ENV.AI_BEAM ?? 0}`,
            winRate: r.pooled.decisiveWinRate, games: r.pooled.iterations,
            turns: +r.pooled.averageTurns.toFixed(2), truncated: r.pooled.truncatedCount, note: s.note,
        };
    } finally {
        restore();
    }
}

for (const s of SUBJECTS) {
    if (ONLY.length && !ONLY.includes(s.os)) continue;
    for (const width of [1, 3]) {
        for (const arm of ['ON', 'OFF'] as const) {
            if (done.has(`${s.os}|${width}|${arm}`)) continue;
            const row = run(s, width, arm);
            rows.push(row);
            fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
            console.error(`${s.os.padEnd(14)} w${width} ${arm.padEnd(3)} ` +
                `win ${(row.winRate * 100).toFixed(1)}%  turns ${row.turns}  trunc ${row.truncated}`);
        }
    }
}

console.error('\n=== OS contribution (ON minus OFF, win-rate points) ===');
for (const s of SUBJECTS) {
    const get = (w: number, a: string) => rows.find(r => r.os === s.os && r.width === w && r.arm === a);
    const [on1, off1, on3, off3] = [get(1, 'ON'), get(1, 'OFF'), get(3, 'ON'), get(3, 'OFF')];
    if (!on1 || !off1 || !on3 || !off3) continue;
    const c1 = (on1.winRate - off1.winRate) * 100;
    const c3 = (on3.winRate - off3.winRate) * 100;
    console.error(`  ${s.os.padEnd(14)} 1v1 ${c1 >= 0 ? '+' : ''}${c1.toFixed(1)}   3v3 ${c3 >= 0 ? '+' : ''}${c3.toFixed(1)}   ` +
        `${Math.abs(c1) > 0.1 ? `(x${(c3 / c1).toFixed(2)} at width)` : '(no 1v1 baseline to divide)'}`);
}
console.error(`\n-> ${OUT}`);
