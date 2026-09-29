/**
 * TICKET 157 — **THE RUN WALKER: a whole run played by the machine, read as a curve.**
 *
 * Henry, 2026-09-20: *"how can we automate that progression testing. I have limited time to play
 * test so need some ways for you to help me."* Two of his playtests cost about six hours and
 * produced four findings, each of which is one sample of one route with one starter. The question
 * underneath them — **does the deck at fight 12 beat the deck at fight 1, and by how much** — needs
 * dozens of runs per starter. He cannot play dozens. This can.
 *
 * # WHAT WAS ALREADY BUILT, AND THE EXACT GAP
 *
 * `runGate.ts` (ticket 61) already rolls a REAL encounter at a REAL node of a REAL region graph and
 * plays it headless. Its own header names what it does not do: *"what this sample deliberately does
 * NOT model is deck DRIFT"* — the party walks in with the run-start deck every time. `runBatch`
 * plays a composed fight N times. 156 records the rows. 149c scores a deck.
 *
 * **The gap was the WALK BETWEEN FIGHTS.** Nothing chose a node, took a reward, bought at a shop or
 * recruited a body. That walk *is* progression; everything else existed.
 *
 * # THE ONE STRUCTURAL RULE OF THIS FILE
 *
 * **The walker holds no second opinion about any rule the game already has.** It moves the run by
 * dispatching `runSlice`'s own actions into a real store, rolls fights with `rollEncounter` and
 * `rollGauntletFight`, prices the shop with `marketplace.ts`, and rolls rewards with
 * `rollDropTable`. What it adds is a POLICY — which node, which card, which body — and nothing
 * else. A harness that reimplements a rule measures the reimplementation, which is how
 * `runGate.ts`'s header came to warn about exactly that.
 *
 * So the things to read this file for are the policy decisions, and every one of them is §3's
 * "policy v0, dumb on purpose": the curve it produces is **the floor a human should beat, not a
 * ceiling.**
 *
 * # WHAT A POLICY-V0 RUN CAN AND CANNOT TELL US (§4, said up front)
 *
 * It measures the run SYSTEM — is there a curve to climb at all — not whether a human can find it.
 *
 *   - deck power flat fight 1 → 12  → the REWARDS are the problem (153);
 *   - it climbs but the machine still loses the gym → the FIGHTS are the problem (148/151);
 *   - it climbs and wins, and Henry does not → the VISIBILITY of the good pick is the problem
 *     (158/159).
 *
 * Telling those three apart before another six hours are spent is the whole value.
 *
 * # OUTPUT
 *
 * Exactly 156's row schema (`FIGHT_DECK`, `FIGHT_TURN` is not emitted — see `recordFight` —
 * `FIGHT_ENDED`, `RUN_ENDED` and the pick/buy/recruit rows), built as an in-memory `IRunLog`, so
 * `runRead.ts` reads a machine run and a human run with the same table.
 */
import { configureStore } from '@reduxjs/toolkit';

import runReducer, {
    startRun, enterNode, resolveEncounter, endRun, addRunScrap, addRunCards, addRunCollection,
    buyMarketCard, recruitIntoParty, beginGauntlet, advanceGauntlet, finishGauntlet,
    recordFightBlueprintOutcome, addDriver, fitPatch, upgradeDeckCard, buyMarketBlueprint, removeJunkCard,
} from '../../ui/store/runSlice';
import { junkToRemove } from './junkPolicy';
import { START_KIT_SIZE, createRun, recruitDeckFor, startKitIdsFor } from '../../engine/run/createRun';
import { DRAFT_PICKS, draftOffer, draftPool, takePick } from '../../engine/run/modifiers/draftStart';
import { activeModifiers } from '../../engine/run/modifiers/modifierRegistry';
import { recruitingBlocked } from '../../engine/run/modifiers/noRecruits';
import { shopPrice } from '../../engine/run/modifiers/shopPrice';
import { offerGyms, GYM_REGISTRY, COUNTERED_BY, speciesOwningFirmware, gymCompElementPlan, type IGym } from '../../engine/run/gyms';
import { rollEncounter, isFightNode, RUN_ENEMY_MODE } from '../../engine/run/encounter';
import { eventFightScrapMultiplier, fightNodeFor } from '../../engine/run/eventFight';
import { rollGauntletFight, GAUNTLET_FIGHTS } from '../../engine/run/gauntlet';
import { rollDropTable } from '../../engine/RewardSystem';
import { fightBonusFor } from '../../engine/run/fightBonus';
import { rollMarketStock, rollBlueprintOffer, isMarketNode, upgradePrice, isBlueprintSlotSold, JUNK_REMOVAL_PRICE } from '../../engine/run/marketplace';
import { WORKSHOP_ASSEMBLY_SCRAP } from '../../engine/run/workshop';
import { BlueprintLedger } from './BlueprintLedger';
import { drawEvent } from '../../engine/run/events/eventDraw';
import { offerBlueprints } from '../../engine/run/events/eventBlueprints';
import { offerCards } from '../../engine/run/events/eventCards';
import { offerMacros } from '../../engine/run/events/eventMacros';
import { EMPTY_RELAY_ID, EMPTY_RELAY_SCRAP } from '../../engine/run/events/emptyRelay';
import { applyChoice, applyEmptyRelay } from '../../ui/events/applyOutcome';
import type { OutcomePick } from '../../ui/events/outcomePicks';
import { chooseEventChoice, chooseGiveUps } from './eventPolicy';
export { BlueprintLedger } from './BlueprintLedger';
import { hasUpgrade } from '../../engine/data/plusRegistry';
import { PATCH_SLOTS } from '../../engine/data/patchRegistry';
import { gatePatchChoices, SHOP_STOCK_PATCH } from '../../engine/data/patchRanking';
import { rawFirmwareHooks } from '../../engine/data/firmwareRegistry';
import { SHOP_PATCH_PRICE } from '../../ui/screens/PatchBench';
import { MingmingRegistry, LAUNCH_SPECIES, GetMingmingData } from '../../engine/data/mingmingRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { grammarFor } from '../../engine/data/osGrammar';
import { emptyRunLog, appendRunEvent, type IRunLog } from '../../engine/run/runLog';
import { SeedStream } from '../../engine/core/SeedStream';
import { calculatePowerscale } from './powerscale';
import { runOne, type RunResult } from './runBatch';
import { BALANCE_STAT_JITTER, BALANCE_IV } from './balanceScenarios';
import type { ComposedSetup, EnemySetup } from '../scenarios/scenarioSchema';
import type { IMingmingState, IBattleEntity } from '../../engine/types';
import type { IRunState, IRegionNode, IRunCard, NodeKind } from '../../engine/runTypes';

/**
 * The firmware with no firmware. `runGate.ts` minted this sentinel for the same reason and exports
 * it, but importing the gate into the walker would drag its whole cell table along; one shared
 * string constant is not worth that coupling, and `NO_FIRMWARE_OS` is asserted equal to the gate's
 * in `runWalker.test.ts` so the two cannot drift.
 */
export const NO_FIRMWARE_OS = 'run-gate:no-firmware';

/** One battle per fight. A run is a playthrough, not a sample of one. */
const WALK_MAX_TURNS = 60;

// ---------------------------------------------------------------------------------------------
// Scoring — the one number the whole policy runs on
// ---------------------------------------------------------------------------------------------

/**
 * A card's 149c score, or null when the registry cannot answer.
 *
 * Wrapped because 154a made `GetProgramData` THROW on an unknown id in development, and a walk that
 * died on one dropped card would lose the other thirteen fights it had already measured. A card the
 * registry does not know scores nothing and is never picked, which is the honest behaviour.
 */
export function scoreOf(dataId: string): number | null {
    try {
        const data = GetProgramData(dataId);
        if (!data || !data.name) return null;
        return calculatePowerscale(data).score;
    } catch {
        return null;
    }
}

/**
 * The mean 149c score of a deck — 148's progression number.
 *
 * Deliberately the same shape as `runRead.ts`'s private `meanPowerscale`, and asserted equal to it
 * in the test, because the walker's curve and the human run read have to be the same measurement or
 * comparing them is meaningless. It says nothing about whether the cards fit TOGETHER; that is what
 * the win column is for.
 */
export function deckPower(deck: ReadonlyArray<string>): number | null {
    let total = 0;
    let counted = 0;
    for (const dataId of deck) {
        const score = scoreOf(dataId);
        if (score === null) continue;
        total += score;
        counted += 1;
    }
    return counted === 0 ? null : total / counted;
}

// ---------------------------------------------------------------------------------------------
// The policy — §3's table, one function per row
// ---------------------------------------------------------------------------------------------

/** Why the walker stepped where it did. Logged so a route can be argued with afterwards. */
export interface StepReason {
    readonly nodeId: string;
    readonly kind: NodeKind;
    readonly why: string;
}

