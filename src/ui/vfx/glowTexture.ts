/**
 * TICKET 198b-1 — THE LAB'S GLOW TEXTURE, exactly (`tex` in battle-juice-lab.js).
 *
 * One cached 64 px radial sprite per quantised colour (4 bits a channel, so at most 4,096 of them
 * and in practice a few dozen), stamped with `drawImage`. Two kinds:
 *
 *   - a GLOW: white at the centre, the colour at 22%, the colour at 35% opacity by 55%, nothing at
 *     the edge. Every light particle (flame, ember, mote, orb) is one of these, and the white centre
 *     is where the "hot core" of a flame column comes from when many of them overlap additively.
 *   - a SOFT: the colour all the way, fading out. Smoke, mist, pollen.
 *
 * There is no dark rim here. 194k-3 added one ("so a glow stays visible over a light stage") and
 * that rim is the black border Henry saw round every effect. Contrast on a light stage is handled
 * by the layer instead (`ParticleLayer`: additive among the effects, ordinary over the stage).
 */

export type Rgb = readonly [number, number, number];

const SIZE = 64;
const cache = new Map<string, HTMLCanvasElement>();

/** The colour quantised to 4 bits a channel, which keys the cache. */
export function quantise(rgb: Rgb): Rgb {
    return [(rgb[0] >> 4) * 17, (rgb[1] >> 4) * 17, (rgb[2] >> 4) * 17];
}

/** The lab's radial stops for a glow (white centre) or a soft (the colour, fading). */
export function textureStops(rgb: Rgb, soft: boolean): ReadonlyArray<readonly [number, string]> {
    const [r, g, b] = rgb;
    if (soft) {
        return [
            [0, `rgba(${r},${g},${b},1)`],
            [0.5, `rgba(${r},${g},${b},.5)`],
            [1, `rgba(${r},${g},${b},0)`],
        ];
    }
    return [
        [0, 'rgba(255,255,255,1)'],
        [0.22, `rgba(${r},${g},${b},1)`],
        [0.55, `rgba(${r},${g},${b},.35)`],
        [1, `rgba(${r},${g},${b},0)`],
    ];
}

export function glowTexture(rgb: Rgb, soft = false): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const key = `${rgb[0] >> 4},${rgb[1] >> 4},${rgb[2] >> 4}${soft ? 's' : ''}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const half = SIZE / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    for (const [at, colour] of textureStops(quantise(rgb), soft)) gradient.addColorStop(at, colour);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);
    cache.set(key, canvas);
    return canvas;
}

/** Stamp a glow sprite of `radius` at a point, additively, as the lab's `drawGlowAt` does. */
export function drawGlowAt(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rgb: Rgb, alpha = 1): void {
    const sprite = glowTexture(rgb, false);
    if (!sprite) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
}
