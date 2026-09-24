/**
 * TICKET 149 (3c + 3d) — CAST PROBE: what a scaling card actually READS and DELIVERS at cast, and
 * what an OS payoff hook actually delivers per proc, from beamless battles.
 *
 * Two things are recorded from the same games, both for the PLAYER side's owner unit only:
 *
 *  A. CASTS. Every PLAY_PROGRAM the player makes with a watched card (`--cards`, default: every
 *     card in the owner deck) gets one row: the piles on self and target BEFORE the reducer runs
 *     (Poison / Burn / Strengthened / Weakened / Dazed / Sharp), the per-turn counters the
 *     CARDS_PLAYED / CARDS_DISCARDED / CARDS_DRAWN_TRIGGERED scalers read, and AFTER: what
 *     `state.lastStatusConsumed` says was cashed, the owner's HP delta (heal / self-hit), the
 *     enemy party's HP delta, the action's `damageLedger` (raw / absorbed / applied - the card's
 *     true output before shields and the 0 floor), and the stack deltas of Poison / Weakened /
 *     Energized on target and self, plus the owner's energy delta.
 *
 *  B. OS PROCS. Every hook of the owner's OS (hooks.json + CustomFirmware, looked up AFTER
 *     `getOSBehavior` has populated the registry - the ticket-103 lesson) is wrapped IN PLACE.
 *     A `do`-style hook counts a fire when it returns a different state object, and the delivered
 *     quantity is the diff between the state it was given and the state it returned: enemy HP
 *     lost (damage), owner HP gained (heal), owner HP lost (cost), owner status stacks, energy,
 *     max energy, hand size. A modifier hook (onDamageCalculated / onHealCalculated /
 *     onStatusDamageCalculated / onCostCalculated) counts a fire when it returns a different
 *     number, and the delivered quantity is that delta - HP, because modifiers run after the
 *     damage divisor. Everything is gated on `isSimulating()` false so the AI's lookahead is not
 *     counted (0-AI-SIM-COUNTS).
 *
 * NOTHING ON DISK IS TOUCHED. `--swap from:to` replaces EVERY copy of a card id in the owner deck
 * in memory (used to put `fire_punch_v2`, which no shipped deck runs, on a Fire frame for the
 * benchmark, and by 163a to put a `+` card in the deck its base lives in).
 *
 * Run: npx vite-node scratch/t149_castprobe.ts -- --width 1 --owner nidhoggr_v2 --cards umbral_feast --iter 20 --out results/t149_consume/w1_nidhoggr_v2.jsonl
 *      npx vite-node scratch/t149_castprobe.ts -- --width 3 --comp zoo --owner huldra_v1 --cards hexbloom --opps ink_loop,control --iter 5 --out results/t149_consume/w3_huldra_v1.jsonl
 */
