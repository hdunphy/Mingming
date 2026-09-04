import { describe, it, expect } from 'vitest';
import { generateEncounter, getSectorSpecies } from './EncounterGenerator';
import { createMockEntity } from './battleFactories';
import { GetProgramData } from './programRegistry';
import { MingmingRegistry } from './mingmingRegistry';
import type { Element } from '../types';

describe('EncounterGenerator', () => {
    const playerParty = [
        createMockEntity('Player 1', 'fenrir'),
        createMockEntity('Player 2', 'kraken')
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

        // Ticket 21: this used to assert enemy level sat within avgPlayerLevel ± 2. Level scaling
        // is gone — every unit is built at CALIBRATION_LEVEL — so what is left worth asserting is
        // that the generator still produces a party at all from a fixed seed.
        expect(encounter.enemyParty.length).toBeGreaterThan(0);
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

describe('getSectorSpecies', () => {
    it('returns the Fire pool including fenrir and skoll', () => {
        const ids = getSectorSpecies('Fire').map(def => def.id);
        expect(ids).toContain('fenrir');
        expect(ids).toContain('skoll');
    });

    it('never includes species of other elements', () => {
        const elements: Element[] = ['Fire', 'Water', 'Earth', 'Air', 'Nature', 'Ice', 'Light', 'Dark'];
        for (const element of elements) {
            const species = getSectorSpecies(element);
            species.forEach(def => expect(def.primaryElement).toBe(element));
        }
    });

    it('returns exactly the registry entries whose primaryElement matches (per element)', () => {
        const elements: Element[] = ['Fire', 'Water', 'Earth', 'Air', 'Nature', 'Ice', 'Light', 'Dark'];
        for (const element of elements) {
            const expected = Object.values(MingmingRegistry)
                .filter(def => def.primaryElement === element)
                .map(def => def.id)
                .sort();
            const actual = getSectorSpecies(element).map(def => def.id).sort();
            expect(actual).toEqual(expected);
        }
    });

    it('returns [] for an element with no wild species', () => {
        expect(getSectorSpecies('None' as Element)).toEqual([]);
    });
});
