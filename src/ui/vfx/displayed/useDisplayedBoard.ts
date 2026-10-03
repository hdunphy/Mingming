/**
 * THE DISPLAYED BOARD, IN REACT — ticket 189c.
 *
 * `useDisplayedUnit` is what the plaque and the sprite read instead of `entity.currentHp`.
 * `useDisplayedBoardSync` is mounted once by the battle screen: it starts the board equal to real
 * state and, whenever the presenter goes idle, makes sure it still is (the safety net).
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';

import type { IBattleEntity, IBattleState } from '../../../engine/types';
import { barkShieldPoints } from '../../components/stage/barkShield';
import type { CastPresenter } from '../useCastSequence';
import { displayedBoard } from './displayedBoardRuntime';

export interface ShownUnit {
    readonly hp: number;
    /** Where the pale chunk reaches (never below `hp`). */
    readonly ghost: number;
    /** Bark Shield in HP points. */
    readonly bark: number;
    /** Knocked out as the player sees it: only after the killing impact. */
    readonly isDown: boolean;
}

/**
 * What the player sees of this body. A body the board does not know (a screen with no battle
 * running, a component test) shows its real values, so nothing reads wrong when the board is empty.
 */
export function useDisplayedUnit(entity: IBattleEntity): ShownUnit {
    useSyncExternalStore(displayedBoard.subscribe, displayedBoard.getVersion, displayedBoard.getVersion);
    const shown = displayedBoard.unit(entity.id);
    const hp = shown?.hp ?? entity.currentHp;
    return {
        hp,
        ghost: shown?.ghost ?? hp,
        bark: shown?.bark ?? barkShieldPoints(entity),
        isDown: hp <= 0,
    };
}

export function useDisplayedBoardSync(battleState: IBattleState | null, presenter: CastPresenter): void {
    const stateRef = useRef(battleState);
    useEffect(() => {
        stateRef.current = battleState;
    });

    // Mount: the board equals the real state. Unmount: nothing is left to show or to drain.
    useEffect(() => {
        displayedBoard.reset(stateRef.current);
        return () => displayedBoard.clear();
    }, []);

    useEffect(() => {
        if (!battleState) return undefined;
        // Nobody in common with what the board holds: a new battle, not a turn of this one.
        if (!displayedBoard.sharesBody(battleState)) displayedBoard.reset(battleState);

        // When the presenter has nothing left to play the board must equal the real state. A newer
        // state cancels this check; the newest one is the one that counts.
        let cancelled = false;
        void presenter.whenIdle().then(() => {
            if (!cancelled) displayedBoard.reconcile(battleState);
        });
        return () => { cancelled = true; };
    }, [battleState, presenter]);
}