/**
 * The next node, and why.
 *
 * §3: *"Henry's ruled route [counter, gym element, gym biome] (142d); shortest path node by node."*
 * The biome ORDER is already fixed by the gym offer, so "the ruled route" is a property of the graph
 * rather than a choice this function makes. What is left is which node inside the layer.
 *
 * **Shortest path first, and the tie-break is the policy.** A breadth-first search from the current
 * node gives every neighbour's distance to the gym; anything not on a shortest path is discarded
 * outright, because a walker that wanders is measuring a different run length than the one being
 * asked about. Among the neighbours that ARE on a shortest path, the tie-break is:
 *
 *   1. a **workshop** while a blueprint is held — a recruit is the largest single move the run
 *      offers, and §5.2 rules that the walker recruits;
 *   2. a **marketplace** with enough scrap to buy the cheapest thing on a shelf;
 *   3. a **fight**, because fights are what pay for 1 and 2;
 *   4. whatever is left, by node id, so the walk is deterministic.
 *
 * The alternative — pure shortest path with a random tie-break — would make "did the walker reach a
 * shop" a coin flip, and the shop is one of the three levers 153 is about. The tie-break is named
 * here rather than buried because it is the part a reader should disagree with first.
 */
export function chooseStep(
    run: IRunState,
    gymNodeId: string,
    hasRecruitableBlueprint: boolean | number,
): StepReason | null {
    const byId = new Map(run.nodes.map((node) => [node.id, node]));
    const current = byId.get(run.currentNodeId);
    if (!current || current.id === gymNodeId) return null;

    // BFS distance to the gym from every node, so a neighbour can be tested for "on a shortest path".
    const dist = new Map<string, number>([[gymNodeId, 0]]);
    let frontier = [gymNodeId];
    while (frontier.length > 0) {
        const next: string[] = [];
        for (const id of frontier) {
            for (const edge of byId.get(id)?.edges ?? []) {
                if (dist.has(edge)) continue;
                dist.set(edge, (dist.get(id) ?? 0) + 1);
                next.push(edge);
            }
        }
        frontier = next;
    }

    const here = dist.get(current.id);
    if (here === undefined) return null;

    const onPath = current.edges
        .map((id) => byId.get(id))
        .filter((node): node is IRegionNode => node !== undefined)
        .filter((node) => (dist.get(node.id) ?? Infinity) === here - 1);
    if (onPath.length === 0) return null;

    const canRecruit = typeof hasRecruitableBlueprint === 'boolean'
        ? hasRecruitableBlueprint
        : hasRecruitableBlueprint > 0;
    const rank = (node: IRegionNode): number => {
        if (node.kind === 'workshop' && canRecruit) return 0;
        if (isMarketNode(node.kind)) return 1;
        if (isFightNode(node.kind)) return 2;
        return 3;
    };
    const sorted = [...onPath].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
    const chosen = sorted[0];
    const why = rank(chosen) === 0 ? 'workshop, holding a blueprint'
        : rank(chosen) === 1 ? 'marketplace on the path'
            : rank(chosen) === 2 ? 'fight on the path'
                : 'only node on the path';
    return { nodeId: chosen.id, kind: chosen.kind, why };
}

/** What a pick decision came to, for the `PICK` row §5.4 asked for. */
export interface PickDecision {
    readonly offered: ReadonlyArray<string>;
    readonly taken: string | null;
    readonly score: number | null;
    /** True when the best card on offer is worse than everything already in the deck. */
    readonly toCollection: boolean;
}

/**
 * §3's reward row: *"take the card whose 149c score is highest AND whose element/OS tag matches an
 * active body; else the top-scoring card into the collection."*
 *
 * Two clauses and they are not the same test, which is the part worth being careful about. The
 * FIRST asks whether a card belongs to this party at all — a Water card in a Fire party is a card
 * the deck cannot use however well it scores. The SECOND is 153's number: **how often is the best
 * available pick worse than every card already in the deck.** A card taken into the collection is
 * still taken (`collection` costs nothing and is one edit from playing, which is why paid removal
 * could be deleted), so "sent to collection" is a measure of the REWARD TABLE, not of a refusal.
 */
export function choosePick(
    offered: ReadonlyArray<string>,
    deck: ReadonlyArray<string>,
    partyElements: ReadonlySet<string>,
): PickDecision {
    const scored = offered
        .map((dataId) => ({ dataId, score: scoreOf(dataId) }))
        .filter((row): row is { dataId: string; score: number } => row.score !== null);
    if (scored.length === 0) return { offered, taken: null, score: null, toCollection: false };

    const usable = scored.filter(({ dataId }) => {
        const element = GetProgramData(dataId).element;
        return element === 'None' || partyElements.has(element);
    });
    const best = [...(usable.length > 0 ? usable : scored)].sort((a, b) => b.score - a.score)[0];

    // 153's number. The worst card in the deck is the bar: a pick that beats nothing already held
    // does not improve the deck, whatever its absolute score.
    const deckScores = deck.map(scoreOf).filter((s): s is number => s !== null);
    const worstHeld = deckScores.length > 0 ? Math.min(...deckScores) : -Infinity;

    return { offered, taken: best.dataId, score: best.score, toCollection: best.score <= worstHeld };
}

/** A recruit choice with the sentence §5.2 asks to be logged. */
export interface RecruitChoice {
    readonly speciesId: string;
    readonly osId: string;
    readonly why: string;
}

/**
 * §5.2, Henry's ruling: **never bench, but recruit strategically.**
 *
 * > *"prefer a recruit that is a listed partner of a body already in the party, and prefer the
 * > element that counters the gym (a Water/Water/Fire gym wants a Nature/Nature/Water party)."*
 *
 * The tags used to live in `collection-v2/collection.json`, which is why the ruling says so. **They
 * do not any more** — 158-r1 moved them into `osGrammar.ts`, which is the reason that row was taken
 * before this one. The walker reads the registry like every other consumer; nothing here parses a
 * design file.
 *
 * Scoring, highest first, and the weights are ORDINAL rather than tuned — they encode "a partner
 * beats an element match beats nothing", which is the ruling's sentence and not a number anybody
 * has measured:
 *
 *   +4  a listed partner of a firmware already in the party (the authored web)
 *   +2  the element that counters the gym's element
 *   +1  shares a currency with a body in the party (the weaker half of "synergy", from the same
 *       grammar: two bodies banking `Strength` feed each other even when neither is listed)
 *
 * Ties break on firmware id so a walk is reproducible.
 */
export function chooseRecruit(
    speciesId: string,
    partyOS: ReadonlyArray<string>,
    gymElement: string,
): RecruitChoice | null {
    // TICKET 28a: `gymElement` is the element the gym's AUTHORED comp mostly fields, derived by the
    // caller from `gymCompElementPlan` — one table, the same one the scout previews. It used to be
    // the gym's own `element`, which happened to agree because a gym fields two of its own bodies;
    // reading the comp means a re-composition moves the walker with it rather than past it.
    const definition = MingmingRegistry[speciesId];
    if (!definition) return null;

    const counter = COUNTERED_BY[gymElement];
    const heldCurrencies = new Set(partyOS.flatMap((os) => [...(grammarFor(os)?.currency ?? [])]));

    let best: (RecruitChoice & { score: number }) | null = null;
    for (const osId of definition.availableOS) {
        const reasons: string[] = [];
        let score = 0;

        const partnered = partyOS.filter((held) =>
            (grammarFor(held)?.partners ?? []).some((p) => p.osId === osId)
            || (grammarFor(osId)?.partners ?? []).some((p) => p.osId === held));
        if (partnered.length > 0) {
            score += 4;
            reasons.push(`authored partner of ${partnered.join(', ')}`);
        }
        if (definition.primaryElement === counter) {
            score += 2;
            reasons.push(`${definition.primaryElement} counters the ${gymElement} gym`);
        }
        const shared = [...(grammarFor(osId)?.currency ?? [])].filter((c) => heldCurrencies.has(c));
        if (shared.length > 0) {
            score += 1;
            reasons.push(`shares ${shared.join('/')} with the party`);
        }

        const why = reasons.length > 0 ? reasons.join('; ') : 'nothing in the grammar joins it to this party';
        if (best === null || score > best.score || (score === best.score && osId < best.osId)) {
            best = { speciesId, osId, why, score };
        }
    }
    return best === null ? null : { speciesId: best.speciesId, osId: best.osId, why: best.why };
}

/**
 * TICKET 163e's policy: **upgrade the highest-149c card in the deck that has a `+`, when the purse
 * covers it.**
 *
 * Highest rather than lowest, and the choice is the arm's whole character. An upgrade is *"the same
 * card with a bigger number"* (163 §1) — it never changes a card's shape — so upgrading the best
 * card compounds what the deck already does, while upgrading the worst raises a floor the deck is
 * trying to draw around. §5's wording picks the first, and the take-rate this measures is therefore
 * a take-rate for the COMPOUNDING policy. A "upgrade the worst" arm is a different question and is
 * not this row's.
 *
 * Returns the instance to upgrade, or null when nothing in the deck has a `+` the purse can reach —
 * which is a bench walked past, and is counted.
 */
