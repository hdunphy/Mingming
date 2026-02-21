import { generateEncounter } from './src/engine/data/EncounterGenerator';
import { createBattleState } from './src/engine/data/battleFactories';
import { createStarterSave } from './src/engine/gameTypes';
import { createDefaultSave } from './src/engine/gameTypes';

const save = createDefaultSave();
// mock what sector terminal does
save.gauntlet = {
    type: 'Gym',
    element: 'Fire',
    currentBattleIndex: 0,
    totalBattles: 3,
    persistedStats: {}
};
save.roster = createStarterSave('fenrir').roster;
save.activeParty = [save.roster[0].id];

try {
    const state = createBattleState(save as any, []);
    console.log("Enemy Deck Cards:", state.enemyDeck.drawpile.map(c => c.dataId));
    console.log("Enemy Hand Cards:", state.enemyDeck.hand.map(c => c.dataId));
} catch (e) {
    console.error(e);
}
