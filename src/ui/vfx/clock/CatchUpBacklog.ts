/**
 * WHAT "QUEUED" MEANS FOR CATCH-UP — ticket 190a (Henry, 2026-10-03: "Good with your suggestion").
 *
 * Catch-up runs the clock faster when cards are queued. On the player's turn that is the presenter's
 * line. But ticket 189e makes the enemy wait for each card to finish before it plays the next, so on
 * an enemy turn the line never holds more than the card in flight and catch-up would never fire,
 * which is exactly the long turn it is for. So the enemy cards already played THIS turn count as
 * backlog too: the longer the turn runs, the faster it plays, up to the same x1.6 ceiling.
 */
export class CatchUpBacklog {
    private enemyActions = 0;

    constructor(private readonly presenterQueued: () => number) {}

    /** The enemy dispatched one more card this turn. */
    enemyActed(): void {
        this.enemyActions += 1;
    }

    /** A new turn begins: the enemy's count starts again. */
    turnStarted(): void {
        this.enemyActions = 0;
    }

    count(): number {
        const queued = this.presenterQueued();
        return (Number.isFinite(queued) && queued > 0 ? queued : 0) + this.enemyActions;
    }
}
