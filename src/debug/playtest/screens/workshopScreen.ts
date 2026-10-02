/**
 * TICKET 180b — THE WORKSHOP: assembly, reflash, the team, the upgrade bench, and the way out.
 * Composed from `screens/workshop/` and the shared upgrade bench; this module only stacks them.
 */
import { UPGRADES_PER_VISIT } from '../../../engine/run/marketplace';
import { hereNode, leaveStall } from '../stalls';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';
import { nodeLabel } from '../gameText';
import { assemblySection } from './workshop/assembly';
import { reflashSection } from './workshop/reflash';
import { teamLines } from './workshop/teamLines';
import { upgradeSection } from './upgradeBench';

export function workshopScreen(world: World): Screen {
    const node = hereNode(world);
    const run = runOf(world);
    const assembly = assemblySection(world);
    const reflash = reflashSection(world);
    const upgrades = upgradeSection(world, { benchKey: `${node.id}:${node.visited}`, allowance: UPGRADES_PER_VISIT, free: false, keyPrefix: 'workshop' });
    const leave: Move = { key: 'leave', label: 'Leave the workshop', apply: leaveStall };

    return {
        id: 'workshop',
        body: [
            `${nodeLabel(node)}, visit ${node.visited}. Scrap: ${run.scrap}.`,
            ...assembly.lines, ...reflash.lines, ...teamLines(world), ...upgrades.lines,
        ],
        moves: [...assembly.moves, ...reflash.moves, ...upgrades.moves, leave],
    };
}
