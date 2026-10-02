import { LAUNCH_SPECIES, MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { PATCHES, PATCH_IDS, patchTouchCount } from '../src/engine/data/patchRegistry';
import { rawFirmwareHooks, getOSBehavior } from '../src/engine/data/firmwareRegistry';
const os = LAUNCH_SPECIES.flatMap((s) => MingmingRegistry[s]?.availableOS ?? []);
console.log(['os', ...PATCH_IDS].join('\t'));
for (const id of os) {
  const hooks = rawFirmwareHooks(id);
  console.log([`${id}(${getOSBehavior(id)?.name},${hooks.length}h)`, ...PATCH_IDS.map((p) => patchTouchCount((PATCHES as any)[p], hooks))].join('\t'));
}
