// @vitest-environment jsdom
/**
 * Ticket 165b — Drag release deselects, and unit click is not a drop.
 *
 * Henry, 2026-09-26: *"When I drag a card releasing it should deselect it.
 * Too often its selected then I go to change my active mingming then attack my ally."*
 */
import { describe, expect, it } from 'vitest';
import BattleArena from './BattleArena';
import { makeStore, mount, fire, flush } from '../../testing/interaction';
import { selectSource, setBattleState } from '../store/battleSlice';
import { createBattleState, type IBattleSetup } from '../../engine/data/battleFactories';
import type { IBattleState, ProgramEntity } from '../../engine/types';

function makeBattle(): IBattleState {
    const setup: IBattleSetup = {
        party: [
            { id: 'p1', definitionId: 'fenrir', blueprintsCollected: 0, hpIV: 15, attackIV: 15, defenseIV: 15 },
            { id: 'p2', definitionId: 'skoll', blueprintsCollected: 0, hpIV: 15, attackIV: 15, defenseIV: 15 },
        ],
        deck: [],
        drivers: [],
        persistedHp: {},
        encounter: null,
    };
    const battle = createBattleState(setup, ['kraken'], undefined, {
        seed: 'drag-release-test',
        enemyMode: 'CARDS',
    });
    // Give p1 cards in hand: Ember Jab (has STATUS, legal on ally) and Cinder Lance
    const cards: ProgramEntity[] = [
        { id: 'card_ember', dataId: 'ember_jab', currentCost: 1, isPlayable: true },
        { id: 'card_lance', dataId: 'cinder_lance', currentCost: 1, isPlayable: true },
    ];
    return {
        ...battle,
        playerDeck: {
            ...battle.playerDeck,
            hand: cards,
        },
        playerParty: battle.playerParty.map((p) => ({
            ...p,
            currentEnergy: 2,
        })),
    };
}

function firePointer(target: Element, type: string, init: MouseEventInit = {}) {
    return fire(target, type, init as EventInit);
}

