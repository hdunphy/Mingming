/**
 * TICKET 193c — a difference the game's own log explains is not a surprise.
 *
 * 2026-10-03 listed four "surprises": Whirlpool+ "Apply 4 Dazed" gave 6 and Whirlpool "Apply 2 Dazed"
 * gave 4 (Kraken's ABYSSAL_INK_SYS adds 2 Dazed on every draw outside the draw phase, and Whirlpool
 * draws), and Pressure Point hit twice (Feedback Loop's zap). Ticket 186d ruled that card text stays
 * clean and the log reports what a firmware adds, so those are the ruling working, not wording bugs.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from '../../../engine/battleReducer';
import { createSparseBattleState, createSparseEntity } from '../../scenarios/scenarioTestSupport';
import { GetProgramData } from '../../../engine/data/programRegistry';
import { compare } from './compare';
import { explainDifferences, firedHooks } from './explainedByLog';
import { outcomeOf, type PlayRecord } from './outcome';
import type { IBattleEntity, IBattleState } from '../../../engine/types';

const FRAME = 3000;
const unit = (id: string, extra: Partial<IBattleEntity> = {}): IBattleEntity =>
    createSparseEntity({ id, name: id === 'p1' ? 'Kraken' : 'Foe', currentHp: FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5, ...extra });

function play(caster: Partial<IBattleEntity>, dataId: string): PlayRecord {
    const before: IBattleState = createSparseBattleState({
        activeSide: 'PLAYER', phase: 'ACTION',
        playerParty: [unit('p1', caster)],
        enemyParty: [unit('e1')],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], discard: [], exhaust: [],
            drawpile: [{ id: 'd1', dataId: 'tackle', currentCost: 0, isPlayable: true }, { id: 'd2', dataId: 'tackle', currentCost: 0, isPlayable: true }],
            hand: [{ id: 'h1', dataId, currentCost: GetProgramData(dataId).baseCost as number, isPlayable: true }],
        },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
    });
    const action = { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } } as const;
    const after = battleReducer(before, action as never);
    return { action: action as never, before, after, hits: [] };
}

const diffs = (record: PlayRecord, prediction: Parameters<typeof compare>[0]) => compare(prediction, outcomeOf(record), record.before);

describe('193c — a firmware that fired explains its own difference', () => {
    const whirlpool = play({ activeOS: 'kraken_v1' }, 'whirlpool');

    it('Kraken\'s Abyssal Ink is among the hooks that fired', () => {
        expect(firedHooks(whirlpool).map((h) => h.ownerName)).toContain('ABYSSAL_INK_SYS');
    });

    it('the card text says 2 Dazed, the foe got 4, and that is explained', () => {
        const differences = diffs(whirlpool, { status: { Foe: { Dazed: 2 } } });
        expect(differences).toHaveLength(1);
        const result = explainDifferences(whirlpool, differences);
        expect(result.explained).toHaveLength(1);
        expect(result.unexplained).toHaveLength(0);
        expect(result.by).toContain('ABYSSAL_INK_SYS');
    });
});

describe('193c — what is not explained is still a surprise', () => {
    it('the same Whirlpool without the firmware: an unforeseen Dazed has no one to explain it', () => {
        const bare = play({}, 'whirlpool');
        const result = explainDifferences(bare, diffs(bare, { status: { Foe: { Dazed: 5 } } }));
        expect(result.explained).toHaveLength(0);
        expect(result.unexplained).toHaveLength(1);
    });

    it('a firmware that fired but cannot change the kind of thing that differs does not explain it', () => {
        const whirlpool = play({ activeOS: 'kraken_v1' }, 'whirlpool');
        // Abyssal Ink applies a status; it cannot make an extra hit, so a wrong hit count is still the card's.
        const result = explainDifferences(whirlpool, diffs(whirlpool, { hits: 5 }));
        expect(result.unexplained.map((d) => d.key)).toEqual(['hits']);
    });

    it('with no hook fired there is nothing to explain', () => {
        const tackle = play({}, 'tackle');
        expect(firedHooks(tackle)).toEqual([]);
        expect(explainDifferences(tackle, diffs(tackle, { hits: 3 })).unexplained).toHaveLength(1);
    });
});

describe('193c — an Aura\'s extra hit', () => {
    it('Feedback Loop\'s zap explains a hit count one higher than the card', () => {
        const aura = { id: 'a1', dataId: 'feedback_loop', currentCost: 1, isPlayable: true };
        const record = play({ daemons: [aura] }, 'whirlpool');
        // Whirlpool draws, the Aura zaps once: two hits where the card text promises one.
        const differences = diffs(record, { hits: 1 });
        const result = explainDifferences(record, differences);
        expect(differences.length).toBeGreaterThan(0);
        expect(result.unexplained).toHaveLength(0);
        expect(result.by.length).toBeGreaterThan(0);
    });
});
