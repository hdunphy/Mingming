/**
 * THE WORKSHOP — ticket 14 (steam-release map). The place a run's PARTY grows.
 *
 * # WHAT A WORKSHOP IS FOR
 *
 * Ticket 13 gave the run a place to sharpen its deck. This is the other half of the same scrap: a
 * mid-run bench where a **blueprint plus scrap** buys a whole new party member, or a blueprint plus
 * scrap reflashes one you already have. `vision.md` calls the party's growth *"recruiting IS
 * drafting"*, and ticket 06 makes it exclusive to this node — **the party goes 1 → 2 → 3 here and
 * only here**.
 *
 * The price shape is Henry's ruling of 2026-08-21, quoted in `runTypes.ts`:
 *
 * > **Assembly costs a blueprint at the ranch, and a blueprint PLUS scrap at a mid-run workshop.**
 * > This resolves a direct conflict between `vision.md` ("spend SCRAP to assemble") and
 * > `economy-session.md` ("assembly (ranch AND workshop) costs blueprints only") by making both
 * > literally true of the place each was describing. Mid-run recruiting therefore competes with the
 * > marketplace for scrap — growing the team vs sharpening the deck is a real route decision —
 * > while between runs a blueprint is always spendable. **The scrap number is not set here**; it
 * > belongs to ticket 14.
 *
 * That last sentence is what this file is. `WORKSHOP_ASSEMBLY_SCRAP` is the number ticket 06
 * deliberately left open, and the whole of THE WORKSHOP KNOB below is the arithmetic behind it.
 *
 * # THE DESIGN TARGET IS COMPETITION, NOT COST
 *
 * The ruling does not ask for the recruit to be expensive; it asks for it to be **a sacrifice of
 * cards**. A price the player never notices makes the workshop a free power-up and the "route
 * decision" imaginary; a price they cannot pay makes the node dead and freezes the party at one,
 * which then compounds — `SCRAP_PER_ENEMY` pays **per defeated enemy** and `enemyPartySize` makes
 * an ordinary wild symmetric with your team, so a party that has not grown earns less and can
 * afford to grow even later. Every bound below is set against those two failures.
 *
 * # WHAT IS *NOT* PRICED HERE
 *
 * Removal. `WORKSHOP_REMOVAL_PRICE` is ticket 13's `REMOVAL_PRICE`, re-exported rather than
 * re-declared — see its own note. One sink, one price, whichever counter you buy it over.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random()`, no
 * `Date.now()`.
 */

import { SeedStream } from '../core/SeedStream';
import { MingmingRegistry } from '../data/mingmingRegistry';
import { createRanchMember } from '../gameTypes';
import { PARTY_SIZE, partyBlockFor, type PartyBlock, type PartyMember } from '../party';
import { REMOVAL_PRICE } from './marketplace';
import { recruitDeckFor } from './createRun';
import { toMingmingState } from './battleSetup';
import { nodeSeed } from './nodeSeed';
import type { IRanchMember, IRanchState, IRegionNode, IRunCard, IRunState, NodeKind } from '../runTypes';

// =================================================================================================
// THE WORKSHOP KNOB — every number here is a PROPOSAL awaiting Henry's ratification
// =================================================================================================

/**
 * ## The shape of the growth this ticket prices
 *
 * The party starts at one member (`createRun` is handed the party `RunStart` picked, and
 * `vision.md`'s progression opens solo) and ends at `PARTY_SIZE`. So **two recruits per run** is not
 * an estimate, it is the ruled shape — the same figure ticket 13 divided its own generics count by
 * (`START_GENERICS + RECRUIT_GENERICS × 2 = 5`). It is named here rather than written as a literal
 * `2` so that the two tickets' derivations move together if the party size is ever changed.
 */
export const RECRUITS_PER_RUN = PARTY_SIZE - 1;

