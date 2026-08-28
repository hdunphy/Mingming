/**
 * TICKET 125: the hover preview shows what a card will do to the target's STATUSES.
 *
 * Henry, ticket-118 playtest: *"Hexbloom has no indication what it will do. There should be some
 * preview."* `hexbloom` applies Poison scaled by the target's Weakened and deals no direct HP
 * damage, so it failed both of `computeDamagePreview`'s old gates - it has no ATTACK action, and it
 * costs the target no HP - and returned the zero preview.
 *
 * The status delta is DIFFED out of the same simulated play that produces the damage number, so it
 * covers every status card rather than hexbloom specifically, and there is no second implementation
 * to drift from (the ticket-104 discipline).
 */

import { describe, it, expect } from 'vitest';
import { computeDamagePreview } from './damagePreview';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity, StatusEffectInstance } from '../../engine/types';

const status = (type: string, stacks: number): StatusEffectInstance =>
    ({ id: `s-${type}`, type, stacks } as StatusEffectInstance);

const inHand = (dataId: string): ProgramEntity =>
    ({ id: 'c1', dataId, currentCost: 0, isPlayable: true } as ProgramEntity);

function stateWith(dataId: string, targetStatuses: StatusEffectInstance[]): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', definitionId: 'huldra', name: 'Huldra', cardDraw: 3 })],
        enemyParty: [createSparseEntity({
            id: 'e1', definitionId: 'kraken', name: 'Target', statusEffects: targetStatuses,
        })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [],
            hand: [inHand(dataId)], discard: [], exhaust: [],
        },
    });
}

const previewOf = (dataId: string, statuses: StatusEffectInstance[]) =>
    computeDamagePreview(stateWith(dataId, statuses), 'p1', 'c1', 'e1');

describe('ticket 125 - status changes are previewed', () => {
    it('hexbloom previews the Poison it will apply, scaled by the target\'s Weakened', () => {
        const preview = previewOf('hexbloom', [status('Weakened', 3)]);

        const poison = preview.statusChanges.find(c => c.status === 'Poison');
        expect(poison, 'hexbloom should preview a Poison application').toBeTruthy();
        expect(poison!.delta).toBeGreaterThan(0);

        // It scales off the pile, so a bigger pile must preview a bigger number - that is the
        // thing the card gave no indication of.
        const bigger = previewOf('hexbloom', [status('Weakened', 6)]);
        const biggerPoison = bigger.statusChanges.find(c => c.status === 'Poison');
        expect(biggerPoison!.delta).toBeGreaterThan(poison!.delta);
    });

    it('hexbloom previews nothing on a clean board, rather than a misleading number', () => {
        // No Weakened means no Poison: the card is a payoff with nothing to cash.
        const preview = previewOf('hexbloom', []);
        expect(preview.statusChanges.find(c => c.status === 'Poison')).toBeUndefined();
    });

    it('an attack card still previews its damage AND any status it applies', () => {
        // `killing_frost` is 13 power plus 2 Weakened and 2 Dazed - the preview must not have
        // become status-only.
        const preview = previewOf('killing_frost', []);
        expect(preview.damage).toBeGreaterThan(0);
        expect(preview.statusChanges.map(c => c.status).sort()).toEqual(['Dazed', 'Weakened']);
    });

    it('reports a status being REMOVED as a negative delta', () => {
        // TICKET 124 made rimebreaker pay a stack of everything it counts, so its preview should
        // show the cost as well as the damage.
        const preview = previewOf('rimebreaker', [status('Weakened', 2), status('Sharp', 2)]);
        expect(preview.damage).toBeGreaterThan(0);
        for (const s of ['Weakened', 'Sharp']) {
            expect(preview.statusChanges.find(c => c.status === s)?.delta, s).toBe(-1);
        }
    });

    it('a card that does nothing to this target still previews nothing', () => {
        const preview = previewOf('iron_bark', []);   // a SELF buff
        expect(preview.damage).toBe(0);
        expect(preview.statusChanges).toEqual([]);
    });
});
