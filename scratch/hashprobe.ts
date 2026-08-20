/** Ticket 103: is a hooks.json edit actually visible to the cell cache's key? */
import { getOSBehavior } from '../src/engine/data/firmwareRegistry';
import { cellKey, engineHash } from '../src/debug/balance/cellCache';

const f = getOSBehavior('sleipnir_v1');
console.error('hooks in registry:', f?.hooks.length);
console.error('serialized:', JSON.stringify(f));
console.error('engineHash:', engineHash());
console.error('cellKey:', cellKey({
    playerSpecies: 'sleipnir', playerOS: 'sleipnir_v1',
    enemySpecies: 'control', enemyOS: 'control_v1',
    seed: 'probe', iterations: 30,
}));
