/**
 * TICKET 194b — Ragnarok Edge has no cap; Bloodlust and Last Rites keep theirs.
 *
 * Henry, 2026-10-04: "1.5 power, but lets remove the cap from the base and the upgrade." The cap
 * is a shared constant (`MISSING_HP_PCT_CAP`), so the removal is a per-action `scalingCap: null`
 * and these tests pin both halves: the two Edges read the whole missing percent, everything
 * else still stops at 50.
 */

import { describe, it, expect } from 'vitest';
import { getEffectiveAttackPower } from './actions/ActionExecutors';
import { GetProgramData } from './data/programRegistry';
import { createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { AttackActionData } from './types';

const attackOf = (id: string): AttackActionData =>
    GetProgramData(id).actions!.find((a) => a.type === 'ATTACK') as AttackActionData;

/** A 1,000 HP unit at `missingPct` percent missing. */
const unitMissing = (missingPct: number) =>
    createSparseEntity({ maxHp: 1000, currentHp: 1000 - Math.round(missingPct * 10) });

describe('194b — Ragnarok Edge is uncapped', () => {
    it('ragnarok_edge at 80% missing: 20 + 80 = 100 power', () => {
        expect(getEffectiveAttackPower(unitMissing(80), attackOf('ragnarok_edge'))).toBe(100);
    });

    it('ragnarok_edge+ at 80% missing: 30 + 120 = 150 power (1.5 a percent)', () => {
        expect(getEffectiveAttackPower(unitMissing(80), attackOf('ragnarok_edge+'))).toBe(150);
    });

    it('still reads 50% exactly as before, so the old numbers hold where the cap used to bite', () => {
        expect(getEffectiveAttackPower(unitMissing(50), attackOf('ragnarok_edge'))).toBe(70);
        expect(getEffectiveAttackPower(unitMissing(50), attackOf('ragnarok_edge+'))).toBe(105);
    });

    it('a fractional missing percent gives whole power', () => {
        // 1,000 max, 333 missing -> 33.3%: 1.5 x 33.3 = 49.95 -> 49.
        const unit = createSparseEntity({ maxHp: 1000, currentHp: 667 });
        const power = getEffectiveAttackPower(unit, attackOf('ragnarok_edge+'));
        expect(Number.isInteger(power)).toBe(true);
        expect(power).toBe(30 + 49);
    });

    it('the description no longer promises a cap, and the + names 1.5', () => {
        expect(GetProgramData('ragnarok_edge').description).toBe('20 power. +1 power per 1% of your max HP missing.');
        expect(GetProgramData('ragnarok_edge+').description).toBe('30 power. +1.5 power per 1% of your max HP missing.');
    });
});

describe('194b — the other MISSING_HP cards keep the 50% cap', () => {
    it('bloodlust at 80% missing reads 50%: 13 + 0.35 x 50', () => {
        expect(getEffectiveAttackPower(unitMissing(80), attackOf('bloodlust'))).toBeCloseTo(13 + 0.35 * 50, 6);
    });

    it('last_rites at 80% missing equals its value at 50%', () => {
        const at80 = getEffectiveAttackPower(unitMissing(80), attackOf('last_rites'));
        const at50 = getEffectiveAttackPower(unitMissing(50), attackOf('last_rites'));
        expect(at80).toBe(at50);
    });
});
