/**
 * POST-FIGHT REWARDS — ticket 12 (steam-release map), refitting Epic 3's drop table.
 *
 * What a won fight pays: **scrap**, **one pick-1-of-3 per defeated enemy**, and **possibly a
 * blueprint**. That is the whole list. Three things changed here and each one is a ruling rather
 * than a tidy-up:
 *
 * 1. **XP is gone from the bundle.** Ticket 21 deleted levelling and froze the engine at
 *    `CALIBRATION_LEVEL`; `IRewardBundle.totalXP` was the last stub of it in the reward path, kept
 *    as a structurally-zero field so nothing had to be touched at the time. Ticket 12 removes the
 *    field, so there is no longer a place for XP to come back by accident.
 * 2. **Every number is a table keyed by node kind**, not a constant buried in a roll. A wild, an
 *    elite, an ambush and an alpha are different fights and ticket 07 says so; before this ticket
 *    they all paid `nextInt(5, 15)` per body and the same blueprint chance. The two tables below
 *    (`BLUEPRINT_DROP_RATE`, `SCRAP_PER_ENEMY`) are the only places those numbers exist.
 * 3. **The card pick draws from one function** (`rewardCardPool`), so the open economy question can
 *    be answered by editing that function and nothing else.
 *
 * **REPEAT FIGHTS PAY FULL REWARDS.** Ticket 07, restated as an amendment by Henry on 2026-08-21:
 * *"entering a node triggers it again, always — wilds re-fight at full rewards, farming is fine."*
 * Nothing in this module can see a visit count, a node id or a run, and that is deliberate: there is
 * no place for a re-entry falloff to be added by accident, and the only way to add one later is to
 * change this module's signature on purpose. `RewardSystem.test.ts` asserts the full payout on a
 * re-entered node explicitly, because a quiet "anti-farm" patch is exactly the kind of thing that
 * would sail through review.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random`, no
 * `Date.now()`. Everything procedural threads through the battle's seed, so a bundle is a pure
 * function of (seed, defeated enemies, node kind, party) — card instance ids included.
 */

import { PRNG, type PrngSeed } from './core/PRNG';
import { SeedStream } from './core/SeedStream';
import { ProgramRegistry } from './data/programRegistry';
import { getDeckForOS } from './data/mingmingRegistry';
import type { IRewardBundle, IOwnedProgram, ICardChoice } from './gameTypes';
import { createOwnedProgram } from './gameTypes';
import type { NodeKind } from './runTypes';
import type { IBattleEntity, Element, Rarity } from './types';

// --- Rarity Distribution Constants ---

/** Card-salvage options offered per defeated foe ("pick 1 of N"). */
export const SALVAGE_CHOICES_PER_FOE = 3;

/** Bounded rerolls when hunting for distinct cards within one pick-1-of-3. */
const SALVAGE_REROLL_LIMIT = 24;

const RARITY_WEIGHTS: Record<Rarity, number> = {
    'Common': 50,
    'Uncommon': 30,
    'Rare': 15,
    'Epic': 5
};

// ---------------------------------------------------------------------------------------------
// Blueprint drops (ticket 12, piece 2)
// ---------------------------------------------------------------------------------------------

