/**
 * THE ENEMY'S HAND, AS A LIST — ticket 159b.
 *
 * §5 asks for a UI test that "the panel lists N rows in cost order, greys by affordability, and
 * shows the tile on row hover". The first two are arithmetic and live here; the third is a render
 * concern and lives in the component test beside it.
 *
 * What makes these worth writing rather than obvious: every one of them is a rule about what the
 * player is TOLD, and the ticket's whole design rests on telling them the truth and nothing more.
 * A row greyed when it should not be is a card the player writes off; one ungreyed when it should
 * be is a threat they brace for that cannot come.
 */
import { describe, expect, it } from 'vitest';

import { highestEnemyEnergy, stackHand } from './enemyHand';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';

const card = (dataId: string, n = 1): ProgramEntity[] =>
    Array.from({ length: n }, (_, i) => ({
        id: `${dataId}-${i}`, dataId, currentCost: 1, isPlayable: true,
    } as ProgramEntity));

const foe = (id: string, energy: number, hp = 100): IBattleEntity =>
    ({ id, currentEnergy: energy, currentHp: hp } as unknown as IBattleEntity);

const board = (enemies: IBattleEntity[]): IBattleState =>
    ({ enemyParty: enemies } as unknown as IBattleState);

describe('159b — how much Energy the enemy side can actually bring', () => {
    it('takes the HIGHEST, not the sum', () => {
        /*
         * The question a greyed row answers is "could this be cast at all this turn", and one
         * caster with four Energy makes a four-cost card castable however poor the other two are.
         * Summing would promise combinations no single unit can pay for — the panel would ungrey
         * a card nobody can play.
         */
        expect(highestEnemyEnergy(board([foe('a', 1), foe('b', 4), foe('c', 2)]))).toBe(4);
    });

    it('ignores the dead, who cannot act', () => {
        expect(highestEnemyEnergy(board([foe('a', 9, 0), foe('b', 2)]))).toBe(2);
        expect(highestEnemyEnergy(board([foe('a', 9, 0)]))).toBe(0);
    });

    it('survives no board at all', () => {
        expect(highestEnemyEnergy(null)).toBe(0);
    });
});

describe('159b — the hand as rows', () => {
    it('stacks duplicates and orders by cost, then name', () => {
        // Cost first because that is the axis the player decides against; name second so the list
        // is stable between renders rather than reshuffling as cards are drawn.
        const stacks = stackHand([...card('ignite', 3), ...card('molten_core'), ...card('growth')], 9);

        expect(stacks.map(s => s.dataId)).toHaveLength(3);
        const costs = stacks.map(s => s.cost);
        expect([...costs].sort((a, b) => a - b)).toEqual(costs);
        expect(stacks.find(s => s.dataId === 'ignite')?.count).toBe(3);
        expect(stacks.find(s => s.dataId === 'growth')?.count).toBe(1);
    });

    it('greys exactly the cards no living enemy could pay for', () => {
        const rich = stackHand(card('molten_core'), 9);
        expect(rich[0].unaffordable).toBe(false);

        const broke = stackHand(card('molten_core'), 0);
        expect(broke[0].unaffordable).toBe(true);

        // The boundary is "cost exceeds energy", so a card costing exactly the Energy available
        // is castable and must NOT be greyed.
        const exact = stackHand(card('molten_core'), rich[0].cost);
        expect(exact[0].unaffordable).toBe(false);
    });

    it('drops a card the registry no longer knows rather than rendering a blank row', () => {
        const stacks = stackHand([...card('ignite'), ...card('a_card_that_was_cut')], 9);
        expect(stacks.map(s => s.dataId)).toEqual(['ignite']);
    });

    it('is empty for an empty hand, which is what hides the tab', () => {
        expect(stackHand([], 5)).toEqual([]);
    });
});
