/** TICKET 180b — who is on the team and who is on the bench, as the workshop's right-hand panel lists them. */
import { PARTY_SIZE } from '../../../../engine/party';
import type { IRanchMember } from '../../../../engine/runTypes';
import { readDeckFloor } from '../../../../ui/screens/deckFloor';
import { firmwareName, memberName } from '../../gameText';
import type { World } from '../../types';
import { runOf } from '../../types';

export function teamLines(world: World): string[] {
    const run = runOf(world);
    const ranch = world.store.getState().game;
    const reading = readDeckFloor(run);
    const find = (id: string): IRanchMember | undefined => ranch.roster.find((m) => m.id === id);
    const row = (id: string): string => {
        const m = find(id);
        return m ? `  ${memberName(m)} on ${firmwareName(run.osOverrides?.[m.id] ?? m.activeOS)}` : `  ${id}`;
    };
    const lines = [`TEAM (party ${run.partyIds.length}/${PARTY_SIZE}, bench ${(run.bench ?? []).length}; deck ${reading.counted}, floor ${reading.floor}):`];
    for (const id of run.partyIds) lines.push(row(id));
    for (const id of run.bench ?? []) lines.push(`${row(id)} (bench)`);
    return lines;
}
