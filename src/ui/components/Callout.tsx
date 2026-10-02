import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import type { Tip } from '../../engine/tips';
import { markTipSeen } from '../store/gameSlice';
import { prefersReducedMotion } from '../utils/motionPrefs';
import { useShowTips } from '../settings/useShowTips';
import './Callout.css';

/**
 * ONE TIP ON SCREEN, AS A TOAST — ticket 24's reusable half, cut down by ticket 182a.
 *
 * # WHAT IT WAS, AND WHY IT IS A TOAST NOW
 *
 * Ticket 24 built a strip with a title, two sentences and two buttons ("Got it", "Skip tips").
 * Henry's first-impression review (2026-10-01) found that the paragraphs on every screen were what
 * made the game feel AI-made, and a tip panel with buttons is a paragraph with homework. So the tip
 * is one line, no buttons, and it leaves by itself.
 *
 * - **It marks its tip seen the moment it shows** (`seenTips`, once ever), not when it is dismissed,
 *   so closing the game with a toast up does not bring it back.
 * - **It goes after `TOAST_MS`, or on the next click**, whichever comes first.
 * - **One at a time.** Marking a tip seen makes the parent offer the next one at once; the toast
 *   keeps the tip it is showing and takes the next only when this one has gone.
 * - **Its text is not a `<p>`.** A toast is transient, not screen copy, so it does not count against
 *   the copy budget (`copyBudget.test.tsx`).
 * - "Skip tips" is gone. A toast does not need skipping; the **Show tips** switch in Settings (183d)
  turns the toasts off for good, and back on.
 *
 * Reduced motion is honoured by not animating at all (the entrance is a CSS transition, and the
 * class that carries it is dropped): `prefersReducedMotion` is the repo's existing gate.
 */

/** How long a toast stays up if nobody clicks. */
export const TOAST_MS = 5000;

export interface CalloutProps {
    /** The tip to show. `null` renders nothing — callers pass `nextBattleTip(...)` straight in. */
    readonly tip: Tip | null;
    /** Where the toast sits, which is only ever a CSS concern. */
    readonly placement?: 'battle' | 'panel';
}

const Callout: React.FC<CalloutProps> = ({ tip, placement = 'panel' }) => {
    const dispatch = useDispatch();
    // TICKET 183d: Settings' "Show tips". Off, the toast is not drawn and no tip is marked seen.
    const tipsOn = useShowTips();
    // Starts as the tip it was handed, so the very first render already shows it (a static render
    // runs no effects).
    const [shown, setShown] = useState<Tip | null>(tip);

    // Take the next tip, but only once the current one has gone (React's "adjust state while
    // rendering" pattern: guarded, so it settles in one extra render).
    if (shown === null && tip !== null) setShown(tip);

    // A tip on screen is a tip seen; and it leaves after a few seconds or on the next click.
    useEffect(() => {
        if (shown === null || !tipsOn) return undefined;
        dispatch(markTipSeen(shown.id));
        const timer = window.setTimeout(() => setShown(null), TOAST_MS);
        const onPointer = (): void => setShown(null);
        document.addEventListener('pointerdown', onPointer);
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('pointerdown', onPointer);
        };
    }, [shown, dispatch, tipsOn]);

    if (!shown || !tipsOn) return null;

    const motionClass = prefersReducedMotion() ? '' : ' callout-enter';

    return (
        <aside
            className={`callout callout-${placement}${motionClass}`}
            role="status"
            aria-label={`Tip: ${shown.title}`}
            data-testid={`callout-${shown.id}`}
        >
            <span className="callout-text">{shown.body}</span>
        </aside>
    );
};

export default Callout;
