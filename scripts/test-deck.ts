import { getArchetypeDeck } from './src/engine/data/battleFactories';
import { instantiateDeck } from './src/engine/data/battleFactories';

try {
    const ids = getArchetypeDeck('FENRIR');
    console.log("FENRIR ids:", ids);

    const deck = instantiateDeck(ids);
    console.log("FENRIR deck valid:", deck.every(d => d.dataId !== undefined));
} catch (e) {
    console.error(e);
}
