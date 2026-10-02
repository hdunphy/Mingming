/**
 * TICKET 163c — **WHICH HOOKS DOES THIS BODY RUN?** One answer, four callers.
 *
 * It used to be four answers. `resolutionEngine` had this one, with the cache; `core/Hooks.ts` had
 * three hand-rolled copies, one each for the heal, power and damage modifier paths. They agreed,
 * because nobody had changed the rule since they were written.
 *
 * 163c changes the rule. A PATCH makes a body's hooks a function of more than its firmware id, and
 * three copies that did not know that would have shipped a patch working everywhere except in the
 * damage path — so AMPLIFIER would have done nothing at all to the firmware whose entire output is
 * a damage multiplier, silently. That is this engine's signature failure (see `daemonCoverage`),
 * and the fix is not to patch four places carefully: it is to have one place.
 *
 * The cache is part of the rule rather than an optimisation beside it. A patched body rebuilds its
 * firmware's hooks from data; doing that per lookup instead of per (OS, patch) pair would be a
 * rebuild on every damage event, and ticket 127's profile is the reason that matters.
 *
 * Everything below the header is moved verbatim from `resolutionEngine`, including the note on why
 * the cache is keyed on the registry's generation — that argument did not change, it just lives
 * where the code does now.
 */
import type { HookDefinition } from './HookTypes';
import type { IBattleEntity } from '../types';
import { getHook, hookRegistryVersion } from './HookRegistry';
import { getOSBehavior, rawFirmwareHooks } from '../data/firmwareRegistry';
import { applyPatchesToFirmware, getPatch, type PatchDefinition } from '../data/patchRegistry';
import { GetProgramData } from '../data/programRegistry';
import { HookFactory } from './HookFactory';

/*
 * ============================================================================================
 * TICKET 144b — THE PER-ENTITY HOOK LIST, BUILT ONCE INSTEAD OF NINETY THOUSAND TIMES
 * ============================================================================================
 *
 * Three functions below (`executeResolutionStackInner`, `executeStatusDamageCalculated`,
 * `executeCostCalculated`) each opened with the same twenty lines: walk every living entity, build
 * a `Set` of hook ids from `e.hooks` + the firmware's hooks + every daemon's program data, then
 * `getHook` each id and keep the ones carrying this phase. That ran on EVERY hook phase of EVERY
 * simulated action — ticket 127 counted 93,889 reducer calls for one 3v3 decision, and the profile
 * put `executeResolutionStack` and its callbacks at 38% of the run.
 *
 * None of that work depends on the battle. An entity's hook set is a function of three fields —
 * its `activeOS`, its own `hooks` list, and its daemons' `dataId`s — none of which change during a
 * resolution, and all of which are cheap to key on. So it is computed once per distinct shape and
 * reused.
 *
 * WHY THE ORDER IS PROVABLY THE SAME, which is the only thing that matters for the identity gate:
 *
 *   1. the id set was insertion-ordered (`Set` preserves insertion order) — own hooks, then
 *      firmware, then daemons — and `collectEntityHooks` walks the same three sources in the same
 *      order into an array with the same dedupe;
 *   2. the phase filter was applied while iterating that set, so filtering the cached array by
 *      phase yields the same subsequence;
 *   3. entities are still visited in `[...playerParty, ...enemyParty]` order, and each entity's
 *      hooks are still appended as a block;
 *   4. the priority sort is unchanged, and `Array.prototype.sort` is stable in V8, so equal
 *      priorities keep the order steps 1-3 produced.
 *
 * The cache is keyed on the registry's generation as well as the entity shape, because
 * registration is NOT a boot-only event: firmware registers lazily on first `getOSBehavior`, and
 * test files register hand-built hooks at module scope. Without that, the first test to run would
 * pin every later one to its view of the registry.
 */
interface EntityHookCacheEntry {
    /** Every registered hook this entity carries, in the order the old `Set` walk produced. */
    readonly all: HookDefinition[];
    /** Lazily filled per phase — most phases are never asked for on most entities. */
    readonly byPhase: Map<string, HookDefinition[]>;
}

const entityHookCache = new Map<string, EntityHookCacheEntry>();
let entityHookCacheVersion = -1;

