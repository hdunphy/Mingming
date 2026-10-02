/**
 * THE PLATFORM UNDER A BODY — ticket 183b. A flat ellipse in the biome's `--ground-2` at 75%; the
 * acting ally's turns the selection yellow with a `--ground-2` inner ellipse. Sized off the DRAWN
 * sprite box (the mock's numbers: 170x40 at 150x120, ten px out to the left and 98 px down), so a
 * body and its platform cannot drift apart at a non-reference scale.
 */
import React from 'react';

import { SPRITE_H, SPRITE_W, type StageRect } from '../stageGeometry';

export interface PlatformProps {
    /** The drawn sprite box. */
    readonly rect: StageRect;
    readonly active: boolean;
    /** Enemies slide with the enemy-hand panel, and so do their platforms. */
    readonly enemy: boolean;
}

export function Platform({ rect, active, enemy }: PlatformProps): React.ReactElement {
    return (
        <div
            className={['stage-platform', enemy ? 'stage-enemy-shift' : '', active ? 'is-active' : ''].filter(Boolean).join(' ')}
            data-testid="stage-platform"
            style={{
                left: rect.x - rect.w * (10 / SPRITE_W),
                top: rect.y + rect.h * (98 / SPRITE_H),
                width: rect.w * (170 / SPRITE_W),
                height: rect.h * (40 / SPRITE_H),
            }}
        >
            {active && <div className="stage-platform-inner" />}
        </div>
    );
}
