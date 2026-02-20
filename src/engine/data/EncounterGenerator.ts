import { MingmingRegistry } from './mingmingRegistry';
import { ProgramRegistry } from './programRegistry';
import type { Element, IBattleEntity, IMingmingState } from '../types';
import { initializeBattleEntity, getExpForLevel } from '../types';
import { PRNG } from '../core/PRNG';

/**
 * Epic 8: Milestone 8.1 - Encounter Generator
 * Generates randomized enemy encounters based on a chosen elemental sector.
 */

export interface IEncounterOptions {
    sectorElement: Element;
    playerParty: IBattleEntity[];
    seed?: string;
}

export interface IGeneratedEncounter {
    enemyParty: IBattleEntity[];
    enemyDeckIds: string[];
}

export function generateEncounter(options: IEncounterOptions): IGeneratedEncounter {
    const { sectorElement, playerParty, seed = Date.now().toString() } = options;
    const prng = new PRNG(seed);

    // 1. Calculate Level Scaling
    const avgPlayerLevel = Math.floor(playerParty.reduce((sum, p) => sum + p.level, 0) / playerParty.length);
    const { value: enemyLevelVariance } = prng.nextInt(-2, 2);
    const enemyLevel = Math.max(1, avgPlayerLevel + enemyLevelVariance);

    // 2. Randomize Party Size
    const { value: partySize } = prng.nextInt(1, playerParty.length);

    // 3. Filter Mingmings by Element
    const eligibleMingmingIds = Object.keys(MingmingRegistry).filter(id => {
        const def = MingmingRegistry[id];
        return def.primaryElement === sectorElement;
    });

    // Fallback to all if none found (shouldn't happen with valid sectorElement)
    const pool = eligibleMingmingIds.length > 0 ? eligibleMingmingIds : Object.keys(MingmingRegistry);

    const enemyPartyStates: IMingmingState[] = [];
    for (let i = 0; i < partySize; i++) {
        const { value: mmIndex } = prng.nextInt(0, pool.length - 1);
        const mmId = pool[mmIndex];
        const def = MingmingRegistry[mmId];

        const { nextSeed } = prng.next();
        enemyPartyStates.push({
            id: `enemy_${mmId}_${nextSeed}`,
            definitionId: mmId,
            nickname: `Wild ${def.name}`,
            level: enemyLevel,
            experience: getExpForLevel(enemyLevel),
            blueprintsCollected: 0,
            hpIV: prng.nextInt(10, 31).value,
            attackIV: prng.nextInt(10, 31).value,
            defenseIV: prng.nextInt(10, 31).value
        });
    }

    const enemyParty = enemyPartyStates.map(state =>
        initializeBattleEntity(state, MingmingRegistry[state.definitionId])
    );

    // 4. Build Elemental Deck
    // Logic: Sector Element cards + "None" category utility cards
    const sectorCards = Object.keys(ProgramRegistry).filter(id => {
        const p = ProgramRegistry[id];
        return p.element === sectorElement || p.element === 'None';
    });

    // Filter out Daemons and Tokens for normal enemy decks
    const enemyPool = sectorCards.filter(id => {
        const p = ProgramRegistry[id];
        return p.category !== 'Daemon' && !p.isToken;
    });

    // Pick a Daemon for the archetype if available
    const daemonPool = Object.keys(ProgramRegistry).filter(id => {
        const p = ProgramRegistry[id];
        return p.category === 'Daemon' && (p.element === sectorElement || p.element === 'None');
    });

    const enemyDeckIds: string[] = [];

    // Add 1 Daemon if pool exists
    if (daemonPool.length > 0) {
        const { value: dIndex } = prng.nextInt(0, daemonPool.length - 1);
        enemyDeckIds.push(daemonPool[dIndex]);
    }

    // Add 9 random cards from pool
    for (let i = 0; i < 9; i++) {
        const { value: cIndex } = prng.nextInt(0, enemyPool.length - 1);
        enemyDeckIds.push(enemyPool[cIndex]);
    }

    return {
        enemyParty,
        enemyDeckIds
    };
}
