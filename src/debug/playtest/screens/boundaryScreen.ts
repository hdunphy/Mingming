/**
 * TICKET 180c — THE BIOME BOUNDARY OFFER (ticket 61).
 *
 * After the elite that gates the next biome falls, `run.boundaryBiome` records that the party is
 * owed a loadout edit. The game raises it as a modal over the map with two buttons: ignore, or edit.
 * Both dismiss it (`dismissBoundaryAlert`); edit then opens the loadout editor. While it is up the
 * map is not available, as under the game's modal scrim.
 */
import { dismissBoundaryAlert } from '../../../ui/store/runSlice';
import { speciesName } from '../gameText';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';

export function boundaryScreen(world: World): Screen {
    const run = runOf(world);
    const next = run.biomes[run.boundaryBiome!];
    const bench = (run.bench ?? []).map((id) => world.store.getState().game.roster.find((m) => m.id === id)).filter((m) => m !== undefined);
    const moves: Move[] = [
        { key: 'boundary:ignore', label: 'Ignore it and continue', apply: (w) => { w.store.dispatch(dismissBoundaryAlert()); } },
        {
            key: 'boundary:edit', label: 'Edit the loadout before going on',
            apply: (w) => { w.store.dispatch(dismissBoundaryAlert()); w.view.editor = { swapping: null, confirmWarned: false }; },
        },
    ];
    return {
        id: 'boundary',
        body: [
            `BIOME BOUNDARY. The elite is down. Ahead: ${next?.name ?? 'the next biome'} (${(next?.elements ?? []).join(' / ')}). You may edit your party and deck now, or continue as it is.`,
            bench.length === 0 ? 'Nobody is benched.' : `Benched: ${bench.map((m) => speciesName(m!.definitionId)).join(', ')}.`,
        ],
        moves,
    };
}
