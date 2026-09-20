/**
 * Fetch, decode and hold the 61 sampled cues — ticket 147a.
 *
 * # WHAT THIS IS NOT
 *
 * It is not an audio graph. It owns exactly one thing: the map from a cue name to a decoded
 * `AudioBuffer`, and the once-only work of filling it. `AudioEngine` decides what to play and
 * when; this decides only what has arrived.
 *
 * # LAZY, BACKGROUND, AND NEVER LOAD-BEARING
 *
 * 147 §8: *"Load lazily on first battle, in the background; the synth covers the first fight if
 * the fetch is slow."* So `primeSampleBank()` is fire-and-forget: it returns immediately, it is
 * idempotent, and nothing waits on it. A cue asked for before its buffer lands falls back to the
 * synth recipe (`SAMPLE_FALLBACK`), which is why the game is fully audible with `public/sfx/`
 * deleted and why a slow connection costs fidelity rather than sound.
 *
 * 675 KB across 61 files, none over 19 KB. Small enough to fetch the lot rather than build a
 * per-cue demand loader, whose complexity would buy nothing at this size.
 *
 * # THE BASE PATH IS NOT OPTIONAL
 *
 * The manifest stores `"sfx/cardHover.mp3"` — relative, no leading slash — and it must be joined
 * onto `import.meta.env.BASE_URL`. The web build serves from `/Mingming/` and the desktop build
 * from `./` over `file://`; an absolute `/sfx/...` breaks both. This is the same trap ticket 42
 * documents at the top of `vite.config.ts`, where absolute asset URLs gave a blank Electron
 * window.
 *
 * # SILENT UNDER TEST, BY THE SAME MECHANISM AS EVERYTHING ELSE
 *
 * The engine's "nothing plays under vitest" property is structural, not mocked: there is no
 * `AudioContext` in node or in jsdom, so `ensureContext()` returns null and `playSfx` stops.
 * This module inherits that by taking the `AudioContext` as an ARGUMENT — no context, no priming,
 * no `fetch`. It deliberately never touches `new Audio()`, which jsdom *does* implement and which
 * would break the property the moment it was constructed.
 */

import { isSampleCue, type SampleCue } from './sfxSamples';

/** One cue's row in `public/sfx/manifest.json`. */
interface ManifestEntry {
    readonly file: string;
    readonly bytes: number;
    readonly seconds: number;
}

interface Manifest {
    readonly format?: string;
    readonly generated?: string;
    readonly cues: Readonly<Record<string, ManifestEntry>>;
}

/** Where the manifest lives, relative to the app's base path. */
export const SFX_MANIFEST_PATH = 'sfx/manifest.json';

const buffers = new Map<SampleCue, AudioBuffer>();

type Phase = 'idle' | 'loading' | 'done' | 'failed';
let phase: Phase = 'idle';
/** The context the buffers were decoded against. A new context invalidates them. */
let decodedFor: AudioContext | null = null;

/** The app's base path, with a trailing slash. `BASE_URL` always has one; belt and braces. */
function baseUrl(): string {
    try {
        const base = import.meta.env?.BASE_URL ?? '/';
        return base.endsWith('/') ? base : `${base}/`;
    } catch {
        return '/';
    }
}

/**
 * Start filling the bank. Returns immediately; nothing waits on the result.
 *
 * Idempotent per context: called on every battle mount, it does the work once. A context change
 * (which in practice means a reload) clears the bank, because an `AudioBuffer` belongs to the
 * context that decoded it and playing one through another is undefined behaviour.
 */
export function primeSampleBank(context: AudioContext): void {
    if (decodedFor !== context) {
        buffers.clear();
        decodedFor = context;
        phase = 'idle';
    }
    if (phase !== 'idle') return;
    phase = 'loading';
    void fill(context);
}

async function fill(context: AudioContext): Promise<void> {
    try {
        const base = baseUrl();
        const response = await fetch(`${base}${SFX_MANIFEST_PATH}`);
        if (!response.ok) throw new Error(`manifest ${response.status}`);
        const manifest = (await response.json()) as Manifest;
        if (!manifest?.cues) throw new Error('manifest has no cues');

        /*
         * One failed cue is one missing sound, not a failed load. A 404 on `cry_ymir` must not
         * cost the other sixty, so every decode is settled independently and its failure is
         * simply a cue that keeps its fallback.
         */
        await Promise.all(Object.entries(manifest.cues).map(async ([name, entry]) => {
            // A manifest key that is not in the typed union is a build the code does not know
            // about. Skipping it is right: `playSfx` could not name it anyway.
            if (!isSampleCue(name) || !entry?.file) return;
            try {
                const res = await fetch(`${base}${entry.file}`);
                if (!res.ok) return;
                const bytes = await res.arrayBuffer();
                // `decodeAudioData` is the only expensive step, and it is off the main thread.
                const buffer = await context.decodeAudioData(bytes);
                // The context may have been replaced while this was in flight.
                if (decodedFor === context) buffers.set(name, buffer);
            } catch {
                // This cue keeps its fallback.
            }
        }));

        phase = 'done';
    } catch {
        /*
         * No manifest at all — a build without `public/sfx`, an offline desktop start, a blocked
         * fetch. `failed` rather than `idle` so the next battle does not retry a fetch that is
         * not going to work; the synth covers every cue and the game is fully audible.
         */
        phase = 'failed';
    }
}

/** The decoded buffer for a cue, or `null` while it has not arrived. */
export function sampleBuffer(cue: SampleCue, context: AudioContext): AudioBuffer | null {
    if (decodedFor !== context) return null;
    return buffers.get(cue) ?? null;
}

/** How the bank is doing — for tests and the debug panel, not for gameplay decisions. */
export function sampleBankStatus(): { phase: Phase; loaded: number } {
    return { phase, loaded: buffers.size };
}

/** Test seam: forget everything. Nothing in the app calls this. */
export function resetSampleBank(): void {
    buffers.clear();
    decodedFor = null;
    phase = 'idle';
}
