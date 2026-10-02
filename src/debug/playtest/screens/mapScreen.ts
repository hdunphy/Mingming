/**
 * TICKET 180a — THE MAP SCREEN.
 *
 * What the map shows the player: where they stand, and each node they can step to, labelled the way
 * the map labels it, and **only as far as the fog allows**. `layoutRegion` is the map's own rule for
 * what is revealed (the next column, anything visited, a surveyed biome); a node that is not
 * revealed is listed as unknown. It never assumes the old five-layer shape: it lists the current
 * node's `edges`, whatever they are, so a map that grows towns or longer biomes needs no change here.
 *
 * Moves: one per reachable node, plus one per Survey macro that can still be fired.
 */
import { getMacro, isBiomeRevealed, revealedBiomesFrom } from '../../../engine/data/macroRegistry';
import { resolveDriverStake, partyElementsOf } from '../../../engine/run/driverStakes';
import { rivalElementPlan, FIGHT_KINDS } from '../../../engine/run/encounter';
import { GetMingmingData } from '../../../engine/data/mingmingRegistry';
import { PARTY_SIZE } from '../../../engine/party';
import type { IRegionNode } from '../../../engine/runTypes';
import { fireMapReveal } from '../../../ui/store/runSlice';
import { layoutRegion, type LaidOutNode } from '../../../ui/screens/regionLayout';
import { stepOnto } from '../fightFlow';
import { driverName, nodeKindLabel, nodeLabel } from '../gameText';
import { partyOf } from '../party';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';

/** One reachable node, as a line: its kind, its elements, and the facts the map prints beside it. */
export function describeNode(world: World, laid: LaidOutNode): string {
    const run = runOf(world);
    const node = laid.node;
    if (!laid.revealed) return `Unknown (biome ${node.biomeIndex + 1}, layer ${node.layer})`;

    const label = node.scout ? `Scout ${nodeKindLabel(node.kind).toLowerCase()}` : nodeLabel(node);
    const parts = [label];
    if (FIGHT_KINDS.includes(node.kind)) {
        const rival = node.kind === 'rival'
            ? rivalElementPlan(run, node, PARTY_SIZE)
            : [];
        const elements = rival.length > 0 ? rival : (run.biomes[node.biomeIndex]?.elements ?? []);
        if (elements.length > 0) parts.push(elements.join(' + '));
    }
    if (node.driverStake) {
        const party = partyOf(world).map((m) => GetMingmingData(m.definitionId));
        parts.push(`${node.kind === 'ambush' ? 'bonus' : 'stakes'}: ${driverName(resolveDriverStake(node.driverStake, partyElementsOf(party)))}`);
    }
    parts.push(`biome ${node.biomeIndex + 1}`, `layer ${node.layer}`);
    if (node.pocket) parts.push('dead end');
    if (node.visited > 0) parts.push(`visited ${node.visited}x`);
    return parts.join(', ');
}

export function mapScreen(world: World): Screen {
    const run = runOf(world);
    const revealedBiomes = revealedBiomesFrom(run.modifiers);
    const layout = layoutRegion(run.nodes, run.currentNodeId, revealedBiomes);
    const here = layout.byId.get(run.currentNodeId);
    const biome = run.biomes[here?.node.biomeIndex ?? 0];

    const reachable = layout.nodes.filter((n) => n.reachable);
    const body: string[] = [];
    body.push(`MAP. You are at: ${here ? nodeLabel(here.node) : run.currentNodeId}${biome ? `, ${biome.name} (${biome.elements.join(' + ')})` : ''}, layer ${here?.node.layer ?? '?'}.`);

    // What a survey has shown further ahead: the kinds of the revealed nodes beyond the next column.
    const here_column = here?.column ?? 0;
    const ahead = layout.nodes.filter((n) => n.revealed && !n.reachable && n.column > here_column + 1);
    if (ahead.length > 0) {
        const byColumn = new Map<number, string[]>();
        for (const laid of ahead) byColumn.set(laid.column, [...(byColumn.get(laid.column) ?? []), nodeLabel(laid.node)]);
        body.push('Surveyed ahead:');
        for (const [column, kinds] of [...byColumn.entries()].sort((a, b) => a[0] - b[0])) {
            body.push(`  column ${column}: ${kinds.join(', ')}`);
        }
    }

    const moves: Move[] = reachable.map((laid) => ({
        key: `enter:${laid.node.id}`,
        label: `Go to ${describeNode(world, laid)}`,
        apply: (w) => stepOnto(w, laid.node.id),
    }));

    // A Survey macro lights up the whole biome the party stands in. It is free to fire and is used up.
    run.macros.forEach((macroId, slot) => {
        const macro = getMacro(macroId);
        if (!macro || macro.targeting !== 'MAP') return;
        if (here && isBiomeRevealed(run, here.node.biomeIndex)) return;
        moves.push({
            key: `survey:${slot}`,
            label: `Use the macro ${macro.name} (rack slot ${slot + 1}) on this biome`,
            apply: (w) => { w.store.dispatch(fireMapReveal(slot)); w.view.news.push(`Used ${macro.name}.`); },
        });
    });

    return { id: 'map', body, moves };
}

export const nodeById = (world: World, id: string): IRegionNode | undefined =>
    runOf(world).nodes.find((n) => n.id === id);
