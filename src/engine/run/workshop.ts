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
 * deliberately left open; ticket 14 proposed it, **Henry ruled it in ticket 56 and ticket 57 applied
 * the ruling**, and the whole of THE WORKSHOP KNOB below is the arithmetic that now stands behind it.
 *
 * # THE DESIGN TARGET IS COMPETITION, NOT COST
 *
 * The ruling does not ask for the recruit to be expensive; it asks for it to be **a sacrifice of
 * cards**. A price the player never notices makes the workshop a free power-up and the "route
 * decision" imaginary; a price they cannot pay makes the node dead and freezes the party at one,
 * which then compounds — `scrapForWin` pays **10 plus 5 per enemy beyond the first**, and
 * `enemyPartySize` makes an ordinary wild symmetric with your team, so a party that has not grown
 * takes 10 a fight where a full one takes 20 and can afford to grow even later. Every bound below is
 * set against those two failures.
 *
 * That compounding is why ticket 56 cut this file's numbers **harder than the income was cut**. The
 * scale fell by about half (450–500 a run → ~210); the recruit fell by two thirds (75 → 25). Holding
 * the old ratio would have left a solo party needing eight won 1v1 wilds to afford the first
 * workshop it walks into, which is the dead node this section is written to prevent.
 *
 * # WHAT IS *NOT* PRICED HERE
 *
 * Removal is GONE from this screen (2026-08-26); the workshop edits the deck for free instead of
 * re-declared — see its own note. One sink, one price, whichever counter you buy it over.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, no `Math.random()`, no
 * `Date.now()`.
 */

import { SeedStream } from '../core/SeedStream';
import { MingmingRegistry } from '../data/mingmingRegistry';
import { createRanchMember } from '../gameTypes';
import { PARTY_SIZE, partyBlockFor, type PartyBlock, type PartyMember } from '../party';
import { recruitDeckFor } from './createRun';
import { toMingmingState } from './battleSetup';
import { nodeSeed } from './nodeSeed';
import type { IRanchMember, IRanchState, IRegionNode, IRunCard, IRunState, NodeKind } from '../runTypes';

