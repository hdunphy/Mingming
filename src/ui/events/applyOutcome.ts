/**
 * TICKET 168a — turn an event outcome into dispatches: one small function per outcome type.
 *
 * The event data says WHAT happens; this says how, using the reducers that already exist. Every
 * row adds its own outcome types here.
 *
 * # ORDER
 *
 * `applyChoice` dispatches a choice's outcomes FIRST and `resolveEvent` LAST, so a crash between
 * the two leaves the event unresolved rather than paid and lost — the codebase's "generous state"
 * rule. And nothing is dispatched until the player has made every pick the choice needs, so a
 * price is never paid for a pick that was not made.
 */

import type { UnknownAction } from '@reduxjs/toolkit';

import { SeedStream } from '../../engine/core/SeedStream';
import { nodeSeed } from '../../engine/run/nodeSeed';
import { JUNK_CARD_ID } from '../../engine/run/junk';
import { resolveGambles } from '../../engine/run/events/eventGamble';
import { choiceGrants, choiceScrapCost } from '../../engine/run/events/eventSchema';
import type { EventChoice, EventDefinition, EventOutcome } from '../../engine/run/events/eventSchema';
import { planRecruit } from '../../engine/run/workshop';
import { introRules } from '../../engine/run/intro/introRules';
import type { IRanchState, IRegionNode, IRunCard, IRunState } from '../../engine/runTypes';
import { addBlueprint, assembleMingming } from '../store/gameSlice';
import {
    addRunCards, addRunCollection, addRunScrap, addTempDriver, buyMarketCard, recordBankedBlueprint, recordCardOffer,
    recruitIntoParty, resolveEvent, revealCurrentBiome, spendRunScrap, startEventFight, takeRewardMacro,
} from '../store/runSlice';
import {
    applyDuplicate, applyGiveCards, applyTradeUp, applyTransform,
} from './applyCards';
import { applyDriverPick, applyGiveBlueprint, applyPatch, applyReflash } from './applyGrants';
import {
    isBlueprintPick, isCardPick, isDriverPick, isGivePick, isMacroPick, isPatchPick, isRecruitPick, isReflashPick,
} from './outcomePicks';
import type {
    BlueprintPickResult, CardPickResult, DriverPickResult, GiveCardsResult, MacroPickResult, OutcomePick,
    PatchPickResult, RecruitPickResult, ReflashPickResult,
} from './outcomePicks';

export type {
    BlueprintPickResult, CardPickResult, DriverPickResult, GiveCardsResult, MacroPickResult, OutcomePick,
    PatchPickResult, RecruitPickResult, ReflashPickResult,
};

/** Anything with `dispatch`, so a test can hand in a bare store. */
export type OutcomeDispatch = (action: UnknownAction) => unknown;

export interface OutcomeContext {
    readonly run: IRunState;
    readonly node: IRegionNode;
    /** The whole ranch, for the outcomes that write to it (a recruit). Absent for the ones that do not. */
    readonly ranch?: IRanchState;
    /** Reads the ranch roster AFTER a dispatch, so a recruit can check the ranch half took. */
    readonly rosterHas?: (memberId: string) => boolean;
}

const INTERACTIVE: ReadonlySet<EventOutcome['type']> = new Set([
    'CARD_PICK', 'BLUEPRINT_PICK', 'MACRO_PICK', 'RECRUIT',
    'GIVE_CARD', 'GIVE_BLUEPRINT', 'TRADE_UP', 'DUPLICATE', 'TRANSFORM', 'DRIVER_PICK', 'PATCH', 'REFLASH',
]);

/** Outcomes that take something from the player. They are applied AFTER every gain in their choice. */
const COSTS: ReadonlySet<EventOutcome['type']> = new Set(['GIVE_CARD', 'GIVE_BLUEPRINT']);

/** Outcomes whose own action carries the choice's scrap price, so the price and the item move together. */
const CARRIES_PRICE: ReadonlySet<EventOutcome['type']> = new Set(['CARD_PICK', 'DUPLICATE', 'PATCH']);

/** Outcomes that need the player to pick something before anything is dispatched. */
export function isInteractiveOutcome(outcome: EventOutcome): boolean {
    return INTERACTIVE.has(outcome.type);
}

/** `SCRAP`: a gain adds; a price spends (and the reducer never lets it go below 0). */
function applyScrap(dispatch: OutcomeDispatch, amount: number): void {
    if (amount >= 0) dispatch(addRunScrap(amount));
    else dispatch(spendRunScrap(-amount));
}

/** `TEMP_DRIVER` (168b): a Driver for the next fight only. */
function applyTempDriver(dispatch: OutcomeDispatch, driverId: string, fights: number): void {
    dispatch(addTempDriver({ driverId, fights }));
}

