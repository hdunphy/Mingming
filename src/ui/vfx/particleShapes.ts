/**
 * TICKET 198b-1 — HOW EACH KIND OF PARTICLE IS DRAWN: the lab's `drawParts` switch, one case per
 * kind, line for line. The field (`particles.ts`) works out the alpha, the colour and the size for
 * the frame and hands them here; this file only puts ink down.
 *
 * The lab's kinds:
 *   glow    a white-centred radial sprite (fire, embers, motes, orbs)       drawn additively
 *   soft    a colour-only radial sprite (smoke, mist, pollen)               usually not
 *   spark   a line along its own velocity, as long as it is fast
 *   drop    an ellipse pointed along its velocity, stretched by speed
 *   leaf    a turning ellipse with a vein down the middle
 *   star    a five-pointed star
 *   glint   a four-pointed sparkle, long on the vertical
 *   plus    a plus sign
 *   chev    a "v" pointing the way it is going (up when rising, down when sinking)
 *   bubble  an outlined circle
 *   ring    an outlined ellipse that grows from `size` to `size2` and thins out
 *   plank   a short board, turned by its own rotation
 *
 * The game's older names (`puff`, `flame`, `streak`, `chevron`) are kept as aliases of the lab's
 * kinds so nothing that still uses them has to change on the same day.
 */

export type ParticleKind =
    | 'glow' | 'soft' | 'spark' | 'drop' | 'leaf' | 'star' | 'glint' | 'plus' | 'chev' | 'bubble' | 'ring' | 'plank';

/** The names the game used before 198b-1, each one a lab kind. */
export type LegacyKind = 'puff' | 'flame' | 'streak' | 'chevron';

export type ParticleShape = ParticleKind | LegacyKind;

const ALIASES: Readonly<Record<LegacyKind, ParticleKind>> = {
    puff: 'glow',
    flame: 'glow',
    streak: 'spark',
    chevron: 'chev',
};

export const labKindOf = (shape: ParticleShape): ParticleKind => (ALIASES as Record<string, ParticleKind>)[shape] ?? (shape as ParticleKind);

/** What one frame of a particle looks like, worked out by the field. */
export interface ParticleFrame {
    readonly x: number;
    readonly y: number;
    readonly vx: number;
    readonly vy: number;
    /** The size this frame (a radius for the round kinds). */
    readonly size: number;
    /** Age as a fraction of the life, 0 at birth and 1 at death. */
    readonly t: number;
    readonly rot: number;
    readonly colour: string;
}

export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points = 5): void {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / points;
        const radius = i % 2 ? r * 0.45 : r;
        ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    ctx.closePath();
}

/** Draw a non-sprite kind. The sprite kinds (`glow`, `soft`) are stamped by the field. */
export function drawKind(ctx: CanvasRenderingContext2D, kind: ParticleKind, p: ParticleFrame): void {
    const { x, y, size: sz, colour } = p;
    switch (kind) {
        case 'spark':
            ctx.strokeStyle = colour;
            ctx.lineWidth = sz;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - p.vx * 0.035, y - p.vy * 0.035);
            ctx.stroke();
            return;
        case 'drop': {
            const angle = Math.atan2(p.vy, p.vx);
            const stretch = Math.min(3, 1 + Math.hypot(p.vx, p.vy) / 300);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.fillStyle = colour;
            ctx.beginPath();
            ctx.ellipse(0, 0, sz * stretch, sz, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }
        case 'leaf':
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(p.rot);
            ctx.fillStyle = colour;
            ctx.beginPath();
            ctx.ellipse(0, 0, sz, sz * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(20,70,30,.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-sz, 0);
            ctx.lineTo(sz, 0);
            ctx.stroke();
            ctx.restore();
            return;
        case 'star':
            ctx.fillStyle = colour;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(p.rot);
            starPath(ctx, 0, 0, sz);
            ctx.fill();
            ctx.restore();
            return;
        case 'glint':
            ctx.fillStyle = colour;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(p.rot);
            ctx.beginPath();
            ctx.moveTo(0, -sz);
            ctx.lineTo(sz * 0.18, 0);
            ctx.lineTo(0, sz);
            ctx.lineTo(-sz * 0.18, 0);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-sz * 0.6, 0);
            ctx.lineTo(0, sz * 0.12);
            ctx.lineTo(sz * 0.6, 0);
            ctx.lineTo(0, -sz * 0.12);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            return;
        case 'plus':
            ctx.fillStyle = colour;
            ctx.fillRect(x - sz, y - sz * 0.3, sz * 2, sz * 0.6);
            ctx.fillRect(x - sz * 0.3, y - sz, sz * 0.6, sz * 2);
            return;
        case 'chev': {
            const d = p.vy < 0 ? -1 : 1;
            ctx.strokeStyle = colour;
            ctx.lineWidth = sz * 0.45;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(x - sz, y - d * sz * 0.5);
            ctx.lineTo(x, y + d * sz * 0.5);
            ctx.lineTo(x + sz, y - d * sz * 0.5);
            ctx.stroke();
            return;
        }
        case 'bubble':
            ctx.strokeStyle = colour;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, sz, 0, Math.PI * 2);
            ctx.stroke();
            return;
        case 'ring':
            ctx.strokeStyle = colour;
            ctx.lineWidth = Math.max(0.5, 5 * (1 - p.t));
            ctx.beginPath();
            ctx.ellipse(x, y, sz, sz * 0.8, 0, 0, Math.PI * 2);
            ctx.stroke();
            return;
        case 'plank':
            ctx.fillStyle = colour;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(p.rot);
            ctx.fillRect(-sz, -sz * 0.3, sz * 2, sz * 0.6);
            ctx.restore();
            return;
        case 'glow':
        case 'soft':
        default:
            return;
    }
}