// =================================================================================================
// THE WORKSHOP KNOB — RULED by Henry in ticket 56, applied by ticket 57
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
 * **RULED — a mid-run recruit costs 25 scrap on top of its blueprint** (Henry, ticket 56; applied by
 * ticket 57). Ticket 14 proposed 75 against an income scale that no longer exists, so the derivation
 * below is rebuilt from the table that replaced it rather than left standing as arithmetic that does
 * not compute.
 *
 * ### The derivation
 *
 * 1. **A run's income** is now `scrapForWin`, flat and per fight: **10 + 5 per enemy beyond the
 *    first** (1v1 10, 2v2 15, 3v3 20), **elite 30**. A full three-biome run adds up to roughly:
 *
 *    | source | count | pays | total |
 *    |---|---|---|---|
 *    | biome exits that are elites | 2 | 30 | 60 |
 *    | the gym (three fights of three) | 1 | 3 × 20 | 60 |
 *    | wilds, symmetric with a party that is growing | ~6 | 10 / 15 / 20 | 90 |
 *
 *    — **about 210 scrap a run**, against ticket 12's dead 450–500. The wild row is the honest half
 *    of the estimate and it is deliberately taken at the *low* end of ticket 12's 8–10 fight shape,
 *    for ticket 13's reason: pricing to the optimistic end of a band is how a node ends up
 *    unaffordable for everyone who is not already winning.
 * 2. **A market visit's scrap** = 210 / `MARKET_VISITS_PER_RUN` = **70**. Ticket 07 guarantees one
 *    marketplace *and* one workshop per biome, and a run is three biomes, so the two node kinds see
 *    the player exactly as often as each other. That symmetry is why the marketplace's own divisor
 *    is the right one to quote a workshop against: three visits each, one shared purse.
 * 3. **Two recruits per run** (`RECRUITS_PER_RUN`).
 * 4. **The price**: 25 × 2 = **50 scrap to grow the party 1 → 2 → 3** — about **five sevenths of one
 *    market visit** (50 of 70), and **two median cards** (2 × 25; see the trade below).
 *
 * ### What changed in the *shape*, not just the digits
 *
 * Ticket 14 could say "growing the team costs exactly one market visit's scrap", which made the
 * run's three sinks quotable as thirds of the same purse. The ruled number gives up that tidiness on
 * purpose: at 50 out of ~210 the team is **a quarter of the run** where it used to be a third. The
 * sentence that replaces it is the one the new scale actually supports — **growing the team costs
 * one card off the shelf per recruit, and it is the only sink in the game that is also gated by a
 * blueprint.**
 *
 * ### The trade, stated
 *
 * The median rewardable card in the registry prices at **25** (`cardPrice` over the offerable
 * registry; the band is ticket 56's four rungs, 15/25/35/45), because that ticket replaced the
 * rarity base plus energy step with `CARD_PRICE_BY_ENERGY` and most printed cards sit on the
 * 1-energy rung. So **one recruit is exactly one median card, and the pair is two median cards you
 * did not buy** — out of the eight a 210-scrap run could otherwise afford (210 / 25 ≈ 8).
 *
 * That equality is worth naming as the thing the ruling actually produced: ticket 14's 75 was "about
 * one and a half cards" against a card table that no longer exists, and the ruled 25 lands on the
 * median rung exactly. It is a coincidence of two rulings rather than a derivation — nothing keeps
 * them equal if either moves — so `workshop.test.ts` asserts it as a bound with room either side
 * (at least one card, under two) rather than as a law.
 *
 * That is a smaller bite than ticket 14 priced, and it is the right one now. The run's purse fills
 * at about half the old rate overall — but the cut is not spread evenly, and where it bites is
 * exactly where this node is first met: ticket 12's bands paid **per body**, so a 3v3 that used to
 * pay ~33 now pays 20, while a *solo* wild has barely moved (~11 → 10). A player at the biome-1
 * workshop is therefore earning what they always did, out of a run that is worth half as much — so
 * the fee that competes with the shop has to be sized against the solo rate, not against the total.
 *
 * ### Why not higher, why not lower
 *
 * - **Not a rounding error.** 25 is more than the cheapest card on the shelf
 *   (`CARD_PRICE_BY_ENERGY[0]` at 15) and more than one removal once ticket 57's marketplace half
 *   let declining a recruit buy a removal instead; free editing has replaced that trade.
 * - **Not ≥ 70 (a whole market visit each).** Two recruits would then eat 140 of 210 and the
 *   marketplace becomes a window display — the same failure ticket 14 named, at the new scale.
 * - **Payable at the first workshop, which is where the old number broke.** The biome-1 workshop is
 *   reached by a *solo* party, and a solo party's wilds field one body and pay **10** flat. 25 is
 *   therefore **three won fights**; the 75 this replaces would have been **eight**, and a node that
 *   costs eight fights on first sight is a node the player walks past. The guaranteed blueprint is
 *   at the biome-1 pocket alpha (`BLUEPRINT_DROP_RATE.alpha = 1.0`), which is a single body and so
 *   pays 10 as well — so the alpha plus two wilds buys both halves of the price. Re-entry pays full
 *   rewards (ticket 07: *"markets and workshops can be revisited at the price of re-fighting the
 *   wilds on the way"*), so that errand is always available.
 * - **Still not free at the first workshop**, which is intended rather than tolerated. Henry's
 *   ticket-14 amendment is what keeps the node worth standing in meanwhile: see
 *   a paid removal, when this screen still sold one.
 *
 * ### What would move this number
 *
 * Only Henry. This is no longer a proposal derived from the income — it is a ruling the income is
 * checked *against*. If `BASE_WIN_SCRAP` / `SCRAP_PER_EXTRA_ENEMY` / `ELITE_WIN_SCRAP` are retuned,
 * the thing to recompute is the run total above and the bounds in this section; `workshop.test.ts`
 * asserts those bounds from the income constants themselves, so a retune that breaks them fails the
 * test rather than quietly falsifying this comment.
 */
export const WORKSHOP_ASSEMBLY_SCRAP = 25;

/**
 * **RULED — a mid-run reflash costs 15 scrap on top of its blueprint** (Henry, ticket 56; applied by
 * ticket 57). Ticket 14 read the reflash into the ruling and proposed 40; ticket 56 settles both
 * halves — the reflash **is** charged, and this is what it costs.
 *
 * ### The reading that turned out to be right
 *
 * Henry's 2026-08-21 ruling named **assembly** only: "a blueprint at the ranch, a blueprint PLUS
 * scrap at a mid-run workshop". Ticket 14 took the wide reading — that the ruling's *mechanism* is
 * "a mid-run transaction spends the run's currency so that it competes with the marketplace", and
 * that the mechanism is about the place rather than about assembly specifically. A reflash mid-run
 * is a genuine drafting move: `rewardCardPool` and `rollMarketStock` both read `activeOS`, so
 * reflashing changes *every* card the rest of the run will offer you, and something that re-aims the
 * shop should be paid for out of the shop's money. Ticket 56 ratifies that reading by pricing it,
 * so the "if Henry reads it narrowly, set this to 0" escape hatch is closed and gone.
 *
 * ### The number
 *
 * **Three fifths of a recruit** (15 of 25). A reflash gains no body and no cards, so it must cost
 * clearly less than the thing that gains both; ticket 14 proposed half and Henry landed slightly
 * above half, which keeps it from reading as a token at a scale where a won 1v1 wild pays 10.
 *
 * Both numbers sit on a **5-scrap grid**, which is the grid the *income* is built on
 * (`BASE_WIN_SCRAP` 10, `SCRAP_PER_EXTRA_ENEMY` 5, `ELITE_WIN_SCRAP` 30) rather than the 8-scrap
 * energy step ticket 13 priced cards on and ticket 14 rounded its proposed 40 onto — a grid ticket
 * 56 deleted along with the rarity base it was added to; the shelf now moves in 10s. The income's
 * grid is the right one for a workshop either way: every
 * price here is now a whole or half number of won fights — a reflash is **one and a half wilds**, a
 * recruit is **two and a half** — where a market price is a number of cards.
 *
 * ### THE RULING INVERTS TICKET 14'S ORDERING, AND THAT IS COHERENT
 *
 * Ticket 14 held the reflash **above** removal, so that "the cheapest button in the workshop stays
 * the sink". At 15 against a removal that ticket 57 lands at 20, the order is now **reflash <
 * removal < recruit** and that law is dead. It is worth saying why losing it is fine rather than
 * quietly dropping the sentence:
 *
 * - **The old law compared the two prices in the wrong currency.** A removal costs scrap and nothing
 *   else. A reflash costs scrap **plus a blueprint**, and blueprints drop from ~20% of defeated
 *   wilds — so in the resource that is actually scarce at a workshop, the reflash is still the
 *   dearer transaction by a wide margin. Ranking them by their scrap tags alone was the mistake.
 * - **The worry the law existed to prevent does not follow.** "A power-up priced under a deletion
 *   makes the sink the expensive option" assumes the two compete for the same click. They do not:
 *   removal is the thing you do at a workshop **when you are holding no blueprint** (see
 *   a paid removal, when one existed), which is most visits.
 *
 * What does still hold, and is still asserted in the test:
 *
 * - **Below the recruit**, because it gains strictly less.
 * - **Below the median card (25)**, so a reflash never costs more than the card you gave up to buy
 *   it. The margin is **three fifths of a card** — 15 against 25 — which is real clearance where
 *   ticket 14's 40 against a 48 median was a hair, but nothing like the factor of three that looking
 *   at the income cut alone would suggest: ticket 56 cut the *card table* too, so the shelf came
 *   down to meet this price rather than staying overhead. The exact coincidence with the old
 *   Uncommon base at 40 that ticket 14 noted went with the rarity table itself, which is no loss: it
 *   was explicitly a coincidence rather than a definition.
 */
export const WORKSHOP_REFLASH_SCRAP = 15;

/*
 * `WORKSHOP_REMOVAL_PRICE` is deleted (Henry, 2026-08-26). It re-exported ticket 13's
 * `REMOVAL_PRICE` so one sink had one price at two counters; there is no paid removal at either
 * counter now. A workshop edits the deck for free — it is one of the four edit surfaces — and the
 * card you will never play is sold at a marketplace. See `marketplace.SELL_PRICE_BY_ENERGY`.
 */

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
 * at the moment of the click and it changes under the player's feet as they buy and remove; what this
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
