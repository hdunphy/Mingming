// @vitest-environment jsdom
/**
 * TICKET 127: the card that just resolved is announced for the centre-screen reveal.
 *
 * TICKET 189e moved the announcing from the engine's `PROGRAM_PLAYED` to the presenter's card signals
 * (`vfx/presenter/cardSignals`): `in` shows the card, `out` takes it away when its sequence ends. These
 * tests drive the signals directly; `presenter.test.tsx` covers the presenter sending them.
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
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { useBattleVfx, type BattleVfx, type PlayedCardAnnouncement } from './useBattleVfx';
import { emitCardSignal } from '../vfx/presenter/cardSignals';
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
/**
 * A mutable holder rather than a bare `let`: `react-hooks/globals` rejects assigning to a
 * module-scope binding from inside a component, and it is right to - the lint rule is about render
 * purity. Writing into a stable object is the same escape hatch a ref would give, without pulling
 * a second hook into the probe.
 */
const seen: { vfx: BattleVfx | null } = { vfx: null };
const latest = (): BattleVfx => {
    if (!seen.vfx) throw new Error('probe never rendered');
    return seen.vfx;
};

function Probe(): null {
    const vfx = useBattleVfx(STATE);
    // Published from an EFFECT, not from render. `react-hooks/immutability` rejects writing to
    // anything outside the component during render, and it is right to: that is the render-purity
    // rule. An effect is the sanctioned place for a side effect, and `act()` flushes effects before
    // each assertion, so the tests still read the value they just produced.
    useEffect(() => { seen.vfx = vfx; });
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

let keyCounter = 100;
/** What the presenter announces for a cast of `programId` - names and side read off STATE. */
function announcement(sourceId = 'e1', targetId = 'p1', programId = 'ice_spear'): PlayedCardAnnouncement {
    const names: Record<string, string> = { e1: 'Kraken', p1: 'Huldra' };
    return {
        key: keyCounter++, dataId: programId, sourceId, targetId,
        fromPlayer: sourceId === 'p1', sourceName: names[sourceId] ?? sourceId, targetName: names[targetId] ?? targetId,
    };
}

async function cardIn(card: PlayedCardAnnouncement): Promise<void> {
    await act(async () => { emitCardSignal({ kind: 'in', card }); });
}
async function cardOut(card: PlayedCardAnnouncement): Promise<void> {
    await act(async () => { emitCardSignal({ kind: 'out', card }); });
}

describe('ticket 127 - the played card is announced', () => {
    it('shows the card the presenter brings in, with the caster and the target', async () => {
        expect(latest().playedCard).toBeNull();
        await cardIn(announcement());

        expect(latest().playedCard).toMatchObject({
            dataId: 'ice_spear',
            sourceId: 'e1',
            targetId: 'p1',
            sourceName: 'Kraken',
            targetName: 'Huldra',
            fromPlayer: false,   // the enemy cast it, so the reveal comes in from their side
        });
    });

    it("keeps the player's side on the card, so the reveal can side itself", async () => {
        await cardIn(announcement('p1', 'e1'));
        expect(latest().playedCard?.fromPlayer).toBe(true);
    });

    it('gives two casts of the SAME card two distinct reveals', async () => {
        const first = announcement();
        await cardIn(first);
        const second = announcement();
        await cardIn(second);
        // Without a monotonic key, AnimatePresence would treat the second cast as the same element
        // and play no animation at all - the second copy of a doubled card would appear not to fire.
        expect(latest().playedCard!.key).toBe(second.key);
        expect(second.key).not.toBe(first.key);
        expect(latest().playedCard!.dataId).toBe('ice_spear');
    });

    it('survives the damage the card deals - the regression this ticket walked into', async () => {
        await cardIn(announcement());
        expect(latest().playedCard).not.toBeNull();

        await act(async () => {
            globalBattleEventBus.emit({
                type: 'DAMAGE_TAKEN', targetId: 'p1', amount: 5, element: 'Ice', timestamp: Date.now(),
            } as never);
        });

        expect(latest().playedCard?.dataId, 'a damage event cleared the reveal').toBe('ice_spear');
    });

    it('is no longer announced by the engine event: PROGRAM_PLAYED alone shows nothing', async () => {
        await act(async () => {
            globalBattleEventBus.emit({
                type: 'PROGRAM_PLAYED', sourceId: 'e1', targetId: 'p1', programId: 'ice_spear', timestamp: Date.now(),
            });
        });
        expect(latest().playedCard).toBeNull();
    });

    it('is NOT cleared by TURN_START - a card leaves when its own sequence ends (189e)', async () => {
        const card = announcement();
        await cardIn(card);
        await act(async () => {
            globalBattleEventBus.emit({
                type: 'TURN_START', activeSide: 'PLAYER', turn: 2, timestamp: Date.now(),
            } as never);
        });
        expect(latest().playedCard?.key).toBe(card.key);
    });
});

describe('2026-10-02 (189e) - a card leaves when its sequence ends, not on a timer', () => {
    it('clears on its own `out`', async () => {
        const card = announcement('p1', 'e1');
        await cardIn(card);
        await cardOut(card);
        expect(latest().playedCard).toBeNull();
    });

    it("an older card's `out` does not take down a newer card", async () => {
        const first = announcement('p1', 'e1');
        await cardIn(first);
        const second = announcement('p1', 'e1');
        await cardIn(second);
        await cardOut(first);
        expect(latest().playedCard?.key).toBe(second.key);
        await cardOut(second);
        expect(latest().playedCard).toBeNull();
    });

    it("an enemy's card stays up for as long as its sequence is playing", async () => {
        const card = announcement();
        await cardIn(card);
        await new Promise(resolve => setTimeout(resolve, 60));
        expect(latest().playedCard?.fromPlayer).toBe(false);
        await cardOut(card);
        expect(latest().playedCard).toBeNull();
    });
});
