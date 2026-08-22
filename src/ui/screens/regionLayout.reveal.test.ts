/**
 * THE FOG'S THIRD CLAUSE — ticket 15 (ticket 07's map-reveal amendment).
 *
 * Kept out of `regionLayout.test.ts` so ticket 10's landed fog suite stays exactly as ratified: the
 * one-layer rule and the visited rule are unchanged by this ticket, and a diff that says so is worth
 * more than a tidier file.
 *
 * The claim: **a surveyed biome is revealed whole, and nothing else changes.** Both halves matter. A
 * reveal that also lifted the fog elsewhere would make the consumable strictly better than it says;
 * a reveal that only lifted the current *layer* would make it strictly worse than the amendment
 * ("reveals the current biome's node types") and nearly worthless, since one layer ahead is already
 * free.
 */

import { describe, expect, it } from 'vitest';

import { generateRegionGraph } from '../../engine/run/regionGraph';
import { biomeRevealModifier, revealedBiomesFrom } from '../../engine/data/macroRegistry';
import { columnOf, layoutRegion } from './regionLayout';

const GRAPH = generateRegionGraph('reveal-seed');
const START = GRAPH.entryNodeId;

/** The nodes that ordinary one-layer fog leaves hidden from the entry node. */
function foggedFromStart(): string[] {
    return layoutRegion(GRAPH.nodes, START).nodes.filter((n) => !n.revealed).map((n) => n.node.id);
}

describe('layoutRegion — a surveyed biome', () => {
    it('leaves the map exactly as it was when nothing has been surveyed', () => {
        // The argument for the parameter defaulting to empty: every pre-ticket-15 caller and every
        // ticket 10 test describes the unsurveyed map, and must keep describing it.
        expect(layoutRegion(GRAPH.nodes, START, [])).toEqual(layoutRegion(GRAPH.nodes, START));
    });

    it('reveals every node of the surveyed biome, however far ahead it is', () => {
        // Biome 2 is ten columns from the entry node — comfortably beyond the one-layer rule, so
        // nothing here can be revealed by proximity and the survey is the only cause.
        const before = layoutRegion(GRAPH.nodes, START);
        const after = layoutRegion(GRAPH.nodes, START, [2]);

        const inBiome2 = GRAPH.nodes.filter((n) => n.biomeIndex === 2);
        expect(inBiome2.length).toBeGreaterThan(0);
        expect(inBiome2.some((n) => before.byId.get(n.id)!.revealed)).toBe(false);
        for (const node of inBiome2) {
            expect(after.byId.get(node.id)!.revealed).toBe(true);
        }
    });

    it('reveals NOTHING outside the surveyed biome', () => {
        const after = layoutRegion(GRAPH.nodes, START, [2]);
        const stillFogged = foggedFromStart().filter((id) => GRAPH.nodes.find((n) => n.id === id)!.biomeIndex !== 2);
        expect(stillFogged.length).toBeGreaterThan(0);
        for (const id of stillFogged) {
            expect(after.byId.get(id)!.revealed).toBe(false);
        }
    });

    it('surveys two biomes independently', () => {
        const after = layoutRegion(GRAPH.nodes, START, [1, 2]);
        for (const node of GRAPH.nodes) {
            if (node.biomeIndex === 0) continue;
            expect(after.byId.get(node.id)!.revealed).toBe(true);
        }
    });

    it('changes only `revealed` — position, reachability and ordering are untouched', () => {
        // A reveal is a fog change and nothing else. If it moved a node, the map would visibly
        // reshuffle when a consumable was spent, which is the sort of thing that reads as a bug.
        const before = layoutRegion(GRAPH.nodes, START);
        const after = layoutRegion(GRAPH.nodes, START, [1, 2]);
        expect(after.nodes.map((n) => n.node.id)).toEqual(before.nodes.map((n) => n.node.id));
        expect(after.nodes.map((n) => [n.column, n.row, n.reachable, n.isCurrent]))
            .toEqual(before.nodes.map((n) => [n.column, n.row, n.reachable, n.isCurrent]));
    });

    it('is driven end to end by the `modifiers` entry the macro writes', () => {
        // The one case that spans both halves: `runSlice.fireMapReveal` writes a string, and this is
        // what that string is FOR. If the prefix ever drifts, this fails rather than the map quietly
        // never lifting.
        const modifiers = [biomeRevealModifier(2)];
        const after = layoutRegion(GRAPH.nodes, START, revealedBiomesFrom(modifiers));
        const far = GRAPH.nodes.find((n) => n.biomeIndex === 2 && columnOf(n) >= 12)!;
        expect(after.byId.get(far.id)!.revealed).toBe(true);
    });
});

describe('revealedBiomesFrom', () => {
    it('reads only its own namespaced entries, and ignores everything else', () => {
        // `modifiers` is shared with the ascension-shaped run modifiers `runTypes.ts` reserves it
        // for, so the reader has to be indifferent to strings it does not own.
        expect(revealedBiomesFrom(['ascension:3', biomeRevealModifier(1), 'cursed'])).toEqual([1]);
    });

    it('is total — a malformed entry is skipped, never thrown on', () => {
        // Called from a render. A save carrying a modifier from a future version must not take the
        // map down with it.
        expect(revealedBiomesFrom(['reveal:biome:', 'reveal:biome:x', 'reveal:biome:-1'])).toEqual([]);
    });

    it('deduplicates, so a repeated entry is not a second reveal', () => {
        expect(revealedBiomesFrom([biomeRevealModifier(0), biomeRevealModifier(0)])).toEqual([0]);
    });
});
