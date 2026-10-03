/**
 * TICKET 190d — THE LIVE ATTACK EFFECTS. The particle layer owns one of these beside its
 * `ParticleField`: effects are added when an attack leaves the caster, stepped on the battle clock
 * (a freeze holds them), drawn under the particles, and dropped when their time is up. Each frees
 * nothing by itself — the particles it threw belong to the field, which retires them on its own.
 */

import type { AttackEffect, Spawn } from './AttackEffect';

/** A backgrounded tab hands back a multi-second delta; the field clamps it the same way. */
const MAX_DT_MS = 64;

interface Live {
    readonly effect: AttackEffect;
    ageMs: number;
}

export class EffectField {
    private live: Live[] = [];

    get count(): number {
        return this.live.length;
    }

    add(effect: AttackEffect): void {
        this.live.push({ effect, ageMs: 0 });
    }

    /** Advance by `dtMs` of game time. Returns how many effects are still alive. */
    step(dtMs: number, spawn: Spawn): number {
        const dt = Math.min(Math.max(dtMs, 0), MAX_DT_MS);
        for (const entry of this.live) {
            entry.ageMs += dt;
            entry.effect.step(entry.ageMs, dt, spawn);
        }
        this.live = this.live.filter((entry) => entry.ageMs < entry.effect.durationMs);
        return this.live.length;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        for (const entry of this.live) entry.effect.draw(ctx, entry.ageMs);
    }

    clear(): void {
        this.live = [];
    }
}