export function chooseUpgrade(
    deck: ReadonlyArray<IRunCard>,
    scrap: number,
    free: boolean,
    /** TICKET 169j: the game's price rule (Tight Budget) applied to a base price. Default: the plain price. */
    priceOf: (base: number) => number = (base) => base,
): { instanceId: string; from: string; to: string; price: number } | null {
    const candidates = deck
        .filter((card) => hasUpgrade(card.dataId))
        .map((card) => ({ card, score: scoreOf(card.dataId), price: free ? 0 : priceOf(upgradePrice(card.dataId)) }))
        .filter((row): row is { card: IRunCard; score: number; price: number } =>
            row.score !== null && row.price <= scrap)
        .sort((a, b) => b.score - a.score || a.card.instanceId.localeCompare(b.card.instanceId));
    if (candidates.length === 0) return null;
    const { card, price } = candidates[0];
    return { instanceId: card.instanceId, from: card.dataId, to: `${card.dataId}+`, price };
}

/**
 * TICKET 163e's other half: **which patch a body takes at the gate, and whether one is worth 50
 * scrap at the shop.**
 *
 * The gate offers a choice of two per body, free (163 §3), and `gatePatchChoices` already leads with
 * the rider that changes the most about THIS firmware — so the policy is simply "take the first",
 * and what is being measured is the DISTRIBUTION that produces. The shop stocks Amplifier at
 * `SHOP_PATCH_PRICE`, which is the number this row existed to tune — and did: it was 50, set level
 * with `MARKET_BLUEPRINT_PRICE`, and 163e moved it to 45 on the ordering condition
 * `upgrade ceiling < patch < blueprint`. See that constant's comment for what the take-rate could
 * and could not decide.
 *
 * Returns the ids to fit, one per body with a free slot, in party order.
 */
export function choosePatches(
    party: ReadonlyArray<IMingmingState>,
    held: Readonly<Record<string, ReadonlyArray<string>>>,
    venue: 'gate' | 'shop',
): Array<{ memberId: string; patchId: string }> {
    const out: Array<{ memberId: string; patchId: string }> = [];
    for (const member of party) {
        if ((held[member.id] ?? []).length >= PATCH_SLOTS) continue;
        if (venue === 'shop') { out.push({ memberId: member.id, patchId: SHOP_STOCK_PATCH }); continue; }
        const pair = gatePatchChoices(rawFirmwareHooks(member.activeOS ?? ''), held[member.id] ?? []);
        if (pair.length > 0) out.push({ memberId: member.id, patchId: pair[0] });
    }
    return out;
}

// ---------------------------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------------------------

export interface WalkInput {
    readonly seed: string;
    /** The starter firmware id — one of the EA twelve (§5.3). */
    readonly starter: string;
    /** Which of the three offered gyms. `index % 3` from the caller spreads a batch evenly. */
    readonly gymIndex: number;
    /**
     * TICKET 163e's arm: **"upgrade the highest-149c card when scrap ≥ price" vs never.**
     *
     * The comparison is the measurement. An upgrade costs 25–40 scrap out of the same purse a card
     * costs 15–45 from, so the two arms are not "with and without a free bonus" — they are two
     * spending policies, and the interesting number is whether the upgrade one ends up with a
     * better deck or merely a poorer one.
     */
    readonly upgrades?: boolean;
    /**
     * TICKET 163e: what the shop charges for a patch. `SHOP_PATCH_PRICE` is MINE rather than
     * Henry's — 163 §3 names no price — so this row is the first thing that could argue with it,
     * and the sweep this field enables is what moved it from 50 to 45. Kept overridable so the next
     * sweep (after 157's opening-fight ruling) needs no edit to the shipped constant.
     */
    readonly patchPrice?: number;
    /**
     * TICKET 157-r1 — **stop the walk after N fights**, so fight one can be measured on its own.
     *
     * Henry's ruling asks for a fight-one read at the target of 95, and a full walk is the wrong
     * instrument for it: a 5-seed walk of the twelve costs about ten minutes and spends almost all
     * of it on fights the read does not look at, which caps the sample at the point where 60% and
     * 80% are the same measurement. Stopping after fight one costs a single 1v1 per seed, so the
     * same ten minutes buys hundreds of seeds per starter instead of five.
     *
     * It is a TRUNCATION, not a different harness. Everything up to the stop is the walk exactly as
     * it runs: the same `createRun`, the same node, the same `rollEncounter`, the same `runOne`.
     * That is the whole point of putting it here rather than writing a second script that builds
     * its own fight and quietly disagrees with this one about the beam or the AI tier.
     *
     * A truncated run's `outcome` is `defeat` and its `finalDeck` is a first-fight deck; neither
     * means anything and neither should be read. `summariseFightOne` reads `byFightIndex` alone.
     */
    readonly stopAfterFights?: number;
    /**
     * TICKET 169j: the difficulty tier to play (0-3). Left out it is the gym's own tier, which is
     * what every walk before 169 played, so the default reproduces them exactly.
     */
    readonly tier?: number;
    /** TICKET 169j: run modifiers to play, by id. Left out, none. */
    readonly modifiers?: ReadonlyArray<string>;
}

export interface FightRecord {
    readonly index: number;
    readonly nodeId: string;
    readonly kind: NodeKind;
    readonly biome: number;
    readonly deckSize: number;
    readonly deckPower: number | null;
    readonly won: boolean;
    readonly turns: number;
    readonly truncated: boolean;
    /** Who was left standing, and on what fraction of their pool. */
    readonly survivors: ReadonlyArray<{ osId: string; hpFraction: number }>;
}

export interface WalkResult {
    readonly seed: string;
    readonly starter: string;
    readonly gymId: string;
    readonly gymElement: string;
    readonly outcome: 'victory' | 'defeat';
    readonly fights: ReadonlyArray<FightRecord>;
    readonly picks: ReadonlyArray<PickDecision>;
    readonly bought: ReadonlyArray<{ dataId: string; price: number }>;
    readonly recruits: ReadonlyArray<RecruitChoice>;
    readonly steps: ReadonlyArray<StepReason>;
    /** 163e: every upgrade bought, by base id and price. */
    readonly upgraded: ReadonlyArray<{ from: string; to: string; price: number }>;
    /** 163e: every patch fitted, by id and where it came from. */
    readonly patches: ReadonlyArray<{ patchId: string; from: 'elite' | 'gate' | 'shop'; price: number }>;
    /** 163e: benches walked past with nothing affordable or nothing upgradable. */
    readonly benchesMissed: number;
    /** 163e: bodies that stood in front of the shop's patch shelf — the shop take-rate's denominator. */
    readonly patchShelvesSeen: number;
    readonly finalDeck: ReadonlyArray<string>;
    readonly scrapAtEnd: number;
    /** 156's rows, so `runRead` can read this run exactly as it reads a human one. */
    readonly log: IRunLog;
}

const asSetupMember = (member: IMingmingState, patches?: Readonly<Record<string, ReadonlyArray<string>>>) => {
    const fitted = patches?.[member.id];
    return {
        definitionId: member.definitionId,
        activeOS: member.activeOS,
        attackIV: member.attackIV,
        defenseIV: member.defenseIV,
        hpIV: member.hpIV,
        ...(fitted && fitted.length > 0 ? { patches: [...fitted] } : {}),
    };
};

/**
 * The `IRunEncounter` → `ComposedSetup` translation, deliberately identical to `runGate.ts`'s.
 *
 * **The whole enemy deck rides on `enemies[0]`, and that is not a shortcut**: `IRunEncounter` gives
 * one flat `enemyDeckIds` because a side's deck is SHARED, and `buildScenarioState` rebuilds the
 * enemy pile as `setup.enemies.flatMap(e => e.deck ?? [])`. One enemy carrying the list reproduces
 * the run's shared pile exactly; splitting it per member would invent an ownership the run does not
 * have. `runWalker.test.ts` asserts this against a gate-built setup rather than trusting the copy.
 */
export function setupFor(
    seed: string,
    party: ReadonlyArray<IMingmingState>,
    deck: ReadonlyArray<string>,
    enemyParty: ReadonlyArray<IBattleEntity>,
    enemyDeckIds: ReadonlyArray<string>,
    enemyDrivers: ReadonlyArray<string>,
    playerDrivers: ReadonlyArray<string>,
    patches?: Readonly<Record<string, ReadonlyArray<string>>>,
): ComposedSetup {
    const enemies: EnemySetup[] = enemyParty.map((enemy, index) => ({
        definitionId: enemy.definitionId,
        activeOS: enemy.activeOS ?? NO_FIRMWARE_OS,
        attackIV: enemy.attackIV ?? BALANCE_IV,
        defenseIV: enemy.defenseIV ?? BALANCE_IV,
        hpIV: enemy.hpIV ?? BALANCE_IV,
        deck: index === 0 ? [...enemyDeckIds] : [],
    }));
    return {
        seed,
        enemyMode: RUN_ENEMY_MODE,
        player: { party: party.map((m) => asSetupMember(m, patches)), deck: [...deck], drivers: [...playerDrivers] },
        enemies,
        ...(enemyDrivers.length > 0 ? { enemyDrivers: [...enemyDrivers] } : {}),
        statJitter: BALANCE_STAT_JITTER,
    };
}