/** `MAP_REVEAL`: survey the biome the run stands in. */
function applyMapReveal(dispatch: OutcomeDispatch): void {
    dispatch(revealCurrentBiome());
}

/** A run-card instance id derived from the node's seed, so the same event on the same node mints the same id. */
function mintInstanceId(ctx: OutcomeContext, purpose: string, prefix: string): string {
    return new SeedStream(nodeSeed(ctx.run, ctx.node, purpose)).nextId(prefix);
}

/** `JUNK` (168c): one Forge Slag, into the deck. `index` keeps two junk cards in one choice apart. */
function applyJunk(dispatch: OutcomeDispatch, ctx: OutcomeContext, index: number): void {
    const instanceId = new SeedStream(new SeedStream(nodeSeed(ctx.run, ctx.node, 'event-junk')).fork(String(index))).nextId('junk');
    dispatch(addRunCards([{ instanceId, dataId: JUNK_CARD_ID, ownerId: null }]));
}

/**
 * `CARD_PICK`: the picked card goes to the deck, or to the run collection when the player stored it
 * (the same deck/store choice the reward screen has). The instance id is derived from the node's
 * seed, so the same pick on the same node mints the same card.
 */
function applyCardPick(dispatch: OutcomeDispatch, ctx: OutcomeContext, pick: CardPickResult, price: number): void {
    const instanceId = mintInstanceId(ctx, 'event-card', 'evt');
    const card: IRunCard = { instanceId, dataId: pick.cardId, ownerId: null };
    // Ticket 185e: the shown cards are remembered whichever one was taken. Recorded first, so a
    // crash after it can only mean the offer is left out of the next one, never a card taken twice.
    if (pick.offered) dispatch(recordCardOffer(pick.offered));
    // A priced pick (The Skald's Price) rides ONE action into the deck — the card and the scrap together,
    // as a stall purchase does. A card sent to the collection has no such action, so it is added
    // first and the price taken after: a crash between leaves the player with a free card, not robbed.
    if (price > 0 && !pick.toCollection) { dispatch(buyMarketCard({ card, price })); return; }
    dispatch(pick.toCollection ? addRunCollection([card]) : addRunCards([card]));
    if (price > 0) dispatch(spendRunScrap(price));
}

/** `BLUEPRINT_PICK` (Wild Tracks): banked to the ranch and noted on the run, as a gym-clear blueprint is. */
function applyBlueprintPick(dispatch: OutcomeDispatch, pick: BlueprintPickResult): void {
    dispatch(addBlueprint(pick.speciesId));
    dispatch(recordBankedBlueprint(pick.speciesId));
}

/** `MACRO_PICK` (Brewer's Cask): the reward screen's own action, first free slot or the slot replaced. */
function applyMacroPick(dispatch: OutcomeDispatch, pick: MacroPickResult): void {
    dispatch(takeRewardMacro({ macroId: pick.macroId, replaceSlot: pick.replaceSlot }));
}

/**
 * `RECRUIT` (Stray Mingming): the workshop's flow at price 0 — ranch first (it spends the
 * blueprint), then the run, and the run half only if the ranch half took.
 */
function applyRecruit(dispatch: OutcomeDispatch, ctx: OutcomeContext, pick: RecruitPickResult): void {
    if (!ctx.ranch || !ctx.rosterHas) return;
    /*
     * TICKET 182c: the intro's recruit grants the chosen species' blueprint at the moment it is
     * built, so the vault ends where it started (assembling spends the blueprint straight away).
     * The plan is checked against a ranch that already holds it, because the workshop's own legality
     * check wants one.
     */
    const grants = introRules(ctx.run).grantsRecruitBlueprint;
    const ranch = grants
        ? { ...ctx.ranch, blueprints: { ...ctx.ranch.blueprints, [pick.speciesId]: (ctx.ranch.blueprints[pick.speciesId] ?? 0) + 1 } }
        : ctx.ranch;
    const plan = planRecruit({ ranch, run: ctx.run, node: ctx.node, speciesId: pick.speciesId, osId: pick.osId });
    if (!plan) return;
    if (grants) dispatch(addBlueprint(pick.speciesId));
    dispatch(assembleMingming(plan.member));
    if (!ctx.rosterHas(plan.member.id)) return;
    dispatch(recruitIntoParty({ memberId: plan.member.id, cards: plan.cards, price: 0 }));
}

/**
 * Apply every outcome of one choice, then record the resolution. `picks` holds the player's answer
 * for each interactive outcome, keyed by the outcome's index in the choice.
 */
