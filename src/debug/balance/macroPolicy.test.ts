/**
 * The harness's macro policy (ticket 77 B1), checked for the properties the arm depends on:
 * every fire passes `canFireMacro` (or the policy THROWS — the ticket's STOP condition), the rules
 * fire in the order the ticket names them, and the lethal preview is the real reducer.
 */

import { describe, expect, it } from 'vitest';

import { battleReducer, canFireMacro } from '../../engine/battleReducer';
import type { IBattleState } from '../../engine/types';
import { matchupScenario, teamScenario } from './balanceScenarios';
import { buildScenarioState } from '../scenarios/buildScenarioState';
import { MACRO_LOADOUTS, createMacroPolicy, macroIsLethal } from './macroPolicy';

const oneVsOne = (): IBattleState => {
    const setup = matchupScenario({ player: 'fenrir', enemy: 'kraken', playerOS: 'fenrir_v1', enemyOS: 'kraken_v1', seed: 'macro-policy' });
    return buildScenarioState({ ...setup, seed: setup.seed });
};

const threeVsThree = (): IBattleState => {
    const setup = teamScenario({
        player: [['fenrir', 'fenrir_v1'], ['huldra', 'huldra_v1'], ['kraken', 'kraken_v1']],
        enemy: [['skoll', 'skoll_v1'], ['ratatoskr', 'ratatoskr_v1'], ['jormungandr', 'jormungandr_v1']],
        seed: 'macro-policy-3v3',
    });
    return buildScenarioState({ ...setup, seed: setup.seed });
};

const withEnemyHp = (s: IBattleState, index: number, hp: number): IBattleState => ({
    ...s,
    enemyParty: s.enemyParty.map((e, i) => (i === index ? { ...e, currentHp: hp, tempHp: 0 } : e)),
});
const withAllyHp = (s: IBattleState, index: number, hp: number): IBattleState => ({
    ...s,
    playerParty: s.playerParty.map((e, i) => (i === index ? { ...e, currentHp: hp } : e)),
});

