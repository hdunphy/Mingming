// @vitest-environment jsdom
/**
 * TICKET 127: the card that just resolved is announced for the centre-screen reveal.
 *
 * Henry, after the ticket-118 playtest: *"We should also show the cards that get played, animate
 * them to show center screen so the player knows what was played rather than having to check the
 * log."*
 *
 * These are DATA tests, not rendering tests, and the split is deliberate: `useBattleVfx` deciding
 * *what* to announce is the half that can be wrong silently, and it is the half the enemy loop's
 * pacing depends on. The visual itself needs an eyeball (as ticket 125's chip row did) and no test
 * substitutes for that.
 *
 * The last case is the one that would otherwise rot. `VfxState` had exactly two fields for its whole
 * life and several `setVfx` branches rebuilt the object by listing both by hand rather than
 * spreading `prev` — which silently dropped any third field. Adding `playedCard` walked straight
 * into it: a card played and then damage taken (i.e. every attack in the game) cleared the reveal
 * before it rendered. A damage event must not eat the announcement.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { useBattleVfx, type BattleVfx } from './useBattleVfx';
import { globalBattleEventBus } from '../../engine/events';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { IBattleState } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STATE: IBattleState = createSparseBattleState({
    activeSide: 'ENEMY',
    phase: 'ACTION',
    playerParty: [createSparseEntity({ id: 'p1', definitionId: 'huldra', name: 'Huldra' })],
    enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'kraken', name: 'Kraken' })],
});

let host: HTMLDivElement;
let root: Root;
let latest: BattleVfx;

function Probe(): null {
    latest = useBattleVfx(STATE);
    return null;
}

beforeEach(async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root.render(<Probe />); });
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
});

/** The enemy casts `ice_spear` at the player — a real dataId, since the reveal looks it up. */
async function emitPlay(sourceId = 'e1', targetId = 'p1', programId = 'ice_spear'): Promise<void> {
    await act(async () => {
        globalBattleEventBus.emit({
            type: 'PROGRAM_PLAYED', sourceId, targetId, programId, timestamp: Date.now(),
        });
    });
}

describe('ticket 127 - the played card is announced', () => {
    it('announces the dataId, the caster and the target', async () => {
        expect(latest.playedCard).toBeNull();
        await emitPlay();

        expect(latest.playedCard).toMatchObject({
            dataId: 'ice_spear',
            sourceId: 'e1',
            targetId: 'p1',
            sourceName: 'Kraken',
            targetName: 'Huldra',
            fromPlayer: false,   // the enemy cast it, so the reveal comes in from their side
        });
    });

    it('marks a player cast as the player\'s, so the reveal can side itself', async () => {
        await emitPlay('p1', 'e1', 'ice_spear');
        expect(latest.playedCard?.fromPlayer).toBe(true);
    });

    it('gives two casts of the SAME card two distinct reveals', async () => {
        await emitPlay();
        const first = latest.playedCard!.key;
        await emitPlay();
        // Without a monotonic key, AnimatePresence would treat the second cast as the same element
        // and play no animation at all - the second copy of a doubled card would appear not to fire.
        expect(latest.playedCard!.key).not.toBe(first);
        expect(latest.playedCard!.dataId).toBe('ice_spear');
    });

    it('survives the damage the card deals - the regression this ticket walked into', async () => {
        await emitPlay();
        expect(latest.playedCard).not.toBeNull();

        await act(async () => {
            globalBattleEventBus.emit({
                type: 'DAMAGE_TAKEN', targetId: 'p1', amount: 5, element: 'Ice', timestamp: Date.now(),
            } as never);
        });

        expect(latest.playedCard?.dataId, 'a damage event cleared the reveal').toBe('ice_spear');
    });

    it('is cleared by the next TURN_START, so it never sits under the wrong turn banner', async () => {
        await emitPlay();
        await act(async () => {
            globalBattleEventBus.emit({
                type: 'TURN_START', activeSide: 'PLAYER', turn: 2, timestamp: Date.now(),
            } as never);
        });
        expect(latest.playedCard).toBeNull();
    });
});
