import React from 'react';
import { useDispatch } from 'react-redux';

import { ALL_TIP_IDS, type Tip } from '../../engine/tips';
import { markTipSeen, skipTips } from '../store/gameSlice';
import { prefersReducedMotion } from '../utils/motionPrefs';
import './Callout.css';

/**
 * ONE TIP ON SCREEN — ticket 24's reusable half.
 *
 * # WHY THIS IS A STRIP AND NOT A COACH MARK
 *
 * The ticket says "contextual callouts", and the picture that phrase paints is a little bubble with
 * an arrow pointing at the energy pips. That was costed and rejected, in the open:
 *
 * - There is no positioning library in the repo and a lockfile change is forbidden, so anchoring
 *   would mean hand-rolled `getBoundingClientRect` measurement plus a resize/scroll listener per
 *   mark — and the battle screen's own layout arithmetic (ticket 22's six-pip budget) is already
 *   tuned to the pixel at 1280x800. A floating bubble is the one element that would have to fit
 *   somewhere nobody measured.
 * - It would be **untestable here**. `renderToStaticMarkup` runs no effects, so a measured position
 *   is a position no test can ever see; the strip's markup is asserted in full by
 *   `Callout.test.tsx`.
 *
 * So the callout is a strip that sits in the layout, and it earns "contextual" a different way: the
 * *moment* is contextual (`engine/tips.ts` decides when each one is true) and the sentence names
 * the thing it is about in words — "the pips under its name" — rather than pointing at it. A player
 * reading a sentence that names what they are looking at is taught; a player following an arrow to
 * a widget with no explanation is only directed.
 *
 * # THE TWO BUTTONS ARE THE POINT
 *
 * "Got it" marks this tip seen. "Skip tips" marks **all** of them seen, which is the ticket's
 * "everything skippable" and is one dispatch rather than a `tutorialEnabled` boolean — a second
 * piece of state that could disagree with `seenTips` about whether onboarding is over. There is
 * exactly one answer to that question and it is this list.
 *
 * Reduced motion is honoured by not animating at all (the entrance is a CSS transition, and the
 * class that carries it is dropped): `prefersReducedMotion` is the repo's existing gate, used the
 * same way `BattleArena` uses it.
 */
export interface CalloutProps {
    /** The tip to show. `null` renders nothing — callers pass `nextBattleTip(...)` straight in. */
    readonly tip: Tip | null;
    /** Where the strip sits, which is only ever a CSS concern. */
    readonly placement?: 'battle' | 'panel';
}

const Callout: React.FC<CalloutProps> = ({ tip, placement = 'panel' }) => {
    const dispatch = useDispatch();
    if (!tip) return null;

    const motionClass = prefersReducedMotion() ? '' : ' callout-enter';

    return (
        <aside
            className={`callout callout-${placement}${motionClass}`}
            role="note"
            aria-label={`Tip: ${tip.title}`}
            data-testid={`callout-${tip.id}`}
        >
            <div className="callout-body">
                <h4 className="callout-title">{tip.title}</h4>
                <p className="callout-text">{tip.body}</p>
            </div>
            <div className="callout-actions">
                <button
                    type="button"
                    className="callout-button callout-got-it"
                    onClick={() => dispatch(markTipSeen(tip.id))}
                >
                    Got it
                </button>
                <button
                    type="button"
                    className="callout-button callout-skip"
                    onClick={() => dispatch(skipTips([...ALL_TIP_IDS]))}
                    title="Stop showing tips for good."
                >
                    Skip tips
                </button>
            </div>
        </aside>
    );
};

export default Callout;
