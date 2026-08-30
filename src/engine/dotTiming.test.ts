/**
 * TICKET 126: Burn, Poison and Regen tick at the START of their owner's turn.
 *
 * Henry, ticket-118 playtest, two complaints that turn out to be one timing:
 *   "Regen triggers at the end of the turn. So I just put i on there it triggered for no gain."
 *   "it felt bad for huldra to apply a huge stack of poison only for sleipnir to finish off one of
 *    our allies and then die at the end of our turn."
 *
 * Ticking on the way OUT of a turn heals before the enemy has hit you, and lets a poisoned attacker
 * take the turn its poison has already killed it for. Ticking on the way IN fixes both. It is a real
 * buff to damage-over-time, not a cosmetic reordering: a DoT now denies its victim a turn.
 *
 * The last test is the structural one. Burn and Poison can KILL, so the start-of-turn pass needs the
 * same defeat detection, HP-threshold crossings and DoT damage hook the end-of-turn pass has - which
 * is why `tickStatuses` is shared rather than copied.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { getStatusBehavior } from './StatusBehaviors';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleState, IBattleEntity, StatusEffectInstance } from './types';

const eff = (type: string, stacks: number): StatusEffectInstance =>
    ({ id: `s-${type}`, type, stacks } as StatusEffectInstance);

/** PLAYER is active; the ENEMY carries `statuses`. END_TURN hands over and runs the enemy's tick. */
function enemyCarrying(statuses: StatusEffectInstance[], hp?: number): IBattleState {
    const base = createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', definitionId: 'huldra', name: 'Hero', cardDraw: 3 })],
        enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'kraken', name: 'Foe', statusEffects: statuses })],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
    });
    return hp === undefined ? base
        : { ...base, enemyParty: base.enemyParty.map(e => ({ ...e, currentHp: hp })) };
}

const endTurn = (s: IBattleState): IBattleState => battleReducer(s, { type: 'END_TURN' } as never);
const foe = (s: IBattleState): IBattleEntity => s.enemyParty[0];

describe('ticket 126 - Burn, Poison and Regen tick at turn START', () => {
    it('a poisoned unit takes its tick BEFORE it acts, not after', () => {
        const before = enemyCarrying([eff('Poison', 4)]);
        const hp0 = foe(before).currentHp;

        // Player ends turn -> the enemy's turn begins -> their Poison ticks immediately.
        const after = endTurn(before);

        expect(foe(after).currentHp).toBeLessThan(hp0);
        expect(after.activeSide).toBe('ENEMY');
    });

    it('does NOT tick on the way out of its owner\'s own turn', () => {
        // Same board, but the ENEMY is already active, so ending their turn must not tick them -
        // their next tick is at the start of their NEXT turn.
        const base = enemyCarrying([eff('Poison', 4)]);
        const enemyActive: IBattleState = { ...base, activeSide: 'ENEMY' };
        const hp0 = foe(enemyActive).currentHp;

        const after = endTurn(enemyActive);
        expect(foe(after).currentHp).toBe(hp0);
    });

    it('Regen heals on the way in, and spends exactly one stack', () => {
        const base = enemyCarrying([eff('Regen', 3)]);
        const wounded: IBattleState = {
            ...base,
            enemyParty: base.enemyParty.map(e => ({ ...e, currentHp: Math.floor(e.maxHp / 2) })),
        };
        const hp0 = foe(wounded).currentHp;

        const after = endTurn(wounded);
        expect(foe(after).currentHp).toBeGreaterThan(hp0);
        expect(foe(after).statusEffects.find(s => s.type === 'Regen')?.stacks).toBe(2);
    });

    it('a DoT can now KILL its victim before it acts - and logs one defeat, not two', () => {
        const dying = enemyCarrying([eff('Burn', 2), eff('Poison', 2)], 1);
        const after = endTurn(dying);

        expect(foe(after).currentHp).toBe(0);
        expect(after.logs.filter(l => l.includes('DEFEATED BY STATUS'))).toHaveLength(1);
    });

    it('carries non-matching statuses through untouched rather than dropping them', () => {
        // The first version of this change `continue`d without re-pushing, which would have
        // deleted every end-timed status from the rebuilt list.
        const before = enemyCarrying([eff('Poison', 3), eff('Weakened', 2), eff('Sharp', 1)]);
        const after = endTurn(before);

        const types = foe(after).statusEffects.map(s => s.type).sort();
        expect(types).toContain('Weakened');
        expect(types).toContain('Sharp');
    });

    it('exactly Burn, Poison and Regen tick at start - nothing else moved', () => {
        const start = (['Burn', 'Poison', 'Regen', 'Weakened', 'Sharp', 'Strengthened', 'Dazed',
            'Asleep', 'Stunned', 'Energized', 'StableOS', 'BarkShield'] as const)
            .filter(t => getStatusBehavior(t as never)?.ticksAt === 'OWNER_TURN_START');
        expect(start.sort()).toEqual(['Burn', 'Poison', 'Regen']);
    });
});