/**
 * **PROPOSAL — a mid-run recruit costs 75 scrap on top of its blueprint. THE NUMBER THIS TICKET
 * OWNS, so here is the arithmetic in full, in the shape ticket 13 used for removal.**
 *
 * ### The derivation
 *
 * 1. **A run's income** is ticket 12's measured anchor: a full 8–10 fight run with a three-member
 *    party lands around **450–500 scrap**. 450 is used throughout, for ticket 13's reason — pricing
 *    to the optimistic end of a band is how a shop ends up unaffordable for everyone who is not
 *    already winning.
 * 2. **A market visit's scrap** = 450 / `MARKET_VISITS_PER_RUN` = **150**. Ticket 07 guarantees one
 *    marketplace *and* one workshop per biome, and a run is three biomes, so the two node kinds see
 *    the player exactly as often as each other. That symmetry is why the marketplace's own divisor
 *    is the right one to quote a workshop against: three visits each, one shared purse.
 * 3. **Two recruits per run** (`RECRUITS_PER_RUN`).
 * 4. **The price**: growing the party 1 → 2 → 3 costs **one market visit's scrap**, so
 *    150 / 2 = **75 scrap per recruit**.
 *
 * That is deliberately the same sentence ticket 13 wrote about removal ("stripping all generics
 * costs roughly one market visit's scrap"), because it makes the run's three sinks quotable against
 * one another: of the three market visits' worth of scrap a run earns, **one buys the team, one
 * strips the filler, and one buys cards.** A player who does all three does each of them once.
 *
 * ### The trade, stated
 *
 * The median rewardable card in the registry prices at **48** (`cardPrice`; the band runs 24–96).
 * So **one recruit costs you roughly one and a half cards' worth of market — and the two together
 * are three cards you did not buy.** At the cheap end of the shelf a recruit is three Commons; at
 * the dear end it is most of one Rare. It is also 2.5 removals, so recruiting once is half the
 * generics you could have stripped instead.
 *
 * Three cards out of the ~9 a 450-scrap run can buy is a sacrifice the player feels at the shelf
 * and can still choose to make. That is the whole of the ruling's "real route decision".
 *
 * ### Why not higher, why not lower
 *
 * - **Not ≤ `REMOVAL_PRICE` (30).** A recruit that costs less than deleting one filler card is a
 *   rounding error against a 450-scrap run, and the ruling's competition never happens.
 * - **Not ≥ 150 (a whole market visit each).** Two recruits would then eat 300 of 450 and the
 *   marketplace becomes a window display. Worse, it is unpayable where it is first offered: the
 *   biome-1 workshop is reached by a *solo* party, whose wilds field one body and pay ~11 apiece,
 *   so the player arrives holding tens of scrap, not hundreds. A node the player can never use is a
 *   dead node.
 * - **75 is still not free at the first workshop**, and that is intended rather than tolerated. A
 *   solo player usually has to take the biome-1 pocket alpha — which is where the guaranteed
 *   blueprint is anyway (`BLUEPRINT_DROP_RATE.alpha = 1.0`), and which pays 30–40 — or farm a wild
 *   or two and walk back in (ticket 07: *"markets and workshops can be revisited at the price of
 *   re-fighting the wilds on the way"*, and re-fighting pays). The first recruit is a small errand.
 *   Henry's amendment is what keeps the node worth standing in meanwhile: see
 *   `WORKSHOP_REMOVAL_PRICE`.
 *
 * ### What would move this number
 *
 * Only the income anchor. If Henry retunes `SCRAP_PER_ENEMY`, recompute 450 → new total, divide by
 * `MARKET_VISITS_PER_RUN`, divide by `RECRUITS_PER_RUN`. `workshop.test.ts` computes that chain
 * from these constants, so a retune fails the test rather than quietly falsifying this comment.
 */
export const WORKSHOP_ASSEMBLY_SCRAP = 75;