/**
 * **THE BLUEPRINT KNOB. Every number here is a PROPOSAL awaiting Henry's ratification, except the
 * alpha's 1.0, which is already ruled.**
 *
 * Ticket 07 describes the alpha as *"one overtuned wild ... guards a guaranteed blueprint"*, so
 * `alpha: 1.0` is transcribing a ruling. Ticket 12 asks for *"blueprint 15-25% per defeated wild,
 * 100% from alphas"* and leaves the other three kinds to this implementation to propose:
 *
 * | kind | rate | why this number (all proposals) |
 * |---|---|---|
 * | `wild` | **0.20** | the midpoint of ticket 12's own 15-25% band — the band is the ruling, the midpoint is the proposal |
 * | `ambush` | **0.20** | the SAME per-body rate as a wild on purpose: an ambush already pays more because it fields one more body, so it gets one more roll. Raising the rate too would pay the extra danger twice |
 * | `elite` | **0.25** | the top of the wild band. An elite is the biome's unavoidable exam, but `macros-and-drivers.md` makes the **Driver** its headline prize (ticket 16) — the blueprint should not be the reason to fight it |
 * | `alpha` | **1.00** | **RULED** (ticket 07). One enemy, one guaranteed blueprint; the pocket detour is worth taking exactly because of this line |
 * | `gym` | **0.50** | placeholder. Ticket 18 owns the gauntlet refit and will very likely replace a per-body roll with one authored award; 1.0 per body would pay three blueprints for the run's last fight |
 *
 * **THE RATE IS PER DEFEATED ENEMY, NOT PER FIGHT**, and that is worth reading twice before
 * ratifying: a 3v3 wild rolls three times at 20% and yields at least one blueprint ~49% of the
 * time. It is per-enemy because the blueprint that drops is *the species you defeated* — a fight-
 * level roll would have to pick a species out of the corpses, which is the same thing with an extra
 * arbitrary step. If Henry reads 20% as a per-fight number, the wild/ambush/elite rows drop to
 * roughly 0.07 / 0.07 / 0.09 and nothing else in this file changes.
 *
 * The three non-fight kinds are listed at 0 rather than omitted. `FIGHT_KINDS` (engine/run/
 * encounter.ts) means they can never reach this table today, and a total record is what stops a
 * future event-fight from silently inheriting a wild's payout because `Record` lookups on a missing
 * key return `undefined` and `undefined < rate` is quietly false.
 */
export const BLUEPRINT_DROP_RATE: Readonly<Record<NodeKind, number>> = {
    wild: 0.20,
    ambush: 0.20,
    elite: 0.25,
    alpha: 1.00,
    gym: 0.50,
    marketplace: 0,
    workshop: 0,
    event: 0,
};

/**
 * **`getBlueprintRate(rosterSize)` IS DELETED, NOT KEPT AS A MULTIPLIER.** It scaled the drop by
 * how many mingmings the player owned — 0.75 at one, 0.50 at two, 0.15 from three on — and the
 * argument for removing it is the reason ticket 12 exists at all:
 *
 * - **It was written for a different meaning of "blueprint".** Back then a blueprint was a
 *   permanent *permission* to build a species, deduplicated on arrival (`gap audit §3`), so a
 *   third one was literally worthless and the curve throttling to 15% was mercy, not economy.
 *   `vision.md` (Henry, 2026-08-19) made blueprints **consumable**: one is spent per assembly and
 *   one per reflash, and ticket 12 names the repeat drops *"the re-roll grind"*. Under the new
 *   meaning the curve does the exact opposite of what it was for — it throttles hardest on the
 *   player who is deepest into the grind Henry has explicitly blessed.
 * - **It taxes engagement.** Roster size is a record of how many blueprints you have already spent.
 *   Reading it as "this player needs fewer" punishes the collector for collecting, and a player who
 *   re-rolls a kraken for better IVs would watch their drop rate fall as a *result* of re-rolling.
 * - **It would falsify the table above.** An alpha's ruled 100% would arrive as 15% for anyone with
 *   three mingmings, so the one number in this file that is actually ruled would be the one the
 *   code did not honour. A multiplier on a "guaranteed" drop is a contradiction, and special-casing
 *   the alpha out of the multiplier is just this deletion with extra steps.
 * - **It coupled a run payout to a persistent stat.** `economy-session.md`'s anti-mudflation line
 *   runs the other way (the ranch must not fund the run), but the same instinct applies: what a
 *   fight pays should be a property of the fight.
 *
 * Early-game generosity is a real need and it has a better home: the *first run's* difficulty and
 * the starter grant (tickets 09 and 24), where it can be authored rather than emergent. If Henry
 * wants the curve back, it belongs as an explicit `firstRun: true` modifier on this table, not as a
 * silent function of roster length.
 */

