/**
 * Epic 3: Reward / Drop Table Engine
 * Handles post-battle loot rolls using dynamic pooling and rarity-weighted logic.
 */

import { PRNG } from './core/PRNG';
import { ProgramRegistry } from './data/programRegistry';
import type { IRewardBundle, IBlueprint, IOwnedProgram, ICardChoice } from './gameTypes';
import { createOwnedProgram } from './gameTypes';
import type { IBattleEntity, Element, Rarity } from './types';

// --- Rarity Distribution Constants ---
const RARITY_WEIGHTS: Record<Rarity, number> = {
    'Common': 50,
    'Uncommon': 30,
    'Rare': 15,
    'Epic': 5
};

/**
 * Calculate dynamic blueprint drop rate based on roster size
 */
function getBlueprintRate(rosterSize: number): number {
    if (rosterSize <= 1) return 0.75; // 25% for first teammate
    if (rosterSize === 2) return 0.50; // 15% for completing party
    return 0.15; // 5% for upgrades
}

/**
 * Filter the registry for cards matching an element (includes 'None' as neutral)
 */
function getPoolForElement(element: Element): string[] {
    return Object.values(ProgramRegistry)
        .filter(p => p.element === element || p.element === 'None')
        .map(p => p.id);
}

/**
 * Roll a card from an elemental pool based on rarity weights.
 */
function rollCardFromPool(poolIds: string[], prng: PRNG): { cardId: string; nextSeed: number } {
    // 1. Determine rarity tier
    const rarityRoll = prng.nextInt(1, 100);
    let currentSeed = rarityRoll.nextSeed;
    let selectedRarity: Rarity = 'Common';

    let cumulative = 0;
    for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
        cumulative += weight;
        if (rarityRoll.value <= cumulative) {
            selectedRarity = rarity as Rarity;
            break;
        }
    }

    // 2. Filter pool by rarity
    let filteredPool = poolIds.filter(id => ProgramRegistry[id].rarity === selectedRarity);

    // Fallback if rarity tier is empty in this pool (ensure we always have something)
    if (filteredPool.length === 0) {
        filteredPool = poolIds.filter(id => ProgramRegistry[id].rarity === 'Common');
    }

    // Final fallback to absolute pool if still empty
    if (filteredPool.length === 0) {
        filteredPool = poolIds;
    }

    // 3. Pick random card from filtered cohort
    const cardPick = new PRNG(currentSeed).nextInt(0, filteredPool.length - 1);
    return { cardId: filteredPool[cardPick.value], nextSeed: cardPick.nextSeed };
}

/**
 * Roll rewards for a single defeated entity
 */
function rollForEntity(
    entity: IBattleEntity,
    rosterSize: number,
    prng: PRNG
): { scraps: number; blueprint: IBlueprint | null; cardChoice: ICardChoice; xp: number; nextSeed: number } {
    // 1. Roll scrap yield: 5-15 default
    const scrapRoll = prng.nextInt(5, 15);
    let currentSeed = scrapRoll.nextSeed;

    // 2. Roll blueprint drop (Scaled by roster size)
    const bpRate = getBlueprintRate(rosterSize);
    const bpRoll = new PRNG(currentSeed).next();
    currentSeed = bpRoll.nextSeed;

    const blueprint = bpRoll.value < bpRate
        ? {
            architectureId: entity.definitionId,
            name: `${entity.name} Blueprint`,
            compileCost: 100
        }
        : null;

    // 3. Roll 3 random cards for the "Choice" array
    const pool = getPoolForElement(entity.primaryElement);
    const options: IOwnedProgram[] = [];

    for (let i = 0; i < 3; i++) {
        const { cardId, nextSeed } = rollCardFromPool(pool, new PRNG(currentSeed));
        options.push(createOwnedProgram(cardId));
        currentSeed = nextSeed;
    }

    const cardChoice: ICardChoice = {
        sourceEntityName: entity.name,
        options
    };

    // 4. XP Calculation: Defeated_Level * 20
    const xp = entity.level * 20;

    return { scraps: scrapRoll.value, blueprint, cardChoice, xp, nextSeed: currentSeed };
}

/**
 * Roll the complete reward bundle for a victorious battle.
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
        // Only get rewards for fainted enemies
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
        cards: [],
        cardChoices: allCardChoices,
        totalXP
    };
}

// --- Scrap Economy Helpers ---

/** Scrap values by rarity */
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
