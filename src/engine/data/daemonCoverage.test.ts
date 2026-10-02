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
import { PROGRAM_ALIASES } from './programAliases';
import HOOKS from './lib/hooks.json';

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

/**
 * THE LOOP AUDIT — `research/69-toolbox-printings.md`'s gate: *"loop audit on all daemons"*.
 *
 * A daemon is a standing hook, so one whose effect re-enters its own trigger recurses until
 * `resolutionEngine`'s nesting cap stops it at 12 — a CAP, not a design. ROOT ROT hit exactly this
 * in ticket 72 (`onStatusApplied` applying a status); unguarded it applied about twelve extra stacks
 * and sprayed `CRITICAL_EVENT_OVERFLOW`.
 *
 * # WHAT COUNTS AS A GUARD — three shapes, all of them live in the tree
 *
 * The first draft of this audit accepted only a counter guard and flagged two shipped daemons that
 * are in fact safe. That was the audit being wrong, not the daemons, and the fix is worth recording
 * because it is the actual property:
 *
 *  - **a counter guard** — ROOT ROT's SIDE-scoped re-entry flag;
 *  - **a `statusApplied` filter naming a DIFFERENT status than the one applied** —
 *    `cinder_armor_daemon` triggers on Burn and applies Sharp, so the nested event fails its own
 *    `when`;
 *  - **`isToken: false` when the thing generated is a token** — `echo_chamber_v2` generates
 *    `feedback_token`, and playing that token fails the filter.
 *
 * All three work the same way: **the fed-back event cannot satisfy the condition that admitted the
 * first one.** That is what the audit tests, rather than any one implementation of it.
 */
describe('the daemon loop audit', () => {
    /** Trigger -> the action types that feed it back to itself. */
    const REENTRANT: Record<string, string[]> = {
        onStatusApplied: ['STATUS'],
        onCardDraw: ['DRAW'],
        onPostDamage: ['ATTACK', 'HP'],
        onHeal: ['HEAL'],
        // A generated card is played, and playing it re-enters the trigger that generated it.
        onActionStart: ['GENERATE_CARD'],
        onActionEnd: ['GENERATE_CARD'],
    };

    type Decl = {
        trigger?: string;
        when?: { counter?: unknown; statusApplied?: string; isToken?: boolean };
        do?: Array<{ type?: string; status?: string; dataId?: string }>;
    };

    const declOf = (hookId: string): Decl | undefined =>
        (getHook(hookId) as unknown as { data?: Decl } | undefined)?.data;

    /** Can the event this action produces satisfy the `when` that admitted the first one? */
    function isGuarded(decl: Decl, action: { type?: string; status?: string; dataId?: string }): boolean {
        if (decl.when?.counter !== undefined) return true;
        if (decl.when?.statusApplied !== undefined && action.type === 'STATUS') {
            return action.status !== decl.when.statusApplied;
        }
        if (decl.when?.isToken === false && action.type === 'GENERATE_CARD') {
            return (action.dataId ?? '').includes('token');
        }
        return false;
    }

    it('no daemon feeds its own trigger without a guard the fed-back event fails', () => {
        const offenders: string[] = [];

        for (const program of Object.values(ProgramRegistry)) {
            if (program.category !== 'Daemon') continue;
            for (const hookId of program.hooks ?? []) {
                const decl = declOf(hookId);
                if (!decl?.trigger) continue;

                const dangerous = REENTRANT[decl.trigger] ?? [];
                for (const action of decl.do ?? []) {
                    if (action.type === undefined || !dangerous.includes(action.type)) continue;
                    if (isGuarded(decl, action)) continue;
                    offenders.push(`${program.id} -> ${hookId}: ${decl.trigger} does ${action.type} unguarded`);
                }
            }
        }

        expect(offenders, 'daemon hook(s) that can re-enter their own trigger').toEqual([]);
    });

    it('the TOOLBOX printings create no cards at all — the doc\'s law', () => {
        /*
         * Scoped to the toolbox on purpose. `echo_chamber_v2` is a shipped Nature daemon that DOES
         * generate cards, safely, behind its `isToken` guard; the toolbox law is a stricter rule for
         * cards that any party can buy into any deck, where the interaction surface is every deck in
         * the game rather than one authored list.
         */
        const toolbox = ['riptide', 'short_circuit', 'reactive_plating', 'scrubber', 'drip_feed', 'vent', 'discharge'];
        for (const id of toolbox) {
            const program = ProgramRegistry[id];
            expect(program, `${id} is not a real card`).toBeTruthy();
            for (const hookId of program.hooks ?? []) {
                for (const action of declOf(hookId)?.do ?? []) {
                    expect(action.type, `${id} generates a card`).not.toBe('GENERATE_CARD');
                }
            }
            for (const action of program.actions ?? []) {
                expect(action.type, `${id} generates a card`).not.toBe('GENERATE_CARD');
            }
        }
    });

    it('is actually READING hook declarations — it passes vacuously otherwise', () => {
        // Both tests above pass trivially if `getHook(...).data` stops resolving. This is the
        // difference between a green test and a check.
        let seen = 0;
        for (const program of Object.values(ProgramRegistry)) {
            if (program.category !== 'Daemon') continue;
            for (const hookId of program.hooks ?? []) if (declOf(hookId)?.trigger) seen += 1;
        }
        expect(seen, 'the audit read no hook declarations at all').toBeGreaterThan(8);
    });

    it('would CATCH an unguarded re-entrant daemon — the audit, audited', () => {
        // A synthetic ROOT-ROT-without-its-guard. If this ever stops being flagged, the audit has
        // stopped working and the three real guards above prove nothing.
        const unguarded: Decl = {
            trigger: 'onStatusApplied',
            when: { statusApplied: 'Poison' },
            do: [{ type: 'STATUS', status: 'Poison' }],
        };
        expect(isGuarded(unguarded, unguarded.do![0])).toBe(false);

        const guardedByDifferentStatus: Decl = {
            trigger: 'onStatusApplied',
            when: { statusApplied: 'Burn' },
            do: [{ type: 'STATUS', status: 'Sharp' }],
        };
        expect(isGuarded(guardedByDifferentStatus, guardedByDifferentStatus.do![0])).toBe(true);
    });
});

