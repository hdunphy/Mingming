/*
 * TICKET 162a step 1 — dump the EA decks and start kits as they stand, for the archive.
 *
 * Reads the registry through its own accessor rather than re-parsing mingmingRegistry.ts, so the
 * archive records what the game actually shipped rather than what a regex thought it said.
 */
import { MingmingRegistry, LAUNCH_SPECIES } from '../src/engine/data/mingmingRegistry';

const out: Record<string, { decks: Record<string, string[]>; startKits: Record<string, string[]> }> = {};
for (const species of LAUNCH_SPECIES) {
    const def = MingmingRegistry[species] as unknown as {
        decks?: Record<string, string[]>;
        startKits?: Record<string, string[]>;
    };
    out[species] = { decks: def.decks ?? {}, startKits: def.startKits ?? {} };
}
console.log(JSON.stringify(out, null, 4));
