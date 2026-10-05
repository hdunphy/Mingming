/**
 * TICKET 190d — THE WATER JET (Water, single target). A rippling jet on a slight arc from the caster
 * to the target; drops shed at the head, spray bounces back off the target while it pours. Ported
 * from the lab's `fxJet`.
 */

import { type AttackBuild, type AttackInput, centerOf, labTicks, muzzleOf } from './AttackEffect';
import { bez2, inQuad, lerp, outQuad, randomIn } from './curves';
import { drawGlowAt, LIGHT_BLEND } from './glow';
import { particle } from './seeds';

/** The tail pulls in over this long once the pour ends. */
const TAIL_MS = 140;
const SEGMENTS = 30;

export function waterJet(input: AttackInput): AttackBuild {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, headMs, sustainMs, particleScale: pm, direction: d } = input;
    const target = input.targets[0];
    const from = muzzleOf(input.caster, d);
    const to = centerOf(target);
    const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - (34 + 30 * s) };
    const pourEnd = headMs + sustainMs;
    let drops = 0;
    let spray = 0;

    /** A point along the jet, rippling sideways as it flows. */
    const along = (u: number, age: number): { x: number; y: number } => {
        const p = bez2(from, control, to, u);
        const n = bez2(from, control, to, Math.min(1, u + 0.01));
        const nx = -(n.y - p.y);
        const ny = n.x - p.x;
        const len = Math.hypot(nx, ny) || 1;
        const w = Math.sin(u * 20 - age * 0.05) * (2 + 3 * s) * (1 - u * 0.4);
        return { x: p.x + (nx / len) * w, y: p.y + (ny / len) * w };
    };

    return {
        hits: [{ targetId: target.id, atMs: pourEnd }],
        effect: {
            durationMs: pourEnd + TAIL_MS,
            step(age, dt, spawn) {
                const frames = labTicks(dt);
                if (age < pourEnd) {
                    drops += frames * (0.25 + 0.35 * s) * pm;
                    const head = bez2(from, control, to, outQuad(Math.min(1, age / headMs)));
                    while (drops >= 1) {
                        drops -= 1;
                        spawn([particle({
                            x: head.x, y: head.y, vx: d * rand(40, 160), vy: rand(-220, -40), ay: 950,
                            life: rand(350, 600), size: rand(2, 4), rgb: [195, 232, 255], kind: 'drop', add: false,
                        })]);
                    }
                }
                if (age > headMs && age < pourEnd) {
                    spray += frames * 0.2 * pm;
                    while (spray >= 1) {
                        spray -= 1;
                        spawn([particle({
                            x: to.x - d * 20, y: to.y, vx: -d * rand(60, 220), vy: rand(-260, -60), ay: 900,
                            life: rand(400, 650), size: rand(2.5, 4), rgb: [205, 238, 255], kind: 'drop', add: false,
                        })]);
                        if ((input.rng ?? Math.random)() < 0.3) {
                            spawn([particle({
                                x: to.x, y: to.y, vx: rand(-40, 40), vy: rand(-30, 10), life: 600, size: 12, size2: 36,
                                rgb: [170, 215, 255], kind: 'soft', a: 0.3,
                            })]);
                        }
                    }
                    input.tremble?.(target.id, 1 + 2 * s);
                }
            },
            draw(ctx, age) {
                const head = outQuad(Math.min(1, age / headMs));
                const tail = age > pourEnd ? inQuad(Math.min(1, (age - pourEnd) / TAIL_MS)) : 0;
                if (tail >= head) return;
                const points: Array<{ x: number; y: number }> = [];
                for (let i = 0; i <= SEGMENTS; i += 1) points.push(along(lerp(tail, head, i / SEGMENTS), age));
                const stroke = (width: number, colour: string, light: boolean): void => {
                    ctx.globalCompositeOperation = light ? LIGHT_BLEND : 'source-over';
                    ctx.strokeStyle = colour;
                    ctx.lineWidth = width;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
                    ctx.stroke();
                };
                stroke(12 + 12 * s, 'rgba(40,120,210,0.55)', false);
                stroke(6 + 6 * s, 'rgba(110,190,255,0.85)', false);
                stroke(2 + 2.5 * s, 'rgba(235,250,255,0.95)', true);
                ctx.globalCompositeOperation = 'source-over';
                const tip = points[points.length - 1];
                drawGlowAt(ctx, tip.x, tip.y, 14 + 10 * s, [150, 210, 255], 0.8);
            },
        },
    };
}
