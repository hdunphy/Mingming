/**
 * EVERY DAEMON'S HOOKS MUST ACTUALLY RESOLVE — the guard for a whole class of silent failure.
 *
 * `initDaemonHooks` builds hooks from a **hand-maintained allowlist** of `hooks.json` keys. A
 * daemon can therefore be:
 *
 *   - printed correctly in `programs.json`,
 *   - hooked correctly in `hooks.json`,
 *   - schema-valid,
 *   - referenced correctly by `ProgramData.hooks`,
 *
 * and still do **absolutely nothing**, because its key is not in that list. Nothing throws, nothing
 * warns, and no existing test notices. `riptide` and `short_circuit` shipped in exactly that state
 * for one commit; the symptom was a counter card that measured as "too weak" rather than as broken.
 *
 * This is the third variant of the same failure in this engine — after ticket 71's
 * `COUNTER`-with-no-`target` (silently skipped by `HookFactory.executeActions`) and zod's stripping
 * of undeclared `when` keys. All three share a shape: **the data is fine and the wiring is missing,
 * so the card is inert instead of loud.** This test closes the class rather than the instance:
 * every Daemon the registry contains, forever, not just the two that exposed it.
 */

import { describe, expect, it } from 'vitest';

import { ProgramRegistry } from './programRegistry';
import { getHook } from '../core/HookRegistry';
import { initDaemonHooks } from './daemonHooks';

initDaemonHooks();

describe('daemon hook coverage', () => {
    it('resolves every hook id every Daemon program declares', () => {
        const daemons = Object.values(ProgramRegistry)
            .filter((p) => p.category === 'Daemon');

        // Guards the guard: if the filter ever silently matches nothing, the loop below passes
        // vacuously and this file becomes decoration.
        expect(daemons.length).toBeGreaterThan(8);

        const broken: string[] = [];
        for (const program of daemons) {
            for (const hookId of program.hooks ?? []) {
                if (getHook(hookId) === undefined) broken.push(`${program.id} -> ${hookId}`);
            }
        }

        expect(broken, 'Daemon(s) whose hooks never registered — check the allowlist in `initDaemonHooks`').toEqual([]);
    });

    it('gives every Daemon something to do — a hook or an action', () => {
        // A Daemon with neither is a blank card that costs energy. Most install a hook;
        // `battery_pack` is the one that resolves as a plain action instead, which is why this
        // asserts the union rather than hooks alone.
        for (const program of Object.values(ProgramRegistry)) {
            if (program.category !== 'Daemon') continue;
            const work = (program.hooks?.length ?? 0) + (program.actions?.length ?? 0);
            expect(work, `${program.id} is a Daemon that does nothing`).toBeGreaterThan(0);
        }
    });
});
