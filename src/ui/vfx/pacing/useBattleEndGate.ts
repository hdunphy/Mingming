/**
 * THE BANNER AND THE STINGER WAIT FOR THE KILLING BLOW TO BE DRAWN — ticket 189e.
 *
 * The real state says "the battle is over" the moment the engine resolves the card, while the trail
 * is still on its way. What is SHOWN (the Victory/Defeat banner) and HEARD (the stinger) waits until
 * the presenter has nothing left to play, so the last impact, the knock-out and the card leaving all
 * happen first. Logic that must not wait (the reward roll, the banking, the AI's stop) keeps reading
 * the real flags.
 *
 * `endKey` tells one battle from the next: a gate opened for the last battle is not open for this one.
 * With the cast sequence off (or at Instant) the presenter is idle at once and the gate opens on the
 * next microtask.
 */

import { useEffect, useState } from 'react';

import type { CastPresenter } from '../useCastSequence';

export function useBattleEndGate(
    battleOver: boolean,
    endKey: string,
    presenter: Pick<CastPresenter, 'whenIdle'>,
): boolean {
    const [shownFor, setShownFor] = useState<string | null>(null);
    useEffect(() => {
        if (!battleOver) return undefined;
        let cancelled = false;
        void presenter.whenIdle().then(() => { if (!cancelled) setShownFor(endKey); });
        return () => { cancelled = true; };
    }, [battleOver, endKey, presenter]);
    return battleOver && shownFor === endKey;
}