export function applyChoice(
    dispatch: OutcomeDispatch,
    ctx: OutcomeContext,
    event: Pick<EventDefinition, 'id'>,
    choice: EventChoice,
    picks: Readonly<Record<number, OutcomePick>> = {},
): void {
    // A gamble lands on one branch first (seeded, so the same node always lands on the same one),
    // and only then are its outcomes applied like any other.
    const played = resolveGambles(ctx, choice);
    // A choice that pays for a card, a copy or a patch hands its whole price to that outcome's own
    // action, so a pick the player did not make is never paid for.
    const pickPays = played.outcomes.some((outcome) => CARRIES_PRICE.has(outcome.type));
    const price = choiceScrapCost(played);
    // Gains first, then what is taken: a crash in the middle leaves the player paid, not robbed
    // (the Driver Shrine grants its Driver BEFORE it takes the two cards or the blueprint).
    const order = played.outcomes.map((outcome, index) => ({ outcome, index }));
    const inOrder = [...order.filter(({ outcome }) => !COSTS.has(outcome.type)), ...order.filter(({ outcome }) => COSTS.has(outcome.type))];
    inOrder.forEach(({ outcome, index }) => {
        switch (outcome.type) {
            case 'SCRAP':
                if (!(pickPays && outcome.amount < 0)) applyScrap(dispatch, outcome.amount);
                break;
            case 'MAP_REVEAL': applyMapReveal(dispatch); break;
            case 'JUNK': applyJunk(dispatch, ctx, index); break;
            // The bench dispatches each upgrade itself as the player makes it; nothing to do here.
            case 'UPGRADE': break;
            case 'TEMP_DRIVER': applyTempDriver(dispatch, outcome.driverId, outcome.fights); break;
            case 'CARD_PICK': {
                const pick = picks[index];
                if (pick && isCardPick(pick)) applyCardPick(dispatch, ctx, pick, price);
                break;
            }
            case 'BLUEPRINT_PICK': {
                const pick = picks[index];
                if (pick && isBlueprintPick(pick)) applyBlueprintPick(dispatch, pick);
                break;
            }
            case 'MACRO_PICK': {
                const pick = picks[index];
                if (pick && isMacroPick(pick)) applyMacroPick(dispatch, pick);
                break;
            }
            case 'RECRUIT': {
                const pick = picks[index];
                if (pick && isRecruitPick(pick)) applyRecruit(dispatch, ctx, pick);
                break;
            }
            case 'GIVE_CARD': {
                const pick = picks[index];
                if (pick && isGivePick(pick)) applyGiveCards(dispatch, pick.instanceIds);
                break;
            }
            case 'GIVE_BLUEPRINT': {
                const pick = picks[index];
                if (pick && isBlueprintPick(pick)) applyGiveBlueprint(dispatch, pick.speciesId);
                break;
            }
            case 'TRADE_UP': {
                const pick = picks[index];
                if (pick && isGivePick(pick) && pick.instanceIds[0]) applyTradeUp(dispatch, ctx, pick.instanceIds[0]);
                break;
            }
            case 'TRANSFORM': {
                const pick = picks[index];
                if (pick && isGivePick(pick) && pick.instanceIds[0]) applyTransform(dispatch, ctx, pick.instanceIds[0]);
                break;
            }
            case 'DUPLICATE': {
                const pick = picks[index];
                if (pick && isGivePick(pick) && pick.instanceIds[0]) applyDuplicate(dispatch, ctx, pick.instanceIds[0], price);
                break;
            }
            case 'DRIVER_PICK': {
                const pick = picks[index];
                if (pick && isDriverPick(pick)) applyDriverPick(dispatch, pick.driverId);
                break;
            }
            case 'PATCH': {
                const pick = picks[index];
                if (pick && isPatchPick(pick)) applyPatch(dispatch, ctx, pick.memberId, price);
                break;
            }
            case 'REFLASH': {
                const pick = picks[index];
                if (pick && isReflashPick(pick)) applyReflash(dispatch, ctx, pick.reflashMemberId);
                break;
            }
            case 'FIGHT':
                // Started AFTER the event is recorded as resolved, below: a loss or a crash cannot offer it again.
                break;
            default:
                // An outcome no row has built yet. Its event is not in `BUILT_EVENTS`, so a player
                // cannot reach this; a test that does is told which type it was.
                throw new Error(`event outcome "${outcome.type}" is not built yet`);
        }
    });
    dispatch(resolveEvent({
        nodeId: ctx.node.id, eventId: event.id, choiceId: choice.id, grants: choiceGrants(played),
    }));
    // TICKET 168g: the fight starts once the choice is on the record.
    if (played.outcomes.some((outcome) => outcome.type === 'FIGHT')) dispatch(startEventFight());
}

/** The Empty Relay: +15 scrap, then the resolution row. */
export function applyEmptyRelay(dispatch: OutcomeDispatch, ctx: OutcomeContext, eventId: string, scrap: number): void {
    dispatch(addRunScrap(scrap));
    dispatch(resolveEvent({ nodeId: ctx.node.id, eventId, choiceId: 'salvage', grants: [] }));
}
