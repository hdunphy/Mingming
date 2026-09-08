/**
 * TICKET 149 (3b) — fold the per-game rows from `t149_daemon_procs.ts` into the proc-rate tables and
 * the `rates.json` that `t149_daemon_score.ts --rates` prices from.
 *
 * Run: npx vite-node scratch/t149_daemon_report.ts -- --w1 'results/t149_daemons/w1_*.jsonl' --w3 results/t149_daemons/w3.jsonl
 */
import fs from 'node:fs';
import { arg } from './_env';
import HOOKS from '../src/engine/data/lib/hooks.json';
import PROGRAMS from '../src/engine/data/programs.json';

const W1 = arg('w1', 'results/t149_daemons/w1_*.jsonl');
const W3 = arg('w3', 'results/t149_daemons/w3*.jsonl');
const OUT = arg('out', 'results/t149_daemons/rates.md');
const RATES = arg('rates', 'results/t149_daemons/rates.json');

interface UnitRow { id: string; name: string; side: string; os: string; maxHp: number; turnsAlive: number; diedTurn: number | null }
interface CastRow { dataId: string; owner: string; turn: number; procs: number; turnsAliveAfter: number }
interface GameRow {
    width: number; owner: string; opponent: string; seed: string; start: string; winner: string; turns: number; truncated: boolean;
    units: UnitRow[]; fires: Record<string, Record<string, number>>; wouldDamage: Record<string, Record<string, number>>;
    platingCapped: Record<string, number>; casts: CastRow[];
}
const glob = (pat: string): string[] => {
    const dir = pat.slice(0, pat.lastIndexOf('/'));
    const re = new RegExp('^' + pat.slice(pat.lastIndexOf('/') + 1).replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => re.test(f)).map(f => `${dir}/${f}`) : [];
};
const load = (files: string[]): GameRow[] => files.flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as GameRow));

// daemon id -> hook ids, and hook id -> trigger/when
const daemonHooks = new Map<string, string[]>();
for (const [id, c] of Object.entries(PROGRAMS as Record<string, { category: string; hooks?: string[] }>))
    if (c.category === 'Daemon') daemonHooks.set(id, c.hooks ?? []);
type HookDef = { id: string; trigger: string; when?: Record<string, unknown> };
const hookDef = new Map<string, HookDef>();
for (const e of Object.values(HOOKS as Record<string, { hooks?: HookDef[] }>)) for (const h of e.hooks ?? []) hookDef.set(h.id, h);

const lines: string[] = [];
const say = (s = ''): void => { lines.push(s); console.log(s); };
const mean = (a: number[]): number => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const median = (a: number[]): number => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

interface RateOut { rate: number; gameLen: number; n: number; width: number; note?: string }
const ratesOut: Record<string, RateOut[]> = {};
const push = (id: string, r: RateOut): void => { (ratesOut[id] ??= []).push(r); };

/** Which units in a game are "of deck X" (1v1: PLAYER side; 3v3: units whose os === X). */
function unitsOfDeck(g: GameRow, deck: string): UnitRow[] { return g.units.filter(u => u.os === deck); }

function probeTable(gamesIn: GameRow[], width: number, label: string, keep: (u: UnitRow) => boolean = () => true, noteTag = 'pool'): void {
    if (gamesIn.length === 0) { say(`_no ${label} games_`); return; }
    const games = gamesIn.map(g => ({ ...g, units: g.units.filter(keep) }));
    const gameLen = mean(games.map(g => g.turns));
    const unitTurns = games.reduce((s, g) => s + g.units.reduce((t, u) => t + u.turnsAlive, 0), 0);
    say(`### ${label}: ${games.length} games, mean length ${gameLen.toFixed(2)} turns, ${unitTurns} unit-turns (all units, both sides), truncated ${games.filter(g => g.truncated).length}`);
    say();
    say('| daemon | hook | trigger / when | procs per unit-turn (pool) | zero-proc unit share | per unit-game | implied procs from t1 (rate x len) | vs 4 | would-be dmg per unit-game (% of a maxHp) |');
    say('|---|---|---|---|---|---|---|---|---|');
    for (const [daemon, hooks] of daemonHooks) {
        for (const h of hooks) {
            const d = hookDef.get(h); if (!d) continue;
            const probe = `probe_${h}`;
            let n = 0, dmg = 0, zero = 0, unitGames = 0;
            for (const g of games) {
                const isPlating = h === 'reactive_plating_proc';
                for (const u of g.units) {
                    const c = isPlating ? (g.platingCapped[u.id] ?? 0) : (g.fires[probe]?.[u.id] ?? 0);
                    n += c; unitGames++; if (c === 0) zero++;
                    dmg += (g.wouldDamage[probe]?.[u.id] ?? 0) / u.maxHp;
                }
            }
            const rate = n / unitTurns;
            const implied = rate * gameLen;
            const note = h === 'reactive_plating_proc' ? 'capped 3/turn' : h === 'reactive_plating_reset' ? 'reset, not value' : undefined;
            const dmgCell = dmg > 0 ? `${(100 * dmg / unitGames).toFixed(1)}%` : '—';
            say(`| ${daemon} | ${h} | ${d.trigger} ${JSON.stringify(d.when ?? {})} | ${rate.toFixed(3)} | ${(100 * zero / unitGames).toFixed(0)}% | ${(n / unitGames).toFixed(2)} | ${implied.toFixed(2)} | ${(implied / 4).toFixed(2)}x | ${dmgCell} |`);
            if (h !== 'reactive_plating_reset') push(daemon, { rate, gameLen, n: unitTurns, width, note: `${noteTag}${note ? ', ' + note : ''}` });
        }
    }
    say();
}

