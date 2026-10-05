/**
 * TICKET 190d — THE FLAME BEAM (Fire, single target). A pouring stream of flame from the caster's
 * mouth with a bright core; embers splash back off the target while it pours; the tail pulls in after.
 * Ported from the lab's `fxFlame`. Length grows with the damage (head + sustain come from the profile).
 * TICKET 198b-2: back to the lab's strokes and spawn rate; the column's body is its particles (about
 * 160-420 a second), the strokes are only the glow down its middle.
 */

import { type AttackBuild, type AttackInput, centerOf, labTicks, muzzleOf } from './AttackEffect';
import { drawGlowAt, LIGHT_BLEND } from './glow';
import { randomIn } from './curves';
import { particle } from './seeds';

const HOT = [255, 238, 170] as const;
const BODY = [224, 93, 67] as const;
/** The tail pulls in over this long once the pour ends. */
const TAIL_MS = 170;

export function flameBeam(input: AttackInput): AttackBuild {
    const rand = randomIn(input.rng ?? Math.random);
    const { s, headMs, sustainMs, particleScale: pm } = input;
    const target = input.targets[0];
    const from = muzzleOf(input.caster, input.direction);
    const to = centerOf(target);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const speed = dist / headMs * 1000;
    const pourEnd = headMs + sustainMs;
    let flames = 0;
    let embers = 0;

    return {
        hits: [{ targetId: target.id, atMs: pourEnd }],
        effect: {
            durationMs: pourEnd + TAIL_MS,
            step(age, dt, spawn) {
                const frames = labTicks(dt);
                if (age < pourEnd) {
                    flames += frames * (0.16 + 0.26 * s) * pm;
                    while (flames >= 1) {
                        flames -= 1;
                        const a = angle + rand(-1, 1) * (0.04 + 0.07 * s);
                        const sp = speed * rand(0.92, 1.08);
                        spawn([particle({
                            x: from.x, y: from.y + rand(-3, 3), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: -rand(60, 260),
                            life: dist / sp * 1000 * rand(0.96, 1.03), size: rand(5, 8) + 4 * s, size2: rand(12, 18) + 14 * s,
                            rgb: [255, 200, 110], rgb2: [200, 40, 20], a: 0.55,
                        })]);
                    }
                }
                if (age > headMs && age < pourEnd) {
                    embers += frames * 0.12 * pm;
                    while (embers >= 1) {
                        embers -= 1;
                        const a = angle + Math.PI + rand(-1.2, 1.2);
                        spawn([particle({
                            x: to.x, y: to.y, vx: Math.cos(a) * rand(80, 220), vy: Math.sin(a) * rand(80, 220) - 60, drag: 0.06,
                            life: rand(250, 450), size: 5, size2: 1, rgb: HOT, rgb2: BODY,
                        })]);
                    }
                    input.tremble?.(target.id, 1 + 2 * s);
                }
            },
            draw(ctx, age) {
                const head = Math.min(1, age / headMs);
                const tail = age > pourEnd ? Math.min(1, (age - pourEnd) / TAIL_MS) : 0;
                const x1 = from.x + dx * tail;
                const y1 = from.y + dy * tail;
                const x2 = from.x + dx * head;
                const y2 = from.y + dy * head;
                const flicker = 0.85 + 0.1 * Math.sin(age * 0.09) + 0.05 * Math.sin(age * 0.23);
                // The lab's three additive strokes: a wide faint red, a narrower orange, a thin hot core.
                ctx.globalCompositeOperation = LIGHT_BLEND;
                ctx.lineCap = 'round';
                const line = (width: number, colour: string): void => {
                    ctx.strokeStyle = colour;
                    ctx.lineWidth = width;
                    ctx.beginPath();
                    ctx.moveTo(x1, y1);
                    ctx.lineTo(x2, y2);
                    ctx.stroke();
                };
                line((18 + 22 * s) * flicker, 'rgba(230,70,25,0.20)');
                line((7 + 9 * s) * flicker, 'rgba(255,150,60,0.42)');
                line(2 + 3 * s, 'rgba(255,240,200,0.8)');
                ctx.globalCompositeOperation = 'source-over';
                if (tail < 1) drawGlowAt(ctx, from.x, from.y, (22 + 22 * s) * flicker, BODY, 0.9 * (1 - tail));
            },
        },
    };
}
