/**
 * Pure rate-limiting / voice-pool logic for the audio engine.
 *
 * Extracted into a framework-free, Web-Audio-free module so it can be unit
 * tested headlessly (vitest runs without an AudioContext).
 */

/** Identical SFX fired within this window coalesce into a single sound. */
export const SFX_COALESCE_WINDOW_MS = 35;

/** Max simultaneous voices; the oldest voice is culled beyond this. */
export const MAX_VOICES = 8;

/**
 * Coalesces identical SFX names fired in rapid succession (multi-hit attacks,
 * five-card opening draws) into one audible instance per window.
 */
export class SfxRateLimiter {
    private last = new Map<string, number>();

    constructor(private readonly windowMs: number = SFX_COALESCE_WINDOW_MS) {}

    /** Returns true (and records the play) if `name` may play at time `now` (ms). */
    shouldPlay(name: string, now: number): boolean {
        const prev = this.last.get(name);
        if (prev !== undefined && now - prev >= 0 && now - prev < this.windowMs) {
            return false;
        }
        this.last.set(name, now);
        return true;
    }

    reset(): void {
        this.last.clear();
    }
}

export interface PooledVoice {
    /** ms timestamp the voice started (monotonic-ish; only ordering matters). */
    readonly startedAt: number;
    /** Hard-stops the voice (disconnects its bus). Must never throw upward. */
    stop(): void;
}

/**
 * Caps the number of simultaneously sounding voices. Registering a voice past
 * the cap culls (stops + removes) the oldest one.
 */
export class VoicePool {
    private voices: PooledVoice[] = [];

    constructor(private readonly maxVoices: number = MAX_VOICES) {}

    get size(): number {
        return this.voices.length;
    }

    register(voice: PooledVoice): void {
        this.voices.push(voice);
        while (this.voices.length > this.maxVoices) {
            let oldest = this.voices[0];
            for (const v of this.voices) {
                if (v.startedAt < oldest.startedAt) oldest = v;
            }
            this.removeVoice(oldest, true);
        }
    }

    /** A voice finished naturally; forget it without stopping it again. */
    release(voice: PooledVoice): void {
        this.removeVoice(voice, false);
    }

    private removeVoice(voice: PooledVoice, callStop: boolean): void {
        const idx = this.voices.indexOf(voice);
        if (idx === -1) return;
        this.voices.splice(idx, 1);
        if (callStop) {
            try {
                voice.stop();
            } catch {
                // A dead voice must never break the pool.
            }
        }
    }
}
