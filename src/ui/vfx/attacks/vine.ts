/**
 * TICKET 190d — THE VINE (Nature, single target). Grows along the ground from the caster's feet, whips
 * up and coils round the target, squeezes on the hit, and retracts after; leaves shed as it grows.
 * Ported from the lab's `fxVine`.
 */

import { type AttackBuild, type AttackInput, centerOf, feetOf, framesOf } from './AttackEffect';
import { bez3, inQuad, lerp, outCubic, randomIn } from './curves';
import { particle } from './seeds';

const RETRACT_MS = 190;
const SEGMENTS = 36;

export function vine(input: AttackInput): AttackBuild {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, headMs, sustainMs, particleScale: pm, direction: d } = input;
    const target = input.targets[0];
    const feet = feetOf(input.caster);
    const to = centerOf(target);
    const p0 = { x: feet.x + d * 30, y: feet.y };
    const p1 = { x: lerp(feet.x, to.x, 0.35), y: feet.y + 34 };
    const p2 = { x: to.x - d * 95, y: to.y + 95 };
    const p3 = { x: to.x - d * 18, y: to.y + 6 };
    const pourEnd = headMs + sustainMs;
    const baseWidth = 10 + 5 * s;
    let leafChance = 0;

    return {
        hits: [{ targetId: target.id, atMs: pourEnd }],
        effect: {
            durationMs: pourEnd + RETRACT_MS,
            step(age, dt, spawn) {
                if (age < headMs) {
                    leafChance += framesOf(dt) * 0.15 * pm;
                    while (leafChance >= 1) {
                        leafChance -= 1;
                        const p = bez3(p0, p1, p2, p3, outCubic(age / headMs));
                        spawn([particle({
                            x: p.x, y: p.y, vx: rand(-60, 60), vy: rand(-90, -30), ay: 140,
                            life: rand(500, 800), size: rand(4, 6), rgb: [90, 200, 100], kind: 'leaf',
                        })]);
                    }
                }
                if (age > headMs && age < pourEnd) input.tremble?.(target.id, 1 + 1.5 * s);
            },
            draw(ctx, age) {
                let reach = outCubic(Math.min(1, age / headMs));
                if (age > pourEnd) reach = 1 - inQuad(Math.min(1, (age - pourEnd) / RETRACT_MS));
                if (reach <= 0.001) return;
                const points: Array<{ x: number; y: number }> = [];
                for (let i = 0; i <= SEGMENTS; i += 1) points.push(bez3(p0, p1, p2, p3, (reach * i) / SEGMENTS));
                ctx.lineCap = 'round';
                for (let i = 1; i < points.length; i += 1) {
                    const w = lerp(baseWidth, 3, i / SEGMENTS);
                    ctx.strokeStyle = 'rgb(29, 90, 43)';
                    ctx.lineWidth = w;
                    ctx.beginPath();
                    ctx.moveTo(points[i - 1].x, points[i - 1].y);
                    ctx.lineTo(points[i].x, points[i].y);
                    ctx.stroke();
                    ctx.strokeStyle = 'rgb(111, 212, 126)';
                    ctx.lineWidth = w * 0.3;
                    ctx.beginPath();
                    ctx.moveTo(points[i - 1].x, points[i - 1].y - w * 0.22);
                    ctx.lineTo(points[i].x, points[i].y - w * 0.22);
                    ctx.stroke();
                    if (i % 5 === 0) {
                        const angle = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x) + (i % 10 ? 1 : -1) * 0.9;
                        ctx.save();
                        ctx.translate(points[i].x, points[i].y);
                        ctx.rotate(angle);
                        ctx.fillStyle = 'rgb(63, 174, 85)';
                        ctx.beginPath();
                        ctx.ellipse(7, 0, 7, 3, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    }
                }
                // The wrap: once the tip arrives it coils round the target, and squeezes at the end of the pour.
                if (age > headMs && age < pourEnd + RETRACT_MS * 0.6) {
                    const coil = Math.min(1, (age - headMs) / Math.max(60, sustainMs * 0.7));
                    const fade = age > pourEnd ? 1 - (age - pourEnd) / (RETRACT_MS * 0.6) : 1;
                    const squeeze = age > headMs + sustainMs * 0.8 ? 0.85 : 1;
                    ctx.globalAlpha = Math.max(0, fade);
                    ctx.lineWidth = 6 + 2 * s;
                    ctx.strokeStyle = 'rgb(44, 122, 58)';
                    ctx.beginPath();
                    ctx.ellipse(to.x, to.y + 12, 54 * squeeze, 20 * squeeze, -0.15 * d, Math.PI * 0.9, Math.PI * 0.9 + Math.PI * 2 * 0.9 * coil);
                    ctx.stroke();
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = 'rgb(126, 224, 139)';
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            },
        },
    };
}
