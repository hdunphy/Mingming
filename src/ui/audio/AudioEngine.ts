/**
 * AudioEngine — fully synthesized SFX for the terminal (Web Audio API, zero
 * asset files). Plain TS, framework-free.
 *
 * Design constraints:
 * - Lazy singleton AudioContext, created/resumed on the first user gesture
 *   (browser autoplay policy). `initAudio()` installs one-time pointerdown /
 *   keydown unlockers.
 * - Every public function is a silent no-op when audio is unavailable
 *   (SSR / vitest node env / jsdom without AudioContext) and never throws.
 * - Volume + mute persist through the save-storage adapter under 'mingming_audio' (a dedicated
 *   key, separate from the game save), wrapped in try/catch.
 * - Identical SFX within ~35ms coalesce; at most 8 simultaneous voices
 *   (oldest culled). See limiters.ts for the pure logic.
 * - Each sound is a small pure recipe over a synthesis toolkit — see
 *   sfxRecipes.ts for the tunable numbers.
 */

import {
    SFX_RECIPES,
    type ArpOpts,
    type NoiseOpts,
    type SfxName,
    type SfxOptions,
    type SynthToolkit,
    type ToneOpts,
} from './sfxRecipes';
import { SfxRateLimiter, VoicePool } from './limiters';
import { getSaveStorage } from '../../engine/save/storage';

export type { SfxName, SfxOptions } from './sfxRecipes';

// ---------------------------------------------------------------------------
// Settings persistence (pure helpers, exported for headless tests)
// ---------------------------------------------------------------------------

export const AUDIO_STORAGE_KEY = 'mingming_audio';
export const DEFAULT_VOLUME = 0.7;

export interface AudioSettings {
    /** Linear 0..1 (a perceptual curve is applied at the master gain). */
    volume: number;
    muted: boolean;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Ticket 23: this used to reach for the global `localStorage` directly. It now goes through the
 * save-storage adapter (`engine/save/storage.ts`), which is the one module allowed to name it —
 * Steam Cloud syncs files, not `localStorage`, and ticket 42 swaps a file backend in behind that
 * interface. Audio settings are a separate KEY, not a separate store, so they ride along.
 *
 * The `StorageLike` shape is kept because tests inject their own two-method fake; only the default
 * changed. The adapter already swallows read failures and reports absence, and `write` throws on
 * failure into `saveAudioSettings`'s existing catch — a full disk must never silence the game.
 */
function defaultStorage(): StorageLike {
    const backend = getSaveStorage();
    return {
        getItem: (key: string) => backend.read(key),
        setItem: (key: string, value: string) => backend.write(key, value),
    };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function loadAudioSettings(storage: StorageLike | null = defaultStorage()): AudioSettings {
    const fallback: AudioSettings = { volume: DEFAULT_VOLUME, muted: false };
    if (!storage) return fallback;
    try {
        const raw = storage.getItem(AUDIO_STORAGE_KEY);
        if (!raw) return fallback;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) return fallback;
        const rec = parsed as Record<string, unknown>;
        return {
            volume:
                typeof rec.volume === 'number' && Number.isFinite(rec.volume)
                    ? clamp01(rec.volume)
                    : fallback.volume,
            muted: rec.muted === true,
        };
    } catch {
        return fallback;
    }
}

export function saveAudioSettings(
    settings: AudioSettings,
    storage: StorageLike | null = defaultStorage()
): void {
    try {
        storage?.setItem(AUDIO_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Storage full / denied — sound still works for this session.
    }
}

// ---------------------------------------------------------------------------
// Engine state (module-level singleton)
// ---------------------------------------------------------------------------

let settings: AudioSettings | null = null;
let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let unlockInstalled = false;
let noiseBuffer: AudioBuffer | null = null;
let noiseBufferCtx: AudioContext | null = null;

const rateLimiter = new SfxRateLimiter();
const voicePool = new VoicePool();

function getSettings(): AudioSettings {
    if (!settings) settings = loadAudioSettings();
    return settings;
}

type AudioContextCtor = new () => AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
        AudioContext?: AudioContextCtor;
        webkitAudioContext?: AudioContextCtor;
    };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Squared curve reads far more linearly to the ear than raw gain. */
function applyMasterGain(): void {
    if (!masterGain || !ctx) return;
    const s = getSettings();
    const target = s.muted ? 0 : s.volume * s.volume;
    try {
        masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.01);
    } catch {
        try {
            masterGain.gain.value = target;
        } catch {
            // Truly hostile environment — stay silent.
        }
    }
}

/** Creates (once) and resumes the context. Returns null wherever audio can't exist. */
function ensureContext(): AudioContext | null {
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    if (!ctx) {
        try {
            ctx = new Ctor();
            masterGain = ctx.createGain();
            applyMasterGain();
            masterGain.connect(ctx.destination);
        } catch {
            ctx = null;
            masterGain = null;
            return null;
        }
    }
    if (ctx.state === 'suspended') {
        try {
            void ctx.resume().catch(() => {});
        } catch {
            // resume() unavailable — the unlock listener will retry.
        }
    }
    return ctx;
}

/**
 * Installs one-time window listeners so the first user gesture creates/resumes
 * the AudioContext (autoplay policy). Safe to call repeatedly; no-op without a
 * window.
 */
