/**
 * TICKET 193f — a mirror fight names which Kraken is which.
 *
 * Three agents (2026-10-02 r02, 2026-10-04 r01 and r04) wrote notes asking whether their Kraken was hitting
 * itself; r04 wrote *"my biggest hits were my own cards hitting my own Kraken ... why would my best cards hit
 * me?"* and lost its Elite thinking it was a reflect mechanic. The hit lines print names only, so two units
 * called Kraken could not be told apart. The enemy side is tagged `(foe)` when a party unit shares its name.
 */
import { describe, it, expect } from 'vitest';
import { createSparseBattleState, createSparseEntity } from '../scenarios/scenarioTestSupport';
import { GetProgramData } from '../../engine/data/programRegistry';
import { step } from './battleSim';
import { fightName } from './sideTag';
import { reportFor } from './fightSettle';
import { fightReportLines } from './screens/fightReportLines';
import type { IBattleState } from '../../engine/types';
import type { IRegionNode } from '../../engine/runTypes';

function mirror(foeName: string): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER', phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', name: 'Kraken', currentHp: 2000, maxHp: 2000, currentEnergy: 5, maxEnergy: 5 })],
        enemyParty: [createSparseEntity({ id: 'e1', name: foeName, currentHp: 2000, maxHp: 2000 })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
            hand: [{ id: 'h1', dataId: 'tackle', currentCost: GetProgramData('tackle').baseCost as number, isPlayable: true }],
        },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] },
    });
}
const tackle = { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' } } as never;

describe('193f — fightName', () => {
    it('tags the enemy unit that shares a party unit\'s name', () => {
        const s = mirror('Kraken');
        expect(fightName(s, 'e1')).toBe('Kraken (foe)');
        expect(fightName(s, 'p1')).toBe('Kraken');
    });

    it('leaves distinct names exactly as they were', () => {
        const s = mirror('Huldra');
        expect(fightName(s, 'e1')).toBe('Huldra');
        expect(fightName(s, 'p1')).toBe('Kraken');
    });
});

describe('193f — the hit lines of a mirror fight', () => {
    it('name the foe, so a hit on it is not a hit on yourself', () => {
        const { hits } = step(mirror('Kraken'), tackle);
        expect(hits).toHaveLength(1);
        expect(hits[0].source).toBe('Kraken');
        expect(hits[0].target).toBe('Kraken (foe)');
    });

    it('a fight with distinct names is unchanged', () => {
        const { hits } = step(mirror('Huldra'), tackle);
        expect(hits[0].target).toBe('Huldra');
    });

    it('the fight report says who the foes were, tagged, and its biggest hits agree', () => {
        const s = mirror('Kraken');
        const { hits } = step(s, tackle);
        const report = reportFor({ id: 'n', kind: 'elite' } as IRegionNode, s, true, 3, false, hits);
        expect(report.foes[0].name).toBe('Kraken (foe)');
        const text = fightReportLines(report).join('\n');
        expect(text).toContain('Kraken (foe)');
        expect(text).toMatch(/Kraken's Tackle on Kraken \(foe\)/);
    });
});