/**
 * **PROPOSAL — a mid-run reflash costs 40 scrap on top of its blueprint. THIS IS A READING OF THE
 * RULING, NOT A TRANSCRIPTION OF IT — flagged for Henry.**
 *
 * ### The reading
 *
 * Henry's 2026-08-21 ruling names **assembly**: "a blueprint at the ranch, a blueprint PLUS scrap at
 * a mid-run workshop". It says nothing about the reflash, which `vision.md` prices at one blueprint
 * and which `gameSlice.swapOS` charges exactly that for at the ranch.
 *
 * Two readings are available and this file takes the wider one:
 *
 * - **Narrow** (reflash is free of scrap): the ruling lists one transaction, so charge for one
 *   transaction. The consequence is that the workshop would hold the game's only mid-run upgrade
 *   with **no opportunity cost at all** — you would reflash whenever you held a spare blueprint,
 *   because declining costs you nothing. The node's two buttons would then disagree about what a
 *   workshop is.
 * - **Wide** (this file): the ruling's *mechanism* is that a mid-run transaction spends the run's
 *   currency **so that it competes with the marketplace**. That mechanism is about the place, not
 *   about assembly specifically, and a reflash mid-run is a genuine drafting move rather than a
 *   cosmetic one — `rewardCardPool` and `rollMarketStock` both read `activeOS`, so reflashing
 *   changes *every* card the rest of the run will offer you. Something that re-aims the shop should
 *   have to be paid for out of the shop's money.
 *
 * **If Henry reads it narrowly, set this to 0 and nothing else changes.** The price is a payload on
 * the dispatch, never a literal in the screen or the reducer, so this constant is the only edit.
 *
 * ### The number
 *
 * **Roughly half a recruit** (75 / 2 = 37.5, rounded to the 8-scrap grid the market's prices already
 * sit on — `ENERGY_PRICE_STEP` — giving 40). A reflash gains no body and no cards, so it must cost
 * clearly less than the thing that gains both; half is the plainest reading of "clearly less" that
 * is not a token.
 *
 * Its two neighbours pin it from either side, and both relations are asserted in the test rather
 * than left to this comment:
 *
 * - **Above `WORKSHOP_REMOVAL_PRICE` (30)**, so the cheapest button in the workshop stays the sink.
 *   A power-up priced under a deletion would make the sink the *expensive* option, which is the
 *   opposite of what `economy-session.md` built it for.
 * - **Below the median card (48)**, so a reflash never costs more than the card you gave up to buy
 *   it. It happens to land exactly on `CARD_PRICE_BY_RARITY.Uncommon` — a legible way to read it
 *   ("one mid-shelf card, not bought"), and a coincidence rather than a definition: retuning the
 *   market's Uncommon base must not silently move the workshop.
 */
export const WORKSHOP_REFLASH_SCRAP = 40;

/**
 * **Removal costs the same here as at a marketplace — ticket 13's `REMOVAL_PRICE`, re-exported and
 * NOT re-declared.** Henry's ticket-14 amendment leans toward offering removal at workshops too and
 * asks for a price; this is the answer, and the answer is "there is only one".
 *
 * ### Why the same and not blueprint-cheap
 *
 * - **Ticket 13 derived 30 against a stated target** — *"stripping all generics over a run costs
 *   roughly one market visit's scrap"*, i.e. 150 / 5 generics. A cheaper workshop removal would
 *   falsify that derivation without retuning it: the player would simply do all five removals at
 *   the workshop, and the sink's real cost would be whatever the cheaper number was, while ticket
 *   13's comment and test went on describing 30.
 * - **It would also make the market's removal button dead.** Two counters selling the same service
 *   at two prices is not a choice, it is a dominant strategy plus a decoy.
 * - **Charging *more* here is the same mistake mirrored** — a convenience tax on the node that
 *   needs a reason to exist.
 *
 * So: one sink, one price, two counters. What changes is only *where* it is available, and that is
 * the point of the amendment rather than a side effect of it.
 *
 * ### What it is for: the empty-handed workshop
 *
 * A blueprint drops from ~20% of defeated wilds, so **most workshops are entered with no blueprint
 * to spend**. Without removal, a workshop is then a node that says "nothing for you" — which is
 * exactly the placeholder ticket 14 is here to delete. Removal gives the node a floor: there is
 * always something to do at a workshop, and it is always the thing the deck actually needs.
 *
 * The knock-on for ticket 13's sink is availability, not price: five removals now spread across six
 * nodes instead of three. The total cost of stripping the filler is untouched, which is the half of
 * that derivation that was load-bearing.
 */
export const WORKSHOP_REMOVAL_PRICE = REMOVAL_PRICE;

// =================================================================================================
// What the node serves
// =================================================================================================

/** Which node kinds this module serves. One per biome, by ticket 07. */
export function isWorkshopNode(kind: NodeKind): boolean {
    return kind === 'workshop';
}

/**
 * Why a species cannot be built here right now. `null` means it can.
 *
 * `PartyBlock`'s two reasons plus one of this node's own: the ranch may simply hold no blueprint of
 * the species. Widened rather than replaced, because a screen has to *say* the reason (ticket 20's
 * precedent — a silently inert button is indistinguishable from a bug) and the three refusals are
 * three different sentences.
 */
export type WorkshopBlock = PartyBlock | 'no-blueprint';

/** One row of the workshop's assembly list: a species, what the ranch holds, and what stops it. */
export interface IWorkshopSpecies {
    readonly speciesId: string;
    /** Blueprints of this species the ranch holds. Always ≥ 1 for a row that is listed at all. */
    readonly blueprints: number;
    /** `null` when the species can be assembled into the party right now. */
    readonly block: WorkshopBlock | null;
}

