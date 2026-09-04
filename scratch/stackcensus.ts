/**
 * Ticket 102: how big do the duality piles actually GET in play?
 *
 * The per-card pricer can only see what one card grants (never more than 5). What decides whether
 * +1 power per stack is a nudge or a runaway is what a deck ACCUMULATES across a turn, and no
 * per-card instrument can see that. This walks real games and records the pile.
 *
 * env: DECK (required), ITER (seeds per opponent, default 4), OPPONENTS (default 10 spread)
 */
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { deriveSeeds, applyStatJitter } from '../src/debug/balance/runBatch';
import { battleReducer } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import type { IBattleState, IBattleEntity, BattleAction } from '../src/engine/types';
import { ENV } from './_env';

const DECK = ENV.DECK ?? 'sleipnir_v1';
const SPECIES = DECK.replace(/_v[12]$/, '');
const ITER = Number(ENV.ITER ?? 4);
const OPPONENT_COUNT = Number(ENV.OPPONENTS ?? 10);
const TRACKED = ['Strengthened', 'Weakened', 'Sharp', 'Dazed'] as const;

const all: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
    for (const d of MingmingRegistry[sp].availableOS) all.push({ sp, deck: d });
const step = Math.max(1, Math.floor(all.length / OPPONENT_COUNT));
const opponents = all.filter((_, i) => i % step === 0).slice(0, OPPONENT_COUNT);

const peak: Record<string, number> = {};
const sum: Record<string, number> = {};
let samples = 0;
for (const s of TRACKED) { peak[s] = 0; sum[s] = 0; }

const stacksOf = (e: IBattleEntity, s: string) => e.statusEffects.find(x => x.type === s)?.stacks ?? 0;

for (const o of opponents) {
    const setup = matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck, seed: `sc:${DECK}:${o.deck}`,
    });
    for (const seed of deriveSeeds(setup.seed, ITER)) {
        let st: IBattleState = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
        let guard = 0;
        const alive = (p: ReadonlyArray<IBattleEntity>) => p.some(e => e.currentHp > 0);
        let lastTurn = -1;
        while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
            const me = st.playerParty[0];
            const them = st.enemyParty[0];
            if (st.activeSide === 'PLAYER' && st.turn !== lastTurn && me && them) {
                lastTurn = st.turn; samples++;
                for (const s of TRACKED) {
                    // Strengthened/Weakened live on ME; Sharp/Dazed on the target I am hitting.
                    const v = (s === 'Strengthened' || s === 'Weakened')
                        ? stacksOf(me, s) : stacksOf(them, s);
                    sum[s] += v;
                    if (v > peak[s]) peak[s] = v;
                }
            }
            const action: BattleAction = getBestAction(st);
            let next = battleReducer(st, action);
            if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
            st = next;
        }
    }
}

console.error(`\nSTACK CENSUS ${DECK}   my turns sampled ${samples}`);
for (const s of TRACKED)
    console.error(`  ${s.padEnd(15)} mean ${(sum[s] / Math.max(1, samples)).toFixed(2).padStart(6)}   peak ${String(peak[s]).padStart(3)}   -> +${peak[s]} power at the top`);
console.error(`CSV,${DECK},${samples},` + TRACKED.map(s => `${(sum[s] / Math.max(1, samples)).toFixed(3)},${peak[s]}`).join(','));
