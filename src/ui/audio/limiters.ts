/**
 * Pure rate-limiting / voice-pool logic for the audio engine.
 *
 * Extracted into a framework-free, Web-Audio-free module so it can be unit
 * tested headlessly (vitest runs without an AudioContext).
 */

/**
 * Identical SFX fired within this window coalesce into a single sound.
 *
 * **60 ms since ticket 147b**, which is the number the ticket names. It is longer than
 * `TRAIL_STAGGER_MS` (40 ms), the gap 146c leaves between one cast's per-target impacts — so a
 * Side card hitting three bodies would coalesce to ONE hit under this rule. That is why a
 * deliberate series carries `step` (see `SfxOptions`): the caller says "this is the Nth of a
 * sequence I meant", which both pitches it and exempts it from coalescing. The coalescer exists
 * to stop ACCIDENTAL stacking — one event firing twice in a frame — and a stated series is not
 * that.
 */
export const SFX_COALESCE_WINDOW_MS = 60;

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

/**
 * ── SPACING — Henry, 2026-09-25, off the Rootfall playtest ────────────────────────────────────
 *
 * *"fenrir_v2 using burn cards and like 5 noises play at once ... its jarring."* He was counting
 * right. One Ember Jab from fenrir_v2 fires six DIFFERENT cues in the same frame — the card's
 * whoosh, the Fire cast, the hit, Burn landing, Sharp landing on himself and his firmware's proc —
 * and Ignite adds a draw tick. The coalescer above only merges IDENTICAL names, so none of those
 * six ever met it. Asked to choose between one headline sound, muting self-buffs, or spacing,
 * Henry ruled **space the sounds**.
 *
 * So different cues that arrive together are laid out one `SFX_SPACING_MS` apart, in the order
 * they arrived — the card, then what it did. Six cues become a 400 ms phrase instead of a chord.
 */
export const SFX_SPACING_MS = 80;

/**
 * How far behind "now" the spacer may run before it starts dropping cues.
 *
 * Six slots — one card's worth. Without a bound, a player clicking cards faster than 480 ms apart
 * would push every sound further behind the thing that caused it, until the audio narrated plays
 * the board had finished a second ago. A late sound is a wrong sound, so past this the cue is
 * dropped rather than queued.
 */
export const SFX_SPACING_MAX_LAG_MS = SFX_SPACING_MS * 6;

/**
 * Hands each cue its delay. Pure: `now` is passed in, nothing is scheduled here.
 */
export class SfxSpacer {
    /** The earliest moment the NEXT cue may start. */
    private nextFree = Number.NEGATIVE_INFINITY;

    constructor(
        private readonly spacingMs: number = SFX_SPACING_MS,
        private readonly maxLagMs: number = SFX_SPACING_MAX_LAG_MS,
    ) {}

    /**
     * The delay in ms before this cue should sound, or null if it would land too late to mean
     * anything. A `required` cue (a kill, a big hit) is never dropped: past the lag bound it plays
     * AT the bound, and does not push the queue further out.
     */
    delayFor(now: number, required = false): number | null {
        const delay = Math.max(0, this.nextFree - now);
        if (delay > this.maxLagMs) {
            if (!required) return null;
            return this.maxLagMs;
        }
        this.nextFree = now + delay + this.spacingMs;
        return delay;
    }

