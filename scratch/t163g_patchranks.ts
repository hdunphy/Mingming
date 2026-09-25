/**
 * TICKET 163g — the 6×12 patch table under the new ranking, printed.
 *
 * Read for two things: whether the scored delta discriminates where the touch count did not
 * (163e measured `amplifier ×27`, i.e. every patch the walker ever fitted), and whether the gate's
 * two offers are now two different KINDS.
 */
import { MingmingRegistry, LAUNCH_SPECIES } from '../src/engine/data/mingmingRegistry';
import { rawFirmwareHooks } from '../src/engine/data/firmwareRegistry';
import { PATCHES, PATCH_IDS, patchTouchCount } from '../src/engine/data/patchRegistry';
import { bestPatchFor, gatePatchChoices, patchScoreDeltaFor } from '../src/engine/data/patchRanking';

const osIds = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);

console.log('scored delta (% of a health pool per game); (n) = touch count\n');
console.log(`${'firmware'.padEnd(17)}${PATCH_IDS.map((id) => id.padStart(14)).join('')}   | best        | gate offers`);
for (const osId of osIds) {
    const hooks = rawFirmwareHooks(osId);
    const cells = PATCH_IDS.map((id) => {
        const d = patchScoreDeltaFor(PATCHES[id], hooks);
        const n = patchTouchCount(PATCHES[id], hooks);
        return `${d.toFixed(2)}(${n})`.padStart(14);
    }).join('');
    const gate = gatePatchChoices(hooks, []);
    const kinds = gate.map((id) => PATCHES[id].field);
    console.log(
        `${osId.padEnd(17)}${cells}   | ${bestPatchFor(hooks).id.padEnd(10)} | ${gate.join(' + ').padEnd(24)} ${
            kinds.length === 2 && kinds[0] === kinds[1] ? 'SAME KIND' : `${kinds.join('/')}`}`,
    );
}

console.log('\n--- what each patch wins, across the twelve ---');
const wins: Record<string, number> = {};
for (const osId of osIds) wins[bestPatchFor(rawFirmwareHooks(osId)).id] = (wins[bestPatchFor(rawFirmwareHooks(osId)).id] ?? 0) + 1;
for (const id of PATCH_IDS) console.log(`${id.padEnd(12)} best on ${wins[id] ?? 0} of ${osIds.length}`);

console.log('\n--- inertness: a patch that changes nothing on anybody ---');
for (const id of PATCH_IDS) {
    const touched = osIds.filter((osId) => patchTouchCount(PATCHES[id], rawFirmwareHooks(osId)) > 0);
    const moved = osIds.filter((osId) => patchScoreDeltaFor(PATCHES[id], rawFirmwareHooks(osId)) !== 0);
    console.log(`${id.padEnd(12)} touches ${String(touched.length).padStart(2)}/${osIds.length}   moves the score on ${String(moved.length).padStart(2)}/${osIds.length}`);
}
