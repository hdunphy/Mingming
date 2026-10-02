/**
 * THE BACKDROP'S SHAPES — ticket 183b, on the mock's 1280x590 stage (590 is where the console
 * starts at 1280x800). Flat polygons; no gradient, no blur.
 */

export const BACKDROP_W = 1280;
export const BACKDROP_H = 590;

/** Where the ground starts, and so where the horizon line sits. */
export const HORIZON_Y = 330;

/** A hill band: its top edge, its height, and the ridge as [x%, y%] points of that band. */
export interface HillBand {
    readonly top: number;
    readonly height: number;
    readonly ridge: ReadonlyArray<readonly [number, number]>;
}

export const FAR_HILLS: HillBand = {
    top: 190,
    height: 120,
    ridge: [[0, 55], [9, 25], [20, 50], [33, 15], [46, 45], [58, 20], [70, 50], [82, 22], [94, 45], [100, 30]],
};

export const NEAR_HILLS: HillBand = {
    top: 262,
    height: 90,
    ridge: [[0, 45], [12, 15], [24, 50], [38, 10], [50, 40], [63, 18], [76, 55], [88, 20], [100, 40]],
};

/** The SVG `points` of a hill band: the ridge, then down the right edge and back along the foot. */
export function hillPoints(band: HillBand): string {
    const point = (xPct: number, yPct: number): string =>
        `${(BACKDROP_W * xPct) / 100},${band.top + (band.height * yPct) / 100}`;
    const foot = band.top + band.height;
    return [...band.ridge.map(([x, y]) => point(x, y)), `${BACKDROP_W},${foot}`, `0,${foot}`].join(' ');
}

/** The darker strips on the ground: x, y, width, height of a 12px pill. */
export const GROUND_STRIPS: ReadonlyArray<readonly [number, number, number, number]> = [
    [120, 400, 160, 12],
    [980, 470, 200, 12],
    [560, 520, 180, 12],
];
