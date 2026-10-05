/**
 * TICKET 180c — an event's one-of-a-list steps: a blueprint, a blueprint to give up, a Driver, a
 * patch, a reflash and a recruit. The lists are the pick screens' own (`offerBlueprints`,
 * `offerDrivers`, `patchOffers`, `reflashRows`, `recruitOptions`), and a reflash row that is blocked
 * is listed with the game's reason and no move.
 */
import { MingmingRegistry } from '../../../../engine/data/mingmingRegistry';
import { offerBlueprints } from '../../../../engine/run/events/eventBlueprints';
import { partyMembersOf } from '../../../../engine/run/events/eventContext';
import { offerDrivers } from '../../../../engine/run/events/eventDrivers';
import { patchOffers } from '../../../../engine/run/events/eventPatch';
import { REFLASH_BLOCK_REASON, reflashRows } from '../../../../engine/run/events/eventReflash';
import { recruitOptions } from '../../../../ui/events/recruitOptions';
import { driverLine, driverName, firmwareName, patchLine, speciesName } from '../../gameText';
import type { Move, Section } from '../../types';
import type { StepInput } from './stepInput';

const nameOf = (ctx: StepInput['ctx'], memberId: string): string => {
    const member = ctx.ranch.roster.find((m) => m.id === memberId);
    return member ? speciesName(member.definitionId) : memberId;
};

export function blueprintPickStep({ ctx, outcome, slot, take }: StepInput): Section {
    if (outcome.type !== 'BLUEPRINT_PICK') return { lines: [], moves: [] };
    const species = offerBlueprints(ctx, outcome.count, slot);
    return {
        lines: ['PICK ONE TRACE (it goes to the ranch at once):', ...species.map((id) => `  ${speciesName(id)} (${MingmingRegistry[id]?.primaryElement ?? ''})`)],
        moves: species.map((id): Move => ({ key: `event:blueprint:${id}`, label: `Take the ${speciesName(id)} trace`, apply: () => take({ speciesId: id }) })),
    };
}

export function giveBlueprintStep({ ctx, take }: StepInput): Section {
    const held = Object.entries(ctx.ranch.blueprints).filter(([, count]) => count >= 1);
    return {
        lines: ['GIVE UP ONE TRACE:', ...held.map(([id, count]) => `  ${speciesName(id)} (you hold ${count})`)],
        moves: held.map(([id]): Move => ({ key: `event:give-blueprint:${id}`, label: `Give up a ${speciesName(id)} trace`, apply: () => take({ speciesId: id }) })),
    };
}

export function driverPickStep({ ctx, outcome, slot, take }: StepInput): Section {
    if (outcome.type !== 'DRIVER_PICK') return { lines: [], moves: [] };
    const drivers = offerDrivers(ctx, outcome.count, slot);
    return {
        lines: ['PICK ONE TOTEM (it stays for the rest of the run):', ...drivers.map((id) => `  ${driverLine(id)}`)],
        moves: drivers.map((id): Move => ({ key: `event:driver:${id}`, label: `Take the Totem ${driverName(id)}`, apply: () => take({ driverId: id }) })),
    };
}

export function patchStep({ ctx, take }: StepInput): Section {
    const members = partyMembersOf(ctx);
    const offers = patchOffers(ctx);
    return {
        lines: ['PICK A BODY (it is fitted with its best rune):', ...offers.map(({ memberId, patchId }) => {
            const member = members.find((m) => m.id === memberId);
            return `  ${nameOf(ctx, memberId)}: ${patchLine(member?.activeOS, patchId)}`;
        })],
        moves: offers.map(({ memberId }): Move => ({ key: `event:patch:${memberId}`, label: `Fit the rune on ${nameOf(ctx, memberId)}`, apply: () => take({ memberId }) })),
    };
}

export function reflashStep({ ctx, take }: StepInput): Section {
    const rows = reflashRows(ctx);
    const lines = ['PICK A BODY (its instinct changes for this run; its cards do not):'];
    const moves: Move[] = [];
    for (const row of rows) {
        const from = firmwareName(row.fromOS);
        lines.push(row.blocked !== null
            ? `  ${nameOf(ctx, row.memberId)}: ${from} [no: ${REFLASH_BLOCK_REASON[row.blocked]}]`
            : `  ${nameOf(ctx, row.memberId)}: ${from} -> ${firmwareName(row.toOS ?? undefined)}`);
        if (row.blocked === null) moves.push({ key: `event:reflash:${row.memberId}`, label: `Retrain ${nameOf(ctx, row.memberId)}`, apply: () => take({ reflashMemberId: row.memberId }) });
    }
    return { lines, moves };
}

export function recruitStep({ world, ctx, take }: StepInput): Section {
    const options = recruitOptions(world.store.getState().game, ctx.run);
    return {
        lines: ['PICK ONE MINGMING TO SUMMON (it joins the party, free):', ...(options.length === 0 ? ['  no trace you hold can be summoned right now'] : options.map((o) => `  ${speciesName(o.speciesId)} on ${firmwareName(o.osId)}`))],
        moves: options.map((o): Move => ({ key: `event:recruit:${o.speciesId}:${o.osId}`, label: `Summon ${speciesName(o.speciesId)} on ${firmwareName(o.osId)}`, apply: () => take(o) })),
    };
}