export function initAudio(): void {
    if (unlockInstalled || typeof window === 'undefined') return;
    unlockInstalled = true;
    const unlock = () => {
        ensureContext();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
    };
    try {
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', unlock);
    } catch {
        // No listeners — audio will still unlock via the mute-toggle click.
    }
}

// ---------------------------------------------------------------------------
// Synthesis toolkit (the Web Audio realization of SynthToolkit)
// ---------------------------------------------------------------------------

function getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (noiseBuffer && noiseBufferCtx === context) return noiseBuffer;
    const length = Math.max(1, Math.floor(context.sampleRate));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buffer;
    noiseBufferCtx = context;
    return buffer;
}

interface RealizedToolkit extends SynthToolkit {
    /** Latest scheduled end time (AudioContext clock, seconds). */
    readonly endTime: number;
}

function makeToolkit(context: AudioContext, bus: GainNode): RealizedToolkit {
    const base = context.currentTime;
    let maxEnd = base;
    const MIN_GAIN = 0.0001;
    const safeFreq = (f: number) => Math.max(1, f);

    const tone = ({
        freq,
        endFreq,
        type = 'sine',
        delay = 0,
        attack = 0.005,
        decay = 0.15,
        gain = 0.5,
    }: ToneOpts): void => {
        const t0 = base + delay;
        const tEnd = t0 + attack + decay;
        const osc = context.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(safeFreq(freq), t0);
        if (endFreq !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(safeFreq(endFreq), tEnd);
        }
        const env = context.createGain();
        env.gain.setValueAtTime(MIN_GAIN, t0);
        env.gain.linearRampToValueAtTime(Math.max(MIN_GAIN, gain), t0 + attack);
        env.gain.exponentialRampToValueAtTime(MIN_GAIN, tEnd);
        osc.connect(env);
        env.connect(bus);
        osc.start(t0);
        osc.stop(tEnd + 0.02);
        maxEnd = Math.max(maxEnd, tEnd + 0.02);
    };

    const noise = ({
        duration = 0.1,
        delay = 0,
        attack = 0.003,
        gain = 0.3,
        filterType = 'lowpass',
        filterFreq = 1200,
        filterEndFreq,
        q = 0.9,
    }: NoiseOpts): void => {
        const t0 = base + delay;
        const tEnd = t0 + duration;
        const src = context.createBufferSource();
        src.buffer = getNoiseBuffer(context);
        src.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.setValueAtTime(safeFreq(filterFreq), t0);
        if (filterEndFreq !== undefined) {
            filter.frequency.exponentialRampToValueAtTime(safeFreq(filterEndFreq), tEnd);
        }
        filter.Q.value = q;
        const env = context.createGain();
        env.gain.setValueAtTime(MIN_GAIN, t0);
        env.gain.linearRampToValueAtTime(Math.max(MIN_GAIN, gain), t0 + attack);
        env.gain.exponentialRampToValueAtTime(MIN_GAIN, tEnd);
        src.connect(filter);
        filter.connect(env);
        env.connect(bus);
        src.start(t0);
        src.stop(tEnd + 0.02);
        maxEnd = Math.max(maxEnd, tEnd + 0.02);
    };

    const arp = (
        freqs: number[],
        { step = 0.08, type = 'square', decay = 0.15, gain = 0.08, delay = 0 }: ArpOpts = {}
    ): void => {
        freqs.forEach((freq, i) => {
            tone({ freq, type, delay: delay + i * step, attack: 0.004, decay, gain });
        });
    };

    return {
        tone,
        noise,
        arp,
        get endTime() {
            return maxEnd;
        },
    };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fire an SFX. Silent no-op when audio is unavailable, muted, rate-limited, or
 * the context is still locked. Never throws.
 */
export function playSfx(name: SfxName, opts: SfxOptions = {}): void {
    try {
        const s = getSettings();
        if (s.muted || s.volume <= 0) return;
        const context = ensureContext();
        if (!context || context.state !== 'running' || !masterGain) return;

        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (!rateLimiter.shouldPlay(name, now)) return;

        const recipe = SFX_RECIPES[name];
        if (!recipe) return;

        const bus = context.createGain();
        bus.connect(masterGain);
        const toolkit = makeToolkit(context, bus);
        recipe(toolkit, {
            intensity: clamp01(opts.intensity ?? 0.4),
            pitch: opts.pitch ?? 1,
        });

        const voice = {
            startedAt: now,
            stop: () => {
                try {
                    bus.disconnect();
                } catch {
                    // Already gone.
                }
            },
        };
        voicePool.register(voice);
        const ttlMs = Math.max(60, (toolkit.endTime - context.currentTime) * 1000 + 120);
        setTimeout(() => voicePool.release(voice), ttlMs);
    } catch {
        // Audio must never break the game.
    }
}

/** Spec-named alias for playSfx. */
export const play = playSfx;

export function getVolume(): number {
    return getSettings().volume;
}

export function setVolume(volume: number): void {
    const s = getSettings();
    settings = { ...s, volume: clamp01(Number.isFinite(volume) ? volume : s.volume) };
    saveAudioSettings(settings);
    applyMasterGain();
}

export function isMuted(): boolean {
    return getSettings().muted;
}

export function setMuted(muted: boolean): void {
    settings = { ...getSettings(), muted };
    saveAudioSettings(settings);
    applyMasterGain();
    if (!muted) {
        // Unmuting IS a user gesture — use it to unlock the context.
        ensureContext();
    }
}