import fs from 'node:fs';
import { arg } from './_env';
import { matchupScenario, teamScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { deriveSeeds, applyStatJitter } from '../src/debug/balance/runBatch';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { getOSBehavior } from '../src/engine/data/firmwareRegistry';
import { isSimulating } from '../src/engine/core/simulationDepth';
import type { IBattleEntity, IBattleState } from '../src/engine/types';

const WIDTH = Number(arg('width', '1'));
const ITER = Number(arg('iter', WIDTH === 1 ? '20' : '5'));
const OWNER = arg('owner');
const COMP = arg('comp', 'zoo');
const OPPS = arg('opps', 'ink_loop,fire_pair,control,ref_solo_a').split(',').filter(Boolean);
const OUT = arg('out', `results/t149_consume/w${WIDTH}_${OWNER}.jsonl`);
const OPP_LIMIT = Number(arg('opplimit', '0'));
const SWAP = arg('swap', '');
const MAX_TURNS = 60;

const COMPS: Record<string, string> = {
    ink_loop: 'kraken_v1+jormungandr_v1+huldra_v2',
    fire_pair: 'fenrir_v1+skoll_v1+jormungandr_v1',
    control: 'huldra_v2+ratatoskr_v2+jormungandr_v2',
    zoo: 'ratatoskr_v1+huldra_v1+kraken_v1',
    ref_solo_a: 'kraken_v1+skoll_v1+huldra_v2',
};
type Member = readonly [string, string];
const speciesOf = (fw: string): string => fw.replace(/_v[12]$/, '');
const members = (comp: string): Member[] => comp.split('+').map(fw => [speciesOf(fw), fw] as const);
const SPECIES = speciesOf(OWNER);

// ---- optional in-memory deck swap ---------------------------------------------------------------
if (SWAP) {
    const [from, to] = SWAP.split(':');
    const decks = (MingmingRegistry[SPECIES] as unknown as { decks: Record<string, string[]> }).decks;
    /*
     * EVERY copy, not the first. It replaced one until 163a, which was harmless for the benchmark
     * it was written for (`fire_punch_v2` swapped onto a frame that held one copy of the card it
     * replaced) and WRONG for the question ticket 152 asks: a loop needs TWO copies drawing each
     * other, so a swap that left the second copy as the base card would have measured a mixed
     * pile and reported it as the upgrade's number.
     */
    const before = decks[OWNER].length;
    const hits = decks[OWNER].filter((c) => c === from).length;
    if (hits === 0) throw new Error(`SWAP DID NOT TAKE: ${from} not in ${OWNER}`);
    decks[OWNER] = decks[OWNER].map((c) => (c === from ? to : c));
    if (decks[OWNER].length !== before) throw new Error('SWAP CHANGED THE DECK SIZE');
    console.error(`swap: ${OWNER} ${from} -> ${to} (${hits} cop${hits === 1 ? 'y' : 'ies'})`);
}
const DECK_CARDS = (MingmingRegistry[SPECIES] as unknown as { decks: Record<string, string[]> }).decks[OWNER];
const CARDS = new Set(arg('cards', DECK_CARDS.join(',')).split(',').filter(Boolean));

// ---- OS hook wrapping ----------------------------------------------------------------------------
const VALUE_PHASES = ['onDamageCalculated', 'onHealCalculated', 'onStatusDamageCalculated', 'onCostCalculated'] as const;
const STATE_PHASES = ['onActionStart', 'onActionEnd', 'onCardDraw', 'onTurnStart', 'onTurnEnd', 'onStatusApplied',
    'onStatusRemoved', 'onPostDamage', 'onDiscarded', 'onDeckShuffled', 'onHeal', 'onHpThresholdCrossed', 'onUnitFainted'] as const;

interface ProcTally {
    fires: number; offers: number;
    /** enemy party HP lost inside the handler (damage delivered, after shields) */
    dmgHp: number;
    /** ledger raw damage appended inside the handler (before shields / floor) */
    ledgerRaw: number;
    healHp: number; selfDmgHp: number;
    stacks: Record<string, number>;
    energy: number; maxEnergy: number; hand: number;
    /** modifier hooks: sum of (out - in) */
    modDelta: number; modIn: number;
    /** modifier hooks: per-fire deltas by |delta| bucket is overkill; keep count of positive/negative */
    modPos: number; modNeg: number;
}
const emptyTally = (): ProcTally => ({ fires: 0, offers: 0, dmgHp: 0, ledgerRaw: 0, healHp: 0, selfDmgHp: 0, stacks: {}, energy: 0, maxEnergy: 0, hand: 0, modDelta: 0, modIn: 0, modPos: 0, modNeg: 0 });
let procs = new Map<string, ProcTally>();
/** the id of the PLAYER-side owner unit in the game being played; hooks fired for other owners are ignored */
let OWNER_ID = '';
const tallyOf = (k: string): ProcTally => { let t = procs.get(k); if (!t) { t = emptyTally(); procs.set(k, t); } return t; };

const find = (s: IBattleState, id: string): IBattleEntity | undefined => s.playerParty.find(e => e.id === id) ?? s.enemyParty.find(e => e.id === id);
const stacksOf = (e: IBattleEntity | undefined, st: string): number => e?.statusEffects.find(x => x.type === st)?.stacks ?? 0;
const enemyHp = (s: IBattleState): number => s.enemyParty.reduce((a, e) => a + e.currentHp, 0);
const ledgerRaw = (s: IBattleState): number => (s.damageLedger ?? []).reduce((a, h) => a + h.raw, 0);
const TRACK_STATUS = ['Strengthened', 'Sharp', 'Dazed', 'Weakened', 'Burn', 'Poison', 'Regen', 'Energized', 'BarkShield', 'DarkStance', 'LightStance'];

function wrapOS(os: string): string[] {
    const def = getOSBehavior(os);
    if (!def) throw new Error(`no OS behaviour for ${os}`);
    const ids: string[] = [];
    for (const h of def.hooks) {
        const hook = h as unknown as Record<string, unknown>;
        if (hook.__t149) continue;
        hook.__t149 = true;
        ids.push(h.id);
        for (const phase of STATE_PHASES) {
            const orig = hook[phase] as ((c: { state: IBattleState }, o: IBattleEntity) => { state: IBattleState }) | undefined;
            if (typeof orig !== 'function') continue;
            hook[phase] = (context: { state: IBattleState }, owner: IBattleEntity) => {
                const before = context.state;
                const r = orig(context, owner);
                if (!isSimulating() && owner.id === OWNER_ID) {
                    const t = tallyOf(h.id);
                    t.offers++;
                    if (r.state !== before) {
                        const after = r.state;
                        const o0 = find(before, owner.id), o1 = find(after, owner.id);
                        const dEnemy = enemyHp(before) - enemyHp(after);
                        const dSelf = (o1?.currentHp ?? 0) - (o0?.currentHp ?? 0);
                        const dEnergy = (o1?.currentEnergy ?? 0) - (o0?.currentEnergy ?? 0);
                        const dMax = (o1?.maxEnergy ?? 0) - (o0?.maxEnergy ?? 0);
                        const dHand = after.playerDeck.hand.length - before.playerDeck.hand.length;
                        const dLedger = ledgerRaw(after) - ledgerRaw(before);
                        let changed = dEnemy !== 0 || dSelf !== 0 || dEnergy !== 0 || dMax !== 0 || dHand !== 0 || dLedger !== 0;
                        for (const st of TRACK_STATUS) {
                            const d = stacksOf(o1, st) - stacksOf(o0, st);
                            if (d !== 0) { t.stacks[st] = (t.stacks[st] ?? 0) + d; changed = true; }
                            // enemy-facing grants (huldra_v1 Weakened, kraken_v1 / ratatoskr_v2 Dazed, nidhoggr_v1 Poison)
                            const de = after.enemyParty.reduce((a, e) => a + stacksOf(e, st), 0) - before.enemyParty.reduce((a, e) => a + stacksOf(e, st), 0);
                            if (de !== 0) { t.stacks[`enemy:${st}`] = (t.stacks[`enemy:${st}`] ?? 0) + de; changed = true; }
                        }
                        if (changed) {
                            t.fires++;
                            if (dEnemy > 0) t.dmgHp += dEnemy;
                            if (dLedger > 0) t.ledgerRaw += dLedger;
                            if (dSelf > 0) t.healHp += dSelf; else t.selfDmgHp += -dSelf;
                            t.energy += dEnergy; t.maxEnergy += dMax; t.hand += dHand;
                        }
                    }
                }
                return r;
            };
        }
        for (const phase of VALUE_PHASES) {
            const orig = hook[phase] as ((v: number, c: unknown, o: IBattleEntity) => number) | undefined;
            if (typeof orig !== 'function') continue;
            hook[phase] = (value: number, context: unknown, owner: IBattleEntity) => {
                const r = orig(value, context, owner);
                if (!isSimulating() && owner.id === OWNER_ID) {
                    const t = tallyOf(h.id);
                    t.offers++;
                    if (r !== value) {
                        t.fires++; t.modDelta += r - value; t.modIn += value;
                        if (r > value) t.modPos++; else t.modNeg++;
                    }
                }
                return r;
            };
        }
    }
    return ids;
}
const HOOK_IDS = wrapOS(OWNER);
console.error(`wrapped ${HOOK_IDS.length} hooks of ${OWNER}: ${HOOK_IDS.join(' ')}`);

// ---- one game -------------------------------------------------------------------------------------
interface CastRow {
    card: string; turn: number; target: 'self' | 'enemy' | 'ally' | 'none';
    pre: Record<string, number>;
    post: Record<string, number>;
}
interface GameRow {
    width: number; owner: string; opponent: string; seed: string; start: string; winner: string; turns: number; truncated: boolean;
    ownerMaxHp: number; ownerTurnsAlive: number; ownerDiedTurn: number | null;
    casts: CastRow[];
    procs: Record<string, ProcTally>;
    samples: Array<Record<string, number | string>>;
}

function playGame(setupIn: ReturnType<typeof matchupScenario>, seed: string, start: 'PLAYER' | 'ENEMY', oppLabel: string): GameRow {
    procs = new Map();
    const built = buildScenarioState({ ...applyStatJitter(setupIn, seed), seed });
    let state: IBattleState = start === 'PLAYER' ? built : { ...built, activeSide: 'ENEMY' };
    const ownerUnit = state.playerParty.find(e => e.activeOS === OWNER);
    if (!ownerUnit) throw new Error(`owner ${OWNER} not in player party`);
    OWNER_ID = ownerUnit.id;
    const casts: CastRow[] = [];
    let turnsAlive = 0, lastRound = 0, diedTurn: number | null = null;
    const alive = (s: IBattleState): boolean => s.playerParty.some(e => e.currentHp > 0) && s.enemyParty.some(e => e.currentHp > 0);
    const tick = (s: IBattleState): void => {
        const o = find(s, OWNER_ID);
        if (o && o.currentHp <= 0 && diedTurn === null) diedTurn = s.turn;
        if (s.turn === lastRound) return;
        lastRound = s.turn;
        if (o && o.currentHp > 0) turnsAlive++;
    };
    tick(state);
    let truncated = false, guard = 0;
    // census samples: once per PLAYER turn, the owner's own piles, the first living enemy's piles,
    // and which watched cards are in hand - so pile-when-held can be compared with pile-at-cast.
    const samples: Array<Record<string, number | string>> = [];
    let sampledTurn = -1;
    while (alive(state)) {
        if (state.turn > MAX_TURNS || guard++ > 5000) { truncated = true; break; }
        if (state.activeSide === 'PLAYER' && state.turn !== sampledTurn) {
            sampledTurn = state.turn;
            const me = find(state, OWNER_ID);
            const foe = state.enemyParty.find(e => e.currentHp > 0);
            if (me && me.currentHp > 0) samples.push({
                turn: state.turn,
                selfPoison: stacksOf(me, 'Poison'), selfBurn: stacksOf(me, 'Burn'), selfStr: stacksOf(me, 'Strengthened'), selfRegen: stacksOf(me, 'Regen'),
                foePoison: stacksOf(foe, 'Poison'), foeWeak: stacksOf(foe, 'Weakened'), foeDazed: stacksOf(foe, 'Dazed'), foeSharp: stacksOf(foe, 'Sharp'),
                held: state.playerDeck.hand.filter(c => CARDS.has(c.dataId)).map(c => c.dataId).join(','),
            });
        }
        const action: BattleAction = getBestAction(state);
        let next = battleReducer(state, action);
        if (next === state) {
            next = battleReducer(state, { type: 'END_TURN' } as BattleAction);
            if (next === state) { truncated = true; break; }
        } else if (action.type === 'PLAY_PROGRAM' && state.activeSide === 'PLAYER') {
            const pay = (action as { payload: { sourceId: string; targetId: string; programId: string } }).payload;
            const dataId = state.playerDeck.hand.find(c => c.id === pay.programId)?.dataId;
            if (dataId && CARDS.has(dataId) && pay.sourceId === OWNER_ID) {
                const me0 = find(state, OWNER_ID), me1 = find(next, OWNER_ID);
                const tg0 = find(state, pay.targetId), tg1 = find(next, pay.targetId);
                const tgt: CastRow['target'] = !tg0 ? 'none' : tg0.id === OWNER_ID ? 'self' : state.playerParty.some(e => e.id === tg0.id) ? 'ally' : 'enemy';
                const pre: Record<string, number> = {
                    selfPoison: stacksOf(me0, 'Poison'), selfBurn: stacksOf(me0, 'Burn'), selfStr: stacksOf(me0, 'Strengthened'),
                    selfWeak: stacksOf(me0, 'Weakened'), selfEnergized: stacksOf(me0, 'Energized'),
                    tgtPoison: stacksOf(tg0, 'Poison'), tgtWeak: stacksOf(tg0, 'Weakened'), tgtDazed: stacksOf(tg0, 'Dazed'), tgtSharp: stacksOf(tg0, 'Sharp'),
                    tgtHp: tg0?.currentHp ?? 0, tgtMaxHp: tg0?.maxHp ?? 0,
                    selfHp: me0?.currentHp ?? 0, selfMaxHp: me0?.maxHp ?? 0, energy: me0?.currentEnergy ?? 0,
                    cardsPlayed: (me0 as unknown as { playsThisTurn?: number })?.playsThisTurn ?? state.cardsPlayedThisTurn,
                    discarded: state.cardsDiscardedThisTurn ?? 0,
                    nonNaturalDrawn: (me0 as unknown as { nonNaturalCardsDrawnThisTurn?: number })?.nonNaturalCardsDrawnThisTurn ?? state.nonNaturalCardsDrawnThisTurn ?? 0,
                };
                const led = next.damageLedger ?? [];
                const post: Record<string, number> = {
                    consumed: next.lastStatusConsumed ?? -1,
                    selfHpDelta: (me1?.currentHp ?? 0) - (me0?.currentHp ?? 0),
                    enemyHpDelta: enemyHp(state) - enemyHp(next),
                    ledgerRaw: led.reduce((a, h) => a + h.raw, 0),
                    ledgerAbsorbed: led.reduce((a, h) => a + h.absorbed, 0),
                    ledgerApplied: led.reduce((a, h) => a + h.applied, 0),
                    ledgerHits: led.length,
                    tgtPoisonDelta: stacksOf(tg1, 'Poison') - stacksOf(tg0, 'Poison'),
                    tgtWeakDelta: stacksOf(tg1, 'Weakened') - stacksOf(tg0, 'Weakened'),
                    selfPoisonDelta: stacksOf(me1, 'Poison') - stacksOf(me0, 'Poison'),
                    selfBurnDelta: stacksOf(me1, 'Burn') - stacksOf(me0, 'Burn'),
                    selfStrDelta: stacksOf(me1, 'Strengthened') - stacksOf(me0, 'Strengthened'),
                    selfEnergizedDelta: stacksOf(me1, 'Energized') - stacksOf(me0, 'Energized'),
                    energyDelta: (me1?.currentEnergy ?? 0) - (me0?.currentEnergy ?? 0),
                };
                casts.push({ card: dataId, turn: state.turn, target: tgt, pre, post });
            }
        }
        state = next;
        tick(state);
    }
    const winner = !state.playerParty.some(e => e.currentHp > 0) ? (!state.enemyParty.some(e => e.currentHp > 0) ? 'DRAW' : 'ENEMY')
        : !state.enemyParty.some(e => e.currentHp > 0) ? 'PLAYER' : 'TRUNC';
    return {
        width: WIDTH, owner: OWNER, opponent: oppLabel, seed, start, winner, turns: state.turn, truncated,
        ownerMaxHp: ownerUnit.maxHp, ownerTurnsAlive: turnsAlive, ownerDiedTurn: diedTurn,
        casts, procs: Object.fromEntries(procs), samples,
    };
}

// ---- drive ----------------------------------------------------------------------------------------
fs.mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
const cells: Array<{ setup: ReturnType<typeof matchupScenario>; opp: string }> = [];
if (WIDTH === 1) {
    for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
        for (const d of MingmingRegistry[sp].availableOS)
            cells.push({ setup: matchupScenario({ player: SPECIES, enemy: sp, playerOS: OWNER, enemyOS: d, seed: `t149c:${OWNER}:${d}` }), opp: d });
} else {
    const comp = COMPS[COMP] ?? COMP;
    if (!comp.split('+').includes(OWNER)) throw new Error(`${OWNER} is not in comp ${COMP} (${comp})`);
    for (const o of OPPS) {
        const opp = COMPS[o] ?? o;
        cells.push({ setup: teamScenario({ player: members(comp), enemy: members(opp), seed: `t149c3:${comp}:${opp}` }), opp: o });
    }
}
const list = OPP_LIMIT > 0 ? cells.filter((_, i) => i % Math.max(1, Math.floor(cells.length / OPP_LIMIT)) === 0).slice(0, OPP_LIMIT) : cells;
for (const cell of list) {
    const t0 = Date.now();
    let games = 0, turns = 0, wins = 0, ncasts = 0;
    for (const seed of deriveSeeds(cell.setup.seed, ITER)) {
        for (const start of ['PLAYER', 'ENEMY'] as const) {
            const row = playGame(cell.setup, seed, start, cell.opp);
            fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
            games++; turns += row.turns; ncasts += row.casts.length; if (row.winner === 'PLAYER') wins++;
        }
    }
    console.error(`  w${WIDTH} ${OWNER} vs ${cell.opp.padEnd(16)} games ${games} win ${(100 * wins / games).toFixed(0)}% turns ${(turns / games).toFixed(1)} casts ${ncasts}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.error(`-> ${OUT}`);