// ---------------------------------------------------------------------------------------------
// Scrap (ticket 12, piece 3)
// ---------------------------------------------------------------------------------------------

/** Inclusive scrap band rolled per defeated enemy. */
export interface IScrapBand {
    readonly min: number;
    readonly max: number;
}

/**
 * **THE SCRAP KNOB, per defeated enemy. Every band is a PROPOSAL awaiting Henry's ratification.**
 *
 * Before this ticket every corpse in the game paid `nextInt(5, 15)` — a number from when scrap was
 * a persistent currency with nothing to buy. Scrap is run-scoped now (`economy-session.md`: earned
 * by winning and selling, spent on marketplace cards, macros and removal, reset with the run), so
 * these are run-economy numbers and the fight has to be legible in them.
 *
 * **Per enemy, so party size is already in the payout.** `enemyPartySize` makes the ordinary wild
 * symmetric with your team, which means a 3v3 wild pays three rolls and a solo wild pays one — the
 * ticket's "a 3v3 should pay meaningfully more than a solo one" needs no separate multiplier, it
 * needs the roll to stay per-body. `RewardSystem.test.ts` asserts that scaling.
 *
 * | kind | band | per fight at 3 bodies | why (all proposals) |
 * |---|---|---|---|
 * | `wild` | **8-14** | ~33 | the baseline everything else is quoted against; slightly tighter than the old 5-15 so the *kind* of node, not the dice, is what moves a payout |
 * | `ambush` | **10-16** | ~39 | ticket 07's *"their 3 vs your 2"*. Pays the extra enemy twice over — once by having one, and once by a higher band — because you cannot decline it and you fight it down a body |
 * | `elite` | **18-26** | ~66 | *"should pay like the biome's exam"*: a biome's unavoidable exit, fielding the full tuned deck (ticket 08's kit fraction). Roughly two wilds, so skipping wilds to rush the exit is a real route choice rather than a strict loss |
 * | `alpha` | **30-40** | ~35 (one body) | one overtuned enemy in a dead-end pocket. Has to beat the wild you could have fought instead *plus* the backtrack, or the pocket is never worth entering |
 * | `gym` | **20-30** | ~75 | provisional; ticket 18 owns the gauntlet. Scrap won in the final fight is nearly unspendable (the run ends), so this number only matters if 18 puts a shop between gauntlet fights |
 *
 * **TICKET 13 (MARKETPLACE) CALIBRATES AGAINST THESE AND MAY MOVE THEM.** The anchor a shop should
 * price against: a full 8-10 fight run with a 3-member party lands around **450-500 scrap** total
 * (six wilds ~200, three elites ~200, a pocket alpha ~35, the odd ambush ~40), before anything is
 * earned by selling cards. If ticket 13 finds that a card wants to cost 60 and a removal 25, it
 * should change **these bands**, in this table, rather than adding a coefficient at the shop —
 * doubling prices and doubling income are the same patch, and only one of them leaves the numbers
 * readable.
 *
 * Non-fight kinds are 0-0 for the same totality reason as `BLUEPRINT_DROP_RATE`.
 */
export const SCRAP_PER_ENEMY: Readonly<Record<NodeKind, IScrapBand>> = {
    wild: { min: 8, max: 14 },
    ambush: { min: 10, max: 16 },
    elite: { min: 18, max: 26 },
    alpha: { min: 30, max: 40 },
    gym: { min: 20, max: 30 },
    marketplace: { min: 0, max: 0 },
    workshop: { min: 0, max: 0 },
    event: { min: 0, max: 0 },
};

// ---------------------------------------------------------------------------------------------
// The pick pool (ticket 12, piece 4) — ONE FUNCTION, ONE RULE
// ---------------------------------------------------------------------------------------------

/**
 * What `rewardCardPool` needs to know about a party member: its species and the firmware it is
 * running. Structurally satisfied by `IBattleEntity`, `IMingmingState` and `IRanchMember` alike, so
 * callers hand over whichever they already hold rather than mapping first.
 */
export interface IRewardPartyMember {
    readonly definitionId: string;
    readonly activeOS?: string;
}

