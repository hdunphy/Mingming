/**
 * Epic 3: Reward / Drop Table Engine
 * Handles post-battle loot rolls using seeded PRNG for deterministic results.
 */

import { PRNG } from './core/PRNG';
import { GetProgramData } from './data/programRegistry';
import type { IRewardBundle, IDropTableEntry, IBlueprint, IOwnedProgram } from './gameTypes';
import { createOwnedProgram } from './gameTypes';
import type { IBattleEntity, Element } from './types';

// --- Default Drop Tables ---

const DEFAULT_DROP_TABLES: Record<string, IDropTableEntry> = {
    'def_fire': {
        architectureId: 'def_fire',
        blueprintDropRate: 0.05,
        scrapMin: 5,
        scrapMax: 15,
        cardPool: ['reckless', 'flamethrower', 'erupt', 'rage', 'charge', 'radiate', 'fired_up', 'toats', 'roast', 'spicy_breath', 'preheat', 'flash', 'fire_punch']
    },
    'def_water': {
        architectureId: 'def_water',
        blueprintDropRate: 0.05,
        scrapMin: 5,
        scrapMax: 15,
        cardPool: ['squirt', 'water_jet', 'whirlpool', 'bathe', 'scald', 'toxic_water', 'renew', 'wave', 'hypnosis', 'reguvinate', 'rain', 'drink_tea', 'hydro_pump', 'cannon_ball', 'hot_springs']
    },
    'def_neutral': {
        architectureId: 'def_neutral',
        blueprintDropRate: 0.03,
        scrapMin: 3,
        scrapMax: 10,
        cardPool: ['rest', 'scratch', 'cleanse']
    }
};

/**
 * Get or create a drop table entry for a given definition ID
 */
export function getDropTable(definitionId: string): IDropTableEntry {
    return DEFAULT_DROP_TABLES[definitionId] ?? {
        architectureId: definitionId,
        blueprintDropRate: 0.05,
        scrapMin: 5,
        scrapMax: 15,
        cardPool: ['scratch', 'rest'] // Fallback pool
    };
}

/**
 * Roll rewards for a single defeated entity
 */
function rollForEntity(
    entity: IBattleEntity,
    prng: PRNG
): { scraps: number; blueprint: IBlueprint | null; cards: IOwnedProgram[]; nextSeed: number } {
    const table = getDropTable(entity.definitionId);

    // 1. Roll scrap yield
    const scrapRoll = prng.nextInt(table.scrapMin, table.scrapMax);
    const scraps = scrapRoll.value;

    // 2. Roll blueprint drop
    const bpRoll = new PRNG(scrapRoll.nextSeed).next();
    const blueprint = bpRoll.value < table.blueprintDropRate
        ? {
            architectureId: table.architectureId,
            name: `${entity.name} Blueprint`,
            compileCost: 100
        }
        : null;

    // 3. Roll 3 random cards from the pool
    const cards: IOwnedProgram[] = [];
    let currentSeed = bpRoll.nextSeed;

    const cardCount = Math.min(3, table.cardPool.length);
    for (let i = 0; i < cardCount; i++) {
        const cardRoll = new PRNG(currentSeed).nextInt(0, table.cardPool.length - 1);
        const cardId = table.cardPool[cardRoll.value];
        cards.push(createOwnedProgram(cardId));
        currentSeed = cardRoll.nextSeed;
    }

    return { scraps, blueprint, cards, nextSeed: currentSeed };
}

/**
 * Roll the complete reward bundle for a victorious battle.
 * Uses seeded PRNG for deterministic results (replays, testing).
 */
export function rollDropTable(
    defeatedEntities: ReadonlyArray<IBattleEntity>,
    seed: string
): IRewardBundle {
    let totalScraps = 0;
    const allBlueprints: IBlueprint[] = [];
    const allCards: IOwnedProgram[] = [];
    let currentSeed = seed;

    for (const entity of defeatedEntities) {
        if (entity.currentHp > 0) continue; // Only loot defeated units

        const prng = new PRNG(currentSeed);
        const result = rollForEntity(entity, prng);

        totalScraps += result.scraps;
        if (result.blueprint) {
            allBlueprints.push(result.blueprint);
        }
        allCards.push(...result.cards);
        currentSeed = result.nextSeed.toString();
    }

    return {
        scraps: totalScraps,
        blueprints: allBlueprints,
        cards: allCards
    };
}

// --- Scrap Economy Helpers ---

/** Scrap values by rarity (future: read from ProgramData) */
const SCRAP_YIELDS: Record<string, number> = {
    'Common': 10,
    'Uncommon': 25,
    'Rare': 50,
    'Epic': 100
};

/**
 * Calculate the scrap yield from deconstructing a card.
 * Default to Common (10) if rarity is unknown.
 */
export function getScrapYield(rarity: string = 'Common'): number {
    return SCRAP_YIELDS[rarity] ?? 10;
}
