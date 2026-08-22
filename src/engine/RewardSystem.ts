/**
 * Epic 3: Reward / Drop Table Engine
 * Handles post-battle loot rolls using dynamic pooling and rarity-weighted logic.
 */

import { PRNG } from './core/PRNG';
import { ProgramRegistry } from './data/programRegistry';
import type { IRewardBundle, IOwnedProgram, ICardChoice } from './gameTypes';
import { createOwnedProgram } from './gameTypes';
import type { IBattleEntity, Element, Rarity } from './types';

// --- Rarity Distribution Constants ---

/** Card-salvage options offered per defeated foe ("pick 1 of N"). */
export const SALVAGE_CHOICES_PER_FOE = 3;

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
 * Filter the registry for cards matching an element (includes 'None' as neutral).
 * Tokens (isToken or rarity 'Token') are never valid rewards — mirrors the
 * EncounterGenerator exclusion logic, minus the daemon exclusion (daemons are
 * legitimate reward cards). If an element has no real (non-token) cards, fall
 * back to the full non-token pool instead of awarding internal tokens.
 */
function getPoolForElement(element: Element): string[] {
    const nonTokenPool = Object.values(ProgramRegistry)
        .filter(p => !p.isToken && (p.rarity as string) !== 'Token');

    const elementalPool = nonTokenPool
        .filter(p => p.element === element || p.element === 'None');

    return (elementalPool.length > 0 ? elementalPool : nonTokenPool).map(p => p.id);
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
): { scraps: number; blueprint: string | null; cardChoice: ICardChoice; nextSeed: number } {
    // 1. Roll scrap yield: 5-15 default
    const scrapRoll = prng.nextInt(5, 15);
    let currentSeed = scrapRoll.nextSeed;

    // 2. Roll blueprint drop (Scaled by roster size)
    const bpRate = getBlueprintRate(rosterSize);
    const bpRoll = new PRNG(currentSeed).next();
    currentSeed = bpRoll.nextSeed;

    // Ticket 20: a blueprint drop is a SPECIES ID and nothing else. It used to be an object
    // carrying a display name and a flat 100-scrap `compileCost`; both are gone — the name is
    // derivable from the registry, and ranch assembly no longer costs scrap at all.
    const blueprint = bpRoll.value < bpRate ? entity.definitionId : null;

    // 3. Roll the "Choice" array (pick 1 of SALVAGE_CHOICES_PER_FOE)
    const pool = getPoolForElement(entity.primaryElement);
    const options: IOwnedProgram[] = [];

    for (let i = 0; i < SALVAGE_CHOICES_PER_FOE; i++) {
        const { cardId, nextSeed } = rollCardFromPool(pool, new PRNG(currentSeed));
        options.push(createOwnedProgram(cardId));
        currentSeed = nextSeed;
    }

    const cardChoice: ICardChoice = {
        sourceEntityName: entity.name,
        options
    };

    // NOTE: XP is intentionally NOT part of the reward bundle. XP is awarded
    // in-battle by the death-XP system (Pokemon-style active XP) and synced
    // back to the roster via syncPartyStats.
    return { scraps: scrapRoll.value, blueprint, cardChoice, nextSeed: currentSeed };
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
    const allBlueprints: string[] = [];
    const allCardChoices: ICardChoice[] = [];
    let currentSeed = seed;

    for (const entity of defeatedEntities) {
        // Only get rewards for fainted enemies
        if (entity.currentHp > 0) continue;

        const prng = new PRNG(currentSeed);
        const result = rollForEntity(entity, rosterSize, prng);

        totalScraps += result.scraps;
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
        // XP source of truth is the in-battle death-XP system; the bundle grants none.
        totalXP: 0
    };
}

// --- Gym Clear Mini-Draft ---

/** Fraction of each draft pick biased into the gym element's exclusive pool. */
const DRAFT_ELEMENT_BIAS = 0.7;
/** Cards offered per draft round. */
export const DRAFT_CHOICES_PER_ROUND = 3;
/** Default number of sequential draft rounds on a gauntlet clear. */
export const DRAFT_ROUND_COUNT = 3;
/** Bounded rerolls when hunting for distinct cards within a round. */
const DRAFT_REROLL_LIMIT = 24;

/**
 * Roll the sequential mini-draft awarded on a Gym gauntlet CLEAR: `count`
 * independent "pick 1 of 3" rounds, weighted toward the gym's element.
 *
 * Reuses the standard pool/rarity machinery (getPoolForElement +
 * rollCardFromPool) and the seed-chaining PRNG pattern used by rollDropTable,
 * so results are fully deterministic for a given seed. Within a single round
 * the three options are always distinct cards (dataIds); tokens are never
 * offered (getPoolForElement already excludes them).
 */
export function rollDraftRounds(
    seed: string,
    element: Element,
    count: number = DRAFT_ROUND_COUNT
): ICardChoice[] {
    // Full pool = element-matching + neutral ('None') non-token cards.
    const fullPool = getPoolForElement(element);
    // Exclusive pool used for the element-weighted share of picks.
    const elementOnlyPool = fullPool.filter(id => ProgramRegistry[id].element === element);

    const rounds: ICardChoice[] = [];
    // Seed chain starts as the string seed; rollCardFromPool hands back numeric
    // next-seeds (same as rollForEntity's chain) and PRNG accepts both.
    let currentSeed: string | number = seed;

    for (let round = 0; round < count; round++) {
        const pickedIds: string[] = [];
        let attempts = 0;

        while (pickedIds.length < DRAFT_CHOICES_PER_ROUND && attempts < DRAFT_REROLL_LIMIT) {
            attempts++;

            // Element weighting: most picks come from the gym element's own pool.
            const biasRoll = new PRNG(currentSeed).next();
            currentSeed = biasRoll.nextSeed;
            const pool = biasRoll.value < DRAFT_ELEMENT_BIAS && elementOnlyPool.length > 0
                ? elementOnlyPool
                : fullPool;

            const { cardId, nextSeed } = rollCardFromPool(pool, new PRNG(currentSeed));
            currentSeed = nextSeed;

            if (!pickedIds.includes(cardId)) {
                pickedIds.push(cardId);
            }
        }

        // Deterministic fallback for pathologically small pools: sweep the full
        // pool in registry order for cards not yet offered this round.
        for (const id of fullPool) {
            if (pickedIds.length >= DRAFT_CHOICES_PER_ROUND) break;
            if (!pickedIds.includes(id)) pickedIds.push(id);
        }

        rounds.push({
            sourceEntityName: `GYM DRAFT ${round + 1}`,
            options: pickedIds.map(createOwnedProgram)
        });
    }

    return rounds;
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