/**
 * Filter the registry for cards matching an element (includes 'None' as neutral).
 *
 * **This is the ALTERNATIVE rule, kept live as `rewardCardPool`'s fallback.** It is what the game
 * did before ticket 12: the pick pool was the *defeated enemy's* element. See `rewardCardPool` for
 * why that is no longer the default and what it would take to make it the default again.
 *
 * Tokens (isToken or rarity 'Token') are never valid rewards — mirrors the EncounterGenerator
 * exclusion logic, minus the daemon exclusion (daemons are legitimate reward cards). If an element
 * has no real (non-token) cards, fall back to the full non-token pool instead of awarding internal
 * tokens.
 */
function getPoolForElement(element: Element): string[] {
    const nonTokenPool = Object.values(ProgramRegistry)
        .filter(p => !p.isToken && (p.rarity as string) !== 'Token');

    const elementalPool = nonTokenPool
        .filter(p => p.element === element || p.element === 'None');

    return (elementalPool.length > 0 ? elementalPool : nonTokenPool).map(p => p.id);
}

/**
 * A card is never offered as a reward if it is an internal token.
 *
 * **Exported since ticket 13.** The marketplace's off-pool wild-card slot draws from everything
 * `rewardCardPool` did *not* return, which means it needs the same "is this a real card" rule — and
 * a second copy of it would be one `isToken` flag away from putting a generated token on sale.
 */
export function isRewardable(dataId: string): boolean {
    const data = ProgramRegistry[dataId];
    return !!data && !data.isToken && (data.rarity as string) !== 'Token';
}

/**
 * **THE PICK POOL. ONE FUNCTION, ONE RULE — CHANGING THE RULE MEANS CHANGING THIS FUNCTION AND
 * NOTHING ELSE.**
 *
 * ## The rule implemented here is a RECOMMENDATION, NOT A RULING
 *
 * `economy-session.md` lists the reward-pool source as **the last open economy item**, with the
 * designer's recommendation and "Henry deciding" next to it:
 *
 * > picks draw from the **CURRENT PARTY'S species pools** (recruiting = choosing your draft pool;
 * > mono vs spread teams draft different runs; optional off-pool wild-cards at events).
 *
 * That is what this function does, because ticket 12 says to default to the recommendation. **It is
 * not ratified.** The three alternatives, and what each would cost to adopt:
 *
 * - **Biome / enemy element pool** — what the code did before this ticket, still present as
 *   `getPoolForElement` and still used as this function's fallback. Adopting it means returning
 *   `getPoolForElement(fallbackElement)` unconditionally. Reads naturally ("you loot what you
 *   killed") but makes the party irrelevant to the deck it builds, and in a mono-element biome
 *   (ticket 05) three fights in a row offer from one narrow list.
 * - **Global pool** — every non-token card in the registry. One line: `getPoolForElement('None')`
 *   already nearly does it. Maximum variance, minimum identity; the 3v3 decks are tuned as
 *   *species* lists, so a global pool mostly offers cards no member has synergy with.
 * - **Hybrid** — party pool with an off-pool wild-card slot (the parenthesis in the recommendation
 *   above proposes exactly this, at events). Would be a second exported function beside this one,
 *   or a `wildcardChance` parameter here; either way it starts from this rule rather than replacing
 *   it.
 *
 * ## Why the party pool is the whole per-OS deck list, not just the kit
 *
 * Ticket 08, clause 3: *"a species' untagged kit cards enter the pick / marketplace pool while it is
 * in the party — recruiting IS drafting; the kit completes through play."* So a member contributes
 * its **full `getDeckForOS` list**, and the cards *not* in its `startKit` are the interesting half:
 * fenrir_v1 opens holding `blood_rite`/`berserk_rush`/`battle_rhythm`/`crimson_draw` and its
 * `ragnarok_edge` finishers are in the pool, waiting. That is the sentence "the team is the deck"
 * turned into a data flow — the run rebuilds the tuned list the balance corpus is calibrated on,
 * and *which* tuned list is a consequence of who you recruited.
 *
 * ## Duplicates
 *
 * **Ids are deduplicated for POOL MEMBERSHIP, and a card already in the run deck is still offered.**
 * Those are two different statements and both are deliberate. Multiplicity inside a tuned deck
 * (`blood_rite` x2) is a deckbuilding statement about that list, not a claim that the card should
 * drop twice as often, so the pool is a set. But nothing filters against `IRunState.deck`: the
 * tuned decks run doubles, so being offered a second `ignite` is often the correct reward, and
 * ticket 12 calls the repeat drop the grind rather than a bug.
 *
 * `fallbackElement` is used only when the party contributes nothing at all — an empty party, or
 * species with no registry decks (a debug scenario, a species whose deck has not shipped). Falling
 * back to the old element rule beats returning an empty pool, which would offer the player nothing
 * for a fight they won.
 */
