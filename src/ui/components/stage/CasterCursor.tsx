/**
 * THE CASTER CURSOR — ticket 183b. A yellow triangle 18px above the acting ally's sprite.
 */
import React from 'react';

import type { StageRect } from '../stageGeometry';

export function CasterCursor({ rect, scale }: { readonly rect: StageRect; readonly scale: number }): React.ReactElement {
    return (
        <div
            className="stage-caster-cursor"
            data-testid="caster-cursor"
            style={{
                left: rect.x + rect.w / 2 - 9 * scale,
                top: rect.y - 18 * scale,
                width: 18 * scale,
                height: 13 * scale,
            }}
        />
    );
}
