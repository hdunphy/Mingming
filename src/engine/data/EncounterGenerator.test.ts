import { describe, it, expect } from 'vitest';
import { generateEncounter } from './EncounterGenerator';
import { createMockEntity } from './battleFactories';
import { GetProgramData } from './programRegistry';

describe('EncounterGenerator', () => {
    const playerParty = [
        createMockEntity('Player 1', 'fenrir', 10),
        createMockEntity('Player 2', 'kraken', 10)
    ];

    it('should generate an encounter with the correct sector element', () => {
        const encounter = generateEncounter({
            sectorElement: 'Fire',
            playerParty
        });

        expect(encounter.enemyParty.length).toBeGreaterThan(0);
        encounter.enemyParty.forEach(enemy => {
            expect(enemy.primaryElement).toBe('Fire');
        });

        encounter.enemyDeckIds.forEach(id => {
            const data = GetProgramData(id);
            expect(data.id).not.toBe('missing');
            expect(data.element === 'Fire' || data.element === 'None').toBe(true);
        });
    });

    it('should scale enemy level based on player average level', () => {
        const encounter = generateEncounter({
            sectorElement: 'Water',
            playerParty,
            seed: 'steady-seed'
        });

        const avgLevel = 10;
        encounter.enemyParty.forEach(enemy => {
            // Variance is -2 to +2
            expect(enemy.level).toBeGreaterThanOrEqual(avgLevel - 2);
            expect(enemy.level).toBeLessThanOrEqual(avgLevel + 2);
        });
    });

    it('should include a daemon in the enemy deck if available for that element', () => {
        const encounter = generateEncounter({
            sectorElement: 'Fire',
            playerParty
        });

        const hasDaemon = encounter.enemyDeckIds.some(id => GetProgramData(id).category === 'Daemon');
        expect(hasDaemon).toBe(true);
    });
});
