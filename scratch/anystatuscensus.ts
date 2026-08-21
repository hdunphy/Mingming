/**
 * Ticket 107: the scorer constant for `ANY_STATUS`.
 *
 * The ticket: *"the DISTINCT_STATUS path needs an any-status variant constant - measure the board
 * reality and set it; document."*
 *
 * This measures the same quantity ticket 66 measured for `DISTINCT_STATUS` (which came out at 0.70
 * and took the constant from 3 to 1), on the same population and with the same rule: **distinct
 * status TYPES on the card's target, counted UNCONDITIONALLY** - boards with nothing on them count
 * as zero. That is what makes it the one census number in the file needing no floor caveat, and
 * the any-status variant has to be measured the same way or the two constants are not comparable.
 *
 * Two populations are reported, because `rimebreaker` is a card in a deck AND a card in the
 * registry that anyone could draft:
 *   - ROSTER: every deck's target, the general case the constant has to price.
 *   - DRAUGR: what draugr_v2's own targets actually look like, which is the number that explains
 *     the card in play.
 *
 * env: ITER (seeds per pairing, default 3), STEP (opponent spread, default 3)
 */
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { deriveSeeds, applyStatJitter } from '../src/debug/balance/runBatch';
import { battleReducer } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { NEGATIVE_STATUSES } from '../src/engine/core/ConditionValidator';
import type { IBattleState, IBattleEntity } from '../src/engine/types';

const ITER = Number(process.env.ITER ?? 3);
const STEP = Number(process.env.STEP ?? 3);

const decks: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) for (const d of MingmingRegistry[sp].availableOS) decks.push({ sp, deck: d });

const anyAll: number[] = [];
const debuffAll: number[] = [];
const anyDraugr: number[] = [];

const distinct = (e: IBattleEntity, only?: readonly string[]) => new Set(
    e.statusEffects.filter(s => s.stacks > 0 && (!only || only.includes(s.type))).map(s => s.type),
).size;

let pairs = 0;
for (const a of decks) {
    for (const b of decks) {
        if (a.sp === b.sp) continue;
        if ((pairs++ % STEP) !== 0) continue;
        const setup = matchupScenario({
            player: a.sp, enemy: b.sp, playerOS: a.deck, enemyOS: b.deck, seed: `any:${a.deck}:${b.deck}`,
        });
        for (const seed of deriveSeeds(setup.seed, ITER)) {
            let st = buildScenarioState({ ...applyStatJitter(setup, seed), seed }) as IBattleState;
            let guard = 0;
            const alive = (p: ReadonlyArray<IBattleEntity>) => p.some(e => e.currentHp > 0);
            while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
                const action = getBestAction(st);
                // Sample at the moment a card is aimed - the same instant the scaling reads.
                if (action.type === 'PLAY_PROGRAM') {
                    const t = st.playerParty.find(e => e.id === action.payload.targetId)
                        ?? st.enemyParty.find(e => e.id === action.payload.targetId);
                    if (t) {
                        anyAll.push(distinct(t));
                        debuffAll.push(distinct(t, NEGATIVE_STATUSES));
                        if (a.deck === 'draugr_v2' && st.activeSide === 'PLAYER') anyDraugr.push(distinct(t));
                    }
                }
                let next = battleReducer(st, action);
                if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
                st = next;
            }
        }
    }
}

const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

console.error(`\nANY_STATUS CENSUS   ${anyAll.length} card-aims sampled`);
console.error(`  ROSTER any-status distinct    mean ${mean(anyAll).toFixed(2)}   median ${med(anyAll)}`);
console.error(`  ROSTER debuff-only distinct   mean ${mean(debuffAll).toFixed(2)}   median ${med(debuffAll)}` +
    `   (ticket 66 measured 0.70 -> constant 1)`);
console.error(`  DRAUGR_V2's own targets       mean ${mean(anyDraugr).toFixed(2)}   median ${med(anyDraugr)}   n ${anyDraugr.length}`);
console.error(`CSV,anystatus,${mean(anyAll).toFixed(3)},${mean(debuffAll).toFixed(3)},${mean(anyDraugr).toFixed(3)}`);