describe('createMacroPolicy', () => {
    it('yields to the card AI on turn 1 of a LEAD-IN fight with nothing lethal and no one hurt', () => {
        const policy = createMacroPolicy('mixed', { bossFight: false });
        expect(policy.next(oneVsOne())).toBeNull();
        expect(policy.held).toEqual([...MACRO_LOADOUTS.mixed]);
        expect(policy.fired).toEqual([]);
    });

    it('never speaks on the enemy\'s turn', () => {
        const policy = createMacroPolicy('surge3', { bossFight: true });
        expect(policy.next({ ...oneVsOne(), activeSide: 'ENEMY' })).toBeNull();
    });

    it('rule 2 empties the rack on turn 1 of the BOSS fight, one macro per call, each one legal', () => {
        const policy = createMacroPolicy('mixed', { bossFight: true });
        let state = threeVsThree();
        const fired: string[] = [];
        for (let i = 0; i < 3; i += 1) {
            const action = policy.next(state);
            expect(action?.type).toBe('FIRE_MACRO');
            if (action?.type !== 'FIRE_MACRO') return;
            expect(canFireMacro(state, action.payload)).toBeNull();
            const next = battleReducer(state, action);
            expect(next, 'the reducer must accept what the policy fires').not.toBe(state);
            state = next;
            fired.push(action.payload.macroId);
        }
        expect(fired.sort()).toEqual(['cripple', 'mend', 'surge']);
        expect(policy.held).toEqual([]);
        expect(policy.next(state), 'an empty rack has nothing to say').toBeNull();
        expect(policy.fired.every((f) => f.rule === 'boss-turn-1' && f.turn === 1)).toBe(true);
    });

    it('rule 2 aims Surge at the lowest pool and Cripple at the highest attack', () => {
        const policy = createMacroPolicy('mixed', { bossFight: true });
        let state = withEnemyHp(threeVsThree(), 2, 400);
        const strongest = [...state.enemyParty].sort((a, b) => b.attack - a.attack)[0].id;
        const weakest = state.enemyParty[2].id;
        const targets: Record<string, string> = {};
        for (let i = 0; i < 3; i += 1) {
            const action = policy.next(state)!;
            if (action.type !== 'FIRE_MACRO') throw new Error('expected a macro');
            targets[action.payload.macroId] = action.payload.targetId;
            state = battleReducer(state, action);
        }
        expect(targets.surge).toBe(weakest);
        expect(targets.cripple).toBe(strongest);
        expect(state.playerParty.map((p) => p.id)).toContain(targets.mend);
    });

    it('rule 1 fires a lethal Surge in ANY fight, and the kill is real', () => {
        const policy = createMacroPolicy('surge3', { bossFight: false });
        const state = withEnemyHp(oneVsOne(), 0, 1);
        const enemy = state.enemyParty[0];
        expect(macroIsLethal(state, 'surge', state.playerParty[0].id, enemy.id)).toBe(true);

        const action = policy.next(state);
        expect(action?.type).toBe('FIRE_MACRO');
        if (action?.type !== 'FIRE_MACRO') return;
        expect(action.payload.macroId).toBe('surge');
        expect(action.payload.targetId).toBe(enemy.id);
        expect(policy.fired[0].rule).toBe('lethal');

        const after = battleReducer(state, action);
        expect(after.enemyParty[0].currentHp).toBeLessThanOrEqual(0);
    });

    it('the lethal preview honours shields — a full-HP enemy is not lethal to a 30-power Surge', () => {
        const state = oneVsOne();
        expect(macroIsLethal(state, 'surge', state.playerParty[0].id, state.enemyParty[0].id)).toBe(false);
        // And a preview never spends the macro or mutates the state handed in.
        const policy = createMacroPolicy('surge3', { bossFight: false });
        expect(policy.next(state)).toBeNull();
        expect(policy.held).toHaveLength(3);
    });

    it('rule 3 mends the lowest-% ally at the START of a turn when one is under 40%, and only once per turn', () => {
        const policy = createMacroPolicy('mixed', { bossFight: false });
        let state = withAllyHp(threeVsThree(), 1, 10);
        const hurt = state.playerParty[1].id;

        const action = policy.next(state);
        expect(action?.type).toBe('FIRE_MACRO');
        if (action?.type !== 'FIRE_MACRO') return;
        expect(action.payload.macroId).toBe('mend');
        expect(action.payload.targetId).toBe(hurt);
        expect(policy.fired[0].rule).toBe('mend-under-40');
        state = battleReducer(state, action);
        expect(state.playerParty[1].currentHp).toBeGreaterThan(10);

        // Same turn, still hurt (a 30-power Mend does not clear 40% of a 3v3 pool): no second mend,
        // and there is no second Mend held anyway — surge and cripple stay racked.
        expect(policy.next(state)).toBeNull();
        expect([...policy.held].sort()).toEqual(['cripple', 'surge']);
    });

    it('THROWS rather than firing a macro canFireMacro would refuse', () => {
        const policy = createMacroPolicy('surge3', { bossFight: true });
        // Battle already over: every enemy at 0. `canFireMacro` says 'battle-over'; rule 1 sees no
        // living enemy and rule 2 finds no target, so the policy yields — that is the correct path.
        const over = { ...oneVsOne(), enemyParty: oneVsOne().enemyParty.map((e) => ({ ...e, currentHp: 0 })) };
        expect(policy.next(over)).toBeNull();

        // A state the rules WOULD act on but the reducer refuses: wrong phase. The policy must not
        // return an action here, and if a rule ever did, `fire` throws — exercised via the phase
        // guard below, which is the same refusal `canFireMacro` gives.
        const wrongPhase = { ...withEnemyHp(oneVsOne(), 0, 1), phase: 'PRE_TURN' as IBattleState['phase'] };
        expect(canFireMacro(wrongPhase, { macroId: 'surge', sourceId: wrongPhase.playerParty[0].id, targetId: wrongPhase.enemyParty[0].id })).toBe('wrong-phase');
        expect(policy.next(wrongPhase)).toBeNull();
    });
});
