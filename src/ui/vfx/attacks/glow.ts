/**
 * TICKET 190d — the glow the attacks draw heads and muzzles with: one cached radial-gradient sprite
 * per (quantised) colour, stamped with `drawImage`, as the lab does and as the particle layer's ramp
 * atlas does.
 *
 * The lab blended light additively ('lighter'). The particle layer measured that additive blending
 * disappears over the near-white cards (see `ParticleField.draw`), so light is drawn with ordinary
 * blending here. `LIGHT_BLEND` is the one place to change that.
 *
 * TICKET 194k-3: the sprite is white at the centre, the element colour as a body, and a dark rim
 * that fades out (`glowStops`), so a glow stays visible over a light stage.
 */

import { glowStops, type Rgb } from './layers';

export const LIGHT_BLEND: GlobalCompositeOperation = 'source-over';

const cache = new Map<string, HTMLCanvasElement>();

function glowSprite(rgb: Rgb): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const key = `${rgb[0] >> 4},${rgb[1] >> 4},${rgb[2] >> 4}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const quant: Rgb = [(rgb[0] >> 4) * 17, (rgb[1] >> 4) * 17, (rgb[2] >> 4) * 17];
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [at, colour] of glowStops(quant)) gradient.addColorStop(at, colour);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    cache.set(key, canvas);
    return canvas;
}

export function drawGlowAt(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rgb: Rgb, alpha = 1): void {
    const sprite = glowSprite(rgb);
    if (!sprite) return;
    const before = ctx.globalAlpha;
    ctx.globalCompositeOperation = LIGHT_BLEND;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = before;
    ctx.globalCompositeOperation = 'source-over';
}