/**
 * TICKET 169j — which of the offered cards the walker takes at one Draft Start pick.
 *
 * The first offered card that is in the member's start kit and not yet used up (a kit that holds two
 * copies lets a second through); if none is, the offer with the highest `scoreOf`, ties to the first
 * offered. So the walker drafts the kit the game would have dealt it whenever the offers allow, and
 * otherwise the best card it is shown. Pure, so the policy is testable without a walk.
 */
export function chooseDraftPick(
    offer: ReadonlyArray<string>,
    kit: ReadonlyArray<string>,
    picked: ReadonlyArray<string>,
): string | undefined {
    const count = (ids: ReadonlyArray<string>, id: string): number => ids.filter((other) => other === id).length;
    const fromKit = offer.find((id) => count(kit, id) > count(picked, id));
    if (fromKit !== undefined) return fromKit;
    let best: string | undefined;
    let bestScore = -Infinity;
    for (const id of offer) {
        const score = scoreOf(id) ?? -Infinity;
        // Strictly greater, so a tie keeps the first offered; and the first card is taken even at -Infinity.
        if (best === undefined || score > bestScore) { best = id; bestScore = score; }
    }
    return best;
}

/** TICKET 169j: a whole Draft Start draft for one member, five picks with `chooseDraftPick`. */
export function draftKitFor(seed: string, member: IMingmingState, memberIndex = 0): string[] {
    const kit = startKitIdsFor(member, START_KIT_SIZE);
    let remaining = draftPool(member);
    const picks: string[] = [];
    for (let pick = 0; pick < DRAFT_PICKS; pick += 1) {
        const chosen = chooseDraftPick(draftOffer(seed, memberIndex, pick, remaining), kit, picks);
        if (chosen === undefined) break;
        picks.push(chosen);
        remaining = takePick(remaining, chosen);
    }
    return picks;
}

/** A roster member built at the corpus IVs, so the walk measures decks rather than stat rolls. */
export function memberFor(id: string, osId: string): IMingmingState {
    const species = speciesOwningFirmware(osId);
    if (!species) throw new Error(`runWalker: no species owns firmware ${osId}`);
    return {
        id, definitionId: species, activeOS: osId, blueprintsCollected: 0,
        attackIV: BALANCE_IV, defenseIV: BALANCE_IV, hpIV: BALANCE_IV,
    };
}

/**
 * TICKET 168a — the walker at an event node: draw the event, take the first choice that is free
 * (`chooseEventChoice`, else Leave), and record what happened. A card pick takes what the walker's
 * ordinary reward policy would take from the same three cards.
 *
 * The ledger stands in for the ranch's blueprint counts (one per species held). 168d: a blueprint
 * pick adds to it, a macro pick takes the first macro offered, an upgrade uses the free bench
 * `count` times, and a recruit goes through the walker's own workshop recruit at price 0.
 */
export function playEventNode(
    store: { dispatch: (action: unknown) => void; getState: () => { run: { run: IRunState | null } } },
    node: IRegionNode,
    roster: ReadonlyArray<IMingmingState>,
    ledger: BlueprintLedger,
    pickFor: (offered: string[]) => { taken: string | null; toCollection: boolean },
    record: (event: Parameters<typeof appendRunEvent>[1]) => void,
    /** The workshop's recruit at price 0 (Stray Mingming). Absent: the walker cannot recruit here. */
    recruit?: () => void,
    /** `true` when the choice started an event fight (Ambush Bait): the caller plays it. */
): boolean {
    const run = store.getState().run.run!;
    const dispatch = (action: unknown): void => store.dispatch(action);
    const blueprints: Record<string, number> = {};
    for (const species of ledger.recruitable([])) blueprints[species] = 1;
    const ranch = { roster, blueprints };
    const event = drawEvent(run, node, ranch);
    const ctx = { run, node };
    const scrapBefore = run.scrap;
    const scrapDelta = (): number => store.getState().run.run!.scrap - scrapBefore;

    if (event === null) {
        applyEmptyRelay(dispatch, ctx, EMPTY_RELAY_ID, EMPTY_RELAY_SCRAP);
        record({ kind: 'SCRAP', delta: scrapDelta(), reason: 'event' });
        record({ kind: 'EVENT_RESOLVED', eventId: EMPTY_RELAY_ID, choiceId: 'salvage' });
        return false;
    }

    const choice = chooseEventChoice(event, scrapBefore);
    const picks: Record<number, OutcomePick> = {};
    const eventCtx = { run, node, ranch };
    choice.outcomes.forEach((outcome, index) => {
        const slot = `${choice.id}:${index}`;
        if (outcome.type === 'CARD_PICK') {
            const offered = offerCards(eventCtx, { count: outcome.count, rarities: outcome.rarities }, slot);
            const decision = pickFor(offered);
            if (decision.taken !== null) picks[index] = { cardId: decision.taken, toCollection: decision.toCollection };
        } else if (outcome.type === 'BLUEPRINT_PICK') {
            // A species the walker does not hold yet beats one it does: a second copy is a spare.
            const offered = offerBlueprints(eventCtx, outcome.count, slot);
            const speciesId = offered.find((id) => !ledger.has(id)) ?? offered[0];
            if (speciesId) { picks[index] = { speciesId }; ledger.add(speciesId); }
        } else if (outcome.type === 'MACRO_PICK') {
            const macroId = offerMacros(eventCtx, outcome.count, slot)[0];
            if (macroId) picks[index] = { macroId, replaceSlot: 0 };
        } else if (outcome.type === 'UPGRADE') {
            // The free bench, `count` times, on the key the screen uses. Taken whatever the run's
            // `upgrades` arm says: that arm measures the purchase, and this one is not bought.
            for (let taken = 0; taken < outcome.count; taken += 1) {
                const current = store.getState().run.run!;
                const upgrade = chooseUpgrade(current.deck, current.scrap, true);
                if (!upgrade) break;
                dispatch(upgradeDeckCard({
                    instanceId: upgrade.instanceId, benchKey: `event:${node.id}`, free: true, allowance: outcome.count,
                }));
            }
        } else if (outcome.type === 'RECRUIT') {
            recruit?.();
        } else if (outcome.type === 'GIVE_CARD') {
            // Only The Toll gets here (the walker leaves every other event that takes a card): it
            // gives up the cheapest cards it can spare.
            picks[index] = { instanceIds: chooseGiveUps(store.getState().run.run!, outcome.count, outcome.rarity, scoreOf) };
        }
    });
    applyChoice(dispatch, ctx, event, choice, picks);
    if (scrapDelta() !== 0) record({ kind: 'SCRAP', delta: scrapDelta(), reason: 'event' });
    record({ kind: 'EVENT_RESOLVED', eventId: event.id, choiceId: choice.id });
    // TICKET 168g: the choice may have started Ambush Bait's fight. The walk plays it.
    return store.getState().run.run!.eventFight === true;
}

export function buyMarketBlueprintIfOffered(
    store: { dispatch: (action: unknown) => void; getState: () => { run: { run: IRunState | null } } },
    node: IRegionNode,
    ledger: BlueprintLedger,
    record?: (event: Parameters<typeof appendRunEvent>[1]) => void,
): boolean {
    const run = store.getState().run.run;
    if (!run || isBlueprintSlotSold(run, node)) return false;
    const bp = rollBlueprintOffer(run, node);
    if (!bp || run.scrap < bp.price) return false;
    const beforeCount = (run.boughtBlueprints ?? []).length;
    store.dispatch(buyMarketBlueprint({ nodeId: node.id, price: bp.price }));
    const after = store.getState().run.run;
    if ((after?.boughtBlueprints ?? []).length > beforeCount) {
        ledger.add(bp.speciesId);
        record?.({ kind: 'SCRAP', delta: -bp.price, reason: 'blueprint' });
        return true;
    }
    return false;
}

export function executeWorkshopRecruit(
    store: { dispatch: (action: unknown) => void; getState: () => { run: { run: IRunState | null } } },
    node: IRegionNode,
    partyMembers: ReadonlyArray<IMingmingState>,
    roster: IMingmingState[],
    ledger: BlueprintLedger,
    gym: IGym,
    record?: (event: Parameters<typeof appendRunEvent>[1]) => void,
    /** What the recruit costs: the workshop's price (Tight Budget's, when on), or 0 for an event. */
    priceOverride?: number,
): RecruitChoice | null {
    const run = store.getState().run.run;
    // TICKET 169j: No Recruits. The walker builds its recruit itself rather than through
    // `planRecruit`, so it has to ask the same question the game does.
    if (!run || recruitingBlocked(run)) return null;
    const price = priceOverride ?? shopPrice(run, WORKSHOP_ASSEMBLY_SCRAP);
    if (run.partyIds.length >= 3 || run.scrap < price) return null;
    const held = new Set(partyMembers.map((m) => m.definitionId));
    const recruitable = new Set(ledger.recruitable(held));
    const candidates = LAUNCH_SPECIES.filter((s) => recruitable.has(s));
    if (candidates.length === 0) return null;
    const partyOS = partyMembers.map((m) => m.activeOS!).filter(Boolean);
    const gymPlan = gymCompElementPlan(gym);
    const target = gymPlan[0] ?? gym.element;
    const ranked = candidates
        .map((speciesId) => chooseRecruit(speciesId, partyOS, target))
        .filter((c): c is RecruitChoice => c !== null)
        .map((c) => ({
            choice: c,
            rank: (grammarFor(c.osId)?.partners ?? []).some((p) => partyOS.includes(p.osId)) ? 0
                : MingmingRegistry[c.speciesId].primaryElement === COUNTERED_BY[target] ? 1 : 2,
        }))
        .sort((a, b) => a.rank - b.rank || a.choice.osId.localeCompare(b.choice.osId));
    if (ranked.length === 0) return null;

    const choice = ranked[0].choice;
    const member = memberFor(`mm${roster.length + 1}`, choice.osId);
    roster.push(member);
    const stream = new SeedStream(new SeedStream(`${run.seed}:${node.id}:recruit`).fork('recruit-deck'));
    const cards = recruitDeckFor(member, stream);
    store.dispatch(recruitIntoParty({ memberId: member.id, cards, price }));
    ledger.spend(choice.speciesId);
    record?.({ kind: 'RECRUITED', definitionId: member.definitionId, cards: cards.map((c) => c.dataId) });
    return choice;
}

