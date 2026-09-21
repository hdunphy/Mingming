/**
 * WHAT THE ENEMY HAS TO PLAY WITH, AS A LIST — ticket 159b.
 *
 * §5 asks for a UI test that "the panel lists N rows in cost order, greys by affordability, and
 * shows the tile on row hover". The first two are arithmetic and live here; the third is a render
 * concern and lives in the component test beside it.
 *
 * What makes these worth writing rather than obvious: every one of them is a rule about what the
 * player is TOLD, and the ticket's whole design rests on telling them the truth and nothing more.
 * A row greyed when it should not be is a card the player writes off; one ungreyed when it should
 * be is a threat they brace for that cannot come. The preview adds a third failure the hand never
 * had — claiming to know a card that has not been shuffled yet — and `unknown` is what forecloses
 * it.
 */
import { describe, expect, it } from 'vitest';

import { enemyHandView, highestEnemyEnergy, stackHand } from './enemyHand';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';

const card = (dataId: string, n = 1): ProgramEntity[] =>
    Array.from({ length: n }, (_, i) => ({
        id: `${dataId}-${i}`, dataId, currentCost: 1, isPlayable: true,
    } as ProgramEntity));

const foe = (
    id: string,
    energy: number,
    extra: Partial<IBattleEntity> = {},
): IBattleEntity => ({
    id,
    name: id,
    currentEnergy: energy,
    maxEnergy: energy,
    currentHp: 100,
    cardDraw: 3,
    statusEffects: [],
    ...extra,
} as unknown as IBattleEntity);

const board = (enemies: IBattleEntity[]): IBattleState =>
    ({ enemyParty: enemies } as unknown as IBattleState);

/** A CARDS fight, from the enemy deck's three piles out. */
const fight = (
    enemies: IBattleEntity[],
    deck: { drawpile?: ProgramEntity[]; hand?: ProgramEntity[]; discard?: ProgramEntity[] },
    extra: Partial<IBattleState> = {},
): IBattleState => ({
    enemyMode: 'CARDS',
    enemyParty: enemies,
    enemyDeck: {
        ownerId: 'ENEMY',
        deck: [],
        drawpile: deck.drawpile ?? [],
        hand: deck.hand ?? [],
        discard: deck.discard ?? [],
        exhaust: [],
    },
    ...extra,
} as unknown as IBattleState);

describe('159b — how much Energy the enemy side can actually bring', () => {
    it('takes the HIGHEST, not the sum', () => {
        /*
         * The question a greyed row answers is "could this be cast at all", and one caster with
         * four Energy makes a four-cost card castable however poor the other two are. Summing
         * would promise combinations no single unit can pay for — the panel would ungrey a card
         * nobody can play.
         */
        expect(highestEnemyEnergy(board([foe('a', 1), foe('b', 4), foe('c', 2)]))).toBe(4);
    });

    it('ignores the dead, who cannot act', () => {
        expect(highestEnemyEnergy(board([foe('a', 9, { currentHp: 0 }), foe('b', 2)]))).toBe(2);
        expect(highestEnemyEnergy(board([foe('a', 9, { currentHp: 0 })]))).toBe(0);
    });

    it('survives no board at all', () => {
        expect(highestEnemyEnergy(null)).toBe(0);
    });

    it('measures a PREVIEW against the Energy they will have, not the tank they just emptied', () => {
        /*
         * This is the one that makes the panel usable rather than merely correct. A preview is
         * read during the PLAYER's turn, which is after the enemy has spent down — usually to
         * zero. Measured against `currentEnergy` every row would grey out, and a panel that greys
         * everything at exactly the moment the player is deciding reads as broken.
         *
         * `processPreTurn` refills a living unit to `maxEnergy + Energized stacks`, so that is
         * what the preview measures against.
         */
        const spent = board([foe('a', 0, { maxEnergy: 4 })]);
        expect(highestEnemyEnergy(spent, 'HAND')).toBe(0);
        expect(highestEnemyEnergy(spent, 'PREVIEW')).toBe(4);
    });

    it('counts Energized into the preview, because the refill does', () => {
        const buffed = board([
            foe('a', 0, { maxEnergy: 3, statusEffects: [{ type: 'Energized', stacks: 2 }] as never }),
        ]);
        expect(highestEnemyEnergy(buffed, 'PREVIEW')).toBe(5);
    });
});

