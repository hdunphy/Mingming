/**
 * TICKET 180 — every word the playtester prints that the game owns comes through here.
 *
 * Ticket 182 is rewriting the game's copy and 183h renames words like Instinct, Trace and Rune, so
 * nothing in `src/debug/playtest/` spells one out. This module is the whole seam: names come from
 * the registries, card text from `ProgramData.description` (what `CardFace` prints), map labels from
 * the map's own table. If one of these moves, this is the one file to fix, and no test or brief
 * has to change.
 */
import { GetMingmingData } from '../../engine/data/mingmingRegistry';
import { GetProgramData } from '../../engine/data/programRegistry';
import { getOSBehavior } from '../../engine/data/firmwareRegistry';
import { getMacro } from '../../engine/data/macroRegistry';
import { getPatch } from '../../engine/data/patchRegistry';
import { describePatchOn } from '../../engine/data/patchText';
import { describeDriver } from '../../engine/data/driverRegistry';
import { numericBaseCost } from '../../engine/types';
import type { IRanchMember, IRegionNode } from '../../engine/runTypes';
import { NODE_LABEL, isRunStart, nodeLabelFor } from '../../ui/screens/regionLayout';
import { plain } from '../../ui/labels/labels';

export const speciesName = (definitionId: string): string => GetMingmingData(definitionId)?.name ?? definitionId;

export const memberName = (member: Pick<IRanchMember, 'id' | 'definitionId' | 'nickname'>): string =>
    member.nickname ?? speciesName(member.definitionId);

/*
 * THE GAME'S WORDS. Tickets 183h and 192 renamed things on the screens (Instinct, Aura, the Norse
 * names) through the UI's `plain()`. Everything below that prints the game's own names and rule text
 * goes through it too, so the agent reads what a player reads. `plain` is the whole seam: when a word
 * is renamed again, nothing here changes.
 */
export const firmwareName = (osId: string | undefined): string =>
    osId === undefined ? '-' : plain(getOSBehavior(osId)?.name ?? osId);

export const firmwareText = (osId: string | undefined): string =>
    osId === undefined ? '' : plain(getOSBehavior(osId)?.description ?? '');

export const cardName = (dataId: string): string => plain(GetProgramData(dataId)?.name || dataId);

export function cardCost(dataId: string): number | string {
    const data = GetProgramData(dataId);
    return data ? numericBaseCost(data.baseCost) : '?';
}

/** `Name (cost, Element): rule text`, as the card face prints it. Never paraphrased. */
export function cardLine(dataId: string): string {
    const data = GetProgramData(dataId);
    if (!data) return `${dataId} (unknown card)`;
    return plain(`${data.name || dataId} (${numericBaseCost(data.baseCost)}e, ${data.element ?? 'None'}): ${data.description ?? ''}`.trimEnd());
}

export const macroLine = (macroId: string): string => {
    const macro = getMacro(macroId);
    return macro ? plain(`${macro.name}: ${macro.description}`) : macroId;
};

export const macroName = (macroId: string | null): string => (macroId === null ? 'empty' : plain(getMacro(macroId)?.name ?? macroId));

export const patchName = (patchId: string): string => plain(getPatch(patchId)?.name ?? patchId);
export const patchLine = (osId: string | undefined, patchId: string): string =>
    plain(`${patchName(patchId)}: ${describePatchOn(osId, patchId)}`);

export const driverLine = (driverId: string): string => {
    const driver = describeDriver(driverId);
    return plain(`${driver.name}: ${driver.description}`);
};

/** The map's own word for a node (it calls the run's first node by its own name). */
export const nodeLabel = (node: IRegionNode): string => nodeLabelFor(node);
export const nodeKindLabel = (kind: IRegionNode['kind']): string => NODE_LABEL[kind];
export { isRunStart };
export const driverName = (driverId: string): string => plain(describeDriver(driverId).name);
