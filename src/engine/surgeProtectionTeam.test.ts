import { describe, it, expect } from 'vitest';
import { executeDraw } from './resolutionEngine';
import { ConditionValidator } from './core/ConditionValidator';
import { actionConditionsMet } from './actions/actionConditions';
import { GetProgramData } from './data/programRegistry';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import { matchupScenario } from '../debug/balance/balanceScenarios';
import type { IBattleEntity, IBattleState, ProgramAction, ProgramConstraint } from './types';

/**
 * TICKET 167e — Urðarbrunnr's refund counts the WHOLE TEAM's triggered draws.
 *
 * Henry, 2026-09-28: yes to *"make its refund count the whole team's draws."*
 *
 * The 2026-08-30 ruling ("it should be scoped to the mingming", `triggeredDraw.test.ts`) stands for
 * everything else, Ink Stream's scaler included: that ruling was about damage, which party width was
 * tripling. This row adds a NEW constraint type for the refund only, so the per-caster type is
 * untouched. The last two tests here are the ones that fail if the two get merged again.
 */

const base = (): IBattleState =>
    buildScenarioState({ ...matchupScenario({ player: 'kraken', enemy: 'fenrir', playerOS: 'kraken_v1' }), seed: 'td167' });

/** A 3v3 (width 3, asserted below) - at width 1 a per-caster and a per-side count are the same number. */
function withThree(s: IBattleState): IBattleState {
    const template = s.playerParty[0];
    return {
        ...s,
        playerParty: [0, 1, 2].map((i) => ({ ...template, id: `p${i}`, name: `P${i}` })),
    } as IBattleState;
}

const TEAM: ProgramConstraint = { type: 'SIDE_CARDS_DRAWN_TRIGGERED', target: 'SELF', value: 1 } as unknown as ProgramConstraint;
const PER_CASTER: ProgramConstraint = { type: 'CARDS_DRAWN_TRIGGERED', target: 'SELF', value: 1 } as ProgramConstraint;

const team = (s: IBattleState, caster: IBattleEntity) => ConditionValidator.evaluateCardConstraint(TEAM, caster, caster, 0, s);

describe('167e — the team refund check', () => {
    it('is measured at width 3', () => {
        expect(withThree(base()).playerParty).toHaveLength(3);
    });

    it('an ally\'s triggered draw satisfies it when the caster drew nothing itself', () => {
        const start = withThree(base());
        const s = executeDraw(start, 'PLAYER', 1, false, start.playerParty[1].id);
        expect(s.playerParty[0].nonNaturalDrawsThisTurn ?? 0).toBe(0);
        expect(team(s, s.playerParty[0])).toBe(true);
    });

    it('with no triggered draw anywhere on the side it is false', () => {
        const s = withThree(base());
        expect(team(s, s.playerParty[0])).toBe(false);
    });

    it('a NATURAL draw (the draw-phase refill) does not count for the team either', () => {
        const start = withThree(base());
        const s = executeDraw(start, 'PLAYER', 3, true, start.playerParty[1].id);
        expect(team(s, s.playerParty[0])).toBe(false);
    });

    it('an ENEMY\'s triggered draw does not count', () => {
        const start = withThree(base());
        const s = {
            ...start,
            enemyParty: start.enemyParty.map((e) => ({ ...e, nonNaturalDrawsThisTurn: 2 })),
        } as IBattleState;
        expect(team(s, s.playerParty[0])).toBe(false);
    });

    it('a fallen ally\'s draw still counts: the draw happened this turn', () => {
        const start = withThree(base());
        const drawn = executeDraw(start, 'PLAYER', 1, false, start.playerParty[2].id);
        const s = {
            ...drawn,
            playerParty: drawn.playerParty.map((e) => (e.id === 'p2' ? { ...e, currentHp: 0 } : e)),
        } as IBattleState;
        expect(team(s, s.playerParty[0])).toBe(true);
    });

    it('the enemy side is read as a side too: an enemy caster counts its teammate\'s draw', () => {
        const start = withThree(base());
        const template = start.enemyParty[0];
        const enemyParty = [
            { ...template, id: 'e0', nonNaturalDrawsThisTurn: 1 },
            { ...template, id: 'e1', nonNaturalDrawsThisTurn: 0 },
        ] as IBattleEntity[];
        const s = { ...start, enemyParty } as IBattleState;
        expect(team(s, s.enemyParty[1])).toBe(true);
    });
});

describe('167e — the card is wired to it', () => {
    const REFUND = (id: string) => GetProgramData(id).actions.find((a: ProgramAction) => a.type === 'ENERGY') as ProgramAction;

    it.each(['surge_protection', 'surge_protection+'])('%s reads the team check and says so', (id) => {
        const refund = REFUND(id);
        expect(refund.conditionals?.[0]?.id).toBe('team_card_drawn_check');
        expect(refund.conditionals![0].type).toBe('SIDE_CARDS_DRAWN_TRIGGERED');
        expect(GetProgramData(id).description).toContain('drew your team a card');
    });

    it('the refund fires off an ally\'s draw when the caster drew nothing', () => {
        const start = withThree(base());
        const s = executeDraw(start, 'PLAYER', 1, false, start.playerParty[1].id);
        const caster = s.playerParty[0];
        expect(actionConditionsMet(s, REFUND('surge_protection'), undefined, caster, caster, caster)).toBe(true);
    });

    it('and does not fire when nobody on the team drew', () => {
        const s = withThree(base());
        const caster = s.playerParty[0];
        expect(actionConditionsMet(s, REFUND('surge_protection'), undefined, caster, caster, caster)).toBe(false);
    });
});

describe('167e — everything else stays per caster', () => {
    it('an ally\'s draw does NOT satisfy the per-caster CARDS_DRAWN_TRIGGERED check (Ink Stream\'s)', () => {
        const start = withThree(base());
        const s = executeDraw(start, 'PLAYER', 2, false, start.playerParty[1].id);
        expect(ConditionValidator.evaluateCardConstraint(PER_CASTER, s.playerParty[0], s.playerParty[0], 0, s)).toBe(false);
        expect(s.playerParty[0].nonNaturalDrawsThisTurn ?? 0).toBe(0);
    });

    it('the library keeps card_drawn_check per caster next to the new team one', async () => {
        const lib = (await import('./data/lib/constraints.json')).default as Record<string, { type: string }>;
        expect(lib.card_drawn_check.type).toBe('CARDS_DRAWN_TRIGGERED');
        expect(lib.team_card_drawn_check.type).toBe('SIDE_CARDS_DRAWN_TRIGGERED');
    });
});
