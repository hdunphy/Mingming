/**
 * THE HP BAR — ticket 183a. A track, a fill, and a 3px lighter band along the top of the fill. The
 * fill goes green, yellow, red at 50% and 20% of max (`hpStep`).
 *
 * # BARK SHIELD IS ON THE BAR, NOT IN THE STATUS ROW
 *
 * Henry (2026-10-02, Rootfall playtest): *"barksheild should be a brown bar over the health bar. It
 * doesn't read well as a status icon."* Like Slay the Spire's Block, the shield is read off the bar
 * it protects. `shield` is in HP points (the plaque passes `floor(stacks x maxHp / 100)`); it is
 * drawn as a brown band laid over the bar starting at the end of the fill, with its HP as a small
 * number on it. When the shield is wider than the room left to the right of the fill, the band is
 * pushed back flush against the end of the track and covers the end of the fill, so a shield on a
 * full-health body is still seen. Hover reads the existing Bark Shield glossary text.
 *
 * # THE GHOST (ticket 189c)
 *
 * `ghost` is where the bar WAS: a pale chunk behind the fill, from the new fill out to the old one.
 * The fill drains to a new value over 240 ms; the ghost's width drains over 420 ms once the board
 * lets it go (it holds for 380 ms first, which is the displayed board's timer, not CSS). Both
 * transitions are in `kit.css` (`k-hp-fill`, `k-hp-ghost`). Left out, no chunk is drawn.
 */
import type { ReactElement } from 'react';

import { statusGlossary } from '../../../engine/data/statusGlossary';
import './kit.css';
import { hpRatio, hpStep } from './hpSteps';

export interface HpBarProps {
    readonly cur: number;
    readonly max: number;
    /** Track width in px. */
    readonly width?: number;
    /** Bark Shield, in HP points. Zero or left out draws no band. */
    readonly shield?: number;
    /** HP the pale chunk reaches. At or below `cur`, or left out, draws none. */
    readonly ghost?: number;
}

export function HpBar({ cur, max, width = 88, shield = 0, ghost }: HpBarProps): ReactElement {
    const fillPct = hpRatio(cur, max) * 100;
    const step = hpStep(cur, max);
    const shieldPct = shield > 0 && max > 0 ? Math.min(1, shield / max) * 100 : 0;
    const shieldLeft = Math.min(fillPct, 100 - shieldPct);
    const ghostPct = ghost !== undefined && ghost > cur ? hpRatio(ghost, max) * 100 : 0;
    const bark = statusGlossary.BarkShield;

    return (
        <div
            className="k-slant k-hp"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={cur}
            data-step={step}
            style={{ width }}
        >
            {ghostPct > 0 && <div className="k-hp-ghost" data-testid="hp-ghost" style={{ width: `${ghostPct}%` }} />}
            <div className="k-hp-fill" style={{ width: `${fillPct}%` }} />
            <div className="k-hp-band" style={{ width: `${fillPct}%` }} />
            {shieldPct > 0 && (
                <div
                    className="k-hp-shield k-display"
                    data-testid="hp-shield"
                    title={`${bark.name}: ${bark.description}`}
                    style={{ left: `${shieldLeft}%`, width: `${shieldPct}%` }}
                >
                    {Math.round(shield)}
                </div>
            )}
        </div>
    );
}