/**
 * The party as `engine/party.ts` wants to see it: roster members, in run order.
 *
 * **A dangling party id still counts toward the party size.** `reconcileLoadedState` discards a run
 * whose party names a missing member, so this cannot survive a load — but a torn state that reached
 * here would otherwise let the player field a fourth body, and the placeholder's `definitionId` is
 * built from the id (which is unique) precisely so it can never collide with a real species and
 * mask the duplicate clause.
 */
function partyMembersOf(ranch: IRanchState, run: IRunState): PartyMember[] {
    return run.partyIds.map((id) => ranch.roster.find((m) => m.id === id) ?? { id, definitionId: `unresolved:${id}` });
}

/**
 * Can this species be assembled into the party here?
 *
 * **The species clause is `partyBlockFor`, called and not copied.** That rule is a standing law (map
 * § Notes) and `engine/party.ts` exists because three hand-written copies of it is how it rots;
 * ticket 20's own note names this ticket as the caller it was kept alive for. The candidate is
 * synthesised with an id no roster can hold, so `partyBlockFor`'s "already in the party, this click
 * removes it" early return cannot fire and both clauses that matter are actually evaluated.
 */
export function workshopBlockFor(speciesId: string, ranch: IRanchState, run: IRunState): WorkshopBlock | null {
    if ((ranch.blueprints[speciesId] ?? 0) < 1) return 'no-blueprint';
    return partyBlockFor({ id: `workshop-candidate:${speciesId}`, definitionId: speciesId }, partyMembersOf(ranch, run));
}

/** Display name for a species, falling back to its id rather than throwing at a render. */
function speciesName(speciesId: string): string {
    return MingmingRegistry[speciesId]?.name ?? speciesId;
}

/**
 * Every species the ranch holds a blueprint for, each carrying the reason it cannot be built if
 * there is one. This is what the screen lists: a blueprint you are holding but cannot spend *here*
 * is news, so it is shown with its refusal rather than filtered out and left unexplained.
 *
 * Sorted by display name so the list does not reshuffle as counts change — the same reason
 * `RanchScreen`'s assembly bay sorts.
 */
export function workshopSpecies(ranch: IRanchState, run: IRunState): IWorkshopSpecies[] {
    return Object.entries(ranch.blueprints)
        .filter(([, count]) => count > 0)
        .map(([speciesId, blueprints]): IWorkshopSpecies => ({
            speciesId,
            blueprints,
            block: workshopBlockFor(speciesId, ranch, run),
        }))
        .sort((a, b) => (speciesName(a.speciesId) < speciesName(b.speciesId) ? -1 : 1));
}

/**
 * Which species the player can actually build here: a blueprint is held, the species is **not
 * already in the party** (the standing species clause), and the party is not full.
 *
 * Scrap is deliberately NOT a term in this function. Affordability is a property of the run's purse
 * at the moment of the click and it changes under the player's feet as they buy and sell; what this
 * answers is the stable question *"is this a legal recruit at all"*. The screen prices the row and
 * the reducer refuses the payment — see `runSlice.recruitIntoParty`.
 */
export function assemblableSpecies(ranch: IRanchState, run: IRunState): IWorkshopSpecies[] {
    return workshopSpecies(ranch, run).filter((entry) => entry.block === null);
}

// =================================================================================================
// The recruit
// =================================================================================================

/** Everything the two dispatches of a recruit need, decided in one pure place. */
export interface IRecruitPlan {
    /** The individual, stats already rolled. Goes to `ranch.roster` — it outlives the run. */
    readonly member: IRanchMember;
    /**
     * The 4 cards it brings, minted with `ownerId` set to the new member. Ticket 08's ruled recruit
     * kit: 3 `startKit` cards + 1 generic, from `recruitDeckFor` — this module does not re-derive
     * the 3+1.
     */
    readonly cards: ReadonlyArray<IRunCard>;
    /** `WORKSHOP_ASSEMBLY_SCRAP`, carried so nothing downstream re-derives a price it must check. */
    readonly scrap: number;
}

export interface RecruitPlanInput {
    readonly ranch: IRanchState;
    readonly run: IRunState;
    /** The workshop being stood in, **already visit-incremented** — see `nodeSeed`. */
    readonly node: IRegionNode;
    readonly speciesId: string;
    /** Firmware the player picked. Omitted resolves to the definition's first OS, as everywhere. */
    readonly osId?: string;
}

/**
 * A roster id nothing else is using.
 *
 * The id is a pure function of (run seed, node, visit, species) — which is what makes a double-click
 * mint the *same* member rather than two, since `runSlice.recruitIntoParty` refuses a party id it
 * already holds. But the **ranch outlives the run**, and two runs on the same seed are reachable
 * (the debug launcher hands one over, and ticket 23 resumes one), so the same recruit built twice
 * across two runs would otherwise put two roster members under one id. Suffixing keeps the function
 * pure — the roster is an input — while making that collision unrepresentable.
 */