describe('159b — which list the panel is looking at', () => {
    it('shows the real hand whenever they are holding one', () => {
        // Their own turn: the cards in hand are the truth, and no preview can improve on it.
        const view = enemyHandView(fight([foe('a', 2)], {
            hand: card('ignite', 2),
            drawpile: card('molten_core', 5),
        }));

        expect(view.source).toBe('HAND');
        expect(view.cards.map(c => c.dataId)).toEqual(['ignite', 'ignite']);
        expect(view.unknown).toBe(0);
    });

    it('previews the top of the drawpile when the hand is empty', () => {
        /*
         * The player's turn. The engine discarded the enemy's hand at the end of its turn and
         * redraws at the start of its next, so the top X of the drawpile IS the hand about to be
         * played. `drawCards` takes from the FRONT (`shift`), which is why this is `slice(0, x)`
         * and not the tail.
         */
        const view = enemyHandView(fight([foe('a', 2), foe('b', 2)], {
            drawpile: [...card('ignite', 2), ...card('molten_core', 3), ...card('growth', 4)],
        }));

        // 3 + 3 − 1 = 5 for two living members.
        expect(view.source).toBe('PREVIEW');
        expect(view.cards).toHaveLength(5);
        expect(view.cards.map(c => c.dataId))
            .toEqual(['ignite', 'ignite', 'molten_core', 'molten_core', 'molten_core']);
        expect(view.unknown).toBe(0);
    });

    it('shrinks when a mingming dies — the case Henry named', () => {
        const alive = fight([foe('a', 2), foe('b', 2), foe('c', 2)], { drawpile: card('ignite', 9) });
        // 3 + 3 + 3 − 2 = 7.
        expect(enemyHandView(alive).cards).toHaveLength(7);

        const bereaved = fight(
            [foe('a', 2), foe('b', 2), foe('c', 2, { currentHp: 0 })],
            { drawpile: card('ignite', 9) },
        );
        // 3 + 3 − 1 = 5. The dead member stops contributing immediately, as it does in the reducer.
        expect(enemyHandView(bereaved).cards).toHaveLength(5);
    });

    it('follows a cardDraw buff, the other case Henry named', () => {
        const buffed = fight(
            [foe('a', 2, { cardDraw: 6 }), foe('b', 2)],
            { drawpile: card('ignite', 9) },
        );
        // 6 + 3 − 1 = 8. The number comes from `describeDraw`, so there is one copy of the formula.
        expect(enemyHandView(buffed).cards).toHaveLength(8);
    });

    it('states the reshuffle tail as a COUNT and never guesses at it', () => {
        /*
         * The shuffle is seeded and could be simulated. It must not be: the seed advances on every
         * card the player casts, so a simulated tail would rewrite itself between one play and the
         * next. A preview that silently changes its mind is worse than one that admits a gap.
         */
        const view = enemyHandView(fight([foe('a', 2), foe('b', 2)], {
            drawpile: card('ignite', 2),
            discard: card('growth', 6),
        }));

        expect(view.cards.map(c => c.dataId)).toEqual(['ignite', 'ignite']);
        // Wants 5, knows 2 — and says so rather than dealing three cards out of the discard.
        expect(view.unknown).toBe(3);
        expect(view.cards.some(c => c.dataId === 'growth')).toBe(false);
    });

    it('clamps the tail to the discard, because a reshuffle deals no cards that do not exist', () => {
        const view = enemyHandView(fight([foe('a', 2), foe('b', 2)], {
            drawpile: card('ignite', 2),
            discard: card('growth', 1),
        }));

        // Wants 5, has 2 + 1 in the whole fight. Claiming 3 would invent two cards.
        expect(view.cards).toHaveLength(2);
        expect(view.unknown).toBe(1);
    });

    it('shows nothing for a MOVES enemy, which is what hides the tab', () => {
        const view = enemyHandView(fight([foe('a', 2)], { drawpile: card('ignite', 4) }, {
            enemyMode: 'MOVES',
        }));

        expect(view.cards).toHaveLength(0);
        expect(view.unknown).toBe(0);
    });

    it('survives no board at all', () => {
        expect(enemyHandView(null).cards).toHaveLength(0);
    });
});

describe('159b — the list as rows', () => {
    it('stacks duplicates and orders by cost, then name', () => {
        // Cost first because that is the axis the player decides against; name second so the list
        // is stable between renders rather than reshuffling as cards move.
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

    it('is empty for an empty list, which is what hides the tab', () => {
        expect(stackHand([], 5)).toEqual([]);
    });
});

/**
 * THE ONLY CHECK THAT CAN ACTUALLY FAIL HONESTLY.
 *
 * Everything above compares the preview against a second copy of the rule I wrote. This one
 * compares it against the ENGINE: take a real battle on the player's turn, ask the panel what the
 * enemy is about to draw, then run the reducer through the turn boundary and look at the hand it
 * actually dealt. If `slice` is off by one, if the draw comes off the back of the pile rather than
 * the front, if the formula drifts from the reducer's copy — this is what says so, and nothing
 * else in this file would.
 */
describe('159b — the preview names the cards the enemy actually draws', () => {
    it('matches the hand the reducer deals, card for card and in order', async () => {
        const { battleReducer } = await import('../../engine/battleReducer');
        const { createSparseBattleState, createSparseEntity } =
            await import('../../debug/scenarios/scenarioTestSupport');

        const playerTurn = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            enemyMode: 'CARDS',
            enemyParty: [
                createSparseEntity({ id: 'e1', definitionId: 'draugr', name: 'Draugr', cardDraw: 3 }),
                createSparseEntity({ id: 'e2', definitionId: 'draugr', name: 'Draugr', cardDraw: 3 }),
            ],
            enemyDeck: {
                ownerId: 'ENEMY',
                deck: [],
                drawpile: [
                    ...card('ignite', 2), ...card('molten_core', 2), ...card('growth', 4),
                ],
                hand: [],
                discard: [],
                exhaust: [],
            },
        });

        // What the player is shown while it is still their move.
        const shown = enemyHandView(playerTurn);
        expect(shown.source).toBe('PREVIEW');
        expect(shown.unknown).toBe(0);

        // What the engine hands the enemy when the turn actually passes.
        const enemyTurn = battleReducer(playerTurn, { type: 'END_TURN' });
        expect(enemyTurn.activeSide).toBe('ENEMY');

        expect(enemyTurn.enemyDeck.hand.map(c => c.id)).toEqual(shown.cards.map(c => c.id));
    });
});
