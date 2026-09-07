/**
 * compgrid.mjs - the Early Access 3v3 comp grid (ticket 140), by SUCCESSIVE HALVING.
 *
 * WHAT. Every legal Fire/Water/Nature trio (three DISTINCT firmwares; the same species may appear
 * as v1 + v2) is scored against a fixed five-comp panel at 3v3. The panel is the three archetype
 * comps from ticket 140 plus two "three solo decks" references, so the panel round robin is also
 * the archetype triangle. 12 firmwares -> 220 comps; `--scope two-plus-one` keeps the 144 comps
 * that are two of one element plus one of another (Henry's rule for EA).
 *
 * HOW IT SAVES TIME. Round 1 runs EVERY comp at 1 paired iteration (2 battles per panel member,
 * both turn orders). Each later round keeps the top fraction by panel score and adds iterations
 * only to those. Battles are spent where the ranking is close, not on comps that lost everything
 * in the screen. Rounds are independent seeds, so results ADD: a comp's score is total wins over
 * total decisive games across every round it survived.
 *
 *   round 1: all comps        x 5 panel x 1 iter   (2 battles a cell)          1,440 battles
 *   round 2: top 50%          x 5 panel x 2 more   (6 total)                    1,440
 *   round 3: top 25%          x 5 panel x 5 more   (16 total)                   1,800
 *   round 4: top 16 comps     x 5 panel x 12 more  (40 total = 20 paired)       1,920
 *   panel:   the 5 panel comps round robin, 20 paired iterations                  400
 *                                                                        ~7,000 battles
 *
 * RESUMABLE. Every finished (comp, opponent, round) is one line in results/compgrid/results.jsonl;
 * rerunning skips what is on disk. Kill it any time.
 *
 * BEAM. Ticket 144 §2, as amended: the beam is a rung of `ENEMY_LADDER`, so the GAME beams its
 * wilds and elites, its GYM does not, and this harness is BEAMLESS unless asked. The default run is
 * therefore the same instrument as every 3v3 number on record (ticket 140's grid, 141's arm B, the
 * gym check) and as the gym fight itself.
 *
 * `--beam 8` opts in through `BatchOptions.aiBeam` (the only route that works under vite-node) and
 * buys about 3.3x. It is a SCREENING tool, not a cheaper version of the same answer: at 3v3 the beam
 * takes ~12.5 points of win rate off whichever side is winning and adds 0.75 turns, and that bias
 * has a DIRECTION - it systematically flatters grindy comps over comps that close. Screen wide with
 * it if you like, then confirm the survivors at `--beam 0`. Every result row records its beam.
 *
 * RUN, from the repo root (needs node_modules, which Henry's machine has again):
 *
 *   node scratch/compgrid.mjs                      # two-plus-one scope, lanes = cores - 1
 *   node scratch/compgrid.mjs --scope all          # all 220 comps
 *   node scratch/compgrid.mjs --lanes 7
 *   node scratch/compgrid.mjs --summary            # just rewrite SUMMARY.md from what is on disk
 *   node scratch/compgrid.mjs --rounds 2           # stop after round 2 (a quick screen)
 *   node scratch/compgrid.mjs --limit 3 --panel-iters 1 --rounds 1 --lanes 2   # 2-minute smoke test
 *   node scratch/compgrid.mjs --comps top30.txt --rounds 1 --outdir results/compgrid_armB   # ticket 141 arm
 *   node scratch/compgrid.mjs --comps ffn.txt --panel a+b+c,d+e+f --rounds 1 --panel-iters 0 --outdir results/gymcheck
 *
 * COST. Measured: one beamless 3v3 battle is ~70s on the (slow, 2-core) container that wrote this;
 * expect 25-40s on a desktop core. The default schedule is ~7,000 battles = 50-80 lane-hours, so
 * on 7 lanes it is an overnight run (7-11 h); the orchestrator prints a projection after the panel
 * round robin from its own measured pace. `--rounds 1` (the screen alone, 1,440 battles) is the
 * 2-3 hour version and already ranks every comp coarsely. Kill and rerun any time; nothing is lost.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1]; };
const flag = n => process.argv.includes(`--${n}`);

const SCOPE = arg('scope', 'two-plus-one');
const LANES = Number(arg('lanes', String(Math.max(1, os.cpus().length - 1))));
const MAX_ROUNDS = Number(arg('rounds', '4'));
const OUTDIR = arg('outdir', 'results/compgrid');
const LIMIT = Number(arg('limit', '0'));          // smoke testing: only the first N comps
const COMPS_FILE = arg('comps', '');
const PANEL_ARG = arg('panel', '');
const BEAM = arg('beam', '');                     // '' = the default, which is BEAMLESS; '8' = the screening beam
const PANEL_ITERS = Number(arg('panel-iters', '20'));
const RESULTS = path.join(OUTDIR, 'results.jsonl');
fs.mkdirSync(OUTDIR, { recursive: true });

// --- the Early Access roster ---------------------------------------------------------------
const ELEMENT = {
    fenrir_v1: 'Fire', fenrir_v2: 'Fire', skoll_v1: 'Fire', skoll_v2: 'Fire',
    kraken_v1: 'Water', kraken_v2: 'Water', jormungandr_v1: 'Water', jormungandr_v2: 'Water',
    ratatoskr_v1: 'Nature', ratatoskr_v2: 'Nature', huldra_v1: 'Nature', huldra_v2: 'Nature',
};
const FW = Object.keys(ELEMENT);

/** Ticket 140's panel: the three archetype comps and two "three solo decks" references. `--panel` replaces it. */
const PANEL = {
    // Refreshed after ticket 141 (2026-09-05). The ticket-140 panel's ramp and ref_b were fodder
    // (field beat them 73-78%) and the zoo fell to 50 under 141; the post-141 read wants the two new
    // leaders in it. The old five are kept as T140_PANEL for a `--panel` rerun against results/compgrid.
    zoo_gossip_tide: 'ratatoskr_v1+huldra_v1+kraken_v1',
    control_venom_court: 'huldra_v2+ratatoskr_v2+jormungandr_v2',
    fire_pair: 'fenrir_v1+skoll_v1+jormungandr_v1',
    ink_loop: 'kraken_v1+jormungandr_v1+huldra_v2',
    ref_solo_a: 'kraken_v1+skoll_v1+huldra_v2',
};
/** The ticket-140 panel: `--panel ratatoskr_v1+huldra_v1+kraken_v1,huldra_v2+ratatoskr_v2+jormungandr_v2,fenrir_v2+skoll_v1+kraken_v2,kraken_v1+skoll_v1+huldra_v2,fenrir_v1+jormungandr_v1+ratatoskr_v2` */
if (PANEL_ARG) {
    for (const k of Object.keys(PANEL)) delete PANEL[k];
    PANEL_ARG.split(',').forEach((c, i) => { PANEL[`opp_${i + 1}`] = c.trim(); });
}
const PANEL_IDS = Object.values(PANEL);

