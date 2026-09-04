/**
 * TICKET 138 amendment — `percentMaxHp` recoil, and the defect it replaced.
 *
 * THE DEFECT. `glass_cannon` printed "20 recoil damage", its JSON said `damageOverride: 300`,
 * `powerscale` charged it 80 power (scoring the card -2.70 against a 2.4-3.0 band, the worst row
 * in the registry), and the engine dealt **53**. Four numbers, four places, no two agreeing —
 * because `damageOverride` is read only by `effectHandlers.handleAttack`, which serves relic and
 * system HP mutations, and a CARD action goes through `AttackExecutor`, which has never looked at
 * the field. The 300 was dead data. What actually landed was the action's `power: 15` running the
 * full damage formula.
 *
 * WHY THAT MATTERED BEYOND THE ARITHMETIC. Running the formula means the recoil picked up the
 * caster's Strengthened - both the duality POWER term and skoll_v2's uncapped +15%/stack
 * SOLAR_OVERDRIVE - so the card that GRANTS Strength cost more the better the deck was working:
 * 53 HP at no stacks, 178 at eight. Henry: *"I don't want the recoil to hit harder."*
 *
 * THE FIX. A recoil is a PRICE, so it is denominated in the victim's own health pool and resolved
 * before the power path: no attacker stats, no STAB, no resistances, no duality term, no hooks.
 * A percentage also rescales itself, which is the property `damageOverride` lacked - it was one of
 * the four things ticket 131c had to fix by hand, and it is how this card broke in the first place.
 *
 * These tests are the guard, not the documentation. The first two fail if the recoil ever starts
 * scaling again; the third fails if anyone authors `damageOverride` onto a card, where it has
 * never worked.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import PROGRAMS from './data/programs.json';
import type { IBattleState, StatusEffectInstance } from './types';

const FRAME = 1200;

/** Plays one card from a skoll_v2 caster on a fixed frame and returns the HP the CASTER lost. */
function selfDamage(dataId: string, strengthStacks: number): number {
    const statusEffects: StatusEffectInstance[] = strengthStacks > 0
        ? [{ id: 's1', type: 'Strengthened', stacks: strengthStacks } as StatusEffectInstance]
        : [];
    let state: IBattleState = createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({
            id: 'p1', definitionId: 'skoll', name: 'Skoll', activeOS: 'skoll_v2',
            currentHp: FRAME, maxHp: FRAME, statusEffects,
        })],
        // A frame big enough that the enemy never dies and never ends the battle early.
        enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'huldra', name: 'Foe', currentHp: 100000, maxHp: 100000 })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
            hand: [{ id: 'h1', dataId, currentCost: 0, isPlayable: true }],
        },
    });
    const before = state.playerParty[0].currentHp;
    state = battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' },
    } as never);
    return before - state.playerParty[0].currentHp;
}

describe('ticket 138 amendment — percentMaxHp recoil is a flat percentage of the victim', () => {
    it('glass_cannon costs exactly 5% of the caster max HP', () => {
        expect(selfDamage('glass_cannon', 0)).toBe(Math.floor(FRAME * 0.05));
    });

    it('desperate_strike and dark_pact each cost exactly 3%', () => {
        expect(selfDamage('desperate_strike', 0)).toBe(Math.floor(FRAME * 0.03));
        expect(selfDamage('dark_pact', 0)).toBe(Math.floor(FRAME * 0.03));
    });

    /**
     * THE ONE THAT MATTERS. Under the old power-based recoil these three numbers were 53 / 124 /
     * 178 for glass_cannon. Identical at every stack count is the ruling.
     */
    it('does not grow with the caster Strengthened pile, at any stack count', () => {
        for (const card of ['glass_cannon', 'desperate_strike', 'dark_pact']) {
            const none = selfDamage(card, 0);
            expect(selfDamage(card, 3), `${card} at 3 Strength`).toBe(none);
            expect(selfDamage(card, 5), `${card} at 5 Strength`).toBe(none);
            expect(selfDamage(card, 8), `${card} at 8 Strength`).toBe(none);
        }
    });

    /**
     * `damageOverride` is honoured ONLY by `effectHandlers.handleAttack` (relic and system HP
     * mutations). On a card action it is silently ignored, which is how a card shipped for months
     * printing one number, storing a second and dealing a third. If a card ever carries the field
     * again, this fails and points at `percentMaxHp`.
     */
    it('no card action carries damageOverride — it has never worked there', () => {
        const offenders: string[] = [];
        for (const [id, card] of Object.entries(PROGRAMS as Record<string, { actions?: Array<Record<string, unknown>> }>)) {
            for (const action of card.actions ?? []) {
                if ('damageOverride' in action) offenders.push(id);
            }
        }
        expect(offenders, 'use percentMaxHp for card recoil').toEqual([]);
    });
});
