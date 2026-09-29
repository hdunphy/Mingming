/**
 * TICKET 167b — Acorn Toss is 5 power three times, and its upgrade is 5 power four times.
 *
 * Henry, 2026-09-28: *"5 power x 3 and upgrade to x4."* The multi-hit shape is the card: more small
 * hits, so a printed number that drifts from this is a different card. The `+`'s printed text is
 * already held to `upgrades.json` by `plusRegistry.test.ts`, so this file only pins the hits.
 */
import { describe, it, expect } from 'vitest';

import { ProgramRegistry } from './programRegistry';

function attackPowers(id: string): number[] {
    return ProgramRegistry[id].actions.filter((a) => a.type === 'ATTACK').map((a) => a.power as number);
}

describe('167b — Acorn Toss', () => {
    it('acorn_toss is three ATTACK actions of power 5', () => {
        expect(attackPowers('acorn_toss')).toEqual([5, 5, 5]);
        expect(ProgramRegistry.acorn_toss.description).toBe('5 power, three times.');
    });

    it('acorn_toss+ is four ATTACK actions of power 5', () => {
        expect(attackPowers('acorn_toss+')).toEqual([5, 5, 5, 5]);
        expect(ProgramRegistry['acorn_toss+'].description).toBe('5 power, four times.');
    });
});