function comps() {
    if (COMPS_FILE) {
        const list = fs.readFileSync(COMPS_FILE, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        for (const c of list) for (const fw of c.split('+')) if (!ELEMENT[fw]) throw new Error(`--comps: unknown firmware ${fw} in ${c}`);
        return LIMIT ? list.slice(0, LIMIT) : list;
    }
    const out = [];
    for (let i = 0; i < FW.length; i++)
        for (let j = i + 1; j < FW.length; j++)
            for (let k = j + 1; k < FW.length; k++) {
                const trio = [FW[i], FW[j], FW[k]];
                const els = trio.map(f => ELEMENT[f]);
                const distinct = new Set(els).size;
                if (SCOPE === 'two-plus-one' && distinct !== 2) continue; // 2 of one element + 1 other
                out.push(trio.join('+'));
            }
    return LIMIT ? out.slice(0, LIMIT) : out;
}

// --- results on disk ------------------------------------------------------------------------
function loadResults() {
    if (!fs.existsSync(RESULTS)) return [];
    // Dedupe on (a, b, seed): two launches into one outdir append identical rows (the engine is
    // deterministic per seed), and counting them twice would double-weight those cells.
    const seen = new Map();
    for (const l of fs.readFileSync(RESULTS, 'utf8').split('\n').filter(Boolean)) {
        const r = JSON.parse(l); const k = key(r.a, r.b, r.seed);
        if (!seen.has(k)) seen.set(k, r);
    }
    return [...seen.values()];
}
const key = (a, b, seed) => `${a}|${b}|${seed}`;

/** Score a comp: total wins / total decisive games against the panel, across every round on disk. */
function scores(results, compList) {
    const acc = new Map();
    for (const r of results) {
        // a comp's rows are (comp vs panel member); the panel round robin rows are (panel vs panel)
        const add = (c, wins, dec) => { const s = acc.get(c) ?? { wins: 0, dec: 0 }; s.wins += wins; s.dec += dec; acc.set(c, s); };
        if (PANEL_IDS.includes(r.b) && !r.seed.startsWith('panel:')) add(r.a, r.winsA, r.decisive);
    }
    return compList.map(c => {
        const s = acc.get(c) ?? { wins: 0, dec: 0 };
        return { comp: c, wins: s.wins, dec: s.dec, score: s.dec ? s.wins / s.dec * 100 : NaN };
    });
}

// --- lanes ------------------------------------------------------------------------------------
const VITE_NODE = path.join(path.dirname(createRequire(import.meta.url).resolve('vite-node/package.json')), 'vite-node.mjs');

function runLane(jobs, laneIdx) {
    return new Promise((resolve, reject) => {
        const jobFile = path.join(OUTDIR, `lane-${laneIdx}.jobs.json`);
        fs.writeFileSync(jobFile, JSON.stringify(jobs));
        const child = spawn(process.execPath, [VITE_NODE, 'scratch/compshard.ts', '--', '--jobs', jobFile, '--out', RESULTS],
            { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
        let err = '';
        child.stdout.on('data', d => { for (const l of String(d).split('\n')) if (l.startsWith('DONE') || l.startsWith('WARNING')) process.stdout.write(`[lane ${laneIdx}] ${l}\n`); });
        child.stderr.on('data', d => { err = (err + d).slice(-4000); });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolve() : reject(new Error(`lane ${laneIdx} exited ${code}\n${err.slice(-1500)}`)));
    });
}

async function runJobs(jobs, label) {
    const done = new Set(loadResults().map(r => key(r.a, r.b, r.seed)));
    const todo = jobs.filter(j => !done.has(key(j.a, j.b, j.seed)));
    console.log(`\n== ${label}: ${jobs.length} jobs, ${jobs.length - todo.length} on disk, ${todo.length} to run on ${LANES} lanes`);
    if (todo.length === 0) return;
    // Interleave so every lane gets a similar mix of long and short battles.
    const lanes = Array.from({ length: LANES }, () => []);
    todo.forEach((j, i) => lanes[i % LANES].push(j));
    const t0 = Date.now();
    await Promise.all(lanes.map((js, i) => js.length ? runLane(js, i) : Promise.resolve()));
    console.log(`== ${label} done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}

// --- the schedule -----------------------------------------------------------------------------
const SCHEDULE = [
    { round: 1, keep: 1.00, iters: 1 },
    { round: 2, keep: 0.50, iters: 2 },
    { round: 3, keep: 0.25, iters: 5 },
    { round: 4, keep: 16,   iters: 12 }, // an absolute count, not a fraction
];

function summary(compList) {
    const results = loadResults();
    const sc = scores(results, compList).filter(s => s.dec > 0).sort((x, y) => y.score - x.score);
    const lines = [];
    lines.push(`# EA 3v3 comp grid - successive halving (${SCOPE}: ${compList.length} comps)`, '');
    lines.push(`Panel: ${Object.entries(PANEL).map(([k, v]) => `${k} = ${v}`).join('; ')}.`, '');
    const beams = [...new Set(results.map(r => r.beam ?? 'unrecorded'))].join('/');
    lines.push(`Beam ${beams}. Score = wins / decisive games against the panel, summed over every round the comp survived; \`games\` is how many battles that rests on.`, '');
    lines.push('| # | comp | score | games | elements |', '|---|---|---|---|---|');
    sc.forEach((s, i) => {
        const els = s.comp.split('+').map(f => ELEMENT[f][0]).join('');
        lines.push(`| ${i + 1} | ${s.comp} | ${s.score.toFixed(1)} | ${s.dec} | ${els} |`);
    });
    // panel round robin
    const pr = results.filter(r => r.seed.startsWith('panel:'));
    if (pr.length) {
        lines.push('', '## Panel round robin (the archetype triangle)', '');
        const names = Object.keys(PANEL); const id2name = Object.fromEntries(Object.entries(PANEL).map(([k, v]) => [v, k]));
        const M = {}; for (const n of names) M[n] = {};
        for (const r of pr) {
            const a = id2name[r.a], b = id2name[r.b];
            if (!a || !b) continue; // a row from an earlier panel in the same outdir
            const w = r.decisive ? r.winsA / r.decisive * 100 : NaN; M[a][b] = w; M[b][a] = 100 - w;
        }
        lines.push('| comp | ' + names.join(' | ') + ' | avg |', '|---'.repeat(names.length + 2) + '|');
        for (const n of names) {
            const vals = names.map(m => m === n ? null : (M[n][m] ?? null));
            const have = vals.filter(v => v !== null && !Number.isNaN(v));
            lines.push(`| ${n} | ` + vals.map(v => v === null ? '-' : v.toFixed(0)).join(' | ') + ` | ${have.length ? (have.reduce((x, y) => x + y, 0) / have.length).toFixed(0) : '-'} |`);
        }
    }
    // per-firmware presence in the top 20
    if (sc.length >= 20) {
        lines.push('', '## Firmware appearances in the top 20', '');
        const cnt = {}; for (const s of sc.slice(0, 20)) for (const f of s.comp.split('+')) cnt[f] = (cnt[f] ?? 0) + 1;
        lines.push('| firmware | in top 20 |', '|---|---|');
        for (const f of FW) lines.push(`| ${f} | ${cnt[f] ?? 0} |`);
    }
    fs.writeFileSync(path.join(OUTDIR, 'SUMMARY.md'), lines.join('\n') + '\n');
    // The ranked ids, one per line, so another run can screen exactly these (`--comps`). Ticket 141 uses the top 30.
    fs.writeFileSync(path.join(OUTDIR, 'ranked.txt'), sc.map(s => s.comp).join('\n') + '\n');
    console.log(`\nSUMMARY -> ${path.join(OUTDIR, 'SUMMARY.md')} (${sc.length} comps scored)`);
    if (sc.length) console.log('top 10:\n' + sc.slice(0, 10).map((s, i) => `  ${i + 1}. ${s.comp}  ${s.score.toFixed(1)}  (${s.dec} games)`).join('\n'));
}

/** Battles still to run under the schedule, and how long they will take at the measured pace. */
function projection(nComps) {
    // Recent rows only: the pace changes with --lanes, and old rows from a choked run would poison the average.
    const rows = loadResults().slice(-40);
    if (!rows.length) return;
    const secPerBattle = rows.reduce((a, r) => a + r.ms, 0) / rows.reduce((a, r) => a + r.games, 0) / 1000;
    let battles = 0, n = nComps;
    for (const step of SCHEDULE.slice(0, MAX_ROUNDS)) {
        if (step.round > 1) n = step.keep < 1 ? Math.ceil(n * step.keep) : Math.min(step.keep, n);
        battles += n * PANEL_IDS.length * step.iters * 2;
    }
    const laneHours = battles * secPerBattle / 3600;
    console.log(`\nPACE: ${secPerBattle.toFixed(0)}s a battle over the last ${rows.length} jobs; the ${MAX_ROUNDS}-round schedule is ~${battles} battles `
        + `= ${laneHours.toFixed(0)} lane-hours = about ${(laneHours / LANES).toFixed(1)} h on ${LANES} lanes.`);
}

async function main() {
    const all = comps();
    console.log(`${all.length} comps (${SCOPE}), panel of ${PANEL_IDS.length}, lanes ${LANES}, beam ${BEAM === '' ? 'default (beamless)' : BEAM}`);
    if (flag('summary')) { summary(all); return; }

    // The panel plays itself at full confidence first: it is the archetype triangle and it is cheap (10 pairs).
    const panelJobs = [];
    for (let i = 0; i < PANEL_IDS.length; i++)
        for (let j = i + 1; j < PANEL_IDS.length; j++)
            panelJobs.push({ a: PANEL_IDS[i], b: PANEL_IDS[j], iterations: PANEL_ITERS, seed: `panel:${PANEL_IDS[i]}:${PANEL_IDS[j]}`, ...(BEAM === '' ? {} : { beam: Number(BEAM) }) });
    if (PANEL_ITERS > 0) await runJobs(panelJobs, `panel round robin (${PANEL_ITERS} paired iterations)`);
    summary(all);
    projection(all.length);

    let survivors = all;
    for (const step of SCHEDULE.slice(0, MAX_ROUNDS)) {
        if (step.round > 1) {
            const ranked = scores(loadResults(), survivors).sort((x, y) => y.score - x.score);
            const n = step.keep < 1 ? Math.ceil(ranked.length * step.keep) : Math.min(step.keep, ranked.length);
            survivors = ranked.slice(0, n).map(s => s.comp);
        }
        const jobs = [];
        for (const c of survivors)
            for (const p of PANEL_IDS) {
                // A comp that IS a panel member does not play itself.
                if (c === p) continue;
                jobs.push({ a: c, b: p, iterations: step.iters, seed: `r${step.round}:${c}:${p}`, ...(BEAM === '' ? {} : { beam: Number(BEAM) }) });
            }
        await runJobs(jobs, `round ${step.round}: ${survivors.length} comps x ${step.iters} paired iterations`);
        summary(all);
    }
    console.log('\nALL DONE');
}
main().catch(e => { console.error(e); process.exit(1); });
