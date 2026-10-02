/**
 * The hand's conditional read (Henry, 2026-09-25: *"an indicator if a conditional is true"*).
 *
 * Each case is a card whose rider the engine has got wrong before, asked the way the reducer asks
 * it: `pressure_point` reads the TARGET on a SELF action, `riptide_run` counts the card itself,
 * `war_pact` is an either/or where exactly one branch holds.
 */

import { describe, expect, it } from 'vitest';

import type { Element, IBattleEntity, IBattleState, StatusType } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';
import { describeConditional, readCardConditionals } from './cardConditionals';

function unit(id: string, over: Partial<IBattleEntity> = {}): IBattleEntity {
    return {
        id, name: id.toUpperCase(), definitionId: 'test_def', blueprintsCollected: 0,
        attackIV: 0, defenseIV: 0, hpIV: 0,
        maxHp: 200, currentHp: 200, cardDraw: 3, maxEnergy: 3, currentEnergy: 3,
        attack: 45, defense: 30, speed: 10,
        primaryElement: 'None' as Element, secondaryElement: 'None' as Element,
        tempHp: 0, statusEffects: [], daemons: [], hooks: [], playsThisTurn: 0,
        ...over,
    } as IBattleEntity;
}

const withStatus = (type: StatusType, stacks = 1) => [{ id: type, type, stacks }];

function state(player: IBattleEntity, enemy: IBattleEntity): IBattleState {
    return {
        playerParty: [player], enemyParty: [enemy], cardsDrawnThisTurn: 0, cardsPlayedThisTurn: 0, counters: {},
    } as unknown as IBattleState;
}

describe('readCardConditionals', () => {
    const card = GetProgramData('pressure_point');

    it('reads a TARGET rider on the TARGET even though the draw is a SELF action', () => {
        const caster = unit('me');
        const dazed = unit('foe', { statusEffects: withStatus('Dazed') });
        const [r] = readCardConditionals(state(caster, dazed), caster, dazed, card);
        expect(r.met).toBe(true);

        const clean = unit('foe');
        expect(readCardConditionals(state(caster, clean), caster, clean, card)[0].met).toBe(false);

        // The caster being Dazed is not the question — the bug the reducer fixed, not repeated here.
        const dazedCaster = unit('me', { statusEffects: withStatus('Dazed') });
        expect(readCardConditionals(state(dazedCaster, clean), dazedCaster, clean, card)[0].met).toBe(false);
    });

    it('says null, not false, when there is no caster or nobody to aim at', () => {
        const foe = unit('foe', { statusEffects: withStatus('Dazed') });
        expect(readCardConditionals(state(unit('me'), foe), null, foe, card)[0].met).toBeNull();
        expect(readCardConditionals(state(unit('me'), foe), unit('me'), null, card)[0].met).toBeNull();
    });

    it('counts THIS card as played for a CARDS_PLAYED rider, as the reducer does', () => {
        const riptide = GetProgramData('riptide_run');
        const foe = unit('foe');
        // Two played already: this is the third — the refund fires.
        const twoIn = unit('me', { playsThisTurn: 2 });
        expect(readCardConditionals(state(twoIn, foe), twoIn, foe, riptide)[0].met).toBe(true);
        const oneIn = unit('me', { playsThisTurn: 1 });
        expect(readCardConditionals(state(oneIn, foe), oneIn, foe, riptide)[0].met).toBe(false);
    });

    it('lights exactly one branch of an either/or', () => {
        const pact = GetProgramData('war_pact');
        const foe = unit('foe');
        const healthy = unit('me', { currentHp: 180 });
        const hurt = unit('me', { currentHp: 60 });
        const read = (c: IBattleEntity) => readCardConditionals(state(c, foe), c, foe, pact).map((r) => r.met);
        // Strength, Dazed (both above half), heal (below half).
        expect(read(healthy)).toEqual([true, true, false]);
        expect(read(hurt)).toEqual([false, false, true]);
    });

    it('is empty for a card with no riders', () => {
        const foe = unit('foe');
        expect(readCardConditionals(state(unit('me'), foe), unit('me'), foe, GetProgramData('fire_punch_v2'))).toEqual([]);
    });
});

describe('describeConditional', () => {
    it('says the rider in plain words, with the engine\'s own threshold', () => {
        expect(describeConditional({ type: 'HAS_STATUS', target: 'TARGET', value: 'Dazed' })).toBe('if the target has Dazed');
        expect(describeConditional({ type: 'HEALTH_THRESHOLD', target: 'SELF', value: 'LT:51' })).toBe('if the caster is below 51% HP');
        expect(describeConditional({ type: 'CARDS_PLAYED', target: 'SELF', value: 3 })).toBe('if this is card 3+ the caster played this turn');
    });
});
