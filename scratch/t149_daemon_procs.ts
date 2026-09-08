/**
 * TICKET 149 (3b) — DAEMON PROC RATES, measured from beamless battles.
 *
 * Two things are counted in the same games:
 *
 *  A. PROBES. For every daemon hook in hooks.json a twin is registered under `probe_<id>` with the
 *     SAME `trigger` and `when` but an empty `do` (modifier hooks get `multiplier: 1`), and the probe
 *     ids are put on EVERY unit's `hooks` list on both sides before the battle starts. The probe
 *     changes nothing (empty `do`, x1.0), but its wrapper counts every time its condition passes
 *     outside AI lookahead (`isSimulating()` false). That is the number of times the daemon WOULD
 *     have fired had it been installed on that unit from turn 1 - respecting `source: SELF`, so at
 *     3v3 a unit's probe sees only its own triggers. For the two modifier daemons the probe also
 *     accumulates the damage the multiplier WOULD have added.
 *
 *  B. INSTALLED. The real daemon hooks are wrapped the same way, so a daemon that is actually cast
 *     (echo_chamber_v2 in ratatoskr_v1/_v2, hoofbeat_daemon in sleipnir_v1) reports casts/game,
 *     cast turn, procs/game and procs per turn alive after the cast.
 *
 * DENOMINATOR. A "unit-turn" is one living unit during one full round (`state.turn` increments
 * when the turn returns to PLAYER); a unit alive at round r contributes one unit-turn for r. The
 * same denominator is used for SELF- and OPPONENT-sourced triggers, so an OPPONENT-sourced rate
 * reads "per round the owner is alive", which is what a play-turn price wants.
 *
 * WIDTHS. `--width 1`: `--owner <deck>` on its species vs every other species x every OS (the
 * standard 1v1 set), `--iter` seeds x 2 turn orders. `--width 3`: `--comp <name>` vs `--opps`
 * (ticket-140 panel comps), `--iter` seeds x 2 turn orders. Both write one JSON line per game to
 * `--out` and a per-game summary to stderr.
 *
 * Run: npx vite-node scratch/t149_daemon_procs.ts -- --width 1 --owner ratatoskr_v1 --iter 20 --out results/t149_daemons/w1_ratatoskr_v1.jsonl
 *      npx vite-node scratch/t149_daemon_procs.ts -- --width 3 --comp zoo --opps ink_loop,fire_pair --iter 5 --out results/t149_daemons/w3.jsonl
 */
