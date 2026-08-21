import { describe, it, expect } from 'vitest';

import { ConditionValidator } from './core/ConditionValidator';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import { getEffectiveAttackPower } from './actions/ActionExecutors';
import type { IBattleState, IBattleEntity, AttackActionData, StatusType } from './types';
import type { HookContext } from './core/HookTypes';

/**
 * TICKET 107 - draugr's second lever.
 *
 * SHIPPED: `rimebreaker` reads EVERY status on the target instead of only debuffs. Measured
 * reality of the debuff-only version was 0.70 distinct debuffs (ticket 66's census) and one or two
 * against huldra, so the card read ~4 damage in Henry's hands. Reading everything inverts the
 * tug-of-war: huldra's Sharp pile - her win condition - becomes draugr's ammunition.
 *
 * HELD, with data: the ticket's second change, a Poison rider on GRAVE_CHILL ("statuses draugr
 * applies to an enemy also apply 1 Poison"). Measured on its own it takes THE cell to 83-87%
 * against a 15-35% target and her field to 82% with sixteen blowout matchups. See the report.
 *
 * `statusAppliedNotIn` ships anyway, and is pinned below rather than left as dead schema. It is the
 * anti-recursion guard the rider needs - a hook that applies a status in response to a status
 * application feeds itself without it, and measurably: with the guard off, one two-status card
 * seeded TWENTY-FOUR Poison instead of two, stopped only by the engine's resolution-depth backstop.
 * A wrong number that still runs is worse than a hang.
 */

const applyStatus = (e: IBattleEntity, type: StatusType, stacks: number): IBattleEntity => ({
    ...e,
    statusEffects: [
        ...e.statusEffects.filter(s => s.type !== type),
        { type, stacks, duration: -1 } as unknown as IBattleEntity['statusEffects'][number],
    ],
});

function draugrVs(enemy: string, enemyOS: string) {
    const setup = matchupScenario({
        player: 'draugr', enemy, playerOS: 'draugr_v2', enemyOS, seed: 'seep',
    });
    const st = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    return { st, me: st.playerParty[0], them: st.enemyParty[0] };
}

describe('ticket 107: rimebreaker reads every status, not just debuffs', () => {
    const RIMEBREAKER = {
        type: 'ATTACK', power: 20, target: 'TARGET', scaling: 'ANY_STATUS',
    } as unknown as AttackActionData;

    it('counts a BUFF on the target - the huldra inversion', () => {
        const { me, them } = draugrVs('huldra', 'huldra_v1');
        // Sharp is huldra's win condition. Under the old debuff-only reading it was invisible to
        // this card; now it is ammunition.
        expect(getEffectiveAttackPower(me, RIMEBREAKER, applyStatus(them, 'Sharp' as StatusType, 6))).toBe(20);
    });

    it('counts DISTINCT statuses, not stacks', () => {
        const { me, them } = draugrVs('huldra', 'huldra_v1');
        const loaded = applyStatus(applyStatus(applyStatus(them,
            'Sharp' as StatusType, 6), 'Weakened' as StatusType, 4), 'Poison' as StatusType, 9);
        // Three different statuses carrying nineteen stacks between them: 3 x 20, not 19 x 20.
        expect(getEffectiveAttackPower(me, RIMEBREAKER, loaded)).toBe(60);
    });

    it('reads zero on a clean board - the card is tech, not the plan', () => {
        const { me, them } = draugrVs('control', 'control_v1');
        expect(getEffectiveAttackPower(me, RIMEBREAKER, { ...them, statusEffects: [] })).toBe(0);
    });
});

describe('ticket 107: statusAppliedNotIn, the anti-recursion guard', () => {
    // Pinned directly on the validator rather than through a live hook, because the hook it was
    // built for is HELD. Without this the condition would be exactly the `isAttack` trap ticket 103
    // found: declared in the schema, read by nothing, and silently a no-op for whoever tries it.
    const owner = { id: 'o' } as unknown as IBattleEntity;
    // A minimal context: the validator reads `state.playerParty` for the source/target axis, and
    // this condition uses neither, so an empty party is enough and keeps the pin on ONE rule.
    const ctx = (statusApplied?: string) => ({
        statusApplied, state: { playerParty: [], enemyParty: [] },
    } as unknown as HookContext);
    const check = (c: unknown, statusApplied?: string) =>
        ConditionValidator.evaluateHookCondition(c as never, ctx(statusApplied), owner);

    it('blocks the named status', () => {
        expect(check({ statusAppliedNotIn: ['Poison'] }, 'Poison')).toBe(false);
    });

    it('passes everything else', () => {
        for (const s of ['Weakened', 'Dazed', 'Burn', 'Stunned']) {
            expect(check({ statusAppliedNotIn: ['Poison'] }, s)).toBe(true);
        }
    });

    it('is inert when no status is in context, rather than blocking', () => {
        expect(check({ statusAppliedNotIn: ['Poison'] })).toBe(true);
    });
});
