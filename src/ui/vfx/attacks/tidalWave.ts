/**
 * TICKET 190d — THE TIDAL WAVE (Water, Side / All). Sweeps the lane from the caster's side; each body
 * is hit as the crest passes. Ported from the lab's `fxWave`.
 */

import { type AttackBuild, type AttackInput, type HitTime, centerOf, labTicks } from './AttackEffect';
import { inOut, invInOut, lerp, randomIn } from './curves';
import { particle } from './seeds';

const FADE_MS = 240;
const EDGE_STEP_PX = 10;

export function tidalWave(input: AttackInput): AttackBuild {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, headMs, sustainMs, particleScale: pm, direction: d } = input;
    const caster = centerOf(input.caster);
    const centres = input.targets.map(centerOf);
    const xs = centres.map((c) => c.x);
    const ys = centres.map((c) => c.y);
    const far = d > 0 ? Math.max(...xs) : Math.min(...xs);
    const x0 = caster.x + d * 90;
    const x1 = far + d * 130;
    const top = Math.max(10, Math.min(...ys) - 95);
    const bottom = Math.max(top + 40, Math.max(...ys) + 85);
    const total = headMs + sustainMs;
    const crest = (age: number): number => lerp(x0, x1, inOut(Math.min(1, age / total)));
    let drops = 0;

    /** The curling front edge of the wave, top to bottom. */
    const edge = (age: number): Array<{ x: number; y: number }> => {
        const x = crest(Math.min(age, total));
        const points: Array<{ x: number; y: number }> = [];
        for (let y = top; y <= bottom; y += EDGE_STEP_PX) {
            const curl = 34 * Math.max(0, 1 - (y - top) / 90);
            points.push({ x: x + d * (Math.sin(y * 0.025 + age * 0.012) * 10 + curl), y });
        }
        return points;
    };

    const hits: HitTime[] = input.targets
        .map((body, i) => ({
            targetId: body.id,
            atMs: Math.min(total, total * invInOut((centres[i].x - d * 30 - x0) / (x1 - x0))),
            from: Math.abs(centres[i].x - x0),
        }))
        .sort((a, b) => a.from - b.from)
        .map(({ targetId, atMs }) => ({ targetId, atMs }));

    return {
        hits,
        effect: {
            durationMs: total + FADE_MS,
            step(age, dt, spawn) {
                if (age > total) return;
                drops += labTicks(dt) * (0.12 + 0.16 * s) * pm;
                const front = edge(age);
                while (drops >= 1) {
                    drops -= 1;
                    const p = front[Math.floor((input.rng ?? Math.random)() * front.length)];
                    spawn([particle({
                        x: p.x, y: p.y, vx: d * rand(120, 280), vy: rand(-180, 40), ay: 700,
                        life: rand(300, 550), size: rand(2, 3.5), rgb: [215, 240, 255], kind: 'drop', add: false, a: 0.75,
                    })]);
                }
            },
            draw(ctx, age) {
                const alpha = age < total ? Math.min(1, age / 120) : Math.max(0, 1 - (age - total) / FADE_MS);
                if (alpha <= 0) return;
                const front = edge(age);
                const x = crest(Math.min(age, total));
                const back = x - d * 260;
                const gradient = ctx.createLinearGradient(back, 0, x, 0);
                gradient.addColorStop(0, 'rgba(40,110,200,0)');
                gradient.addColorStop(0.75, `rgba(55,140,220,${0.42 * alpha})`);
                gradient.addColorStop(1, `rgba(150,215,255,${0.7 * alpha})`);
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(back, top + 40);
                front.forEach((p) => ctx.lineTo(p.x, p.y));
                ctx.lineTo(back, bottom);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = `rgba(240,250,255,${0.85 * alpha})`;
                ctx.lineWidth = 4;
                ctx.beginPath();
                front.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
                ctx.stroke();
            },
        },
    };
}