/** The three fields an entity's hook set is a function of. Nothing else may enter this key. */
export function entityHookKey(e: IBattleEntity): string {
    const own = e.hooks ? e.hooks.join(',') : '';
    const daemons = e.daemons ? e.daemons.map(d => d.dataId).join(',') : '';
    // TICKET 163c: the PATCH is part of the key. Two bodies running the same firmware with
    // different patches are two different hook sets, and a cache keyed only on `activeOS` would
    // hand the second one the first one's rider.
    const patches = e.patches && e.patches.length > 0 ? e.patches.join(',') : '';
    return `${e.activeOS ?? ''}|${own}|${daemons}|${patches}`;
}

export function entityHooksFor(e: IBattleEntity, phase: string): HookDefinition[] {
    const registryVersion = hookRegistryVersion();
    if (registryVersion !== entityHookCacheVersion) {
        entityHookCache.clear();
        entityHookCacheVersion = registryVersion;
    }

    const key = entityHookKey(e);
    let entry = entityHookCache.get(key);
    if (!entry) {
        const ids = new Set<string>();
        if (e.hooks) e.hooks.forEach(h => ids.add(h));
        /*
         * TICKET 163c — a PATCHED body builds its firmware's hooks fresh instead of taking the
         * registry's.
         *
         * `FIRMWARE_REGISTRY` holds hooks built once at boot and shared by every body running that
         * OS, which is right for a firmware and impossible for a patch: the whole point is that
         * THIS body's UNBOUND_KERNEL differs from that one's. So the raw data is transformed
         * (`patchRegistry`) and rebuilt for this entity, and the result is cached under a key that
         * includes the patch — built once per (OS, patch) pair, not once per lookup.
         *
         * The rebuilt hooks are NOT registered. `getHook` is a global table, and registering a
         * per-body variant under the same id would overwrite the unpatched one for everybody. They
         * keep their base ids, which is what makes a patched OS fire the same VFX and log line as
         * an unpatched one: the tell is the firmware, and the rider has a chip of its own.
         */
        const patched: HookDefinition[] = [];
        if (e.activeOS) {
            const os = getOSBehavior(e.activeOS);
            const riders = (e.patches ?? [])
                .map(getPatch)
                .filter((patch): patch is PatchDefinition => patch !== undefined);
            if (os && riders.length > 0) {
                const raw = rawFirmwareHooks(e.activeOS);
                const fromData = new Set(raw.map((hook) => hook.id));
                // 184d: through `applyPatchesToFirmware`, so a firmware's hand-written effect for a
                // patch (`patchOverrides.ts`) is the one that plays — including a hook it ADDS.
                for (const data of applyPatchesToFirmware(e.activeOS, riders, raw)) {
                    patched.push(HookFactory.createHook(data));
                }
                /*
                 * Hand-written firmware (`CustomFirmware`) is CODE, not data, so a patch cannot
                 * reach it — those hooks come through unchanged rather than being dropped, which
                 * is the difference between "this patch does nothing here" and "this patch turned
                 * the firmware off". All five such OSes are post-EA; `patches.test.ts` pins that
                 * boundary rather than leaving it as a comment.
                 */
                os.hooks.forEach(hook => { if (!fromData.has(hook.id)) patched.push(hook); });
            } else if (os) {
                os.hooks.forEach(h => ids.add(h.id));
            }
        }
        if (e.daemons) {
            e.daemons.forEach(daemon => {
                const data = GetProgramData(daemon.dataId);
                if (data.hooks) data.hooks.forEach(h => ids.add(h));
            });
        }
        const all: HookDefinition[] = [...patched];
        ids.forEach(id => {
            const registered = getHook(id);
            if (registered) all.push(registered);
        });
        entry = { all, byPhase: new Map() };
        entityHookCache.set(key, entry);
    }

    let forPhase = entry.byPhase.get(phase);
    if (!forPhase) {
        forPhase = entry.all.filter(h => (h as unknown as Record<string, unknown>)[phase]);
        entry.byPhase.set(phase, forPhase);
    }
    return forPhase;
}


/** Test seam: a suite that rebuilds the registry in place can drop the memo explicitly. */
export function clearEntityHookCache(): void {
    entityHookCache.clear();
    entityHookCacheVersion = -1;
}
