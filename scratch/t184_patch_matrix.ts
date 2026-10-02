/**
 * Ticket 184d — what each of the six patches actually changes on each of the twelve launch
 * firmware. Prints, per cell, the touch count and every field the transform changed (before -> after),
 * read off the same `rawFirmwareHooks` + `patch.apply` the engine uses (`entityHooks`).
 *
 *   npx vite-node scratch/t184_patch_matrix.ts
 */
import { LAUNCH_SPECIES, MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { PATCHES, PATCH_IDS, patchTouchCount } from '../src/engine/data/patchRegistry';
import { rawFirmwareHooks, getOSBehavior } from '../src/engine/data/firmwareRegistry';

type Json = unknown;
function diff(a: Json, b: Json, path: string, out: string[]): void {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
        const n = Math.max(a.length, b.length);
        for (let i = 0; i < n; i++) diff(a[i], b[i], `${path}[${i}]`, out);
        return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
        for (const k of keys) diff((a as Record<string, Json>)[k], (b as Record<string, Json>)[k], `${path}.${k}`, out);
        return;
    }
    out.push(`${path}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
}

const osIds = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);
for (const id of osIds) {
    const hooks = rawFirmwareHooks(id);
    console.log(`\n## ${id} ${getOSBehavior(id)?.name} (${hooks.length} data hooks) — ${getOSBehavior(id)?.description}`);
    for (const pid of PATCH_IDS) {
        const patch = PATCHES[pid];
        const changes: string[] = [];
        for (const hook of hooks) {
            const after = patch.apply(hook);
            if (after !== hook) diff(hook, after, hook.id, changes);
        }
        console.log(`  ${pid} touch=${patchTouchCount(patch, hooks)}`);
        for (const c of changes) console.log(`      ${c}`);
    }
}
