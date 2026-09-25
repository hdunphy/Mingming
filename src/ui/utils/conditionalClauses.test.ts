/**
 * Every conditional in the registry has to land on words the player can see, or it never lights.
 *
 * The descriptions are authored prose, so the clause match is a heuristic — and this suite is what
 * makes it safe: it walks all 366 cards and fails on the first rider the rules cannot place. A new
 * card with an unusual sentence is a red test here, not a card that silently never turns green.
 */

import { describe, expect, it } from 'vitest';

import { GetProgramData, ProgramRegistry } from '../../engine/data/programRegistry';
import { clauseForEachConditional, litClauses, splitClauses } from './conditionalClauses';
import type { ConditionalReading } from './cardConditionals';

const ALL_IDS = Object.keys(ProgramRegistry as Record<string, unknown>);
const CONDITIONAL_IDS = ALL_IDS.filter((id) =>
    (GetProgramData(id).actions ?? []).some((a) => (a.conditionals ?? []).length > 0));

const clauseText = (id: string, actionIndex: number) => {
    const data = GetProgramData(id);
    const hit = clauseForEachConditional(data).find((c) => c.actionIndex === actionIndex);
    return hit?.clause ? (data.description ?? '').slice(hit.clause.start, hit.clause.end) : null;
};

describe('splitClauses', () => {
    it('cuts at sentences and at semicolons, never inside a decimal', () => {
        const text = '15 power. +15 power above half HP; otherwise heal with 1.5 power.';
        expect(splitClauses(text).map((r) => text.slice(r.start, r.end))).toEqual([
            '15 power.', '+15 power above half HP;', 'otherwise heal with 1.5 power.',
        ]);
    });
});

describe('every registry conditional maps to a clause', () => {
    it('finds the conditional cards at all (the walk is not vacuous)', () => {
        expect(CONDITIONAL_IDS.length).toBeGreaterThanOrEqual(30);
    });

    it.each(CONDITIONAL_IDS)('%s', (id) => {
        const unplaced = clauseForEachConditional(GetProgramData(id)).filter((c) => c.clause === null);
        expect(unplaced, `${id}: "${GetProgramData(id).description}"`).toEqual([]);
    });

    it('has no AoE card with a TARGET rider — the hand answers for one target (see cardConditionals)', () => {
        const aoe = CONDITIONAL_IDS.filter((id) => {
            const data = GetProgramData(id);
            const aimsWide = data.target === 'Side' || data.target === 'All';
            return aimsWide && (data.actions ?? []).some((a) => (a.conditionals ?? []).some((c) => c.target === 'TARGET'));
        });
        expect(aoe).toEqual([]);
    });
});

describe('the clause is the rider, not the whole card', () => {
    it('pressure_point lights its draw clause, not its damage', () => {
        expect(clauseText('pressure_point', 1)).toBe('If the target is Dazed, draw 1.');
    });

    it('either/or cards put each branch on its own clause', () => {
        expect(clauseText('war_pact', 0)).toBe('Above half HP: gain 2 Strength and 2 Dazed.');
        expect(clauseText('war_pact', 2)).toBe('Below half: heal with 15 power.');
        expect(clauseText('battle_rhythm', 2)).toBe('Otherwise gain 2 Sharp.');
        expect(clauseText('equilibrium', 1)).toBe('Else heal with 40 power.');
    });

    it('lights a shared clause only when every rider on it holds', () => {
        const data = GetProgramData('war_pact');
        const reading = (actionIndex: number, met: boolean | null): ConditionalReading =>
            ({ actionIndex, constraints: data.actions[actionIndex].conditionals ?? [], met });
        const text = data.description ?? '';
        const lit = (rs: ConditionalReading[]) => litClauses(data, rs).map((r) => text.slice(r.start, r.end));

        expect(lit([reading(0, true), reading(1, true), reading(2, false)])).toEqual(['Above half HP: gain 2 Strength and 2 Dazed.']);
        expect(lit([reading(0, true), reading(1, false), reading(2, false)])).toEqual([]);
        // Unknown is not true.
        expect(lit([reading(0, null), reading(1, null), reading(2, null)])).toEqual([]);
    });
});
