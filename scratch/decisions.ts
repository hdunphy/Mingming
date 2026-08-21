/**
 * Ticket 99: the decision-density census - where does the game ASK the player something?
 *
 * Henry's playtest finding, in his words: *"each deck feels like they have a specific card
 * hierarchy so each hand is decided for itself."* The decks he enjoyed (hel_v2, ymir_v2, fafnir_v1)
 * make each hand a question; the ones he called boring play themselves. This measures that.
 *
 * Three proxies, all read off the AI's own candidate scoring through `setDecisionTap`:
 *
 *   DECISIONS/TURN  - how many lines beat standing pat. One means the turn had no choice in it.
 *   CLOSE-CALL RATE - share of decisions whose top two lines sit within the dominance margin
 *                     (12 eval points = 6 HP). A close call is a decision; a 40-point lead is a
 *                     deck playing itself.
 *   FLIP RATE       - share of decisions where looking ONE TURN AHEAD changed the pick. This is
 *                     the sharpest of the three: it is not "the scores were similar", it is "a
 *                     shallower player gets this wrong".
 *
 * The fourth proxy in the ticket, the greedy gap, is the same question asked in win rate rather
 * than in decisions: run the same deck with `AI_GREEDY=1` and diff the field. It is a separate,
 * much more expensive measurement, so it runs only for the decks this instrument ranks at the
 * extremes - which is where it can falsify the ranking.
 *
 * env: DECK (required), ITER (seeds per opponent, default 6), OPPONENTS (default 10 spread)
 */
import { setDecisionTap, type DecisionRecord } from '../src/engine/ai/TacticalAI';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { deriveSeeds, applyStatJitter } from '../src/debug/balance/runBatch';
import { battleReducer } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import type { IBattleState, IBattleEntity, BattleAction } from '../src/engine/types';

const DECK = process.env.DECK ?? 'hel_v2';
const SPECIES = DECK.replace(/_v[12]$/, '');
const ITER = Number(process.env.ITER ?? 6);
const OPPONENT_COUNT = Number(process.env.OPPONENTS ?? 10);

const all: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
    for (const d of MingmingRegistry[sp].availableOS) all.push({ sp, deck: d });
// Every Nth opponent - a spread across the roster rather than a cherry-picked slice, and the same
// spread for every deck so the columns are comparable.
const step = Math.max(1, Math.floor(all.length / OPPONENT_COUNT));
const opponents = all.filter((_, i) => i % step === 0).slice(0, OPPONENT_COUNT);

const mine: DecisionRecord[] = [];
setDecisionTap(record => { if (record.side === 'PLAYER') mine.push(record); });

// FORECLOSURE - added after the three proxies above failed validation (see the ticket).
// What a solver measures is how hard a choice is to COMPUTE. What Henry described enjoying is how
// much a choice COSTS: ymir_v2 can play one card a turn, fafnir_v1 banks Energy instead of spending
// it, hel_v2 pays HP for everything. In all three the question is not "which line is best" but
// "what am I giving up", and a deck with an obvious best play can still be interesting if playing
// it forecloses something else.
//   held        - cards in hand at the start of my turn: the options I was holding
//   played      - how many of them I actually got to use
//   foreclosed  - the share I held and could not play (1 - played/held)
//   unspent     - Energy left on the table at end of turn
let games = 0;
let turns = 0;
let held = 0;
let played = 0;
let unspent = 0;
for (const o of opponents) {
    const setup = matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck, seed: `dd:${DECK}:${o.deck}`,
    });
    for (const seed of deriveSeeds(setup.seed, ITER)) {
        let st: IBattleState = buildScenarioState({ ...applyStatJitter(setup, seed), seed });
        games++;
        let guard = 0;
        const alive = (p: ReadonlyArray<IBattleEntity>) => p.some(e => e.currentHp > 0);
        let lastTurn = -1;
        while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
            if (st.activeSide === 'PLAYER' && st.turn !== lastTurn) {
                lastTurn = st.turn; turns++;
                held += st.playerDeck.hand.length;
            }
            const mineNow = st.activeSide === 'PLAYER';
            const action: BattleAction = getBestAction(st);
            if (mineNow && action.type === 'PLAY_PROGRAM') played++;
            if (mineNow && action.type === 'END_TURN') unspent += st.playerParty[0]?.currentEnergy ?? 0;
            let next = battleReducer(st, action);
            if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
            st = next;
        }
    }
}
setDecisionTap(null);

// A decision only counts as one if there was something to decide BETWEEN: `candidates > 1`.
// Turns where a single line beat standing pat, or none did, are the deck playing itself, and they
// are reported separately rather than averaged away.
const real = mine.filter(d => d.candidates > 1);
const close = real.filter(d => d.close);
const flipped = real.filter(d => d.flipped);
const noChoice = mine.filter(d => d.candidates <= 1);
const meanGap = real.length
    ? real.reduce((sum, d) => sum + (d.gap ?? 0), 0) / real.length
    : 0;
const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0).toFixed(1);

console.error(`\nDECISIONS ${DECK}   games ${games}  my turns ${turns}`);
console.error(`  decisions with a choice   ${real.length} of ${mine.length}  (${pct(real.length, mine.length)}%)   no-choice turns ${noChoice.length}`);
console.error(`  candidates per decision   ${(real.reduce((s, d) => s + d.candidates, 0) / Math.max(1, real.length)).toFixed(2)}`);
console.error(`  CLOSE-CALL rate           ${pct(close.length, real.length)}%   (top two within 12 eval points)`);
console.error(`  FLIP rate                 ${pct(flipped.length, real.length)}%   (lookahead changed the pick)`);
console.error(`  mean top-two gap          ${meanGap.toFixed(1)} eval points`);
const foreclosed = held ? (1 - played / held) * 100 : 0;
console.error(`  FORECLOSURE               ${foreclosed.toFixed(1)}%   (cards held and never played)   ` +
    `unspent Energy ${(unspent / Math.max(1, turns)).toFixed(2)}/turn`);
console.error(`CSV,${DECK},${games},${turns},${mine.length},${real.length},${noChoice.length},` +
    `${pct(close.length, real.length)},${pct(flipped.length, real.length)},${meanGap.toFixed(2)},${foreclosed.toFixed(2)},${(unspent / Math.max(1, turns)).toFixed(3)}`);
