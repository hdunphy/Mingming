/**
 * THE HP A HELD CARD WOULD TAKE, ON ITS OWN LINE — ticket 194e.
 *
 * Henry, 2026-10-04: *"The HP damage preview is hidden in the overflow."* It used to ride inline
 * after the HP (`1140/1140 (-1007)`), inside the plaque's slanted panel, whose `clip-path` and
 * 168px width cut a four-digit readout off. This line is a child of the plaque's out-of-flow
 * preview block instead, which sits OUTSIDE the panel (see `UnitPlaque`), so nothing clips it and
 * a longer number only makes a longer line.
 */
import React from 'react';

export const PlaqueHpPreview: React.FC<{ readonly damage: number }> = ({ damage }) => {
    if (damage <= 0) return null;
    return (
        <div className="stage-plaque-preview-hp" data-testid="plaque-hp-preview">
            <span className="stage-plaque-preview-hp-sign">&minus;</span>
            {damage}
            <span className="stage-plaque-preview-hp-unit"> HP</span>
        </div>
    );
};
