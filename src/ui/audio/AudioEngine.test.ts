import { describe, it, expect } from 'vitest';
import {
    AUDIO_STORAGE_KEY,
    DEFAULT_VOLUME,
    getVolume,
    initAudio,
    isMuted,
    loadAudioSettings,
    play,
    playSfx,
    saveAudioSettings,
    setMuted,
    setVolume,
} from './AudioEngine';
import { SfxRateLimiter, VoicePool, SFX_COALESCE_WINDOW_MS, MAX_VOICES } from './limiters';
import {
    ALL_SFX_NAMES,
    SFX_RECIPES,
    type SfxName,
    type SynthToolkit,
} from './sfxRecipes';

// ---------------------------------------------------------------------------
// Settings persistence (mock localStorage roundtrip)
// ---------------------------------------------------------------------------

function makeMockStorage() {
    const store: Record<string, string> = {};
    return {
        store,
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
    };
}

describe('AudioEngine settings persistence', () => {
    it('roundtrips volume and mute through storage', () => {
        const storage = makeMockStorage();
        saveAudioSettings({ volume: 0.35, muted: true }, storage);
        expect(storage.store[AUDIO_STORAGE_KEY]).toBeTruthy();

        const loaded = loadAudioSettings(storage);
        expect(loaded.volume).toBeCloseTo(0.35);
        expect(loaded.muted).toBe(true);
    });

    it('falls back to defaults with empty or missing storage', () => {
        expect(loadAudioSettings(makeMockStorage())).toEqual({
            volume: DEFAULT_VOLUME,
            muted: false,
        });
        expect(loadAudioSettings(null)).toEqual({ volume: DEFAULT_VOLUME, muted: false });
    });

    it('survives corrupt or hostile stored payloads', () => {
        const storage = makeMockStorage();
        storage.store[AUDIO_STORAGE_KEY] = 'not-json{{{';
        expect(loadAudioSettings(storage)).toEqual({ volume: DEFAULT_VOLUME, muted: false });

        storage.store[AUDIO_STORAGE_KEY] = JSON.stringify({ volume: 'loud', muted: 'yes' });
        expect(loadAudioSettings(storage)).toEqual({ volume: DEFAULT_VOLUME, muted: false });

        storage.store[AUDIO_STORAGE_KEY] = JSON.stringify({ volume: 42, muted: true });
        expect(loadAudioSettings(storage)).toEqual({ volume: 1, muted: true });

        storage.store[AUDIO_STORAGE_KEY] = JSON.stringify({ volume: -3, muted: false });
        expect(loadAudioSettings(storage)).toEqual({ volume: 0, muted: false });

        storage.store[AUDIO_STORAGE_KEY] = 'null';
        expect(loadAudioSettings(storage)).toEqual({ volume: DEFAULT_VOLUME, muted: false });
    });

    it('never throws when storage itself throws', () => {
        const hostile = {
            getItem: () => {
                throw new Error('denied');
            },
            setItem: () => {
                throw new Error('denied');
            },
        };
        expect(loadAudioSettings(hostile)).toEqual({ volume: DEFAULT_VOLUME, muted: false });
        expect(() => saveAudioSettings({ volume: 0.5, muted: false }, hostile)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Headless no-op safety (vitest runs without a real AudioContext)
// ---------------------------------------------------------------------------

describe('AudioEngine headless safety', () => {
    it('playSfx / play / initAudio are silent no-ops without an AudioContext', () => {
        expect(() => initAudio()).not.toThrow();
        for (const name of ALL_SFX_NAMES) {
            expect(() => playSfx(name)).not.toThrow();
        }
        expect(() => play('hit', { intensity: 1 })).not.toThrow();
        expect(() => playSfx('hit', { intensity: -5, pitch: 0 })).not.toThrow();
    });

    it('volume and mute state work in-memory and clamp inputs', () => {
        setVolume(0.3);
        expect(getVolume()).toBeCloseTo(0.3);

        setVolume(7);
        expect(getVolume()).toBe(1);
        setVolume(-1);
        expect(getVolume()).toBe(0);
        setVolume(Number.NaN);
        expect(getVolume()).toBe(0); // NaN ignored, keeps previous value

        setMuted(true);
        expect(isMuted()).toBe(true);
        setMuted(false);
        expect(isMuted()).toBe(false);

        setVolume(DEFAULT_VOLUME);
    });
});

// ---------------------------------------------------------------------------
// Rate limiting / voice cap (pure logic)
// ---------------------------------------------------------------------------

describe('SfxRateLimiter', () => {
    it('coalesces identical SFX inside the window', () => {
        const rl = new SfxRateLimiter(SFX_COALESCE_WINDOW_MS);
        expect(rl.shouldPlay('hit', 1000)).toBe(true);
        expect(rl.shouldPlay('hit', 1010)).toBe(false);
        expect(rl.shouldPlay('hit', 1034)).toBe(false);
        expect(rl.shouldPlay('hit', 1036)).toBe(true);
    });

    it('tracks different SFX names independently', () => {
        const rl = new SfxRateLimiter(35);
        expect(rl.shouldPlay('hit', 1000)).toBe(true);
        expect(rl.shouldPlay('heal', 1001)).toBe(true);
        expect(rl.shouldPlay('hit', 1002)).toBe(false);
        expect(rl.shouldPlay('heal', 1002)).toBe(false);
    });

    it('reset clears history', () => {
        const rl = new SfxRateLimiter(35);
        expect(rl.shouldPlay('hit', 1000)).toBe(true);
        rl.reset();
        expect(rl.shouldPlay('hit', 1001)).toBe(true);
    });
});

describe('VoicePool', () => {
    const makeVoice = (startedAt: number) => {
        let stopped = 0;
        return {
            startedAt,
            stop: () => {
                stopped++;
            },
            get stopCount() {
                return stopped;
            },
        };
    };

    it('culls the oldest voice past the cap', () => {
        const pool = new VoicePool(3);
        const voices = [makeVoice(1), makeVoice(2), makeVoice(3)];
        voices.forEach(v => pool.register(v));
        expect(pool.size).toBe(3);

        const newest = makeVoice(4);
        pool.register(newest);
        expect(pool.size).toBe(3);
        expect(voices[0].stopCount).toBe(1); // oldest stopped
        expect(voices[1].stopCount).toBe(0);
        expect(newest.stopCount).toBe(0);
    });

    it('release removes without stopping; unknown voices are ignored', () => {
        const pool = new VoicePool(MAX_VOICES);
        const v = makeVoice(1);
        pool.register(v);
        pool.release(v);
        expect(pool.size).toBe(0);
        expect(v.stopCount).toBe(0);
        expect(() => pool.release(v)).not.toThrow();
    });

    it('a throwing stop() does not break culling', () => {
        const pool = new VoicePool(1);
        pool.register({
            startedAt: 1,
            stop: () => {
                throw new Error('boom');
            },
        });
        expect(() => pool.register(makeVoice(2))).not.toThrow();
        expect(pool.size).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// SFX recipe completeness (every name in the union has a runnable recipe)
// ---------------------------------------------------------------------------

function makeRecordingToolkit() {
    const calls: string[] = [];
    const toolkit: SynthToolkit = {
        tone: (o) => {
            calls.push('tone');
            expect(o.freq).toBeGreaterThan(0);
            if (o.endFreq !== undefined) expect(o.endFreq).toBeGreaterThan(0);
        },
        noise: (o) => {
            calls.push('noise');
            if (o.filterFreq !== undefined) expect(o.filterFreq).toBeGreaterThan(0);
        },
        arp: (freqs) => {
            calls.push('arp');
            expect(freqs.length).toBeGreaterThan(0);
            freqs.forEach(f => expect(f).toBeGreaterThan(0));
        },
    };
    return { calls, toolkit };
}

describe('SFX recipes', () => {
    it('every SfxName has a recipe and nothing extra is registered', () => {
        const registered = Object.keys(SFX_RECIPES).sort();
        expect(registered).toEqual([...ALL_SFX_NAMES].sort());
        for (const name of ALL_SFX_NAMES) {
            expect(typeof SFX_RECIPES[name as SfxName]).toBe('function');
        }
    });

    it('every recipe schedules at least one sound with sane parameters', () => {
        for (const name of ALL_SFX_NAMES) {
            const { calls, toolkit } = makeRecordingToolkit();
            SFX_RECIPES[name as SfxName](toolkit, { intensity: 0.5, pitch: 1 });
            expect(calls.length, `recipe '${name}' scheduled nothing`).toBeGreaterThan(0);
        }
    });

    it('intensity extremes keep hit parameters valid', () => {
        for (const intensity of [0, 1, -2, 5]) {
            const { toolkit } = makeRecordingToolkit();
            expect(() => SFX_RECIPES.hit(toolkit, { intensity, pitch: 1 })).not.toThrow();
            expect(() => SFX_RECIPES.hitCrit(toolkit, { intensity, pitch: 1 })).not.toThrow();
        }
    });

    it('statusApply pitch variation keeps frequencies positive', () => {
        for (const pitch of [0.85, 1, 1.27]) {
            const { calls, toolkit } = makeRecordingToolkit();
            SFX_RECIPES.statusApply(toolkit, { intensity: 0.5, pitch });
            expect(calls.length).toBeGreaterThan(0);
        }
    });
});