    reset(): void {
        this.nextFree = Number.NEGATIVE_INFINITY;
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

// ---------------------------------------------------------------------------
// Ticket 147b — the mixing rules, as arithmetic
// ---------------------------------------------------------------------------

/**
 * Semitones between one impact of a multi-hit and the next.
 *
 * Small enough that three of them read as one attack rather than three notes, large enough that
 * the ear counts them. Two semitones over a three-target Side card is a major second and a half —
 * audible, not melodic.
 */
export const MULTI_HIT_SEMITONES = 2;

/** How far a `pitch` multiplier moves per semitone. Equal temperament, so the twelfth root of 2. */
export function semitones(n: number): number {
    return Math.pow(2, n / 12);
}

/**
 * Impacts DROP with damage — ticket 147b's "pitch by magnitude".
 *
 * Down is the direction that reads as weight: a big hit is a lower, heavier thump, the same way
 * `hit`'s own recipe already lengthens and lowers with `intensity`. Three semitones across the
 * whole range, because more than that stops sounding like the same sound.
 *
 * @param fraction damage as a share of the target's max HP, 0..1.
 */
export function pitchForDamage(fraction: number): number {
    const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
    return semitones(-3 * clamped);
}

/**
 * Ticks RISE with stacks — the other half of "pitch by magnitude".
 *
 * Opposite direction to impacts on purpose: a burn getting worse should climb, and using the same
 * direction for both would make a big hit and a deep burn sound alike. Capped at eight stacks,
 * past which the pitch stops moving rather than turning into a whistle.
 */
export function pitchForStacks(stacks: number): number {
    const n = Math.min(8, Math.max(0, Number.isFinite(stacks) ? stacks : 0));
    return semitones(n * 0.75);
}

/**
 * `cardSelect` climbs a semitone per card already played this turn — ticket 147b, from the
 * Balatro/Monster Train note in 147 §1: *"the third card played this turn sits a step higher than
 * the first."*
 *
 * Capped at an octave. A twelve-card turn is possible and a cue two octaves up is a squeak.
 */
export function pitchForCardsPlayed(cardsPlayedThisTurn: number): number {
    const n = Math.min(12, Math.max(0, Number.isFinite(cardsPlayedThisTurn) ? cardsPlayedThisTurn : 0));
    return semitones(n);
}

/** How far the bus ducks under a big moment, and for how long — ticket 147b: −6 dB for 250 ms. */
export const DUCK_DB = -6;
export const DUCK_MS = 250;

/** Linear gain for a decibel change. −6 dB is ≈0.501. */
export function gainForDb(db: number): number {
    return Math.pow(10, db / 20);
}

/**
 * How much quieter `recoil` plays than the impacts (194l, Henry: *"Quieter"*).
 *
 * `recoil` shares the `hit` sample with every impact, so a recoil landing right after the impact on
 * the target sounded like the hit playing twice. Starting at -9 dB; this is the one number to tune
 * by ear.
 */
export const RECOIL_DB = -9;

/** A cue's own level, in dB below its sample. Cues not listed play at 0 dB. */
export const CUE_LEVEL_DB: Readonly<Record<string, number>> = {
    recoil: RECOIL_DB,
};

/** The linear gain a cue plays at, before the bus and the master. */
export function cueGain(name: string): number {
    return gainForDb(CUE_LEVEL_DB[name] ?? 0);
}

/**
 * The cues everything else ducks under.
 *
 * 147b names four. They are the moments where something big happened and the rest of the board's
 * chatter — ticks, hovers, a draw — must not sit on top of it.
 */
export const DUCKING_CUES: ReadonlySet<string> = new Set(['hitBig', 'kill', 'victory', 'defeat']);

/**
 * The cues the COMBAT SOUNDS switch does NOT silence — ticket 147b.
 *
 * Stated as the exceptions rather than as the rule, because the rule is "the fight's own noise"
 * and that is most of the list. What survives the switch is the interface (clicks, refusals, the
 * hover and the pick), the beats that tell you whose move it is, and the run's own stingers —
 * a victory, a defeat, a reward, a gym. Turn a fight quiet and you can still hear the game
 * responding to you and still hear that you won.
 *
 * The switch is NOT the volume slider and NOT the 146 `vfx` switch: one governs how loud
 * everything is, one governs a different sense entirely, and this governs which half of the noise
 * exists at all.
 */
export const NON_COMBAT_CUES: ReadonlySet<string> = new Set([
    'uiClick', 'uiError',
    'cardHover', 'cardSelect',
    'reveal', 'rewardClaim', 'discountPrimed', 'breach', 'levelUp',
    'victory', 'defeat', 'gymIntro',
    'turnPlayer', 'turnEnemy', 'turnStart', 'turnEnd',
]);
