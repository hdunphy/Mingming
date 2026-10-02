// @vitest-environment jsdom
/**
 * THE CHIP FLASHES WHEN THE DRIVER FIRES — steam-release ticket 16, the UI half of PROC-VISIBLE.
 *
 * `macros-and-drivers.md` rejected flat passives as INVISIBLE, so the law for every Driver is that
 * the player SEES it fire. The engine's half is the `DRIVER_PROC` event (`playerDrivers.test.ts`
 * pins that each Driver emits one); this is the other half — the event reaches the mounted top bar
 * and the chip changes. Through the ticket-58 harness (`createRoot` + `act`, console.error trapped)
 * rather than `renderToStaticMarkup`, because a static render cannot receive an event.
 *
 * The bar is mounted ALONE, not inside `App`: the claim is "event in, chip flashes", and a full
 * battle around it would add a minute of setup to say the same thing.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';

import BattleTopBar from './BattleTopBar';
import { globalBattleEventBus } from '../../engine/events';
import { makeStore, mount, flush } from '../../testing/interaction';
import type { IBattleState } from '../../engine/types';

const battle = (): IBattleState => ({
    playerParty: [], enemyParty: [], activeSide: 'PLAYER', turn: 1, phase: 'ACTION',
    playerDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    enemyDeck: { hand: [], drawpile: [], discard: [], exhaust: [] },
    counters: {}, seed: 'x', logs: [], cardsPlayedThisTurn: 0,
    activeDrivers: ['driver_first_blood', 'driver_antivenom'],
} as unknown as IBattleState);

const proc = (driverId: string, fromPlayer = true) =>
    globalBattleEventBus.emit({ type: 'DRIVER_PROC', timestamp: 0, driverId, hookId: `${driverId}_x`, ownerId: 'p1', fromPlayer });

/*
 * MERGE 2026-09-24: `onOpenLog` → `onToggleLog`. This file came in on steam-prep-september,
 * which never saw ticket 155's rename — Henry, 2026-09-22: *"I cannot close the combat log."* The
 * prop toggles now, and the old name does not exist. Nothing else about the case changed.
 */
describe('ticket 16 — the Driver chip flashes on DRIVER_PROC', () => {
    it('flashes the Driver that fired, leaves the other alone, and flashes again on a second proc', async () => {
        const host = await mount(makeStore(), <BattleTopBar battleState={battle()} onToggleLog={() => {}} />);
        const chip = () => host.querySelector('[data-testid="battle-driver-driver_first_blood"]')!;
        const other = () => host.querySelector('[data-testid="battle-driver-driver_antivenom"]')!;
        expect(chip().className).not.toContain('is-proc');

        await act(async () => { proc('driver_first_blood'); });
        await flush();
        expect(chip().className).toContain('is-proc');
        expect(chip().getAttribute('data-procs')).toBe('1');
        expect(other().className).not.toContain('is-proc');

        // A second firing is a second flash: the key changes, so the animation restarts.
        await act(async () => { proc('driver_first_blood'); });
        await flush();
        expect(chip().getAttribute('data-procs')).toBe('2');
    });

    it('ignores the ENEMY side\'s procs — the row is the player\'s Drivers', async () => {
        const host = await mount(makeStore(), <BattleTopBar battleState={battle()} onToggleLog={() => {}} />);
        await act(async () => { proc('driver_first_blood', false); });
        await flush();
        expect(host.querySelector('[data-testid="battle-driver-driver_first_blood"]')!.className).not.toContain('is-proc');
    });
});
