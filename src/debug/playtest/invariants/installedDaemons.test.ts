/**
 * TICKET 193b — an installed Daemon (Aura) is not a vanished card.
 *
 * A Daemon leaves the hand and goes onto its unit's `daemons` list, which `sidePiles` did not read, so
 * 2026-10-03 r01 reported two `card-vanished` failures, both for Feedback Loop, on every Aura it played.
 */
import { describe, it, expect } from 'vitest';
import { battleInvariants } from './battleInvariants';
import { createSparseBattleState, createSparseEntity } from '../../scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity } from '../../../engine/types';

const aura: ProgramEntity = { id: 'a1', dataId: 'feedback_loop', currentCost: 1, isPlayable: true };
const empty = (owner: 'PLAYER' | 'ENEMY') => ({ ownerId: owner, deck: [], drawpile: [], discard: [], exhaust: [], hand: [] });

/** One move earlier the Aura is in the hand; now it is on the unit. */
function installed(): { before: IBattleState; after: IBattleState } {
    const before = createSparseBattleState({
        playerParty: [createSparseEntity({ id: 'p1', name: 'Kraken' })],
        playerDeck: { ...empty('PLAYER'), hand: [aura] },
        enemyDeck: empty('ENEMY'),
    });
    const after: IBattleState = {
        ...before,
        playerParty: [{ ...before.playerParty[0], daemons: [aura] }],
        playerDeck: empty('PLAYER'),
    };
    return { before, after };
}

const names = (v: ReadonlyArray<{ name: string }>) => v.map((x) => x.name);

describe('193b — installed Daemons', () => {
    it('playing an Aura does not read as a vanished card', () => {
        const { before, after } = installed();
        expect(names(battleInvariants(after, before))).not.toContain('card-vanished');
    });

    it('a card that really left every list is still caught', () => {
        const { before, after } = installed();
        const gone = { ...after, playerParty: [{ ...after.playerParty[0], daemons: [] }] };
        expect(names(battleInvariants(gone, before))).toContain('card-vanished');
    });

    it('an enemy unit\'s Daemon counts for the enemy side', () => {
        const before = createSparseBattleState({
            enemyParty: [createSparseEntity({ id: 'e1', name: 'Foe' })],
            playerDeck: empty('PLAYER'),
            enemyDeck: { ...empty('ENEMY'), hand: [aura] },
        });
        const after: IBattleState = { ...before, enemyParty: [{ ...before.enemyParty[0], daemons: [aura] }], enemyDeck: empty('ENEMY') };
        expect(names(battleInvariants(after, before))).not.toContain('card-vanished');
    });

    it('a card id in both the discard and the installed list is a duplicate', () => {
        const { after } = installed();
        const twice = { ...after, playerDeck: { ...after.playerDeck, discard: [aura] } };
        expect(names(battleInvariants(twice))).toContain('duplicate-card-id');
    });
});