/**
 * THE MERGE OF 2026-09-24, AS A RULE — a renamed id does not come back through a union.
 *
 * `steam-prep-september` branched before 162a and still carried the pre-rename spellings of four
 * daemons: `cinder_armor_daemon`, `core_overclock_daemon`, `feedback_loop_daemon` and
 * `hoofbeat_daemon`. `lib/hooks.json` conflicted on both sides appending keys, and the thing a
 * text merge does with that — take both hunks — would have re-created all four under ids nothing
 * points at any more. They were dropped deliberately when the file was merged as JSON.
 *
 * "Deliberately" is a claim about a commit, and a commit is not a guard. This is the guard, and it
 * is written as the LAW rather than as the four ids, because the next branch to merge late will be
 * carrying a different four:
 *
 *   **No alias SOURCE may be a key in `hooks.json`.** `PROGRAM_ALIASES` exists so that an old
 *   spelling RESOLVES to the canonical card (`programAliases.ts` explains why the registry itself
 *   holds one entry per card). A firmware entry under the old spelling is the second copy that
 *   table was written to avoid — inert, since nothing declares it, and therefore silent: the
 *   engine's signature failure, where the data is fine and the wiring is missing.
 */
describe('a renamed id stays renamed', () => {
    const LIBRARY = HOOKS as unknown as Record<string, unknown>;

    it('has no hooks.json entry under any id the alias table renamed away', () => {
        const resurrected = Object.keys(PROGRAM_ALIASES).filter((oldId) => oldId in LIBRARY);
        expect(resurrected, 'a pre-rename hook key is back — check the last merge of lib/hooks.json').toEqual([]);
    });

    it('names the four the September merge would have brought back, so the count cannot drift quietly', () => {
        // The specific half of the claim above. If 162a's rename list changes, this fails and
        // somebody reads the alias table — which is the intended outcome, not a nuisance.
        const renamedDaemons = Object.keys(PROGRAM_ALIASES).filter((id) => id.endsWith('_daemon'));
        expect(renamedDaemons.sort()).toEqual([
            'cinder_armor_daemon', 'core_overclock_daemon', 'feedback_loop_daemon', 'hoofbeat_daemon',
        ]);
        // And the cards they became still have their firmware, so this is not "the hooks are gone".
        for (const oldId of renamedDaemons) {
            expect(PROGRAM_ALIASES[oldId] in LIBRARY, `${PROGRAM_ALIASES[oldId]} lost its hook entry`).toBe(true);
        }
    });
});