/** The same probe rates restricted to the units of one deck (the deck that would run the daemon). */
function deckProbeRow(games: GameRow[], deck: string, daemon: string, width: number): void {
    const hooks = daemonHooks.get(daemon) ?? [];
    const gs = games.filter(g => unitsOfDeck(g, deck).length > 0);
    if (gs.length === 0) return;
    const units = gs.flatMap(g => unitsOfDeck(g, deck).map(u => ({ g, u })));
    const unitTurns = units.reduce((s, x) => s + x.u.turnsAlive, 0);
    const gameLen = mean(gs.map(g => g.turns));
    for (const h of hooks) {
        if (h === 'reactive_plating_reset') continue;
        const probe = `probe_${h}`;
        const n = units.reduce((s, { g, u }) => s + (h === 'reactive_plating_proc' ? (g.platingCapped[u.id] ?? 0) : (g.fires[probe]?.[u.id] ?? 0)), 0);
        const zero = units.filter(({ g, u }) => (g.fires[probe]?.[u.id] ?? 0) === 0).length;
        const rate = n / unitTurns;
        say(`| ${daemon} | ${deck} | ${width}v${width} | ${gs.length} | ${unitTurns} | ${rate.toFixed(3)} | ${(100 * zero / units.length).toFixed(0)}% | ${gameLen.toFixed(2)} | ${(rate * gameLen).toFixed(2)} | ${(rate * gameLen / 4).toFixed(2)}x |`);
        push(daemon, { rate, gameLen, n: unitTurns, width, note: `${deck} units` });
    }
}

function installedTable(games: GameRow[], width: number): void {
    say(`### Installed daemons at ${width}v${width} (real hook firings after the cast)`);
    say();
    say('| daemon | caster deck | games with deck | casts | casts/game | cast turn mean / median | procs/cast | procs per turn-alive (cast turn inclusive) | turns alive from cast (mean, inclusive) | game len | implied EXPECTED procs (per cast) | vs 4 |');
    say('|---|---|---|---|---|---|---|---|---|---|---|---|');
    const byKey = new Map<string, { casts: CastRow[]; games: Set<string>; lens: number[] }>();
    for (const g of games) {
        for (const c of g.casts) {
            const u = g.units.find(x => x.id === c.owner);
            const key = `${c.dataId}|${u?.os ?? '?'}`;
            let e = byKey.get(key); if (!e) { e = { casts: [], games: new Set(), lens: [] }; byKey.set(key, e); }
            e.casts.push(c);
        }
        for (const u of g.units) for (const [d] of daemonHooks) {
            // a game "with the deck" for every daemon that deck ships
            const key = `${d}|${u.os}`;
            if (byKey.has(key) || DECK_HAS(u.os, d)) {
                let e = byKey.get(key); if (!e) { e = { casts: [], games: new Set(), lens: [] }; byKey.set(key, e); }
                if (!e.games.has(g.seed + g.start + g.opponent + g.owner)) { e.games.add(g.seed + g.start + g.opponent + g.owner); e.lens.push(g.turns); }
            }
        }
    }
    if (width === 3) {
        // the shared deck: whoever draws it casts it, so aggregate over every caster too
        const agg = new Map<string, { casts: CastRow[]; games: Set<string>; lens: number[] }>();
        for (const [key, e] of byKey) {
            const daemon = key.split('|')[0];
            let a = agg.get(daemon); if (!a) { a = { casts: [], games: new Set(), lens: [] }; agg.set(daemon, a); }
            a.casts.push(...e.casts);
        }
        for (const g of games) for (const [d] of daemonHooks) {
            const shipped = g.units.some(u => DECK_HAS(u.os, d));
            if (!shipped) continue;
            const a = agg.get(d); if (!a) continue;
            const k = g.seed + g.start + g.opponent + g.owner;
            if (!a.games.has(k)) { a.games.add(k); a.lens.push(g.turns); }
        }
        for (const [daemon, e] of agg) byKey.set(`${daemon}|(any caster, games where a side ships it)`, e);
    }
    for (const [key, e] of byKey) {
        const [daemon, deck] = key.split('|');
        if (e.casts.length === 0) continue;
        const procs = e.casts.reduce((s, c) => s + c.procs, 0);
        // inclusive of the cast turn: a daemon cast on turn t works on turn t, and the last-turn cast has 1 turn, not 0
        const alive = e.casts.reduce((s, c) => s + c.turnsAliveAfter + 1, 0);
        say(`| ${daemon} | ${deck} | ${e.games.size} | ${e.casts.length} | ${(e.casts.length / e.games.size).toFixed(2)} | ${mean(e.casts.map(c => c.turn)).toFixed(2)} / ${median(e.casts.map(c => c.turn))} | ${(procs / e.casts.length).toFixed(2)} | ${(procs / Math.max(1, alive)).toFixed(3)} | ${(alive / e.casts.length).toFixed(2)} | ${mean(e.lens).toFixed(2)} | ${(procs / e.casts.length).toFixed(2)} | ${(procs / e.casts.length / 4).toFixed(2)}x |`);
    }
    say();
}
const DECKS: Record<string, string[]> = {};
{
    const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
    for (const m of Object.values(MingmingRegistry) as Array<{ availableOS?: string[]; decks?: Record<string, string[]> }>)
        for (const os of m.availableOS ?? []) if (m.decks?.[os]) DECKS[os] = m.decks[os];
}
function DECK_HAS(os: string, daemon: string): boolean { return (DECKS[os] ?? []).includes(daemon); }

