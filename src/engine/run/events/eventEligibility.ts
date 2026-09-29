/**
 * TICKET 168a — when each event is allowed to be drawn: one small function per event id, each
 * returning a boolean (the "Eligible when" column of the ticket's table).
 *
 * The rows that BUILD an event own its check being right; until an event is in `BUILT_EVENTS`
 * (`eventDraw.ts`) its check is never asked. They are written now, as the table states them, so
 * the shape is settled and a later row only has to correct one, not invent one.
 *
 * Nothing here is random and nothing here reads the seed: eligibility is a fact about the run.
 */

import { ProgramRegistry } from '../../data/programRegistry';
import { PLAYER_DRIVER_IDS } from '../../data/driverRegistry';
import { hasUpgrade } from '../../data/plusRegistry';
import { rewardCardPool } from '../../RewardSystem';
import { PARTY_SIZE } from '../../party';
import { minimumActiveDeck } from '../createRun';
import { partyMembersOf } from './eventContext';
import type { EventContext } from './eventContext';

/** Cards from the party's reward pool of one rarity. */
function poolOf(ctx: EventContext, rarity: string): string[] {
    return rewardCardPool(partyMembersOf(ctx)).filter((id) => ProgramRegistry[id]?.rarity === rarity);
}

/** Rule 7: a deck card cannot be given up below the floor; a collection card always can. */
function canGiveUpCards(ctx: EventContext, count = 1): boolean {
    const { deck, collection = [], partyIds } = ctx.run;
    const spareInDeck = Math.max(0, deck.length - minimumActiveDeck(partyIds.length));
    return spareInDeck + collection.length >= count;
}

const upgradableCards = (ctx: EventContext): number => ctx.run.deck.filter((card) => hasUpgrade(card.dataId)).length;
const hasUnpatchedBody = (ctx: EventContext): boolean =>
    ctx.run.partyIds.some((id) => (ctx.run.patches?.[id] ?? []).length === 0);
const heldBlueprints = (ctx: EventContext): number =>
    Object.values(ctx.ranch.blueprints).reduce((sum, count) => sum + count, 0);
const always = (): boolean => true;

const CHECKS: Readonly<Record<string, (ctx: EventContext) => boolean>> = {
    // Common
    scrap_cache: always,
    abandoned_terminal: (ctx) => upgradableCards(ctx) >= 1,
    data_fragments: always,
    wild_tracks: always,
    // Survey is greyed on the screen when the biome is already revealed; Strip and Leave still work.
    relay_tower: always,
    corrupted_stream: always,
    // Uncommon
    rare_vault: (ctx) => poolOf(ctx, 'Rare').length >= 1,
    macro_crate: always,
    trader: (ctx) => canGiveUpCards(ctx),
    overclock_rig: (ctx) => upgradableCards(ctx) >= 2,
    data_broker: (ctx) => poolOf(ctx, 'Rare').length >= 1,
    stray_mingming: (ctx) => ctx.run.partyIds.length < PARTY_SIZE && heldBlueprints(ctx) >= 1,
    ambush_bait: always,
    mirror_protocol: (ctx) => ctx.run.deck.length + (ctx.run.collection ?? []).length >= 1,
    // Rare
    driver_shrine: (ctx) => ctx.run.drivers.filter((id) => PLAYER_DRIVER_IDS.includes(id)).length < PLAYER_DRIVER_IDS.length
        && (canGiveUpCards(ctx, 2) || heldBlueprints(ctx) >= 1),
    black_market_patch: hasUnpatchedBody,
    corrupted_cache: (ctx) => poolOf(ctx, 'Rare').length >= 1,
    // Ineligible when the player can do neither of its two choices.
    the_toll: (ctx) => ctx.run.scrap >= 30 || canGiveUpCards(ctx),
    firmware_reflash: hasUnpatchedBody,
    recompiler: (ctx) => canGiveUpCards(ctx),
};

/** Whether an event may be drawn right now. An id with no check is never eligible. */
export function isEventEligible(eventId: string, ctx: EventContext): boolean {
    return CHECKS[eventId]?.(ctx) ?? false;
}

/** The ids that have a check — a test pins this against the catalogue, so a new event cannot skip it. */
export const ELIGIBILITY_IDS: ReadonlyArray<string> = Object.keys(CHECKS);
