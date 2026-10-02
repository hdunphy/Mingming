/**
 * TICKET 186e — the damage ledger says who dealt the damage.
 *
 * Every card attack reaches the ATTACK handler as an HP mutation, and `applyMutations` used to write
 * `sourceId: 'SYSTEM'` on all of them, so 96 percent of the ledger (measured over 96 fights) named the
 * engine instead of the card's caster. The mutation already carries the real source; the heal path
 * already used it. Damage with no named source (a status tick, recoil with no owner) stays `SYSTEM`.
 */
import { describe, expect, it } from 'vitest';

import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity } from './types';

const card = (id: string, dataId: string): ProgramEntity => ({ id, dataId, currentCost: 0, isPlayable: true } as ProgramEntity);

const board = (): IBattleState =>
    createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', definitionId: 'kraken', name: 'Kraken', currentEnergy: 9, maxEnergy: 9 })],
        enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'fenrir', name: 'Foe', currentHp: 500, maxHp: 500 })],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [card('c1', 'tackle')], discard: [], exhaust: [] },
    });

describe('186e — the ledger names the caster', () => {
    it('a card attack is credited to the unit that played it, not to SYSTEM', () => {
        const next = battleReducer(board(), { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' } });
        const hits = (next.damageLedger ?? []).filter((h) => h.raw > 0);
        expect(hits.length).toBeGreaterThan(0);
        for (const hit of hits) expect(hit.sourceId).toBe('p1');
    });
});
