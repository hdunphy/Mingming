/**
 * TICKET 180a — THE MAP SCREEN.
 *
 * What the map shows the player: where they stand, each node they can step to, labelled the way the
 * map labels it, and the type of every node further on (ticket 176d took the fog away, so the whole
 * road is visible). The species in a fight show only in a surveyed biome, as on the map. It lists the
 * current node's `edges`, whatever they are, so a map that grows towns or longer biomes needs no
 * change here.
 *
 * Moves: one per reachable node, plus one per Survey macro that can still be fired.
 */
import { getMacro, isBiomeRevealed, revealedBiomesFrom } from '../../../engine/data/macroRegistry';
import { resolveDriverStake, partyElementsOf } from '../../../engine/run/driverStakes';
import { rivalElementPlan, FIGHT_KINDS, surveyedEncounterLine } from '../../../engine/run/encounter';
import { GetMingmingData } from '../../../engine/data/mingmingRegistry';
import { PARTY_SIZE } from '../../../engine/party';
import { AMBUSH_RISK } from '../../../engine/run/ambushRisk';
import { isMarketNode } from '../../../engine/run/marketplace';
import { isWorkshopNode } from '../../../engine/run/workshop';
import type { IRegionNode } from '../../../engine/runTypes';
import { fireMapReveal } from '../../../ui/store/runSlice';
import { routeNumberOf } from '../../../engine/run/regionGraph';
import { layoutRegion, positionWord, type LaidOutNode } from '../../../ui/screens/regionLayout';
import { stepOnto } from '../arrive';
import { driverName, nodeKindLabel, nodeLabel } from '../gameText';
import { partyOf } from '../party';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';

/** One reachable node, as a line: its kind, its elements, and the facts the map prints beside it. */
export function describeNode(world: World, laid: LaidOutNode): string {
    const run = runOf(world);
    const node = laid.node;
    const label = node.scout ? `Scout ${nodeKindLabel(node.kind).toLowerCase()}` : nodeLabel(node);
    // 176d: after a Heimdall's Gaze or a Survey the fight names who waits in it, as the map does.
    const species = surveyedEncounterLine(run, node, partyOf(world), revealedBiomesFrom(run.modifiers));
    // 176e: a detour says what it costs next to its name, as the map's Travel list does.
    const named = node.detour ? `${label} (detour, +1 fight)` : label;
    const parts = [species ? `${named}: ${species}` : named];
    if (FIGHT_KINDS.includes(node.kind)) {
        const rival = node.kind === 'rival'
            ? rivalElementPlan(run, node, PARTY_SIZE)
            : [];
        const elements = rival.length > 0 ? rival : (run.biomes[node.biomeIndex]?.elements ?? []);
        if (elements.length > 0) parts.push(elements.join(' + '));
    }
    // 193e: the real map marks an Ambush; the tool called its Driver a bonus and an agent walked in.
    if (node.kind === 'ambush') parts.push(AMBUSH_RISK);
    if (node.driverStake) {
        const party = partyOf(world).map((m) => GetMingmingData(m.definitionId));
        parts.push(`${node.kind === 'ambush' ? 'bonus' : 'stakes'}: ${driverName(resolveDriverStake(node.driverStake, partyElementsOf(party)))}`);
    }
    parts.push(`biome ${node.biomeIndex + 1}`);
    const route = routeNumberOf(node);
    if (route !== null) parts.push(`route ${route}`);
    return parts.join(', ');
}

/**
 * `describeNode`, and where the node sits in its column when another node of the column reads the same
 * (ticket 186c; the map screen's Travel list says it the same way, through `positionWord`).
 */
function describeWithPlace(world: World, laid: LaidOutNode, all: ReadonlyArray<LaidOutNode>): string {
    const base = describeNode(world, laid);
    const twins = all
        .filter((other) => other.column === laid.column && describeNode(world, other) === base)
        .sort((a, b) => a.row - b.row);
    return twins.length < 2 ? base : `${base}, ${positionWord(twins.length, twins.indexOf(laid))}`;
}

export function mapScreen(world: World): Screen {
    const run = runOf(world);
    const layout = layoutRegion(run.nodes, run.currentNodeId);
    const here = layout.byId.get(run.currentNodeId);
    const biome = run.biomes[here?.node.biomeIndex ?? 0];

    const reachable = layout.nodes.filter((n) => n.reachable);
    const body: string[] = [];
    body.push(`MAP. You are at: ${here ? nodeLabel(here.node) : run.currentNodeId}${biome ? `, ${biome.name} (${biome.elements.join(' + ')})` : ''}${here && routeNumberOf(here.node) !== null ? `, route ${routeNumberOf(here.node)}` : ''}.`);

    // The road further on: the kinds of the nodes beyond the next column.
    const here_column = here?.column ?? 0;
    const ahead = layout.nodes.filter((n) => !n.reachable && n.column > here_column + 1);
    if (ahead.length > 0) {
        const byColumn = new Map<number, string[]>();
        for (const laid of ahead) byColumn.set(laid.column, [...(byColumn.get(laid.column) ?? []), nodeLabel(laid.node)]);
        body.push('Ahead:');
        for (const [column, kinds] of [...byColumn.entries()].sort((a, b) => a[0] - b[0])) {
            body.push(`  column ${column}: ${kinds.join(', ')}`);
        }
    }

    const moves: Move[] = reachable.map((laid) => ({
        key: `enter:${laid.node.id}`,
        label: `Go to ${describeWithPlace(world, laid, layout.nodes)}`,
        apply: (w) => stepOnto(w, laid.node.id),
    }));

    // A stall you walked out of is not spent: the map offers the way back in (`RunScreen`'s button).
    if (here && (isMarketNode(here.node.kind) || isWorkshopNode(here.node.kind)) && world.view.closedStall === here.node.id) {
        moves.push({
            key: 'reopen',
            label: `Go back into the ${here.node.kind === 'town' ? 'town' : isMarketNode(here.node.kind) ? 'market' : 'den'}`,
            apply: (w) => { w.view.closedStall = null; },
        });
    }

    // A Survey macro lights up the whole biome the party stands in. It is free to fire and is used up.
    run.macros.forEach((macroId, slot) => {
        const macro = getMacro(macroId);
        if (!macro || macro.targeting !== 'MAP') return;
        if (here && isBiomeRevealed(run, here.node.biomeIndex)) return;
        moves.push({
            key: `survey:${slot}`,
            label: `Use the draught ${macro.name} (rack slot ${slot + 1}) on this biome`,
            apply: (w) => { w.store.dispatch(fireMapReveal(slot)); w.view.news.push(`Used ${macro.name}.`); },
        });
    });

    return { id: 'map', body, moves };
}

export const nodeById = (world: World, id: string): IRegionNode | undefined =>
    runOf(world).nodes.find((n) => n.id === id);