/**
 * Play one run, end to end.
 *
 * The shape of the loop is the shape of the run: enter a node, do what that node is for, step. It
 * ends when the gym is reached (and the gauntlet is played) or when a fight is lost — **a loss ends
 * the run**, which is the rule the game has and the reason a walker's "win rate by fight index" is
 * conditional on having survived the fights before it.
 *
 * A step budget guards against a graph the policy cannot leave. It is not expected to fire; if it
 * does, the run is reported as a defeat with `truncated` fights, and that is a finding rather than
 * an error to swallow.
 */
export function walkRun(input: WalkInput): WalkResult {
    const { seed, starter } = input;
    const offers = offerGyms(`${seed}:gyms`);
    const offer = offers[input.gymIndex % offers.length];
    const gym = GYM_REGISTRY[offer.gym.id] ?? offer.gym;

    const party: IMingmingState[] = [memberFor('mm1', starter)];
    const roster: IMingmingState[] = [...party];
    const store = configureStore({ reducer: { run: runReducer } });
    // TICKET 169j: the tier and modifiers, and — with Draft Start — the walker's own draft, since it
    // cannot click. Every one of these is absent by default, so a plain walk is the walk it always was.
    const modifiers = input.modifiers ?? [];
    const startKitOverrides = modifiers.includes('draft_start')
        ? Object.fromEntries(party.map((member, index) => [member.id, draftKitFor(seed, member, index)]))
        : undefined;
    store.dispatch(startRun(createRun({
        seed, offer, party, startedAt: 1_700_000_000_000,
        tier: input.tier, modifiers, startKitOverrides,
    })));

    const runNow = (): IRunState => store.getState().run.run!;
    const gymNodeId = runNow().nodes.find((node) => node.kind === 'gym')!.id;

    let log = emptyRunLog(seed, 1_700_000_000_000);
    let seq = 0;
    const record = (input_: Parameters<typeof appendRunEvent>[1], fightIndex: number): void => {
        const run = runNow();
        log = appendRunEvent(log, input_, {
            seq: seq++, fightIndex, deckSize: run.deck.length, scrap: run.scrap,
        });
    };

    const fights: FightRecord[] = [];
    const picks: PickDecision[] = [];
    const bought: Array<{ dataId: string; price: number }> = [];
    const recruits: RecruitChoice[] = [];
    const steps: StepReason[] = [];
    const upgraded: Array<{ from: string; to: string; price: number }> = [];
    const patchesTaken: Array<{ patchId: string; from: 'elite' | 'gate' | 'shop'; price: number }> = [];
    let benchesMissed = 0;
    /** 163e: how often a body stood in front of the shop's patch shelf — the take-rate denominator. */
    let patchShelvesSeen = 0;
    const blueprintLedger = new BlueprintLedger();
    let outcome: 'victory' | 'defeat' = 'defeat';

    const partyMembers = (): IMingmingState[] =>
        runNow().partyIds.map((id) => roster.find((m) => m.id === id)!).filter(Boolean);
    const deckIds = (): string[] => runNow().deck.map((c) => c.dataId);
    const partyElements = (): Set<string> =>
        new Set(partyMembers().map((m) => GetMingmingData(m.definitionId).primaryElement));

    record({ kind: 'RUN_STARTED', gymId: gym.id, tier: runNow().tier, party: party.map((m) => m.definitionId), modifiers: activeModifiers(runNow()) }, 0);

    /** Play one rolled encounter and fold the result into the log. Returns whether it was won. */
    const fight = (node: IRegionNode, encounter: ReturnType<typeof rollEncounter>, carriedHp?: Readonly<Record<string, number>>): RunResult => {
        const members = partyMembers();
        const setup = setupFor(
            encounter.seed, members, deckIds(), encounter.enemyParty, encounter.enemyDeckIds,
            encounter.enemyDrivers ?? [], runNow().drivers ?? [],
            runNow().patches,
        );
        record({
            kind: 'FIGHT_DECK',
            deck: [...deckIds()].sort(),
            /*
             * HP AND MAXHP ARE ZERO OUTSIDE THE GAUNTLET, AND THAT IS THE HONEST ROW.
             *
             * 156's schema records the party as the fight STARTS. Outside the gym the run full-heals
             * between nodes (`exploration-map.md`, and the reason `IGauntletProgress.persistedHp`
             * is the only HP state in `IRunState`), so there is no carried number to print and
             * inventing the frame's maximum here would put a figure in the log that the run does not
             * hold. Inside the gauntlet the carried HP is real and is printed.
             */
            party: members.map((m) => ({
                memberId: m.id, species: m.definitionId, osId: m.activeOS ?? null,
                hp: carriedHp?.[m.id] ?? 0, maxHp: 0,
            })),
            enemies: encounter.enemyParty.map((e) => ({ species: e.definitionId, osId: e.activeOS ?? null })),
            nodeKind: node.kind, biome: node.biomeIndex,
        }, fights.length + 1);

        // `runOne` applies the jitter itself (`buildScenarioState({...applyStatJitter(setup, seed)})`),
        // so the setup is handed over raw. Beam and AI tier come off the ENCOUNTER rather than from a
        // constant here: getting them right needs the node kind, the run's tier and the opening-fight
        // rule together, and a harness holding a second opinion about any of the three would measure
        // a ladder the game does not field.
        const result = runOne(
            setup, encounter.seed, WALK_MAX_TURNS, 'PLAYER', false,
            encounter.enemyAiTier, encounter.aiBeam,
        );

        const won = result.winner === 'PLAYER';
        record({
            kind: 'FIGHT_ENDED', turns: result.turns, won,
            partyHp: Object.fromEntries(result.playerEnd.map((e, i) => [members[i]?.id ?? e.id, e.hp])),
        }, fights.length + 1);

        fights.push({
            index: fights.length + 1, nodeId: node.id, kind: node.kind, biome: node.biomeIndex,
            deckSize: runNow().deck.length, deckPower: deckPower(deckIds()),
            won, turns: result.turns, truncated: result.truncated,
            survivors: result.playerEnd.map((e, i) => ({
                osId: members[i]?.activeOS ?? '?',
                hpFraction: e.maxHp > 0 ? e.hp / e.maxHp : 0,
            })),
        });
        return result;
    };

    /**
     * The enemy party as the battle LEFT it.
     *
     * `rollDropTable` pays only for bodies at `currentHp <= 0` — its own comment: *"the fight's size
     * is its CORPSES, not the player's party"* — so the rolled party, still at full HP, buys
     * nothing. That is not a hypothetical: the first build of this file handed over the rolled
     * party and measured a run in which no fight ever paid a card.
     *
     * **Joined by INDEX, not by id, and the reason is worth a sentence.** `buildScenarioState` mints
     * its own entities from the `ComposedSetup`, so the ids in `result.enemyEnd` are the battle's,
     * not the encounter's — an id join silently matches nothing and looks exactly like a fight where
     * everybody lived. `setupFor` builds `enemies` by mapping `encounter.enemyParty` in order and
     * the builder preserves that order, which is the same promise `setupFor`'s own
     * "the whole deck rides on `enemies[0]`" rests on. Asserted in `runWalker.test.ts`.
     */
    const corpses = (encounter: ReturnType<typeof rollEncounter>, result: RunResult): IBattleEntity[] =>
        encounter.enemyParty.map((entity, index) => ({
            ...entity,
            currentHp: result.enemyEnd[index]?.hp ?? entity.currentHp,
        }));

    /** §3's reward row, then §3's shop row, then the recruit. */
    const takeRewards = (node: IRegionNode, defeated: ReadonlyArray<IBattleEntity>, scrapMultiplier = 1): void => {
        const run = runNow();
        const bundle = rollDropTable({
            defeated: [...defeated], nodeKind: node.kind, seed: `${run.seed}:${node.id}:reward`,
            party: partyMembers().map((m) => ({ definitionId: m.definitionId, activeOS: m.activeOS, id: m.id })),
            dryFights: run.blueprintDryFights ?? 0,
            bonus: fightBonusFor({ nodeKind: node.kind, biomeIndex: node.biomeIndex, biomeCount: run.biomes.length, gauntlet: null }),
            heldPatches: run.patches ?? {},
        });
        // The walker has no macro policy (it never fires macros), so leave bundle.macroChoices unclaimed.

        // TICKET 168g: an event fight pays its scrap twice.
        const scraps = bundle.scraps * scrapMultiplier;
        if (scraps > 0) {
            store.dispatch(addRunScrap(scraps));
            record({ kind: 'SCRAP', delta: scraps, reason: 'fight' }, fights.length);
        }
        for (const species of bundle.blueprints) {
            blueprintLedger.add(species);
        }
        store.dispatch(recordFightBlueprintOutcome({ dropped: bundle.blueprints.length > 0 }));
        if (bundle.driver) store.dispatch(addDriver(bundle.driver));
        // §3 has no patch policy, and 163's ruling is that an elite offers one per body. Taking the
        // first offer is the same "equip the first found" rule the blueprint row uses.
        for (const offerRow of bundle.patchChoices ?? []) {
            store.dispatch(fitPatch({ memberId: offerRow.memberId, patchId: offerRow.patchId }));
            patchesTaken.push({ patchId: offerRow.patchId, from: 'elite', price: 0 });
            record({ kind: 'PATCH_TAKEN', memberId: offerRow.memberId, patchId: offerRow.patchId }, fights.length);
            break;
        }

        for (const choice of bundle.cardChoices) {
            const offered = choice.options.map((o) => o.dataId);
            const decision = choosePick(offered, deckIds(), partyElements());
            picks.push(decision);
            if (decision.taken === null) {
                record({ kind: 'CARD_SKIPPED', offered }, fights.length);
                continue;
            }
            const card: IRunCard = {
                instanceId: `${node.id}:${decision.taken}:${picks.length}`,
                dataId: decision.taken,
                // `null` is the run's own word for "not minted with a body" — a reward card has no
                // owner, exactly as a bought or drafted one does not.
                ownerId: null,
            };
            store.dispatch(decision.toCollection ? addRunCollection([card]) : addRunCards([card]));
            record({ kind: 'CARD_PICKED', dataId: decision.taken, offered }, fights.length);
        }
    };

    /** §3's shop row: buy the highest-scored affordable card once per visit; refresh never. */
    const shop = (node: IRegionNode): void => {
        const run = runNow();
        const stock = rollMarketStock({
            run, node,
            party: partyMembers().map((m) => ({ definitionId: m.definitionId, activeOS: m.activeOS, id: m.id })),
        });
        const affordable = stock.offers
            .map((o) => ({ offer: o, score: scoreOf(o.card.dataId) }))
            .filter((row): row is { offer: typeof stock.offers[number]; score: number } =>
                row.score !== null && row.offer.price <= runNow().scrap)
            .sort((a, b) => b.score - a.score);
        if (affordable.length > 0) {
            const { offer: best } = affordable[0];
            store.dispatch(buyMarketCard({ card: best.card, price: best.price }));
            bought.push({ dataId: best.card.dataId, price: best.price });
            record({ kind: 'CARD_BOUGHT', dataId: best.card.dataId, price: best.price }, fights.length);
        }

        // A blueprint on the shelf is a body, which the recruit policy values above any card.
        buyMarketBlueprintIfOffered(store, node, blueprintLedger, (evt) => record(evt, fights.length));

        // TICKET 163e: the shop's Amplifier at `SHOP_PATCH_PRICE`. Bought AFTER the card and the
        // blueprint, which is the order the policy already ranks them in — a patch is the newest
        // shelf and has the least evidence behind its price, so it should not outbid the two that do.
        const patchPrice = shopPrice(runNow(), input.patchPrice ?? SHOP_PATCH_PRICE);
        for (const fit of choosePatches(partyMembers(), runNow().patches ?? {}, 'shop')) {
            patchShelvesSeen += 1;
            if (runNow().scrap < patchPrice) break;
            store.dispatch(fitPatch({ memberId: fit.memberId, patchId: fit.patchId, price: patchPrice }));
            patchesTaken.push({ patchId: fit.patchId, from: 'shop', price: patchPrice });
            record({ kind: 'PATCH_TAKEN', memberId: fit.memberId, patchId: fit.patchId }, fights.length);
            break;
        }

        // TICKET 168c: junk is cleared LAST, with whatever the purchases left. A card, a body and a
        // patch are worth more to the run than an empty slot in the hand, so removal never outbids
        // them; it spends only scrap the shop visit had no other use for.
        const removalPrice = shopPrice(runNow(), JUNK_REMOVAL_PRICE);
        for (const instanceId of junkToRemove(runNow().deck, runNow().scrap, removalPrice)) {
            store.dispatch(removeJunkCard({ instanceId, price: removalPrice }));
        }
    };

    /**
     * TICKET 163e — the upgrade bench, at whichever venue the walker is standing in.
     *
     * 163b ships three: the market stall, the workshop node and the gym gate (free, once). One
     * upgrade per visit, which `upgradeDeckCard`'s `benchKey` enforces — the walker passes the same
     * `nodeId:visit` key the screens do rather than counting for itself.
     *
     * A bench walked past with nothing affordable or nothing upgradable is COUNTED rather than
     * ignored: "the player stood at a bench and could not use it" is a different number from "there
     * was no bench", and 163e's take-rate needs the denominator.
     */
    const upgradeBench = (node: IRegionNode, free: boolean): void => {
        const run = runNow();
        const choice = chooseUpgrade(run.deck, run.scrap, free, (base) => shopPrice(run, base));
        /*
         * THE BENCH IS COUNTED IN BOTH ARMS, and only the purchase is gated.
         *
         * The first build returned before counting when the arm was off, which left the control arm
         * reporting "0 of 0 benches" — a take-rate with no denominator, and the one number a
         * paired comparison actually needs. A bench the walker stood at is a bench whether or not
         * the policy spent at it.
         */
        if (!choice) { benchesMissed += 1; return; }
        if (input.upgrades !== true) { benchesMissed += 1; return; }
        const before = runNow().deck.filter((c) => c.upgraded === true).length;
        store.dispatch(upgradeDeckCard({
            instanceId: choice.instanceId, benchKey: `${node.id}:${node.visited}`, free,
        }));
        if (runNow().deck.filter((c) => c.upgraded === true).length === before) { benchesMissed += 1; return; }
        upgraded.push({ from: choice.from, to: choice.to, price: choice.price });
        record({ kind: 'CARD_UPGRADED', from: choice.from, to: choice.to, price: choice.price }, fights.length);
    };

    /** §5.2's strategic recruit, at a workshop, while a blueprint is held and the party has room. */
    const workshop = (node: IRegionNode): void => {
        const choice = executeWorkshopRecruit(
            store, node, partyMembers(), roster, blueprintLedger, gym, (evt) => record(evt, fights.length),
        );
        if (choice) recruits.push(choice);
    };

    // ---- the loop -------------------------------------------------------------------------
    const STEP_BUDGET = 200;
    for (let step = 0; step < STEP_BUDGET; step += 1) {
        const run = runNow();
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;

        if (node.kind === 'gym') {
            /*
             * THE GYM GATE, which is the one venue that is free (163 §3: *"the gym gate offers a
             * choice of two; the shop stocks Amplifier"*, and the upgrade there is free, once). It
             * runs BEFORE `beginGauntlet` because that is where the screen puts it — the gauntlet is
             * three fights with no healing and no shopping between them.
             */
            upgradeBench(node, true);
            for (const fit of choosePatches(partyMembers(), runNow().patches ?? {}, 'gate').slice(0, 1)) {
                store.dispatch(fitPatch({ memberId: fit.memberId, patchId: fit.patchId }));
                patchesTaken.push({ patchId: fit.patchId, from: 'gate', price: 0 });
                record({ kind: 'PATCH_TAKEN', memberId: fit.memberId, patchId: fit.patchId }, fights.length);
            }

            const persisted: Record<string, number> = {};
            store.dispatch(beginGauntlet());
            let cleared = true;
            for (let index = 0; index < GAUNTLET_FIGHTS; index += 1) {
                const encounter = rollGauntletFight({ run: runNow(), node, fightIndex: index });
                const result = fight(node, encounter, persisted);
                if (result.winner !== 'PLAYER') { cleared = false; break; }
                const members = partyMembers();
                const carried = result.playerEnd.map((e, i) => ({ memberId: members[i]?.id ?? e.id, hp: e.hp }));
                for (const row of carried) persisted[row.memberId] = row.hp;
                store.dispatch(advanceGauntlet(carried));
            }
            if (cleared) { store.dispatch(finishGauntlet()); outcome = 'victory'; }
            break;
        }

        if (isFightNode(node.kind)) {
            const encounter = rollEncounter({ run, node, party: partyMembers() });
            const result = fight(node, encounter, undefined);
            store.dispatch(resolveEncounter());
            if (result.winner !== 'PLAYER') break;
            takeRewards(node, corpses(encounter, result));
            // 157-r1's truncation. After the rewards, so a stop at N still measures the Nth fight
            // in full — the reward roll is part of what that fight WAS, and dropping it would make
            // the truncated walk disagree with the full one about the run it just played.
            if (input.stopAfterFights !== undefined && fights.length >= input.stopAfterFights) break;
        } else if (isMarketNode(node.kind)) {
            shop(node);
            upgradeBench(node, false);
        } else if (node.kind === 'workshop') {
            workshop(node);
            upgradeBench(node, false);
        } else if (node.kind === 'event') {
            const startedFight = playEventNode(
                store, node, roster, blueprintLedger,
                (offered) => choosePick(offered, deckIds(), partyElements()),
                (evt) => record(evt, fights.length),
                () => {
                    const held = new Set(partyMembers().map((m) => m.definitionId));
                    if (runNow().partyIds.length >= 3 || blueprintLedger.recruitable(held).length === 0) return;
                    executeWorkshopRecruit(store, node, partyMembers(), roster, blueprintLedger, gym, (evt) => record(evt, fights.length), 0);
                },
            );
            if (startedFight) {
                // TICKET 168g: Ambush Bait. Fought as the wild it is, and paid double. The multiplier
                // is read BEFORE `resolveEncounter` clears the flag, as the arena reads it before the
                // win is claimed.
                const state = runNow();
                const wild = fightNodeFor(state, node);
                const multiplier = eventFightScrapMultiplier(state, node);
                const encounter = rollEncounter({ run: state, node: wild, party: partyMembers() });
                const result = fight(wild, encounter, undefined);
                store.dispatch(resolveEncounter());
                if (result.winner !== 'PLAYER') break;
                takeRewards(wild, corpses(encounter, result), multiplier);
                if (input.stopAfterFights !== undefined && fights.length >= input.stopAfterFights) break;
            }
        }

        const held = new Set(partyMembers().map((m) => m.definitionId));
        const hasRecruitable = runNow().partyIds.length < 3 && blueprintLedger.recruitable(held).length > 0;
        const next = chooseStep(runNow(), gymNodeId, hasRecruitable);
        if (!next) break;
        steps.push(next);
        store.dispatch(enterNode(next.nodeId));
        record({ kind: 'NODE_ENTERED', nodeKind: next.kind, biome: runNow().nodes.find((n) => n.id === next.nodeId)!.biomeIndex, layer: runNow().nodes.find((n) => n.id === next.nodeId)!.layer }, fights.length);
    }

    store.dispatch(endRun(outcome));
    record({ kind: 'RUN_ENDED', outcome, biomeReached: runNow().nodes.find((n) => n.id === runNow().currentNodeId)?.biomeIndex ?? 0 }, fights.length);

    return {
        seed, starter, gymId: gym.id, gymElement: gym.element, outcome,
        fights, picks, bought, recruits, steps,
        upgraded, patches: patchesTaken, benchesMissed, patchShelvesSeen,
        finalDeck: deckIds(), scrapAtEnd: runNow().scrap, log,
    };
}

