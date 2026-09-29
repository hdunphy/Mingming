/**
 * TICKET 167c — an upgrade never makes a card hurt its own caster MORE.
 *
 * Henry, 2026-09-28, on Undertow+: *"draw a card and no weakened."* The generator rule "+1 status
 * stack" added a stack to a debuff the card puts on the CASTER, so the upgrade was a price rise.
 * Undertow was the only one of the 98 upgrades this happened to when it was checked; the guard
 * below is what says so if a future regeneration does it to another.
 */
import { describe, it, expect } from 'vitest';

import { ProgramRegistry } from './programRegistry';
import type { ProgramData } from '../types';

const SELF_DEBUFFS = ['Weakened', 'Dazed', 'Burn', 'Poison', 'Asleep', 'Stunned'] as const;

/** Stacks of each debuff the card puts on its own caster, summed over its direct actions. */
function selfDebuffStacks(card: ProgramData): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const action of card.actions) {
        if (action.type !== 'STATUS' || action.target !== 'SELF') continue;
        const status = action.status as string;
        if (!(SELF_DEBUFFS as ReadonlyArray<string>).includes(status)) continue;
        totals[status] = (totals[status] ?? 0) + ((action.stacks as number | undefined) ?? 0);
    }
    return totals;
}

describe('167c — Undertow+', () => {
    it('is "Draw a card." with no status on the caster', () => {
        const plus = ProgramRegistry['undertow+'];
        expect(plus.description).toBe('Draw a card.');
        expect(plus.actions.filter((a) => a.type === 'STATUS')).toEqual([]);
        const draws = plus.actions.filter((a) => a.type === 'DRAW');
        expect(draws).toHaveLength(1);
        expect(draws[0].amount).toBe(1);
    });

    it('leaves the base card alone', () => {
        expect(ProgramRegistry.undertow.description).toBe('Draw a card. You gain 1 Weakened.');
    });
});

describe('167c — no upgrade applies more of a debuff to its own caster than its base does', () => {
    const plusIds = Object.keys(ProgramRegistry).filter((id) => ProgramRegistry[id].upgradeOf);

    it('covers every `+` card', () => {
        expect(plusIds.length).toBe(98);
    });

    it('holds for every `+` card', () => {
        const offenders: string[] = [];
        for (const id of plusIds) {
            const base = selfDebuffStacks(ProgramRegistry[ProgramRegistry[id].upgradeOf as string]);
            const plus = selfDebuffStacks(ProgramRegistry[id]);
            for (const status of Object.keys(plus)) {
                if (plus[status] > (base[status] ?? 0)) {
                    offenders.push(`${id}: ${status} ${base[status] ?? 0} -> ${plus[status]}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