import fs from 'node:fs';
import { arg } from './_env';
import { matchupScenario, teamScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { deriveSeeds, applyStatJitter } from '../src/debug/balance/runBatch';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { GetProgramData } from '../src/engine/data/programRegistry';
import { initDaemonHooks } from '../src/engine/data/daemonHooks';
import { registerHook, getHook } from '../src/engine/core/HookRegistry';
import { HookFactory } from '../src/engine/core/HookFactory';
import { isSimulating } from '../src/engine/core/simulationDepth';
import HOOKS from '../src/engine/data/lib/hooks.json';
import type { HookContext, HookDefinition } from '../src/engine/core/HookTypes';
import type { IBattleEntity, IBattleState } from '../src/engine/types';

const WIDTH = Number(arg('width', '1'));
const ITER = Number(arg('iter', WIDTH === 1 ? '20' : '5'));
const OWNER = arg('owner', 'ratatoskr_v1');
const COMP = arg('comp', 'zoo');
const OPPS = arg('opps', 'ink_loop,fire_pair,control,ref_solo_a').split(',').filter(Boolean);
const OUT = arg('out', `results/t149_daemons/w${WIDTH}.jsonl`);
const MAX_TURNS = 60;
const OPP_LIMIT = Number(arg('opplimit', '0'));
/** `--noprobe 1`: skip attaching the probe twins (timing control; installed daemons still counted). */
const NOPROBE = arg('noprobe', '0') === '1';

export const COMPS: Record<string, string> = {
    ink_loop: 'kraken_v1+jormungandr_v1+huldra_v2',
    fire_pair: 'fenrir_v1+skoll_v1+jormungandr_v1',
    control: 'huldra_v2+ratatoskr_v2+jormungandr_v2',
    zoo: 'ratatoskr_v1+huldra_v1+kraken_v1',
    ref_solo_a: 'kraken_v1+skoll_v1+huldra_v2',
};
type Member = readonly [string, string];
const speciesOf = (fw: string): string => fw.replace(/_v[12]$/, '');
const members = (comp: string): Member[] => comp.split('+').map(fw => [speciesOf(fw), fw] as const);

// ---- hooks.json daemon entries --------------------------------------------------------------------
const DAEMON_KEYS = ['defensive_daemon', 'core_overclock_daemon', 'cinder_armor_daemon', 'feedback_loop_daemon',
    'fertile_ground_daemon', 'einherjar_standard', 'hoofbeat_daemon', 'echo_chamber', 'riptide', 'short_circuit',
    'reactive_plating', 'scrubber', 'drip_feed'];
const MODIFIER_TRIGGERS = new Set(['onDamageCalculated', 'onStatusDamageCalculated', 'onCostCalculated', 'onHealCalculated']);
type RawHook = { id: string; trigger: string; when?: unknown; do?: unknown[]; multiplier?: number; bonus?: number; scaling?: string; scalingKey?: string; priority: number };
const rawHooks: RawHook[] = [];
for (const k of DAEMON_KEYS) for (const h of ((HOOKS as Record<string, { hooks?: RawHook[] }>)[k]?.hooks ?? [])) rawHooks.push(h);

// ---- counters -------------------------------------------------------------------------------------
/** hookId -> ownerId -> count (and would-be damage for modifiers), reset per game. */
let fires = new Map<string, Map<string, number>>();
let wouldDamage = new Map<string, Map<string, number>>();
/** hookId -> ownerId -> turn -> count, for the per-turn cap of reactive_plating. */
let firesByTurn = new Map<string, Map<string, Map<number, number>>>();
const bump = (m: Map<string, Map<string, number>>, hook: string, owner: string, n = 1): void => {
    let o = m.get(hook); if (!o) { o = new Map(); m.set(hook, o); }
    o.set(owner, (o.get(owner) ?? 0) + n);
};
const bumpTurn = (hook: string, owner: string, turn: number): void => {
    let o = firesByTurn.get(hook); if (!o) { o = new Map(); firesByTurn.set(hook, o); }
    let t = o.get(owner); if (!t) { t = new Map(); o.set(owner, t); }
    t.set(turn, (t.get(turn) ?? 0) + 1);
};

/** Wrap a registered hook so a condition pass outside lookahead is counted under `label`. */
function wrapCounting(id: string, label: string, raw: RawHook): void {
    const reg = getHook(id) as (HookDefinition & Record<string, unknown>) | undefined;
    if (!reg) throw new Error(`hook ${id} not registered`);
    const trig = raw.trigger;
    const orig = reg[trig] as unknown;
    if (typeof orig !== 'function') throw new Error(`hook ${id} has no ${trig}`);
    if (MODIFIER_TRIGGERS.has(trig)) {
        const f = orig as (d: number, c: HookContext, o: IBattleEntity) => number;
        registerHook({
            ...reg, [trig]: (damage: number, ctx: HookContext, owner: IBattleEntity): number => {
                if (!isSimulating() && HookFactory.checkCondition(raw.when as never, ctx, owner)) {
                    const scale = raw.scaling ? HookFactory.resolveScaling(raw.scaling, raw.scalingKey, ctx, owner) : 1;
                    const mult = raw.multiplier ?? 1;
                    const delta = damage * (mult - 1) * scale + (raw.bonus ?? 0) * scale;
                    // a modifier "procs" when it would change the number
                    if (delta !== 0) { bump(fires, label, owner.id); bump(wouldDamage, label, owner.id, delta); bumpTurn(label, owner.id, ctx.state.turn); }
                }
                return f(damage, ctx, owner);
            },
        } as HookDefinition);
    } else {
        const f = orig as (c: HookContext, o: IBattleEntity) => { state: IBattleState };
        registerHook({
            ...reg, [trig]: (ctx: HookContext, owner: IBattleEntity) => {
                if (!isSimulating() && HookFactory.checkCondition(raw.when as never, ctx, owner)) {
                    bump(fires, label, owner.id); bumpTurn(label, owner.id, ctx.state.turn);
                }
                return f(ctx, owner);
            },
        } as HookDefinition);
    }
}

initDaemonHooks();
const PROBE_IDS: string[] = [];
for (const h of rawHooks) {
    // B. the installed daemon's real hook, counted
    wrapCounting(h.id, h.id, h);
    // A. the probe twin: same trigger/when, inert body
    const probeId = `probe_${h.id}`;
    const probeRaw: RawHook = MODIFIER_TRIGGERS.has(h.trigger)
        ? { ...h, id: probeId, multiplier: 1, bonus: 0, scaling: undefined, scalingKey: undefined }
        : { ...h, id: probeId, do: [] };
    registerHook(HookFactory.createHook(probeRaw as never));
    // count with the ORIGINAL multiplier/scaling so would-be damage is right
    wrapCounting(probeId, probeId, { ...h, id: probeId });
    PROBE_IDS.push(probeId);
}
console.error(`registered ${PROBE_IDS.length} probes`);

const DAEMON_IDS = new Set<string>();
{
    const PROGRAMS = (await import('../src/engine/data/programs.json')).default as Record<string, { category: string }>;
    for (const [id, c] of Object.entries(PROGRAMS)) if (c.category === 'Daemon') DAEMON_IDS.add(id);
}

const addProbes = (s: IBattleState): IBattleState => {
    if (NOPROBE) return s;
    const one = (e: IBattleEntity): IBattleEntity => ({ ...e, hooks: [...(e.hooks ?? []), ...PROBE_IDS] });
    return { ...s, playerParty: s.playerParty.map(one), enemyParty: s.enemyParty.map(one) };
};

// ---- one game -------------------------------------------------------------------------------------
interface UnitRow { id: string; name: string; side: 'PLAYER' | 'ENEMY'; os: string; maxHp: number; turnsAlive: number; diedTurn: number | null }
interface CastRow { dataId: string; owner: string; turn: number; procs: number; turnsAliveAfter: number }
interface GameRow {
    width: number; owner: string; opponent: string; seed: string; start: string; winner: string; turns: number; truncated: boolean;
    units: UnitRow[];
    /** hook (probe_* or real) -> ownerId -> count */
    fires: Record<string, Record<string, number>>;
    wouldDamage: Record<string, Record<string, number>>;
    /** reactive_plating probe capped at 3 per owner-turn */
    platingCapped: Record<string, number>;
    casts: CastRow[];
}

function playGame(setupIn: ReturnType<typeof matchupScenario>, seed: string, start: 'PLAYER' | 'ENEMY', ownerLabel: string, oppLabel: string): GameRow {
    fires = new Map(); wouldDamage = new Map(); firesByTurn = new Map();
    const built = buildScenarioState({ ...applyStatJitter(setupIn, seed), seed });
    let state: IBattleState = addProbes(start === 'PLAYER' ? built : { ...built, activeSide: 'ENEMY' });
    const units = new Map<string, UnitRow>();
    for (const side of ['PLAYER', 'ENEMY'] as const)
        for (const e of (side === 'PLAYER' ? state.playerParty : state.enemyParty))
            units.set(e.id, { id: e.id, name: e.name, side, os: e.activeOS ?? '', maxHp: e.maxHp, turnsAlive: 0, diedTurn: null });
    const casts: CastRow[] = [];
    const castsAt = new Map<string, number>(); // ownerId|dataId -> index in casts
    let lastRound = 0;
    const alive = (s: IBattleState): boolean => s.playerParty.some(e => e.currentHp > 0) && s.enemyParty.some(e => e.currentHp > 0);
    const tickRound = (s: IBattleState): void => {
        // count a unit-turn for every living unit each time state.turn advances (and once for turn 1)
        if (s.turn === lastRound) return;
        lastRound = s.turn;
        for (const e of [...s.playerParty, ...s.enemyParty]) {
            const u = units.get(e.id)!;
            if (e.currentHp > 0) u.turnsAlive++;
            else if (u.diedTurn === null) u.diedTurn = s.turn;
        }
    };
    tickRound(state);
    let truncated = false;
    let guard = 0;
    while (alive(state)) {
        if (state.turn > MAX_TURNS || guard++ > 5000) { truncated = true; break; }
        const action: BattleAction = getBestAction(state);
        let next = battleReducer(state, action);
        if (next === state) {
            next = battleReducer(state, { type: 'END_TURN' } as BattleAction);
            if (next === state) { truncated = true; break; }
        } else if (action.type === 'PLAY_PROGRAM') {
            const pay = (action as { payload: { sourceId: string; programId: string } }).payload;
            const deck = state.activeSide === 'PLAYER' ? state.playerDeck : state.enemyDeck;
            const dataId = deck.hand.find(c => c.id === pay.programId)?.dataId;
            if (dataId && DAEMON_IDS.has(dataId)) {
                castsAt.set(`${pay.sourceId}|${dataId}`, casts.length);
                casts.push({ dataId, owner: pay.sourceId, turn: state.turn, procs: 0, turnsAliveAfter: 0 });
            }
        }
        state = next;
        tickRound(state);
        for (const e of [...state.playerParty, ...state.enemyParty]) {
            const u = units.get(e.id)!;
            if (e.currentHp <= 0 && u.diedTurn === null) u.diedTurn = state.turn;
        }
    }
    // fold the installed daemons' fires into their cast rows
    for (const c of casts) {
        const hookIds = (GetProgramData(c.dataId) as unknown as { hooks?: string[] }).hooks ?? [];
        for (const h of hookIds) c.procs += fires.get(h)?.get(c.owner) ?? 0;
        const u = units.get(c.owner)!;
        const end = u.diedTurn ?? state.turn;
        c.turnsAliveAfter = Math.max(0, end - c.turn);
    }
    const platingCapped: Record<string, number> = {};
    for (const [owner, byTurn] of firesByTurn.get('probe_reactive_plating_proc') ?? new Map<string, Map<number, number>>())
        platingCapped[owner] = [...byTurn.values()].reduce((s, n) => s + Math.min(3, n), 0);
    const obj = (m: Map<string, Map<string, number>>): Record<string, Record<string, number>> =>
        Object.fromEntries([...m].map(([k, v]) => [k, Object.fromEntries(v)]));
    const winner = !state.playerParty.some(e => e.currentHp > 0) ? (!state.enemyParty.some(e => e.currentHp > 0) ? 'DRAW' : 'ENEMY')
        : !state.enemyParty.some(e => e.currentHp > 0) ? 'PLAYER' : 'TRUNC';
    return {
        width: WIDTH, owner: ownerLabel, opponent: oppLabel, seed, start, winner, turns: state.turn, truncated,
        units: [...units.values()], fires: obj(fires), wouldDamage: obj(wouldDamage), platingCapped, casts,
    };
}

// ---- drive ----------------------------------------------------------------------------------------
fs.mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
const cells: Array<{ setup: ReturnType<typeof matchupScenario>; owner: string; opp: string }> = [];
if (WIDTH === 1) {
    const species = speciesOf(OWNER);
    for (const sp of BALANCE_SPECIES) if (sp !== species)
        for (const d of MingmingRegistry[sp].availableOS)
            cells.push({ setup: matchupScenario({ player: species, enemy: sp, playerOS: OWNER, enemyOS: d, seed: `t149d:${OWNER}:${d}` }), owner: OWNER, opp: d });
} else {
    const owner = COMPS[COMP] ?? COMP;
    for (const o of OPPS) {
        const opp = COMPS[o] ?? o;
        cells.push({ setup: teamScenario({ player: members(owner), enemy: members(opp), seed: `t149d3:${owner}:${opp}` }), owner: COMP, opp: o });
    }
}
for (const cell of OPP_LIMIT > 0 ? cells.slice(0, OPP_LIMIT) : cells) {
    const t0 = Date.now();
    let games = 0, turns = 0, wins = 0;
    for (const seed of deriveSeeds(cell.setup.seed, ITER)) {
        for (const start of ['PLAYER', 'ENEMY'] as const) {
            const row = playGame(cell.setup, seed, start, cell.owner, cell.opp);
            fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
            games++; turns += row.turns; if (row.winner === 'PLAYER') wins++;
        }
    }
    console.error(`  w${WIDTH} ${cell.owner} vs ${cell.opp.padEnd(16)} games ${games} win ${(100 * wins / games).toFixed(0)}% turns ${(turns / games).toFixed(1)}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.error(`-> ${OUT}`);
