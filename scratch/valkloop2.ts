/** Ticket 100 side-find: valkyrie_v2 hits the 4000-step guard in SOME matchup. Which, and how? */
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { deriveSeeds, applyStatJitter } from '../src/debug/balance/runBatch';
import { battleReducer } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import type { IBattleState } from '../src/engine/types';

const DECK = process.env.DECK ?? 'valkyrie_v2';
const SP = DECK.replace(/_v[12]$/, '');
const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SP)
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

for (const o of opponents.filter((_, i) => i % 3 === 0)) {
    const setup = matchupScenario({
        player: SP, enemy: o.sp, playerOS: DECK, enemyOS: o.deck, seed: `cpt:${DECK}:${o.deck}`,
    });
    for (const seed of deriveSeeds(setup.seed, 4)) {
        let st = buildScenarioState({ ...applyStatJitter(setup, seed), seed }) as IBattleState;
        let guard = 0;
        const cards = new Map<string, number>();
        const alive = (p: ReadonlyArray<{ currentHp: number }>) => p.some(e => e.currentHp > 0);
        while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
            const action = getBestAction(st);
            if (st.activeSide === 'PLAYER' && action.type === 'PLAY_PROGRAM') {
                const c = st.playerDeck.hand.find(x => x.id === action.payload.programId);
                if (c) cards.set(c.dataId, (cards.get(c.dataId) ?? 0) + 1);
            }
            let next = battleReducer(st, action);
            if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
            st = next;
        }
        if (guard >= 4000) {
            console.error(`\nLOOP  ${DECK} vs ${o.deck}  seed ${seed}`);
            console.error(`  stuck at turn ${st.turn}, side ${st.activeSide}, hand ${st.playerDeck.hand.length},` +
                ` draw ${st.playerDeck.drawpile.length}, discard ${st.playerDeck.discard.length},` +
                ` energy ${st.playerParty[0]?.currentEnergy}`);
            console.error(`  top cards: ${[...cards.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${c} x${n}`).join('  ')}`);
            process.exit(0);
        }
    }
}
console.error('no loop found');
