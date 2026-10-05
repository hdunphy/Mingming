/**
 * TICKET 193e — the text tool's map says an Ambush is the dangerous one.
 *
 * 2026-10-04 r01 died at the first Ambush after 4 wins, reading *"Ambush offers a FIRST BLOOD bonus,
 * suggesting extra rewards"*. The real map has marked the ambush `HIGH RISK — they outnumber you` since
 * ticket 17; the tool printed `bonus: <Driver>` and no risk word. The words now come from one place,
 * shared with the real map, so they cannot drift.
 */
import { describe, it, expect } from 'vitest';
import { AMBUSH_RISK } from '../../../engine/run/ambushRisk';
import { layoutRegion } from '../../../ui/screens/regionLayout';
import { describeNode } from './mapScreen';
import { worldAt } from '../walkKit';
import { runOf } from '../types';
import type { World } from '../types';

const lineOf = (world: World, kind: string): string | undefined => {
    const run = runOf(world);
    const laid = layoutRegion(run.nodes, run.currentNodeId).nodes.find((n) => n.node.kind === kind);
    return laid ? describeNode(world, laid) : undefined;
};

describe('193e — the Ambush line', () => {
    it('says HIGH RISK, in the words the real map uses', () => {
        const world = worldAt('ambush');
        const line = lineOf(world, 'ambush');
        expect(line).toBeDefined();
        expect(line).toContain(AMBUSH_RISK);
        expect(AMBUSH_RISK).toMatch(/HIGH RISK/);
    });

    it('a plain wild fight does not carry the word', () => {
        const world = worldAt('ambush');
        const wild = lineOf(world, 'wild');
        if (wild) expect(wild).not.toContain('HIGH RISK');
    });

    it('the real map reads the same constant, not its own copy', async () => {
        const { readFileSync } = await import('node:fs');
        expect(readFileSync('src/ui/screens/RegionMap.tsx', 'utf8')).toContain('AMBUSH_RISK');
    });
});