// ---------------------------------------------------------------------------------------------
// The report — §3's four outputs
// ---------------------------------------------------------------------------------------------

export interface WalkSummary {
    readonly starter: string;
    readonly runs: number;
    readonly victories: number;
    readonly meanFights: number;
    /** §3's 148 number: mean deck power at fight 1, 4, 8 and at the gym. */
    readonly deckPowerAt: Readonly<Record<'f1' | 'f4' | 'f8' | 'gym', number | null>>;
    /** Win rate by fight index, conditional on having reached it. `[index, wins, played]`. */
    readonly byFightIndex: ReadonlyArray<{ index: number; wins: number; played: number }>;
    /** Where runs end: biome index → count. */
    readonly diedAtBiome: Readonly<Record<number, number>>;
    /** §3's 153 number. */
    readonly picks: { offered: number; taken: number; toCollection: number };
    readonly bought: number;
    readonly recruits: number;
    /** The firmware the walker recruited, and how often — §5.2's log, aggregated. */
    readonly recruitedOS: Readonly<Record<string, number>>;
    /** 142 §6's bench pressure: mean HP fraction of the survivors at the end of each fight. */
    readonly meanSurvivorHp: number | null;
    /** 163e: upgrades bought, benches walked past, and the scrap spent on them. */
    readonly upgrades: { taken: number; missed: number; scrap: number };
    /** 163e: patches fitted, by where they came from and by which rider. */
    readonly patches: { total: number; byVenue: Readonly<Record<string, number>>; byKind: Readonly<Record<string, number>>; shopShelves: number };
}

