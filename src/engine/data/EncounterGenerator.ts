import { MingmingRegistry, PLAYABLE_SPECIES } from './mingmingRegistry';
import { ProgramRegistry } from './programRegistry';
import type { Element, IBattleEntity, IMingmingState, IMingmingDefinition } from '../types';
import { initializeBattleEntity, } from '../types';
import { PRNG } from '../core/PRNG';
import { rollSeed } from '../core/SeedStream';

/**
 * Epic 8: Milestone 8.1 - Encounter Generator
 * Generates randomized enemy encounters based on a chosen elemental sector.
 */

export interface IEncounterOptions {
    sectorElement: Element;
    playerParty: IBattleEntity[];
    /**
     * Omit only when the caller genuinely wants an unreproducible encounter -
     * createBattleState always threads its own seed in. Absent, one is rolled
     * once (never Date.now(), which is correlated across calls in the same
     * millisecond and so is not even a good ad-hoc seed).
     */
    seed?: string;
}

export interface IGeneratedEncounter {
    enemyParty: IBattleEntity[];
    enemyDeckIds: string[];
}

/**
 * Pure helper: the wild species pool for a sector element — exactly the pool
 * the encounter generator draws enemies from. The UI uses this to truthfully
 * list a sector's inhabitants, so it must stay in sync with generateEncounter
 * (which consumes it directly).
 */
export function getSectorSpecies(element: Element): IMingmingDefinition[] {
    // Ticket 42: `isControl` entries are measuring instruments, not wild Mingmings.
    return Object.values(MingmingRegistry).filter(def => !def.isControl && def.primaryElement === element);
}

export function generateEncounter(options: IEncounterOptions): IGeneratedEncounter {
    const { sectorElement, playerParty, seed = rollSeed() } = options;
    const prng = new PRNG(seed);

    // Ticket 21: enemies used to be generated at `avgPlayerLevel ± 2`. Level scaling is gone —
    // `vision.md` rules difficulty as enemy team design, never stat inflation, so every unit on
    // both sides is built at CALIBRATION_LEVEL and the encounter's difficulty lives entirely in
    // WHICH species, deck and OS it fields. The ±2 PRNG draw is deleted rather than ignored,
    // because a dead draw would silently shift every downstream roll in this seeded stream.

    // Randomize Party Size
    const { value: partySize } = prng.nextInt(1, playerParty.length);

    // 3. Filter Mingmings by Element (shared with the UI's sector intel list)
    const eligibleMingmingIds = getSectorSpecies(sectorElement).map(def => def.id);

    // Fallback to all if none found (shouldn't happen with valid sectorElement)
    const pool = eligibleMingmingIds.length > 0 ? eligibleMingmingIds : [...PLAYABLE_SPECIES];

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
    } else {
        console.warn(`[EncounterGenerator] No daemons found for element ${sectorElement}.`);
        // Fallback to any daemon? Or just skip. Let's skip for now to avoid cross-element weirdness 
        // unless the deck is too small. actually, let's grab from any daemon just to have one.
        const allDaemons = Object.keys(ProgramRegistry).filter(id => ProgramRegistry[id].category === 'Daemon');
        if (allDaemons.length > 0) {
            const { value: dIndex } = prng.nextInt(0, allDaemons.length - 1);
            enemyDeckIds.push(allDaemons[dIndex]);
        }
    }

    // Add 9 random cards from pool
    const finalPool = (enemyPool.length > 0) ? enemyPool : Object.keys(ProgramRegistry).filter(id => !ProgramRegistry[id].isToken && ProgramRegistry[id].category !== 'Daemon');

    if (finalPool.length === 0) {
        console.error(`[EncounterGenerator] CRITICAL: No eligible cards found in registry at all!`);
    } else {
        for (let i = 0; i < 9; i++) {
            const { value: cIndex } = prng.nextInt(0, finalPool.length - 1);
            enemyDeckIds.push(finalPool[cIndex]);
        }
    }

    return {
        enemyParty,
        enemyDeckIds
    };
}
