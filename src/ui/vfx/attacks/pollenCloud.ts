/**
 * TICKET 190d — THE POLLEN CLOUD (Nature, Side / All). Puffs lob from the caster to each target and
 * bloom into slow clouds with glints; Poison follows as its rider (190f). Ported from the lab's
 * `fxPollen`.
 */

import { type AttackBuild, type AttackInput, centerOf, labTicks, muzzleOf } from './AttackEffect';
import { bez2, outQuad, randomIn } from './curves';
import { drawGlowAt } from './glow';
import { particle } from './seeds';

/** Targets bloom this far apart, nearest first. */
const BLOOM_GAP_MS = 60;
const LINGER_MS = 700;

export function pollenCloud(input: AttackInput): AttackBuild {
    const rand = randomIn(input.rng ?? Math.random);
    const chance = input.rng ?? Math.random;
    const { s, headMs, sustainMs, particleScale: pm } = input;
    const from = muzzleOf(input.caster, input.direction);
    const ordered = [...input.targets].sort((a, b) => Math.abs(centerOf(a).x - from.x) - Math.abs(centerOf(b).x - from.x));
    const arcs = ordered.map((body) => {
        const to = centerOf(body);
        return { body, to, control: { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 90 } };
    });
    const pourEnd = headMs + sustainMs;
    let puffs = 0;
    let bloom = 0;

    return {
        hits: arcs.map((arc, i) => ({ targetId: arc.body.id, atMs: pourEnd + i * BLOOM_GAP_MS })),
        effect: {
            durationMs: pourEnd + LINGER_MS,
            step(age, dt, spawn) {
                const frames = labTicks(dt);
                if (age < headMs) {
                    puffs += frames * 0.25 * pm;
                    while (puffs >= 1) {
                        puffs -= 1;
                        for (const arc of arcs) {
                            const p = bez2(from, arc.control, arc.to, outQuad(age / headMs));
                            spawn([particle({
                                x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: rand(300, 500), size: 8, size2: 18,
                                rgb: [225, 225, 110], kind: 'soft', a: 0.55,
                            })]);
                        }
                    }
                } else if (age < pourEnd + 200) {
                    bloom += frames * (0.12 + 0.12 * s) * pm;
                    while (bloom >= 1) {
                        bloom -= 1;
                        for (const arc of arcs) {
                            spawn([particle({
                                x: arc.to.x + rand(-45, 45), y: arc.to.y + rand(-35, 35), vx: rand(-25, 25), vy: rand(-18, 6),
                                life: rand(700, 1100), size: rand(16, 24), size2: rand(44, 70), rgb: [205, 210, 95], kind: 'soft', add: false, a: 0.24, fadeIn: 150,
                            })]);
                            if (chance() < 0.35) {
                                spawn([particle({
                                    x: arc.to.x + rand(-50, 50), y: arc.to.y + rand(-40, 30), vy: rand(-20, -5), life: 600, size: rand(3, 6),
                                    rgb: [255, 245, 170], kind: 'glint', rot: rand(0, 1), fadeIn: 120,
                                })]);
                            }
                        }
                    }
                }
            },
            draw(ctx, age) {
                if (age >= headMs) return;
                for (const arc of arcs) {
                    const p = bez2(from, arc.control, arc.to, outQuad(age / headMs));
                    drawGlowAt(ctx, p.x, p.y, 16, [230, 230, 120], 0.9);
                }
            },
        },
    };
}
