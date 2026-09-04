/**
 * EVERY `onCardDraw` HOOK STATES WHETHER THE REFILL COUNTS.
 *
 * The 2026-08-30 playtest found `daemon_draw_damage_proc` firing on the draw phase, and the reason
 * it could is that omitting `isNaturalDraw` is indistinguishable from meaning to include the
 * refill. The three hooks that existed all wanted `false`; the one that forgot to say so was worth
 * 15-25 free damage a turn.
 *
 * So the omission is banned rather than the value fixed. A new draw hook must decide, in its data,
 * which draws it pays on - and if a future hook genuinely wants to count the refill, it says
 * `isNaturalDraw: true` and this test passes on the strength of having been thought about.
 */

import { describe, it, expect } from 'vitest';
import HOOKS from './lib/hooks.json';

interface RawHook { id: string; trigger?: string; when?: Record<string, unknown> }

describe('onCardDraw hooks', () => {
    it('every one of them declares isNaturalDraw', () => {
        const undeclared: string[] = [];
        for (const entry of Object.values(HOOKS as Record<string, { hooks?: RawHook[] }>)) {
            for (const hook of entry.hooks ?? []) {
                if (hook.trigger !== 'onCardDraw') continue;
                if (hook.when?.isNaturalDraw === undefined) undeclared.push(hook.id);
            }
        }
        expect(undeclared, `onCardDraw hooks that do not say which draws they pay on: ${undeclared.join(', ')}`).toEqual([]);
    });
});
