
import { PRNG } from './PRNG';
import { GetMingmingData } from '../data/mingmingRegistry';
import type { IBattleEntity, IMove } from '../types';

/**
 * Fallback move given to Mingmings with no move definitions in the registry.
 */
const STRUGGLE_MOVE: IMove = {
    id: 'struggle',
    name: 'Struggle',
    intentType: 'Attack',
    priority: 10,
    actions: [{ type: 'ATTACK', power: 10, element: 'None', target: 'Single' }]
};

export function generateIntents(party: ReadonlyArray<IBattleEntity>, seed: string, turn: number): IBattleEntity[] {
    const intentPrng = new PRNG(`${seed}_target_${turn}`);

    return party.map(entity => {
        if (entity.currentHp <= 0 || entity.currentIntent) return entity;

        const definition = GetMingmingData(entity.definitionId);
        let moves = entity.moves || definition.moves;

        if (!moves || moves.length === 0) {
            console.warn(`[IntentUtils] Mingming ${entity.name} (${entity.definitionId}) has no moveset! Using fallback.`);
            moves = [STRUGGLE_MOVE];
        }

        const prngResult = intentPrng.next();
        const randVal = prngResult.value;
        const totalWeight = moves.reduce((sum, move) => sum + move.priority, 0);
        let threshold = randVal * totalWeight;
        let selectedIntent = moves[moves.length - 1];

        for (const move of moves) {
            threshold -= move.priority;
            if (threshold <= 0) {
                selectedIntent = move;
                break;
            }
        }

        return { ...entity, currentIntent: selectedIntent };
    });
}
