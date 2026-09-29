/**
 * TICKET 168a — turn an event outcome into dispatches: one small function per outcome type.
 *
 * The event data says WHAT happens; this says how, using the reducers that already exist. Built so
 * far: `SCRAP`, `CARD_PICK` and `MAP_REVEAL`. Every later row adds its own outcome types here.
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
import { choiceGrants } from '../../engine/run/events/eventSchema';
import type { EventChoice, EventDefinition, EventOutcome } from '../../engine/run/events/eventSchema';
import type { IRegionNode, IRunCard, IRunState } from '../../engine/runTypes';
import {
    addRunCards, addRunCollection, addRunScrap, resolveEvent, revealCurrentBiome, spendRunScrap,
} from '../store/runSlice';

/** Anything with `dispatch`, so a test can hand in a bare store. */
export type OutcomeDispatch = (action: UnknownAction) => unknown;

export interface OutcomeContext {
    readonly run: IRunState;
    readonly node: IRegionNode;
}

/** What the player chose for an outcome that needs a choice (a card pick). */
export interface CardPickResult { readonly cardId: string; readonly toCollection: boolean }

/** Outcomes that need the player to pick something before anything is dispatched. */
export function isInteractiveOutcome(outcome: EventOutcome): boolean {
    return outcome.type === 'CARD_PICK';
}

/** `SCRAP`: a gain adds; a price spends (and the reducer never lets it go below 0). */
function applyScrap(dispatch: OutcomeDispatch, amount: number): void {
    if (amount >= 0) dispatch(addRunScrap(amount));
    else dispatch(spendRunScrap(-amount));
}

/** `MAP_REVEAL`: survey the biome the run stands in. */
function applyMapReveal(dispatch: OutcomeDispatch): void {
    dispatch(revealCurrentBiome());
}

/**
 * `CARD_PICK`: the picked card goes to the deck, or to the run collection when the player stored it
 * (the same deck/store choice the reward screen has). The instance id is derived from the node's
 * seed, so the same pick on the same node mints the same card.
 */
function applyCardPick(dispatch: OutcomeDispatch, ctx: OutcomeContext, pick: CardPickResult): void {
    const instanceId = new SeedStream(nodeSeed(ctx.run, ctx.node, 'event-card')).nextId('evt');
    const card: IRunCard = { instanceId, dataId: pick.cardId, ownerId: null };
    dispatch(pick.toCollection ? addRunCollection([card]) : addRunCards([card]));
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
    picks: Readonly<Record<number, CardPickResult>> = {},
): void {
    choice.outcomes.forEach((outcome, index) => {
        switch (outcome.type) {
            case 'SCRAP': applyScrap(dispatch, outcome.amount); break;
            case 'MAP_REVEAL': applyMapReveal(dispatch); break;
            case 'CARD_PICK': {
                const pick = picks[index];
                if (pick) applyCardPick(dispatch, ctx, pick);
                break;
            }
            default:
                // An outcome no row has built yet. Its event is not in `BUILT_EVENTS`, so a player
                // cannot reach this; a test that does is told which type it was.
                throw new Error(`event outcome "${outcome.type}" is not built yet`);
        }
    });
    dispatch(resolveEvent({
        nodeId: ctx.node.id, eventId: event.id, choiceId: choice.id, grants: choiceGrants(choice),
    }));
}

/** The Empty Relay: +15 scrap, then the resolution row. */
export function applyEmptyRelay(dispatch: OutcomeDispatch, ctx: OutcomeContext, eventId: string, scrap: number): void {
    dispatch(addRunScrap(scrap));
    dispatch(resolveEvent({ nodeId: ctx.node.id, eventId, choiceId: 'salvage', grants: [] }));
}
