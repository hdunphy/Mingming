/**
 * THE ONE TARGETING PREDICATE — ticket 22.
 *
 * `MingmingUnit`, `BattleStage` and `BattleArena`'s drop handler all ask this module the same
 * question, and the reason it is a module at all is that three components each re-implementing a
 * rule is three chances for one of them to disagree with the reducer. This file is the seam where
 * that agreement is actually checked, and it matters most for the case the surfaces cannot test:
 * `BattleArena`'s Enter-to-cast path runs through `targetVerdict` too, and `renderToStaticMarkup`
 * runs no effects, so a keydown cannot be exercised in this repo's test shape. What CAN be pinned is
 * that the predicate the keyboard gates on is the identical one the pointer gates on.
 *
 * The refusals are asserted as SENTENCES, not booleans. That is the ticket's clause, borrowed from
 * 13/14/20: an invalid target must say why rather than being inert.
 */

import { describe, expect, it } from 'vitest';

import { describeLegalTargets, isValidCardTarget, legalSides, targetVerdict } from './targeting';
import { GetProgramData } from '../../engine/data/programRegistry';
import type { Element, IBattleEntity, ProgramData } from '../../engine/types';

const unit = (id: string, over: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id,
    name: id.toUpperCase(),
    definitionId: 'test_def',
    blueprintsCollected: 0,
    attackIV: 0, defenseIV: 0, hpIV: 0,
    maxHp: 100, currentHp: 100,
    cardDraw: 3, maxEnergy: 3, currentEnergy: 3,
    attack: 45, defense: 30, speed: 10,
    primaryElement: 'None' as Element, secondaryElement: 'None' as Element,
    tempHp: 0, statusEffects: [], daemons: [], hooks: [],
    ...over,
} as IBattleEntity);

const CASTER = unit('caster');
const ALLY = unit('ally');
const FOE = unit('foe');

/** `fire_punch_v2`: `target: 'Single'`, one ATTACK, no HEAL/STATUS — the pure enemy-only shape. */
const ENEMY_ONLY = GetProgramData('fire_punch_v2');
/** `all_in`: `target: 'Self'` — the pure ally-only shape. */
const SELF_ONLY = GetProgramData('all_in');

describe('the predicate itself is unchanged from the one BattleArena has always dropped against', () => {
    it('an enemy-facing Single card takes enemies and refuses allies', () => {
        expect(isValidCardTarget(ENEMY_ONLY, true)).toBe(true);
        expect(isValidCardTarget(ENEMY_ONLY, false)).toBe(false);
    });

    it('a Self card takes allies and refuses enemies', () => {
        expect(isValidCardTarget(SELF_ONLY, false)).toBe(true);
        expect(isValidCardTarget(SELF_ONLY, true)).toBe(false);
    });

    it('the HEAL/STATUS carve-out still opens an ally-side target on a Single card', () => {
        // Preserved verbatim rather than tidied. A silent rules change smuggled in under a UI ticket
        // is how a fight stops matching its tests.
        const healingSingle = {
            ...ENEMY_ONLY,
            actions: [{ type: 'HEAL', power: 10, target: 'TARGET' }],
        } as unknown as ProgramData;
        expect(isValidCardTarget(healingSingle, false)).toBe(true);
        expect(legalSides(healingSingle)).toEqual({ enemies: true, allies: true });
    });

    it('Side and All reach both sides', () => {
        const everywhere = { ...ENEMY_ONLY, target: 'All' } as ProgramData;
        expect(legalSides(everywhere)).toEqual({ enemies: true, allies: true });
    });
});

describe('the legend says where a card may land, in words rather than in schema', () => {
    it('names the reach for each shape', () => {
        expect(describeLegalTargets(ENEMY_ONLY)).toBe('ONE ENEMY');
        expect(describeLegalTargets(SELF_ONLY)).toBe('SELF');
        expect(describeLegalTargets({ ...ENEMY_ONLY, target: 'All' } as ProgramData)).toBe('ANY LIVING UNIT');
    });

    it('is derived from the predicate, so it can never promise a target the game refuses', () => {
        for (const data of [ENEMY_ONLY, SELF_ONLY]) {
            const phrase = describeLegalTargets(data);
            const { enemies, allies } = legalSides(data);
            expect(phrase === 'NO LEGAL TARGET').toBe(!enemies && !allies);
        }
    });
});

describe('every refusal is a sentence the player can act on', () => {
    it('accepts a legal target with nothing to explain', () => {
        expect(targetVerdict(ENEMY_ONLY, FOE, true, CASTER)).toEqual({ ok: true, reason: null });
    });

    it('names the card when the card is the problem', () => {
        expect(targetVerdict(ENEMY_ONLY, ALLY, false, CASTER).reason).toContain('only hits enemies');
        expect(targetVerdict(SELF_ONLY, FOE, true, CASTER).reason).toContain('only lands on its caster');
    });

    it('names the DEAD unit before anything else — it is never a target for anything', () => {
        const corpse = unit('corpse', { currentHp: 0 });
        const verdict = targetVerdict(ENEMY_ONLY, corpse, true, CASTER);
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toContain('CORPSE');
        expect(verdict.reason).toContain('cannot be targeted');
    });

    it('blames the missing caster rather than the target, because that is what the player can fix', () => {
        // With nobody selected every card is illegal, so a per-card refusal would be six identical
        // sentences saying nothing. This one names the actual obstacle and the keys that clear it.
        const verdict = targetVerdict(ENEMY_ONLY, FOE, true, null);
        expect(verdict.ok).toBe(false);
        expect(verdict.reason).toContain('Pick a living caster first');
        expect(verdict.reason).toContain('W, E or R');
    });

    it('treats a downed caster as no caster at all', () => {
        expect(targetVerdict(ENEMY_ONLY, FOE, true, unit('c', { currentHp: 0 })).ok).toBe(false);
    });

    it('has nothing to say when no card is selected', () => {
        // Marking six units before the player has picked a card is chrome, not an affordance.
        expect(targetVerdict(null, FOE, true, CASTER)).toEqual({ ok: true, reason: null });
    });
});