const mean = (xs: ReadonlyArray<number>): number | null =>
    xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

/** Fold N walks of one starter into §3's table. */
export function summarise(starter: string, results: ReadonlyArray<WalkResult>): WalkSummary {
    const at = (pick: (r: WalkResult) => FightRecord | undefined): number | null =>
        mean(results.map(pick).map((f) => f?.deckPower).filter((p): p is number => p != null && Number.isFinite(p)));

    const byIndex = new Map<number, { wins: number; played: number }>();
    for (const result of results) {
        for (const fight of result.fights) {
            const row = byIndex.get(fight.index) ?? { wins: 0, played: 0 };
            row.played += 1;
            if (fight.won) row.wins += 1;
            byIndex.set(fight.index, row);
        }
    }

    const diedAtBiome: Record<number, number> = {};
    for (const result of results) {
        const last = result.fights.at(-1);
        if (result.outcome === 'victory' || !last) continue;
        diedAtBiome[last.biome] = (diedAtBiome[last.biome] ?? 0) + 1;
    }

    const recruitedOS: Record<string, number> = {};
    for (const result of results) for (const r of result.recruits) recruitedOS[r.osId] = (recruitedOS[r.osId] ?? 0) + 1;

    const survivorHp = results.flatMap((r) => r.fights.flatMap((f) => f.survivors.filter((s) => s.hpFraction > 0).map((s) => s.hpFraction)));

    return {
        starter,
        runs: results.length,
        victories: results.filter((r) => r.outcome === 'victory').length,
        meanFights: mean(results.map((r) => r.fights.length)) ?? 0,
        deckPowerAt: {
            f1: at((r) => r.fights[0]),
            f4: at((r) => r.fights[3]),
            f8: at((r) => r.fights[7]),
            gym: at((r) => [...r.fights].reverse().find((f) => f.kind === 'gym')),
        },
        byFightIndex: [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([index, row]) => ({ index, ...row })),
        diedAtBiome,
        picks: {
            offered: results.reduce((n, r) => n + r.picks.reduce((m, p) => m + p.offered.length, 0), 0),
            taken: results.reduce((n, r) => n + r.picks.filter((p) => p.taken !== null).length, 0),
            toCollection: results.reduce((n, r) => n + r.picks.filter((p) => p.toCollection).length, 0),
        },
        bought: results.reduce((n, r) => n + r.bought.length, 0),
        recruits: results.reduce((n, r) => n + r.recruits.length, 0),
        recruitedOS,
        meanSurvivorHp: mean(survivorHp),
        upgrades: {
            taken: results.reduce((n, r) => n + r.upgraded.length, 0),
            missed: results.reduce((n, r) => n + r.benchesMissed, 0),
            scrap: results.reduce((n, r) => n + r.upgraded.reduce((m, u) => m + u.price, 0), 0),
        },
        patches: {
            total: results.reduce((n, r) => n + r.patches.length, 0),
            byVenue: results.flatMap((r) => r.patches).reduce<Record<string, number>>((acc, p) => {
                acc[p.from] = (acc[p.from] ?? 0) + 1; return acc;
            }, {}),
            byKind: results.flatMap((r) => r.patches).reduce<Record<string, number>>((acc, p) => {
                acc[p.patchId] = (acc[p.patchId] ?? 0) + 1; return acc;
            }, {}),
            shopShelves: results.reduce((n, r) => n + r.patchShelvesSeen, 0),
        },
    };
}

/** Walk `seeds` runs of one starter. Seeds are labelled, so a row can be reproduced by hand. */
export function walkStarter(
    starter: string, seeds: number, label = 'walk', upgrades = false, patchPrice?: number,
    /** TICKET 169j: the tier and modifiers, forwarded to every walk. */
    tier?: number, modifiers?: ReadonlyArray<string>,
): WalkResult[] {
    const out: WalkResult[] = [];
    for (let i = 0; i < seeds; i += 1) {
        // The SAME seed in both arms, so the two are paired: the graph, the enemies and the offers
        // are identical and the only difference is the spending policy. An unpaired comparison at
        // ten seeds would be measuring the region generator.
        out.push(walkRun({ seed: `${label}:${starter}:${i}`, starter, gymIndex: i % 3, upgrades, patchPrice, tier, modifiers }));
    }
    return out;
}

/**
 * Walk one starter, stopping after `fights` fights — 157-r1's cheap read.
 *
 * Seeded on a DIFFERENT prefix from `walkStarter`'s (`:f1:` rather than `:`), deliberately. A
 * truncated walk and a full one are two measurements of different things and neither is a sample of
 * the other, so sharing seeds between them would invite exactly the comparison that is not valid:
 * "the same seed won here and lost there" across two run lengths is a statement about the second
 * fight, not about the first.
 */
