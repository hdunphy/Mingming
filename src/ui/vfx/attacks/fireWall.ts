/**
 * TICKET 190d — THE FIRE WALL (Fire, Side / All). Erupts in front of the enemy row, then rolls over
 * it; each body is hit as the wall passes. Ported from the lab's `fxFireWall`.
 */

import { type AttackBuild, type AttackInput, type HitTime, centerOf, labTicks } from './AttackEffect';
import { clamp, inOut, invInOut, lerp, randomIn } from './curves';
import { LIGHT_BLEND } from './glow';
import { particle } from './seeds';

const FADE_MS = 260;

export function fireWall(input: AttackInput): AttackBuild {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, headMs, sustainMs, particleScale: pm, direction: d } = input;
    const centres = input.targets.map(centerOf);
    const xs = centres.map((c) => c.x);
    const ys = centres.map((c) => c.y);
    const near = d > 0 ? Math.min(...xs) : Math.max(...xs);
    const far = d > 0 ? Math.max(...xs) : Math.min(...xs);
    const x0 = near - d * 150;
    const x1 = far + d * 40;
    const top = Math.min(...ys) - 80;
    const bottom = Math.max(...ys) + 70;
    const total = headMs + sustainMs;
    const wallX = (age: number): number => (age < headMs ? x0 : lerp(x0, x1, inOut(Math.min(1, (age - headMs) / Math.max(1, sustainMs)))));
    const intensity = (age: number): number =>
        (age < headMs ? 0.3 + (0.7 * age) / headMs : age < total ? 1 : Math.max(0, 1 - (age - total) / FADE_MS));
    let flames = 0;

    // Each body is hit as the wall passes it, nearest first.
    const hits: HitTime[] = input.targets
        .map((body, i) => ({
            targetId: body.id,
            atMs: Math.min(total, headMs + sustainMs * clamp(invInOut((centres[i].x - x0) / (x1 - x0)), 0, 1)),
            from: Math.abs(centres[i].x - x0),
        }))
        .sort((a, b) => a.from - b.from)
        .map(({ targetId, atMs }) => ({ targetId, atMs }));

    return {
        hits,
        effect: {
            durationMs: total + FADE_MS,
            step(age, dt, spawn) {
                flames += labTicks(dt) * (0.2 + 0.28 * s) * pm * intensity(age);
                const x = wallX(Math.min(age, total));
                while (flames >= 1) {
                    flames -= 1;
                    spawn([particle({
                        x: x + rand(-20, 20), y: rand(top, bottom), vx: d * rand(20, 90), vy: -rand(220, 420), drag: 0.03,
                        life: rand(280, 520), size: rand(7, 10) + 4 * s, size2: rand(16, 26),
                        rgb: [255, 190, 100], rgb2: [190, 35, 20], a: 0.55,
                    })]);
                }
                if (age > headMs && age < total) for (const body of input.targets) input.tremble?.(body.id, 1 + 1.5 * s);
            },
            draw(ctx, age) {
                const x = wallX(Math.min(age, total));
                const k = intensity(age);
                // The lab's one additive column: a soft orange band 100 px wide, 28% at the middle.
                const gradient = ctx.createLinearGradient(x - 50, 0, x + 50, 0);
                gradient.addColorStop(0, 'rgba(255,100,40,0)');
                gradient.addColorStop(0.5, `rgba(255,140,60,${0.28 * k})`);
                gradient.addColorStop(1, 'rgba(255,100,40,0)');
                ctx.globalCompositeOperation = LIGHT_BLEND;
                ctx.fillStyle = gradient;
                ctx.fillRect(x - 50, top - 30, 100, bottom - top + 60);
                ctx.globalCompositeOperation = 'source-over';
            },
        },
    };
}
