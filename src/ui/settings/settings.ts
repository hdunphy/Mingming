/**
 * PLAYER SETTINGS — ticket 36. The half of the settings screen that is not React.
 *
 * # WHY THIS IS NOT IN THE SAVE
 *
 * The ticket says "settings persist outside the game save", and the repo already agrees with it
 * twice: `mingming_audio` (AudioEngine) and `mingming_run_telemetry` (ticket 19) are both top-level
 * keys through the same `ISaveStorage` adapter, deliberately **without** a slot prefix. The argument
 * is the same for all three — a slot is a *save file*, and switching save file must not change how
 * loud the game is or how big the text is. Those are properties of the person, not the run.
 *
 * So this follows the house pattern exactly: one key, a zod schema, `load`/`save` helpers that take
 * an injectable storage and default to the adapter, and nothing in Redux that has to be persisted.
 *
 * # WHY VOLUME IS NOT IN HERE
 *
 * Because it is already in `mingming_audio`, written by `setVolume`/`setMuted`, and a second copy
 * would be a second thing to keep true. The settings screen renders the existing `AudioControls`
 * rather than reimplementing the slider. What lives here is only what had no home before.
 *
 * # WHAT `applySettings` DOES, AND THE ONE THING IT CANNOT
 *
 * Two DOM effects on `<html>`, both idempotent and both readable by CSS:
 *
 * - `style.fontSize` — the root em, which is what `rem` in 2800 lines of stylesheet is measured in.
 * - `data-reduced-motion="on" | "off"` — absent when the choice is `system`, so the plain
 *   `@media (prefers-reduced-motion: reduce)` blocks keep working untouched for everyone who never
 *   opens this screen.
 *
 * The JS half of reduced motion is `motionPrefs.setReducedMotionOverride`, called from here so the
 * two halves cannot disagree about what the player asked for.
 */

import { z } from 'zod';

import { getSaveStorage } from '../../engine/save/storage';
import { setReducedMotionOverride } from '../utils/motionPrefs';

/** One key, no slot prefix — see the header. */
export const SETTINGS_STORAGE_KEY = 'mingming_settings';

/**
 * `system` is the default and means "do not override": the OS preference and the CSS media queries
 * decide, exactly as they did before this screen existed. `on`/`off` are the player overruling both.
 */
export const MOTION_CHOICES = ['system', 'on', 'off'] as const;
export type MotionChoice = (typeof MOTION_CHOICES)[number];

/**
 * Text scale, as a multiplier on the 16px root em.
 *
 * A fixed ladder rather than a slider, for a reason the battle screen makes concrete: ticket 22
 * measured the 1280x800 console to the pixel (six energy pips fit *by one pixel*), and `body`,
 * `#root` and `.battle-screen` are all `overflow: hidden`. Every step up here is a step toward
 * clipping something down there. Four rungs is enough to be an accessibility affordance and few
 * enough that each one can actually be looked at.
 *
 * **FLAGGED:** 1.3 is legible everywhere it was checked *outside* a fight; inside one it crowds the
 * hand. Ticket 37 owns resolution and layout scaling and is where the real audit belongs — this is
 * a floor, and the screen says so next to the control.
 */
export const TEXT_SCALES = [0.9, 1, 1.15, 1.3] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

/** The browser default the whole stylesheet's `rem` values were written against. */
export const BASE_FONT_PX = 16;

export interface ISettings {
    readonly reducedMotion: MotionChoice;
    readonly textScale: number;
}

/**
 * `.default()` and not `.catch()` — ticket 23's argument, applied to a much smaller stake.
 *
 * A malformed settings blob fails the parse and `loadSettings` falls back to the defaults *without
 * writing*, so a hand-edited file is not silently rewritten. `textScale` is bounded rather than
 * enumerated so that a future rung does not invalidate a stored value from a newer build.
 */
export const SettingsSchema = z.object({
    reducedMotion: z.enum(MOTION_CHOICES).default('system'),
    textScale: z.number().min(0.5).max(2).default(1),
});

export const DEFAULT_SETTINGS: ISettings = { reducedMotion: 'system', textScale: 1 };

/** The two methods this module needs. `ISaveStorage` satisfies it; a test can pass a fake. */
export interface SettingsStorage {
    read(key: string): string | null;
    write(key: string, value: string): void;
}

const defaultStorage = (): SettingsStorage => getSaveStorage();

/** Read the stored settings. Any failure — missing, unparseable, invalid — yields the defaults. */
export function loadSettings(storage: SettingsStorage = defaultStorage()): ISettings {
    let raw: string | null;
    try {
        raw = storage.read(SETTINGS_STORAGE_KEY);
    } catch {
        return DEFAULT_SETTINGS;
    }
    if (raw === null) return DEFAULT_SETTINGS;

    try {
        const parsed = SettingsSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
}

/**
 * Persist settings. Swallows a write failure on purpose: a full disk should not stop the player
 * turning motion off for this session, and unlike a save there is nothing here worth a crash.
 */
export function saveSettings(settings: ISettings, storage: SettingsStorage = defaultStorage()): void {
    try {
        storage.write(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Deliberately silent — see the docblock.
    }
}

/** The root font size a scale implies, in px. Exported so a test can assert the arithmetic. */
export const fontSizeFor = (scale: number): string => `${Math.round(BASE_FONT_PX * scale)}px`;

/**
 * Push settings at the document, and at the JS motion gate.
 *
 * Safe to call on a machine with no DOM (the balance harness, a headless test): every branch is
 * guarded, because this is imported by the settings module rather than by a component and there is
 * no `window` in a vitest node environment.
 */
export function applySettings(settings: ISettings, root?: HTMLElement): void {
    setReducedMotionOverride(
        settings.reducedMotion === 'system' ? null : settings.reducedMotion === 'on',
    );

    const element = root ?? (typeof document === 'undefined' ? undefined : document.documentElement);
    if (!element) return;

    element.style.fontSize = fontSizeFor(settings.textScale);
    if (settings.reducedMotion === 'system') element.removeAttribute('data-reduced-motion');
    else element.setAttribute('data-reduced-motion', settings.reducedMotion);
}