export function rewardCardPool(
    party: ReadonlyArray<IRewardPartyMember>,
    fallbackElement: Element = 'None',
): string[] {
    const ids: string[] = [];

    for (const member of party) {
        for (const dataId of getDeckForOS(member.definitionId, member.activeOS)) {
            if (!isRewardable(dataId)) continue;
            if (!ids.includes(dataId)) ids.push(dataId);
        }
    }

    return ids.length > 0 ? ids : getPoolForElement(fallbackElement);
}

// ---------------------------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------------------------

/**
 * Roll a card from a pool based on rarity weights.
 */
/*
 * TICKET 55: `nextSeed` was annotated `number` here and in `rollForEntity`, and it was WRONG — the
 * PRNG these take is constructed from `currentSeed: string | number` (see `rollDropTable`), so the
 * seed it hands back is whichever kind went in. The declaration only compiled because `PRNG` typed
 * `nextSeed` as `any`; the proof it was wrong is three lines below the second one, where the caller
 * calls `.toString()` on a value the signature claims is already a number.
 */
function rollCardFromPool(poolIds: string[], prng: PRNG): { cardId: string; nextSeed: PrngSeed } {
    // 1. Determine rarity tier
    const rarityRoll = prng.nextInt(1, 100);
    const currentSeed = rarityRoll.nextSeed;
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
 * Roll rewards for a single defeated entity: its scrap, its blueprint chance, and the pick-1-of-3
 * it leaves behind.
 *
 * The card **pool** is passed in rather than derived here — it is a property of the party, which is
 * the same for every corpse in the fight, and deriving it per entity would both re-walk the registry
 * three times and re-open the door to the enemy-element rule this ticket closed.
 */
function rollForEntity(
    entity: IBattleEntity,
    nodeKind: NodeKind,
    pool: string[],
    prng: PRNG,
    ids: SeedStream,
): { scraps: number; blueprint: string | null; cardChoice: ICardChoice; nextSeed: PrngSeed } {
    // 1. Scrap, from the node-kind band.
    const band = SCRAP_PER_ENEMY[nodeKind] ?? SCRAP_PER_ENEMY.wild;
    const scrapRoll = prng.nextInt(band.min, band.max);
    let currentSeed = scrapRoll.nextSeed;

    // 2. Blueprint, at the node-kind rate. Rolled even at rate 0 and at rate 1 so the seed chain
    //    advances identically whatever the node is — an alpha and a wild consume the same number of
    //    draws, which is what keeps "the same enemies at two node kinds" comparable in tests.
    const bpRate = BLUEPRINT_DROP_RATE[nodeKind] ?? 0;
    const bpRoll = new PRNG(currentSeed).next();
    currentSeed = bpRoll.nextSeed;

    // Ticket 20: a blueprint drop is a SPECIES ID and nothing else. It used to be an object
    // carrying a display name and a flat 100-scrap `compileCost`; both are gone — the name is
    // derivable from the registry, and ranch assembly no longer costs scrap at all.
    //
    // Ticket 12: the species is the one you just defeated, and **a species already on the ranch can
    // drop again** — `gameSlice.addBlueprint` stacks the count rather than deduping (ticket 20), so
    // a repeat drop is a second assembly or a second IV re-roll. Nothing here consults the ranch;
    // it structurally cannot suppress a duplicate.
    const blueprint = bpRoll.value < bpRate ? entity.definitionId : null;

    // 3. The "pick 1 of SALVAGE_CHOICES_PER_FOE".
    //
    // **Distinct WITHIN one triplet, and deliberately not distinct anywhere else.** A pick-1-of-3
    // that shows the same card twice is a pick-1-of-2 wearing a costume, and it stopped being a
    // theoretical worry with ticket 12: the party pool is one to three species' deck lists — as few
    // as seven unique ids — where the old registry-wide element pool made a collision rare. The
    // reroll-then-sweep shape is `rollDraftRounds`', for the same reason and with the same
    // determinism.
    //
    // What is NOT filtered: the run deck. A card the player already holds is still offered, because
    // the tuned decks run doubles and a second `ignite` is often the right reward
    // (`economy-session.md`: the run BUILDS toward the 20-25 cards a good 3v3 deck wants).
    const pickedIds: string[] = [];
    let attempts = 0;
    while (pickedIds.length < SALVAGE_CHOICES_PER_FOE && attempts < SALVAGE_REROLL_LIMIT) {
        attempts++;
        const { cardId, nextSeed } = rollCardFromPool(pool, new PRNG(currentSeed));
        currentSeed = nextSeed;
        if (!pickedIds.includes(cardId)) pickedIds.push(cardId);
    }
    // Deterministic sweep for pools too small (or too rarity-lopsided) for the random draws to
    // finish, then a cyclic pad. The pad is the degenerate case only — `rewardCardPool` never
    // returns an empty pool — and it exists because a choice with fewer than one option can never
    // be answered, and `BattleReport` will not let the player continue until every choice is.
    for (const id of pool) {
        if (pickedIds.length >= SALVAGE_CHOICES_PER_FOE) break;
        if (!pickedIds.includes(id)) pickedIds.push(id);
    }
    for (let i = 0; pickedIds.length < SALVAGE_CHOICES_PER_FOE && pool.length > 0; i++) {
        pickedIds.push(pool[i % pool.length]);
    }

    const options: IOwnedProgram[] = pickedIds.map((cardId) => createOwnedProgram(cardId, ids));

    const cardChoice: ICardChoice = {
        sourceEntityName: entity.name,
        options
    };

    return { scraps: scrapRoll.value, blueprint, cardChoice, nextSeed: currentSeed };
}

/**
 * Everything a reward roll depends on. An object rather than positional arguments because the old
 * `(defeated, rosterSize, seed)` signature had two bare numbers in it and the middle one — roster
 * size — is exactly the input this ticket removes.
 */
export interface IRewardRollInput {
    /** The enemy party as the battle left it. Survivors are skipped; only corpses pay. */
    readonly defeated: ReadonlyArray<IBattleEntity>;
    /**
     * The kind of node this fight happened on — the key into both knobs above. A battle with no
     * run behind it (a debug scenario) has no node; callers pass `'wild'`, the baseline.
     */
    readonly nodeKind: NodeKind;
    /**
     * The player's party, for `rewardCardPool`. **The party as it is right now**, ticket 08's
     * clause: a recruit's untagged kit cards are in the pool from the moment it joins.
     */
    readonly party: ReadonlyArray<IRewardPartyMember>;
    /** The battle's seed. Same seed + same inputs → byte-identical bundle, instance ids included. */
    readonly seed: string;
}

/**
 * Roll the complete reward bundle for a victorious battle.
 *
 * **Deterministic in the whole input, including card instance ids.** The ids come from a labelled
 * `SeedStream` fork rather than `createOwnedProgram`'s default (which rolls a wall-clock seed), so a
 * replayed fight produces a bundle that deep-equals the original. That matters beyond tidiness: the
 * claimed pick keeps its `instanceId` all the way into `IRunState.deck`, and a run that resumes from
 * its seed (ticket 23) must not mint a different card than the one the player was shown.
 *
 * **There is no re-entry parameter and no falloff.** See the module header: repeat fights on a
 * re-entered node pay full rewards, by Henry's amendment of 2026-08-21.
 */
export function rollDropTable(input: IRewardRollInput): IRewardBundle {
    const { defeated, nodeKind, party, seed } = input;

    // The pool is the party's, once per fight. `primaryElement` of the first corpse is only the
    // fallback's fallback — used when the party contributes no cards at all (see `rewardCardPool`).
    const pool = rewardCardPool(party, defeated[0]?.primaryElement ?? 'None');

    // Two threads off one seed, forked apart so that changing how many cards are offered cannot
    // shift how much scrap the fight paid: the numeric chain below rolls the outcomes, and this
    // stream mints instance ids.
    const ids = new SeedStream(new SeedStream(seed).fork('reward-card-ids'));

    let totalScraps = 0;
    const allBlueprints: string[] = [];
    const allCardChoices: ICardChoice[] = [];
    let currentSeed: string | number = seed;

    for (const entity of defeated) {
        // Only get rewards for fainted enemies
        if (entity.currentHp > 0) continue;

        const result = rollForEntity(entity, nodeKind, pool, new PRNG(currentSeed), ids);

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
 * **NOT CALLED FROM THE BATTLE PATH ANY MORE — TICKET 18 OWNS THE GAUNTLET AND ITS DRAFT.**
 * Ticket 12 removed the invocation from `BattleArena`'s victory effect, where it replaced the normal
 * `cardChoices` on the last fight of a gauntlet. It is left here, tested and working, because the
 * gauntlet refit is a live ticket that will want it — deleting it would mean rewriting the element
 * weighting and the distinct-options logic from scratch two tickets later. `IRewardBundle.draftRounds`
 * and `BattleReport`'s draft panel are the other two halves of the same parked feature.
 *
 * **It also still draws from `getPoolForElement`, the pre-ticket-12 rule.** That is not an oversight:
 * a gym draft is thematically the gym's element, not the party's, and ticket 18 should decide
 * whether the party pool applies here at all. If it does, this function calls `rewardCardPool`
 * instead and the bias logic moves to whatever "weighted toward the gym element" means over a party
 * pool.
 *
 * Reuses the standard pool/rarity machinery (getPoolForElement + rollCardFromPool) and the
 * seed-chaining PRNG pattern used by rollDropTable, so results are fully deterministic for a given
 * seed. Within a single round the three options are always distinct cards (dataIds); tokens are
 * never offered (getPoolForElement already excludes them).
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

/**
 * Scrap values by rarity — the **sell/deconstruct** side of the economy, not the drop side.
 *
 * Nothing calls `getScrapYield` today (ticket 12 checked): the card-selling and card-removal sinks
 * `economy-session.md` describes belong to the **marketplace, ticket 13**, and this is the price
 * list waiting for it. Kept rather than deleted for that reason, and flagged here so 13 finds it
 * instead of inventing a second one — and so it is calibrated in the same pass as
 * `SCRAP_PER_ENEMY` above, since selling an Epic for 100 when a whole elite pays ~66 would make
 * selling the dominant income.
 *
 * **TICKET 13 FOUND IT AND DID NOT ADOPT IT, ON PURPOSE.** `engine/run/marketplace.ts` derives the
 * sell price from the *buy* price by a single multiplier rather than from an independent table,
 * because the one law selling must obey — **sell < buy for every card, or the market is an infinite
 * scrap loop** — is structural under a multiplier and merely a coincidence under two hand-kept
 * tables. This list is exactly the shape that could cross: it is unaware of energy cost, so its
 * flat `Rare: 50` would out-pay a cheap Rare's buy price the moment anyone retuned either half.
 * `getScrapYield` still has no callers; ticket 13 proposes deleting it once Henry ratifies the
 * marketplace numbers, and leaves it standing until then rather than deleting a thing under review.
 */
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
