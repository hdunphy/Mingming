/**
 * THE BIOME BACKDROP — ticket 183b. Five flat bands drawn from the biome's token set: sky, far
 * hills, near hills, the ground, and the ground's darker strips and horizon line. The colours are
 * `--sky`, `--far`, `--near`, `--ground` and `--ground-2`, set per biome in `tokens.css` under
 * `[data-biome]`; the stage root stamps the attribute (`biomeKey`) and this only draws.
 *
 * Painted backdrops can replace this per biome later without touching layout: the one thing a
 * caller owes is a box to fill.
 */
import React from 'react';

import {
    BACKDROP_H, BACKDROP_W, FAR_HILLS, GROUND_STRIPS, HORIZON_Y, NEAR_HILLS, hillPoints,
} from './biomeShapes';

export function BiomeBackdrop(): React.ReactElement {
    return (
        <div className="stage-backdrop" data-testid="biome-backdrop" aria-hidden="true">
            <svg
                viewBox={`0 0 ${BACKDROP_W} ${BACKDROP_H}`}
                preserveAspectRatio="none"
                width="100%"
                height="100%"
            >
                <rect className="bd-sky" x={0} y={0} width={BACKDROP_W} height={HORIZON_Y} />
                <polygon className="bd-far" points={hillPoints(FAR_HILLS)} />
                <polygon className="bd-near" points={hillPoints(NEAR_HILLS)} />
                <rect className="bd-ground" x={0} y={HORIZON_Y} width={BACKDROP_W} height={BACKDROP_H - HORIZON_Y} />
                <rect className="bd-horizon" x={0} y={HORIZON_Y} width={BACKDROP_W} height={6} />
                {GROUND_STRIPS.map(([x, y, w, h]) => (
                    <rect key={`${x}-${y}`} className="bd-strip" x={x} y={y} width={w} height={h} rx={6} />
                ))}
            </svg>
        </div>
    );
}