describe('Ticket 165b — drag release deselects, unit click is not a drop', () => {
    it('1. Pointerdown on a card, move past the threshold, release over empty stage: selectedCardId is null', async () => {
        const store = makeStore();
        store.dispatch(setBattleState(makeBattle()));
        store.dispatch(selectSource('p1'));
        const host = await mount(store, <BattleArena />);

        const handCards = host.querySelectorAll('.hand-card');
        expect(handCards.length).toBeGreaterThan(0);

        // Pointerdown on first card
        await firePointer(handCards[0], 'pointerdown', { clientX: 200, clientY: 500 });
        expect(store.getState().battle.selectedCardId).toBe('card_ember');

        // Pointermove past threshold (e.g. 50px)
        const screen = host.querySelector('.battle-screen')!;
        await firePointer(screen, 'pointermove', { clientX: 200, clientY: 450 });

        // Release over empty stage
        await firePointer(screen, 'pointerup', { clientX: 200, clientY: 450 });
        await flush();

        expect(store.getState().battle.selectedCardId, 'Releasing a drag over empty stage must deselect the card').toBeNull();
    });

    it('2. Drag and release on a valid enemy: the card is played and deselected', async () => {
        const store = makeStore();
        store.dispatch(setBattleState(makeBattle()));
        store.dispatch(selectSource('p1'));
        const host = await mount(store, <BattleArena />);

        const handCards = host.querySelectorAll('.hand-card');
        const enemySlot = host.querySelector('.stage-slot-enemy')!;
        expect(enemySlot).not.toBeNull();

        // Drag card to enemy
        await firePointer(handCards[0], 'pointerdown', { clientX: 200, clientY: 500 });
        const screen = host.querySelector('.battle-screen')!;
        await firePointer(screen, 'pointermove', { clientX: 400, clientY: 300 });
        await firePointer(enemySlot, 'pointerup', { clientX: 400, clientY: 300 });
        await flush();

        expect(store.getState().battle.selectedCardId).toBeNull();
        // Hand should have 1 card remaining (ember jab was played)
        expect(store.getState().battle.battle?.playerDeck.hand).toHaveLength(1);
    });

    it('3. Click a card, then click an ally: no card is played, and the ally becomes the active caster', async () => {
        const store = makeStore();
        store.dispatch(setBattleState(makeBattle()));
        store.dispatch(selectSource('p1'));
        const host = await mount(store, <BattleArena />);

        const handCards = host.querySelectorAll('.hand-card');
        const allySlots = host.querySelectorAll('.stage-slot-ally');
        expect(allySlots.length).toBe(2);

        // Click card (pointerdown + pointerup on same card without move)
        await firePointer(handCards[0], 'pointerdown', { clientX: 200, clientY: 500 });
        await firePointer(handCards[0], 'pointerup', { clientX: 200, clientY: 500 });
        await fire(handCards[0], 'click');
        expect(store.getState().battle.selectedCardId).toBe('card_ember');

        // Click second ally (p2) to switch active caster
        const p2Slot = allySlots[1];
        await firePointer(p2Slot, 'pointerdown', { clientX: 300, clientY: 300 });
        await firePointer(p2Slot, 'pointerup', { clientX: 300, clientY: 300 });
        await fire(p2Slot, 'click');
        await flush();

        // No card played! Both cards remain in hand
        expect(store.getState().battle.battle?.playerDeck.hand).toHaveLength(2);
        // p2 is now selected caster
        expect(store.getState().battle.selectedSourceId).toBe('p2');
    });

    it('4. Click a card, then click an enemy: the target is selected (click-select flow)', async () => {
        const store = makeStore();
        store.dispatch(setBattleState(makeBattle()));
        store.dispatch(selectSource('p1'));
        const host = await mount(store, <BattleArena />);

        const handCards = host.querySelectorAll('.hand-card');
        const enemySlot = host.querySelector('.stage-slot-enemy')!;
        const enemyId = store.getState().battle.battle!.enemyParty[0].id;

        // Click card (pointerdown + pointerup on same card)
        await firePointer(handCards[0], 'pointerdown', { clientX: 200, clientY: 500 });
        await firePointer(handCards[0], 'pointerup', { clientX: 200, clientY: 500 });
        await fire(handCards[0], 'click');
        expect(store.getState().battle.selectedCardId).toBe('card_ember');

        // Click enemy
        await firePointer(enemySlot, 'pointerdown', { clientX: 400, clientY: 300 });
        await firePointer(enemySlot, 'pointerup', { clientX: 400, clientY: 300 });
        await fire(enemySlot, 'click');
        await flush();

        // No card played immediately via click; enemy is targeted
        expect(store.getState().battle.battle?.playerDeck.hand).toHaveLength(2);
        expect(store.getState().battle.selectedTargetId).toBe(enemyId);
    });

    it('5. Drag Ember Jab onto your own mingming and release: it plays there (attacks on allies stay legal)', async () => {
        const store = makeStore();
        store.dispatch(setBattleState(makeBattle()));
        store.dispatch(selectSource('p1'));
        const host = await mount(store, <BattleArena />);

        const handCards = host.querySelectorAll('.hand-card');
        const allySlots = host.querySelectorAll('.stage-slot-ally');

        // Drag Ember Jab onto own mingming (p1)
        await firePointer(handCards[0], 'pointerdown', { clientX: 200, clientY: 500 });
        const screen = host.querySelector('.battle-screen')!;
        await firePointer(screen, 'pointermove', { clientX: 250, clientY: 350 });
        await firePointer(allySlots[0], 'pointerup', { clientX: 250, clientY: 350 });
        await flush();

        // Ember Jab played on p1!
        expect(store.getState().battle.selectedCardId).toBeNull();
        expect(store.getState().battle.battle?.playerDeck.hand).toHaveLength(1);
    });
});