export function walkStarterTruncated(
    starter: string, seeds: number, fights: number, label = 'walk',
): WalkResult[] {
    const out: WalkResult[] = [];
    for (let i = 0; i < seeds; i += 1) {
        out.push(walkRun({ seed: `${label}:f1:${starter}:${i}`, starter, gymIndex: i % 3, stopAfterFights: fights }));
    }
    return out;
}

/** One starter's fight-`index` record: wins, played, and the enemy it was actually shown. */
export interface FightOneRow {
    readonly starter: string;
    readonly wins: number;
    readonly played: number;
    readonly rate: number;
    /** Mean turns, and how often the fight ran out the clock rather than ending. */
    readonly meanTurns: number;
    readonly truncated: number;
    /** Mean HP fraction of the player's survivors — how close the wins were. */
    readonly meanSurvivorHp: number | null;
}

/** Fold truncated walks into 157-r1's one table. Reads `fights[index - 1]` and nothing else. */
export function summariseFightOne(
    starter: string, results: ReadonlyArray<WalkResult>, index = 1,
): FightOneRow {
    const rows = results.map((r) => r.fights[index - 1]).filter((f): f is FightRecord => f != null);
    const wins = rows.filter((f) => f.won).length;
    const hp = rows.flatMap((f) => f.survivors.map((s) => s.hpFraction));
    return {
        starter,
        wins,
        played: rows.length,
        rate: rows.length === 0 ? 0 : (100 * wins) / rows.length,
        meanTurns: rows.length === 0 ? 0 : rows.reduce((n, f) => n + f.turns, 0) / rows.length,
        truncated: rows.filter((f) => f.truncated).length,
        meanSurvivorHp: mean(hp),
    };
}

/**
 * 157-r1's report: fight one against the ruled target, and nothing else.
 *
 * Deliberately not folded into `printWalkReport`. That report answers §3's question ("what does a
 * whole run look like") and this one answers Henry's ("is fight one near 95 yet"); a table that
 * tried to do both would print ten columns of run statistics that a truncated walk cannot fill.
 */
export function printFightOneReport(rows: ReadonlyArray<FightOneRow>, target: number, index = 1): void {
    console.log(`\n=== 157-r1 — FIGHT ${index}, against the ruled target of ${target}% ===\n`);
    console.log('starter              n    win%   vs target    mean turns   survivor HP');
    for (const r of rows) {
        const delta = r.rate - target;
        console.log(
            `${r.starter.padEnd(17)} ${String(r.played).padStart(5)}  ${r.rate.toFixed(1).padStart(5)}%`
            + `   ${(delta >= 0 ? '+' : '') + delta.toFixed(1)}pt`.padEnd(13)
            + `${r.meanTurns.toFixed(1).padStart(8)}      `
            + `${r.meanSurvivorHp === null ? '   —' : `${(100 * r.meanSurvivorHp).toFixed(0)}%`.padStart(5)}`
            + `${r.truncated > 0 ? `   (${r.truncated} hit the turn cap)` : ''}`,
        );
    }
    const played = rows.reduce((n, r) => n + r.played, 0);
    const wins = rows.reduce((n, r) => n + r.wins, 0);
    const pooled = played === 0 ? 0 : (100 * wins) / played;
    // The Wald interval is enough to say whether a move is real at these sample sizes; the gate's
    // own cells report an interval too, so a move between the two instruments is legible.
    const se = played === 0 ? 0 : Math.sqrt((pooled / 100) * (1 - pooled / 100) / played) * 100;
    console.log(
        `\nPOOLED: ${wins}/${played} = ${pooled.toFixed(1)}%`
        + `  (95% CI ${(pooled - 1.96 * se).toFixed(1)}–${(pooled + 1.96 * se).toFixed(1)})`
        + `  ·  target ${target}%  ·  ${(pooled - target >= 0 ? '+' : '') + (pooled - target).toFixed(1)}pt`,
    );
    const under = rows.filter((r) => r.rate < target).length;
    console.log(`${under} of ${rows.length} starters under target; worst ${
        [...rows].sort((a, b) => a.rate - b.rate).slice(0, 3).map((r) => `${r.starter} ${r.rate.toFixed(0)}%`).join(', ')}`);
}

/** The EA twelve, in registry order — §5.3's starter list, derived rather than transcribed. */
export function eaStarters(): string[] {
    return LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);
}

const pct = (n: number, d: number): string => (d === 0 ? '  — ' : `${((100 * n) / d).toFixed(0).padStart(3)}%`);
const num = (n: number | null, places = 2): string => (n === null ? '   —' : n.toFixed(places));

/** §3's report, printed. One block per starter, then the pooled answer to 162c. */
export function printWalkReport(summaries: ReadonlyArray<WalkSummary>): void {
    console.log('\n=== 157 — RUN WALKER, policy v0 ===\n');
    console.log('starter           runs  wins   fights   deck power f1 → f4 → f8 → gym');
    for (const s of summaries) {
        console.log(
            `${s.starter.padEnd(17)} ${String(s.runs).padStart(4)} ${pct(s.victories, s.runs)}`
            + `   ${s.meanFights.toFixed(1).padStart(5)}   ${num(s.deckPowerAt.f1)} → ${num(s.deckPowerAt.f4)}`
            + ` → ${num(s.deckPowerAt.f8)} → ${num(s.deckPowerAt.gym)}`,
        );
    }

    console.log('\n--- win rate by fight index (conditional on reaching it) ---');
    const maxIndex = Math.max(...summaries.flatMap((s) => s.byFightIndex.map((r) => r.index)), 0);
    const header = Array.from({ length: Math.min(maxIndex, 14) }, (_, i) => String(i + 1).padStart(5)).join('');
    console.log(`${'starter'.padEnd(17)}${header}`);
    for (const s of summaries) {
        const row = Array.from({ length: Math.min(maxIndex, 14) }, (_, i) => {
            const cell = s.byFightIndex.find((r) => r.index === i + 1);
            return cell ? `${Math.round((100 * cell.wins) / cell.played)}`.padStart(5) : '    ·';
        }).join('');
        console.log(`${s.starter.padEnd(17)}${row}`);
    }

    console.log('\n--- where runs end, and what the rewards did ---');
    console.log('starter           died in biome 0/1/2   picks taken/offered   → collection   bought  recruits   survivor HP');
    for (const s of summaries) {
        const died = [0, 1, 2].map((b) => String(s.diedAtBiome[b] ?? 0)).join('/');
        console.log(
            `${s.starter.padEnd(17)} ${died.padStart(17)}   ${String(s.picks.taken).padStart(5)}/${String(s.picks.offered).padEnd(6)}`
            // The RAW count beside the percentage: the first report had to reconstruct the pooled
            // figure from twelve rounded percentages, which is a needless way to lose a digit.
            + `  ${String(s.picks.toCollection).padStart(3)} (${pct(s.picks.toCollection, s.picks.taken).trim()})  ${String(s.bought).padStart(4)}  ${String(s.recruits).padStart(6)}`
            + `      ${s.meanSurvivorHp === null ? '  —' : `${(100 * s.meanSurvivorHp).toFixed(0)}%`}`,
        );
    }

    console.log('\n--- who the walker recruited (§5.2: partner first, then the counter element) ---');
    for (const s of summaries) {
        const rows = Object.entries(s.recruitedOS).sort((a, b) => b[1] - a[1]);
        if (rows.length > 0) console.log(`${s.starter.padEnd(17)} ${rows.map(([os, n]) => `${os} ×${n}`).join(', ')}`);
    }

    console.log('\n--- 163e: upgrades and patches ---');
    console.log('starter           upgrades taken/benches   scrap spent   patches (elite/gate/shop)');
    for (const s of summaries) {
        const benches = s.upgrades.taken + s.upgrades.missed;
        const venues = ['elite', 'gate', 'shop'].map((v) => s.patches.byVenue[v] ?? 0).join('/');
        console.log(
            `${s.starter.padEnd(17)} ${String(s.upgrades.taken).padStart(8)}/${String(benches).padEnd(8)}`
            + `  ${pct(s.upgrades.taken, benches)}   ${String(s.upgrades.scrap).padStart(6)}        ${String(s.patches.total).padStart(3)} (${venues})`
            + `   shop shelf ${s.patches.byVenue.shop ?? 0}/${s.patches.shopShelves} ${pct(s.patches.byVenue.shop ?? 0, s.patches.shopShelves)}`,
        );
    }
    const kinds = summaries.flatMap((s) => Object.entries(s.patches.byKind))
        .reduce<Record<string, number>>((acc, [k, n]) => { acc[k] = (acc[k] ?? 0) + n; return acc; }, {});
    console.log(`patch kinds: ${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(', ') || '(none)'}`);

    const runs = summaries.reduce((n, s) => n + s.runs, 0);
    const wins = summaries.reduce((n, s) => n + s.victories, 0);
    console.log(`\nPOOLED: ${wins}/${runs} runs cleared the gym (${((100 * wins) / Math.max(1, runs)).toFixed(1)}%).`);
}
