/**
 * THE SPRITES' SHUDDER — ticket 189d. Two small motions on a body's sprite frame, both written as
 * the CSS `translate` property so they compose with the lunge (framer-motion owns `transform`).
 *
 * - VIBRATE: during a hit-stop the target and the attacker shudder, 2-6 px, fading as the freeze runs
 *   out. It runs on REAL time, because the whole point is that game time has stopped.
 * - SHAKE: after the freeze the target jolts, `4 + 7 s` px, decaying over `SHAKE_MS` of GAME time.
 *   A freeze mid-shake holds it where it is, and a shake that starts under a freeze starts when it
 *   lifts.
 */

import { smoothNoise } from './CameraShake';

export const SHAKE_MS = 260;
/** Ticket 190d: a body trembles for this long after the last time an attack asked (so a pour keeps it going). */
export const TREMBLE_HOLD_MS = 60;
const TREMBLE_RATE = 0.16;
/** Radians per millisecond: ~14 Hz for the shake, ~30 Hz for the vibration (faster, tighter). */
const SHAKE_RATE = 0.088;
const VIBRATE_RATE = 0.19;

/** The slice of an element the field writes. */
export interface ShakeTarget {
    readonly style: { translate: string };
}

export interface ShakeFrame {
    readonly realDt: number;
    readonly gameDt: number;
    readonly frozen: boolean;
}

interface Body {
    el: ShakeTarget | null;
    vibrate: { px: number; totalMs: number } | null;
    shake: { px: number; ageMs: number } | null;
    /** A small steady shudder while an attack pours on the body; game time, so a freeze holds it. */
    tremble: { px: number; leftMs: number; ageMs: number } | null;
    realMs: number;
    written: string;
}

export class SpriteShakes {
    private bodies = new Map<string, Body>();

    constructor(private readonly freezeRemainingMs: () => number) {}

    private body(id: string): Body {
        let body = this.bodies.get(id);
        if (!body) {
            body = { el: null, vibrate: null, shake: null, tremble: null, realMs: 0, written: '' };
            this.bodies.set(id, body);
        }
        return body;
    }

    /** A sprite frame mounted. Returns the detach. */
    attach(id: string, el: ShakeTarget): () => void {
        const body = this.body(id);
        body.el = el;
        return () => {
            if (body.el === el) body.el = null;
            el.style.translate = '';
        };
    }

    /** Shudder these bodies for as long as the freeze that was just requested lasts. */
    vibrate(ids: ReadonlyArray<string | undefined>, px: number): void {
        const totalMs = this.freezeRemainingMs();
        if (!(px > 0) || !(totalMs > 0)) return;
        for (const id of ids) {
            if (!id) continue;
            const body = this.body(id);
            body.vibrate = { px: Math.max(px, body.vibrate?.px ?? 0), totalMs: Math.max(totalMs, body.vibrate?.totalMs ?? 0) };
        }
    }

    /** Jolt this body, after the freeze, for `SHAKE_MS` of game time. */
    shake(id: string, px: number): void {
        if (!(px > 0)) return;
        this.body(id).shake = { px, ageMs: 0 };
    }

    /**
     * Shudder this body a little (ticket 190d: while a beam, jet or vine pours on it). Each call keeps
     * it going for `TREMBLE_HOLD_MS` more of game time.
     */
    tremble(id: string, px: number): void {
        if (!(px > 0)) return;
        const body = this.body(id);
        body.tremble = { px, leftMs: TREMBLE_HOLD_MS, ageMs: body.tremble?.ageMs ?? 0 };
    }

    get active(): boolean {
        for (const body of this.bodies.values()) if (body.vibrate || body.shake || body.tremble) return true;
        return false;
    }

    /** One frame. Returns true while anything is still moving. */
    step(frame: ShakeFrame): boolean {
        let live = false;
        const remaining = this.freezeRemainingMs();
        for (const body of this.bodies.values()) {
            let x = 0;
            if (frame.frozen && body.vibrate && remaining > 0) {
                body.realMs += frame.realDt;
                const fade = Math.min(1, remaining / body.vibrate.totalMs);
                x += body.vibrate.px * fade * smoothSquare(body.realMs * VIBRATE_RATE);
            } else if (!frame.frozen) {
                body.vibrate = null;
                body.realMs = 0;
            }
            if (body.shake) {
                body.shake.ageMs += frame.frozen ? 0 : Math.max(0, frame.gameDt);
                const p = body.shake.ageMs / SHAKE_MS;
                if (p >= 1) body.shake = null;
                else x += body.shake.px * (1 - p) * Math.sin(body.shake.ageMs * SHAKE_RATE);
            }
            if (body.tremble && !frame.frozen) {
                body.tremble.ageMs += Math.max(0, frame.gameDt);
                body.tremble.leftMs -= Math.max(0, frame.gameDt);
                if (body.tremble.leftMs <= 0) body.tremble = null;
            }
            if (body.tremble) x += body.tremble.px * Math.sin(body.tremble.ageMs * TREMBLE_RATE);
            const next = x === 0 ? '' : `${x.toFixed(2)}px 0`;
            if (next !== body.written) {
                body.written = next;
                if (body.el) body.el.style.translate = next;
            }
            if (body.vibrate || body.shake || body.tremble) live = true;
        }
        return live;
    }

    /** Leaving the battle: nothing is moving, nothing is left offset. */
    reset(): void {
        for (const body of this.bodies.values()) if (body.el) body.el.style.translate = '';
        for (const body of this.bodies.values()) { body.vibrate = null; body.shake = null; body.tremble = null; body.written = ''; }
    }
}

/** A rounded square-ish wave in [-1, 1] so the vibration reads as a shudder, not a sway. */
function smoothSquare(phase: number): number {
    return Math.max(-1, Math.min(1, 1.6 * Math.sin(phase) + 0.2 * smoothNoise(phase * 40, 3)));
}
