/**
 * Ticket 104 safety check: the preview now RUNS the reducer. Does that leave any mark on the
 * caller's state? If the reducer mutated entities or the deck in place, a hover would silently
 * change the real game - which would be a far worse bug than the one being fixed.
 */
import { computeDamagePreview } from '../src/ui/utils/damagePreview';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import type { IBattleState } from '../src/engine/types';

const setup = matchupScenario({
    player: 'fenrir', enemy: 'control', playerOS: 'fenrir_v1', enemyOS: 'control_v1', seed: 'purity',
});
const base = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
const cards = (MingmingRegistry.fenrir.decks as Record<string, string[]>).fenrir_v1;

let leaks = 0;
for (const cardId of [...new Set(cards)]) {
    const st = {
        ...base,
        activeSide: 'PLAYER',
        playerDeck: { ...base.playerDeck, hand: [{ id: 'c', dataId: cardId, currentCost: 0, isPlayable: true }] },
    } as IBattleState;
    const snapshot = JSON.stringify(st);
    computeDamagePreview(st, st.playerParty[0].id, 'c', st.enemyParty[0].id);
    if (JSON.stringify(st) !== snapshot) {
        leaks++;
        console.error(`  LEAK: previewing ${cardId} mutated the caller's state`);
    }
}
console.error(`\npreview purity: ${leaks === 0 ? 'CLEAN' : `${leaks} LEAKS`} over ${new Set(cards).size} cards`);
if (leaks) process.exit(1);
