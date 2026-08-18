/**
 * Ticket 75: the hel_v1 diagnostic instrument.
 *
 * Nothing in the codebase records which STANCE Hel is in, and questions 1-3 of the ticket all
 * need it. `DarkStance` / `LightStance` are mutually-exclusive permanent status effects capped at
 * 1, so the tracker is just a read of `statusEffects` sampled at the right moments:
 *
 *   - at the START of each of her actions  -> which stance the card she is about to cast benefits from
 *   - when she TAKES damage                -> whether LightStance's -30% was actually up
 *   - when she casts `eclipse`             -> whether its +30 power was earned
 *
 * TWILIGHT_CADENCE sets stance at the END of an action, so a card never benefits from the stance
 * it sets - only the next one does. That is the rhythm this measures.
 */
import { battleReducer, type BattleAction } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { applyStatJitter, deriveSeeds } from '../src/debug/balance/runBatch';
import { GetProgramData } from '../src/engine/data/programRegistry';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import type { IBattleState, IBattleEntity } from '../src/engine/types';
import { writeFileSync } from 'node:fs';

const OS = process.env.OS_ID ?? 'hel_v1';
const SPECIES = 'hel';
const ITER = Number(process.env.ITER ?? 12);

const stanceOf = (e: IBattleEntity): 'Dark' | 'Light' | 'none' =>
    e.statusEffects?.some(s => s.type === 'DarkStance') ? 'Dark'
        : e.statusEffects?.some(s => s.type === 'LightStance') ? 'Light' : 'none';
const hp = (p: ReadonlyArray<IBattleEntity>) => p.reduce((t, e) => t + e.currentHp, 0);

/** Does this opponent's DECK contain anything that applies Poison or Burn? `purify`'s premise. */
function appliesDoT(deck: string[]): boolean {
    return deck.some(id => {
        const c = GetProgramData(id);
        return (c?.actions ?? []).some(a => {
            const st = (a as unknown as { status?: string }).status;
            return st === 'Poison' || st === 'Burn';
        });
    });
}

interface Acc {
    actions: Record<string, number>;             // stance at the moment she acts
    damageDealtByStance: Record<string, number>;
    damageTakenByStance: Record<string, number>;
    eclipseCasts: number; eclipseInLight: number; eclipseDamage: number;
    plays: Record<string, number>; seen: Record<string, number>;
    purifyVsDoT: number; purifyVsNoDoT: number;
    turnsHers: number;
    switches: number;                            // stance actually CHANGED between her actions
}
const A: Acc = {
    actions: { Dark: 0, Light: 0, none: 0 }, damageDealtByStance: { Dark: 0, Light: 0, none: 0 },
    damageTakenByStance: { Dark: 0, Light: 0, none: 0 }, eclipseCasts: 0, eclipseInLight: 0,
    eclipseDamage: 0, plays: {}, seen: {}, purifyVsDoT: 0, purifyVsNoDoT: 0, turnsHers: 0, switches: 0,
};
const perOpp: Record<string, { dealt: number; taken: number; turns: number; wins: number; games: number }> = {};

const myDeck: string[] = (MingmingRegistry as never as Record<string, { decks: Record<string, string[]> }>)[SPECIES].decks[OS];

for (const opp of BALANCE_SPECIES.filter(s => s !== SPECIES)) {
    const oppDeck: string[] = (MingmingRegistry as never as Record<string, { decks: Record<string, string[]>; availableOS: string[] }>)[opp].decks[
        (MingmingRegistry as never as Record<string, { availableOS: string[] }>)[opp].availableOS[0]];
    const dot = appliesDoT(oppDeck);
    const setup = matchupScenario({ player: SPECIES, enemy: opp, playerOS: OS, seed: `band:${OS}:${opp}` });
    const P = (perOpp[opp] ??= { dealt: 0, taken: 0, turns: 0, wins: 0, games: 0 });

    for (const seed of deriveSeeds(setup.seed, ITER)) for (const side of ['PLAYER', 'ENEMY'] as const) {
        const built = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
        let st: IBattleState = side === 'PLAYER' ? built : { ...built, activeSide: 'ENEMY' };
        let g = 0, lastStance = 'none';
        const alive = (p: ReadonlyArray<IBattleEntity>) => p.some(e => e.currentHp > 0);
        P.games++;
        while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && g++ < 4000) {
            const me = st.playerParty[0];
            const stance = stanceOf(me);
            const myHpBefore = hp(st.playerParty), foeHpBefore = hp(st.enemyParty);
            const act: BattleAction = getBestAction(st);
            const mine = act.type === 'PLAY_PROGRAM' && st.playerParty.some(e => e.id === (act as never as { payload: { sourceId: string } }).payload.sourceId);

            let cast: string | undefined;
            if (mine) {
                cast = st.playerDeck.hand.find(c => c.id === (act as never as { payload: { programId: string } }).payload.programId)?.dataId;
                A.actions[stance]++;
                if (stance !== lastStance) A.switches++;
                lastStance = stance;
                if (cast) {
                    A.plays[cast] = (A.plays[cast] ?? 0) + 1;
                    if (cast === 'eclipse') { A.eclipseCasts++; if (stance === 'Light') A.eclipseInLight++; }
                    if (cast === 'purify') { if (dot) A.purifyVsDoT++; else A.purifyVsNoDoT++; }
                }
            }
            for (const c of st.playerDeck.hand) A.seen[c.dataId] = (A.seen[c.dataId] ?? 0) + 1;

            let next = battleReducer(st, act);
            if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }

            const dealt = Math.max(0, foeHpBefore - hp(next.enemyParty));
            const taken = Math.max(0, myHpBefore - hp(next.playerParty));
            if (dealt) { A.damageDealtByStance[stance] += dealt; P.dealt += dealt; if (cast === 'eclipse') A.eclipseDamage += dealt; }
            if (taken) { A.damageTakenByStance[stanceOf(me)] += taken; P.taken += taken; }
            st = next;
        }
        P.turns += st.turn;
        if (!alive(st.enemyParty) && alive(st.playerParty)) P.wins++;
    }
}