function uniqueMemberId(id: string, ranch: IRanchState): string {
    if (!ranch.roster.some((m) => m.id === id)) return id;
    let n = 2;
    while (ranch.roster.some((m) => m.id === `${id}_${n}`)) n += 1;
    return `${id}_${n}`;
}

/**
 * Roll the individual this workshop would build, and the cards it would bring. Pure, and
 * deterministic in (`run.seed`, `node.id`, `node.visited`, species, roster).
 *
 * Returns `null` for anything `workshopBlockFor` refuses, so an illegal recruit produces **no plan
 * and therefore no dispatch at all** — the species clause is enforced before either slice is
 * touched, which is the only place it can be enforced, since no single reducer can see both the
 * roster's species and the run's party.
 *
 * **The stat roll comes from the node seed, not from a fresh `rollSeed()`** — unlike
 * `RanchScreen`'s assembly bay, which is allowed to be genuinely random because nothing there has to
 * survive a reload. Here the roll has to be the same after an app close, for the same reason a
 * market's stock does (ticket 07 / `nodeSeed`): the workshop is a node's contents, and a resumed run
 * must be standing in the same workshop it left. The consequence, which is ticket 07's rule working
 * rather than a leak: **walking away and back re-rolls the individual**, at the price of re-fighting
 * the wilds in between. That is the mid-run echo of `vision.md`'s "re-assembly is the re-roll", and
 * it costs a real detour rather than a button press because the roll is never previewed — the player
 * sees the stats after paying, exactly as at the ranch.
 *
 * The two forks are labelled apart for `rollMarketStock`'s reason: changing how a recruit's deck is
 * minted must not shift the IVs of an individual a resumed run has already been shown.
 */
export function planRecruit(input: RecruitPlanInput): IRecruitPlan | null {
    const { ranch, run, node, speciesId, osId } = input;
    if (workshopBlockFor(speciesId, ranch, run) !== null) return null;

    const seed = nodeSeed(run, node, 'workshop');
    const rollStream = new SeedStream(new SeedStream(seed).fork(`assembly:${speciesId}`));
    const deckStream = new SeedStream(new SeedStream(seed).fork(`recruit-deck:${speciesId}`));

    // `createRanchMember` resolves an omitted OS to the definition's first — deliberately the same
    // fallback `getDeckForOS`, `initializeBattleEntity` and `createRun`'s kit resolution use, so a
    // recruit runs the same firmware in every subsystem rather than a different one per caller.
    const rolled = createRanchMember(speciesId, osId, rollStream);
    const member: IRanchMember = { ...rolled, id: uniqueMemberId(rolled.id, ranch) };

    // Minted AFTER the id is settled: `ownerId` is the member's roster instance id, and a card
    // pointing at an id the roster does not hold would be exactly the bookkeeping `runTypes.ts`
    // keeps `ownerId` for, broken.
    const cards = recruitDeckFor(toMingmingState(member), deckStream);

    return { member, cards, scrap: WORKSHOP_ASSEMBLY_SCRAP };
}

/**
 * Which firmware images a party member can be reflashed to here: everything its species offers
 * except the one it is already running.
 *
 * Read from the registry rather than assumed to be `_v1`/`_v2` — ticket 15's fix, and the same one
 * `RanchScreen`'s OS picker carries. An unknown species yields nothing rather than throwing: a
 * roster member whose species has been renamed must not take the whole panel down with it.
 */
export function reflashOptionsFor(member: IRanchMember): string[] {
    return (MingmingRegistry[member.definitionId]?.availableOS ?? []).filter((os) => os !== member.activeOS);
}

/**
 * Can this member be reflashed here? `null` means yes.
 *
 * Only the blueprint is checked, for `assemblableSpecies`'s reason: scrap is the run's business and
 * is refused by the reducer that spends it. `'party-full'` is not reachable for a reflash — the
 * member is already in the party — so the block type is narrowed to the two answers that exist.
 */
export function reflashBlockFor(
    member: IRanchMember,
    ranch: IRanchState,
): 'no-blueprint' | 'no-other-firmware' | null {
    if ((ranch.blueprints[member.definitionId] ?? 0) < 1) return 'no-blueprint';
    if (reflashOptionsFor(member).length === 0) return 'no-other-firmware';
    return null;
}