const w1 = load(glob(W1));
const w3 = load(glob(W3));

say('## 2. Per-trigger proc rates (probe twins on every unit, condition-gated exactly as the daemon is)');
say();
probeTable(w1, 1, '1v1 (owner decks vs the standard opponent set, both sides pooled)');
probeTable(w1, 1, '1v1 FIELD: the ENEMY side only = the standard 30-deck opponent set, i.e. an average shipped deck', u => u.side === 'ENEMY', 'field');
probeTable(w3, 3, '3v3 (ticket-140 panel comps, round-robin, both sides pooled)');

say('### Probe rates restricted to the deck that would run the daemon');
say();
say('| daemon | deck | width | games | unit-turns | procs per unit-turn | zero-proc unit share | game len | implied procs from t1 | vs 4 |');
say('|---|---|---|---|---|---|---|---|---|---|');
const SHIPPED: Array<[string, string]> = [['echo_chamber_v2', 'ratatoskr_v1'], ['echo_chamber_v2', 'ratatoskr_v2'], ['hoofbeat_daemon', 'sleipnir_v1'],
    ['feedback_loop_daemon', 'kraken_v1'], ['core_overclock_daemon', 'fenrir_v1'], ['cinder_armor_daemon', 'fenrir_v1'], ['hoofbeat_daemon', 'ratatoskr_v1'], ['echo_chamber_v2', 'sleipnir_v1']];
for (const [d, deck] of SHIPPED) { deckProbeRow(w1, deck, d, 1); deckProbeRow(w3, deck, d, 3); }
say();
installedTable(w1, 1);
installedTable(w3, 3);

// cast-turn distribution for the shipped daemons
say('### Cast-turn distribution of the installed daemons');
say();
say('| daemon | deck | width | casts | t1 | t2 | t3 | t4+ | never cast (games with deck, no cast) |');
say('|---|---|---|---|---|---|---|---|---|');
for (const [games, width] of [[w1, 1], [w3, 3]] as Array<[GameRow[], number]>) {
    for (const [d, deck] of [['echo_chamber_v2', 'ratatoskr_v1'], ['echo_chamber_v2', 'ratatoskr_v2'], ['hoofbeat_daemon', 'sleipnir_v1']]) {
        const withDeck = games.filter(g => g.units.some(u => u.os === deck));
        if (withDeck.length === 0) continue;
        const casts = withDeck.flatMap(g => g.casts.filter(c => c.dataId === d && g.units.find(u => u.id === c.owner)?.os === deck));
        const never = withDeck.filter(g => !g.casts.some(c => c.dataId === d && g.units.find(u => u.id === c.owner)?.os === deck)).length;
        const at = (t: number): number => casts.filter(c => c.turn === t).length;
        say(`| ${d} | ${deck} | ${width}v${width} | ${casts.length} | ${at(1)} | ${at(2)} | ${at(3)} | ${casts.filter(c => c.turn >= 4).length} | ${never} / ${withDeck.length} |`);
    }
}
say();

fs.mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
fs.writeFileSync(OUT, lines.join('\n') + '\n');
fs.writeFileSync(RATES, JSON.stringify(ratesOut, null, 1));
console.error(`-> ${OUT}, ${RATES}`);