const pct = (n: number, d: number) => d ? `${(n / d * 100).toFixed(1)}%` : 'n/a';
const totalActions = Object.values(A.actions).reduce((a, b) => a + b, 0);
const totalDealt = Object.values(A.damageDealtByStance).reduce((a, b) => a + b, 0);
const totalTaken = Object.values(A.damageTakenByStance).reduce((a, b) => a + b, 0);

console.error(`\n=== ${OS} (deck of ${myDeck.length}) - ${ITER}x2 games vs each of 15 opponents\n`);
console.error(`STANCE WHEN SHE ACTS  (n=${totalActions})`);
for (const k of ['Dark', 'Light', 'none']) console.error(`  ${k.padEnd(6)} ${String(A.actions[k]).padStart(5)}  ${pct(A.actions[k], totalActions)}`);
console.error(`  stance CHANGED between consecutive actions: ${pct(A.switches, totalActions)}`);
console.error(`\nDAMAGE DEALT by the stance she was in  (total ${totalDealt})`);
for (const k of ['Dark', 'Light', 'none']) console.error(`  ${k.padEnd(6)} ${String(A.damageDealtByStance[k]).padStart(6)}  ${pct(A.damageDealtByStance[k], totalDealt)}`);
console.error(`\nDAMAGE TAKEN by the stance she was in  (total ${totalTaken})   <- LightStance is -30%`);
for (const k of ['Dark', 'Light', 'none']) console.error(`  ${k.padEnd(6)} ${String(A.damageTakenByStance[k]).padStart(6)}  ${pct(A.damageTakenByStance[k], totalTaken)}`);
console.error(`\nECLIPSE  casts ${A.eclipseCasts}  in LightStance ${A.eclipseInLight} (${pct(A.eclipseInLight, A.eclipseCasts)})  total damage ${A.eclipseDamage}  avg ${(A.eclipseDamage / Math.max(1, A.eclipseCasts)).toFixed(1)}`);
console.error(`PURIFY   vs a DoT deck ${A.purifyVsDoT}  vs a NON-DoT deck ${A.purifyVsNoDoT}`);
console.error(`\nCARD PLAY RATE (played / times seen in hand)`);
for (const id of [...new Set(myDeck)]) {
    const p = A.plays[id] ?? 0, s = A.seen[id] ?? 0;
    console.error(`  ${id.padEnd(16)} x${myDeck.filter(c => c === id).length}  played ${String(p).padStart(4)}  seen ${String(s).padStart(5)}  rate ${pct(p, s)}`);
}
console.error(`\nPER OPPONENT (dealt/turn, taken/turn, NET)`);
const rows = Object.entries(perOpp).map(([o, p]) => ({ o, wr: p.wins / p.games, d: p.dealt / p.turns, t: p.taken / p.turns, net: (p.dealt - p.taken) / p.turns }));
rows.sort((a, b) => a.wr - b.wr);
for (const r of rows) console.error(`  ${r.o.padEnd(14)} win ${(r.wr * 100).toFixed(0).padStart(3)}%   dealt/turn ${r.d.toFixed(2).padStart(6)}  taken/turn ${r.t.toFixed(2).padStart(6)}  NET ${(r.net >= 0 ? '+' : '') + r.net.toFixed(2)}`);

writeFileSync(`/tmp/${OS}-diagnostic.json`, JSON.stringify({ os: OS, iterations: ITER, acc: A, perOpp }, null, 1));
