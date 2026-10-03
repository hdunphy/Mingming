/**
 * TICKET 190a — what "queued" means for catch-up (Henry, 2026-10-03: the enemy's own turn counts).
 *
 * Ticket 189e makes the enemy wait for each card to finish before it plays the next, so the
 * presenter's line never holds more than the card in flight on an enemy turn. Catch-up would never
 * fire there. So the enemy's cards already played this turn count as backlog too: the longer an
 * enemy turn runs, the faster it plays, up to the same x1.6 ceiling.
 */
import { describe, expect, it } from 'vitest';

import { CatchUpBacklog } from './CatchUpBacklog';

describe('190a — CatchUpBacklog', () => {
    it('is the presenter\'s waiting beats on the player\'s turn', () => {
        let waiting = 0;
        const backlog = new CatchUpBacklog(() => waiting);
        expect(backlog.count()).toBe(0);
        waiting = 2;
        expect(backlog.count()).toBe(2);
    });

    it('adds the enemy cards already played this turn', () => {
        const backlog = new CatchUpBacklog(() => 0);
        backlog.enemyActed();
        backlog.enemyActed();
        expect(backlog.count()).toBe(2);
    });

    it('adds the two together', () => {
        const backlog = new CatchUpBacklog(() => 1);
        backlog.enemyActed();
        expect(backlog.count()).toBe(2);
    });

    it('starts the next turn from nothing', () => {
        const backlog = new CatchUpBacklog(() => 0);
        backlog.enemyActed();
        backlog.enemyActed();
        backlog.turnStarted();
        expect(backlog.count()).toBe(0);
    });

    it('survives a nonsense reading from the presenter', () => {
        const backlog = new CatchUpBacklog(() => Number.NaN);
        backlog.enemyActed();
        expect(backlog.count()).toBe(1);
    });
});
