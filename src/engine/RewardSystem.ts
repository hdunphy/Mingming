/**
 * Epic 3: Reward / Drop Table Engine
 * Handles post-battle loot rolls using seeded PRNG for deterministic results.
 */

import { PRNG } from './core/PRNG';
import { GetProgramData } from './data/programRegistry';
import type { IRewardBundle, IDropTableEntry, IBlueprint, IOwnedProgram, ICardChoice } from './gameTypes';
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
 * Calculate dynamic blueprint drop rate based on roster size
 */
function getBlueprintRate(rosterSize: number): number {
    if (rosterSize <= 1) return 0.25; // 25% for first teammate
    if (rosterSize === 2) return 0.15; // 15% for completing party
    return 0.05; // 5% for upgrades
}

/**
 * Roll rewards for a single defeated entity
 */
function rollForEntity(
    entity: IBattleEntity,
    rosterSize: number,
    prng: PRNG
): { scraps: number; blueprint: IBlueprint | null; cardChoice: ICardChoice; xp: number; nextSeed: number } {
    const table = getDropTable(entity.definitionId);

    // 1. Roll scrap yield
    const scrapRoll = prng.nextInt(table.scrapMin, table.scrapMax);
    const scraps = scrapRoll.value;

    // 2. Roll blueprint drop (Scaled by roster size)
    const bpRate = getBlueprintRate(rosterSize);
    const bpRoll = new PRNG(scrapRoll.nextSeed).next();
    const blueprint = bpRoll.value < bpRate
        ? {
            architectureId: table.architectureId,
            name: `${entity.name} Blueprint`,
            compileCost: 100
        }
        : null;

    // 3. Roll 3 random cards for the "Choice" array
    const options: IOwnedProgram[] = [];
    let currentSeed = bpRoll.nextSeed;

    const optionsCount = 3;
    for (let i = 0; i < optionsCount; i++) {
        const cardRoll = new PRNG(currentSeed).nextInt(0, table.cardPool.length - 1);
        const cardId = table.cardPool[cardRoll.value];
        options.push(createOwnedProgram(cardId));
        currentSeed = cardRoll.nextSeed;
    }

    const cardChoice: ICardChoice = {
        sourceEntityName: entity.name,
        options
    };

    // 4. XP Calculation: Defeated_Level * 20
    const xp = entity.level * 20;

    return { scraps, blueprint, cardChoice, xp, nextSeed: currentSeed };
}

/**
 * Roll the complete reward bundle for a victorious battle.
 * Uses seeded PRNG for deterministic results.
 */
export function rollDropTable(
    defeatedEntities: ReadonlyArray<IBattleEntity>,
    rosterSize: number,
    seed: string
): IRewardBundle {
    let totalScraps = 0;
    let totalXP = 0;
    const allBlueprints: IBlueprint[] = [];
    const allCardChoices: ICardChoice[] = [];
    let currentSeed = seed;

    for (const entity of defeatedEntities) {
        if (entity.currentHp > 0) continue;

        const prng = new PRNG(currentSeed);
        const result = rollForEntity(entity, rosterSize, prng);

        totalScraps += result.scraps;
        totalXP += result.xp;
        if (result.blueprint) {
            allBlueprints.push(result.blueprint);
        }
        allCardChoices.push(result.cardChoice);
        currentSeed = result.nextSeed.toString();
    }

    return {
        scraps: totalScraps,
        blueprints: allBlueprints,
        cards: [], // No guaranteed cards in this version
        cardChoices: allCardChoices,
        totalXP
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
