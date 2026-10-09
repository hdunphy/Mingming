/**
 * TICKET 168c — what an event just did, in one line, so the player is told.
 *
 * A gamble that lands on its losing branch, or a choice that mixes a gain with a penalty, would
 * otherwise go straight to "The relay is dark" with nothing said about what happened. This reads
 * the outcomes that were applied (a gamble already resolved to its branch) and lists them.
 */

import { ProgramRegistry } from '../../engine/data/programRegistry';
import type { EventChoice, EventOutcome } from '../../engine/run/events/eventSchema';
import { getMacro } from '../../engine/data/macroRegistry';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { getPatch } from '../../engine/data/patchRegistry';
import type { EventContext } from '../../engine/run/events/eventContext';
import { patchOffers } from '../../engine/run/events/eventPatch';
import { reflashTargetFor } from '../../engine/run/events/eventReflash';
import { recompileTarget, tradeUpTarget } from '../../engine/run/events/eventTrade';
import type { IRunCard } from '../../engine/runTypes';
import {
    isBlueprintPick, isCardPick, isDriverPick, isGivePick, isMacroPick, isPatchPick, isRecruitPick, isReflashPick,
} from './outcomePicks';
import type { OutcomePick } from './outcomePicks';
import { driverText } from '../labels/driverText';
import { instinctName, plain } from '../labels/labels';

const speciesName = (speciesId: string): string => MingmingRegistry[speciesId]?.name ?? speciesId;
const cardName = (dataId: string): string => ProgramRegistry[dataId]?.name ?? dataId;

/** The held card with this id, read off the run as it stands BEFORE the choice is applied. */
function heldCard(ctx: EventContext | undefined, instanceId: string | undefined): IRunCard | undefined {
    if (!ctx || !instanceId) return undefined;
    return [...ctx.run.deck, ...(ctx.run.collection ?? [])].find((card) => card.instanceId === instanceId);
}

function describeOne(
    outcome: EventOutcome,
    index: number,
    scrapBefore: number,
    picks: Readonly<Record<number, OutcomePick>>,
    ctx?: EventContext,
): string | null {
    switch (outcome.type) {
        case 'SCRAP':
            // A price is taken as far as the run could pay it (`applyChoice`), so the line says so.
            return outcome.amount >= 0
                ? `+${outcome.amount} amber`
                : `-${Math.min(-outcome.amount, scrapBefore)} amber`;
        case 'JUNK': return 'Forge Slag added to your deck';
        case 'MAP_REVEAL': return 'This biome is surveyed';
        case 'TEMP_DRIVER': return `${driverText(outcome.driverId).name} for the next fight`;
        case 'UPGRADE': return `${outcome.count} cards upgraded`;
        case 'CARD_PICK': {
            const pick = picks[index];
            if (!pick || !isCardPick(pick)) return null;
            const name = ProgramRegistry[pick.cardId]?.name ?? pick.cardId;
            return `${name} added to your ${pick.toCollection ? 'collection' : 'deck'}`;
        }
        case 'BLUEPRINT_PICK': {
            const pick = picks[index];
            if (!pick || !isBlueprintPick(pick)) return null;
            return `${speciesName(pick.speciesId)} trace banked to the ranch`;
        }
        case 'MACRO_PICK': {
            const pick = picks[index];
            if (!pick || !isMacroPick(pick)) return null;
            return `${plain(getMacro(pick.macroId)?.name ?? pick.macroId)} added to your rack`;
        }
        case 'RECRUIT': {
            const pick = picks[index];
            if (!pick || !isRecruitPick(pick)) return null;
            return `${speciesName(pick.speciesId)} joined your party`;
        }
        case 'GIVE_CARD': {
            const pick = picks[index];
            if (!pick || !isGivePick(pick)) return null;
            const names = pick.instanceIds.map((id) => heldCard(ctx, id)).filter((card): card is IRunCard => card !== undefined).map((card) => cardName(card.dataId));
            return names.length > 0 ? `Gave up ${names.join(' and ')}` : 'Gave up a card';
        }
        case 'GIVE_BLUEPRINT': {
            const pick = picks[index];
            if (!pick || !isBlueprintPick(pick)) return null;
            return `Gave up a ${speciesName(pick.speciesId)} trace`;
        }
        case 'TRADE_UP':
        case 'TRANSFORM': {
            const pick = picks[index];
            const given = pick && isGivePick(pick) ? heldCard(ctx, pick.instanceIds[0]) : undefined;
            if (!ctx || !given) return null;
            const target = outcome.type === 'TRADE_UP' ? tradeUpTarget(ctx, given) : recompileTarget(ctx, given);
            return target === null ? null : `${cardName(given.dataId)} became ${cardName(target)}`;
        }
        case 'DUPLICATE': {
            const pick = picks[index];
            const given = pick && isGivePick(pick) ? heldCard(ctx, pick.instanceIds[0]) : undefined;
            return given ? `${cardName(given.dataId)} copied` : null;
        }
        case 'DRIVER_PICK': {
            const pick = picks[index];
            if (!pick || !isDriverPick(pick)) return null;
            return `${driverText(pick.driverId).name} Totem gained`;
        }
        case 'PATCH': {
            const pick = picks[index];
            if (!pick || !isPatchPick(pick) || !ctx) return null;
            const offer = patchOffers(ctx).find((row) => row.memberId === pick.memberId);
            return offer ? `${plain(getPatch(offer.patchId)?.name ?? offer.patchId)} rune fitted` : null;
        }
        case 'REFLASH': {
            const pick = picks[index];
            if (!pick || !isReflashPick(pick) || !ctx) return null;
            const osId = reflashTargetFor(ctx, pick.reflashMemberId);
            const body = ctx.ranch.roster.find((member) => member.id === pick.reflashMemberId);
            if (osId === null || !body) return null;
            return `${speciesName(body.definitionId)} retrained to ${instinctName(getOSBehavior(osId)?.name ?? osId)}`;
        }
        default: return null;
    }
}

/** The lines for a choice whose gambles are already resolved. Empty for Leave. */
export function describeApplied(
    choice: EventChoice,
    scrapBefore: number,
    picks: Readonly<Record<number, OutcomePick>> = {},
    ctx?: EventContext,
): string {
    return choice.outcomes
        .map((outcome, index) => describeOne(outcome, index, scrapBefore, picks, ctx))
        .filter((line): line is string => line !== null)
        .join(' · ');
}
