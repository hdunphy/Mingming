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
import { prefersReducedMotion, setReducedMotionOverride } from '../utils/motionPrefs';

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
    /**
     * Write a run's log to a file automatically the moment the run ends (ticket 59, extended).
     *
     * Henry: *"Having to export at the right time doesn't work. I often forget."* Which is the
     * correct diagnosis of a manual export — a tester who has to remember is a tester who does not.
     * The instruction it enables is *"turn this on, play, then send me everything in your Downloads
     * folder called `mingming-run-*.json`"*, and it never asks the tester to act again.
     *
     * **Off by default**, and it is a settings field rather than a build flag for the same reason:
     * a shipped player has no use for a JSON file per run appearing in their Downloads, and a build
     * flag could not be turned on by a tester at all.
     */
    readonly autoSaveRunLog: boolean;
    /**
     * ── TICKET 146a — THE THREE VFX SWITCHES ──────────────────────────────────────────────────
     *
     * Three, not one, because they fail differently and a player who wants one of them off rarely
     * wants all three off:
     *
     * - `particles` — the canvas layer. The first thing to cost frames on a weak machine, and the
     *   one a player is most likely to turn off for performance rather than for comfort.
     * - `vfx` — flashes, trails, impact bursts, status tells, OS tells. What things LOOK like.
     * - `animations` — card flight, lunges, lifts, hit-stop, shake. What MOVES, which is the axis
     *   motion sensitivity actually runs along.
     *
     * All default ON. **Off means off**, not reduced: with `animations` off the card appears in the
     * lane and the discard count ticks; with `vfx` off the plaque numbers and badges are the only
     * feedback. The game is fully playable with all three off, which is the property that makes
     * them safe to expose at all.
     */
    readonly particles: boolean;
    readonly vfx: boolean;
    readonly animations: boolean;

    /**
     * ── BATTLE LOGS — Henry, 2026-09-20, with the split that made them cheap. ──────────────
     *
     * Ticket 156 records a transcript per fight so a bug report can say what actually happened.
     * They are the only expensive thing the run log stores: a 21-turn 3v3 measures 376 lines and
     * 12.5 KB, against roughly 30 KB for every other row in an entire run.
     *
     * ON by default, because 156 exists precisely because they were missing — but a switch,
     * because it is the one part of the instrumentation a player might reasonably not want paying
     * for, and because "off" here has a genuinely graceful shape: the `FIGHT_LOG` row still
     * records how many lines the fight ran, so the run log keeps its numbers and loses only the
     * text. Nothing else in the log changes.
     */
    readonly battleLogs: boolean;
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
    // `.default(false)` rather than required, so a settings blob written before this field existed
    // still parses. An older save turning auto-save ON would be the wrong direction of surprise.
    autoSaveRunLog: z.boolean().default(false),
    // `.default(true)` for the same reason `autoSaveRunLog` defaults false: a settings blob written
    // before these fields existed still parses, and it parses into the behaviour that player
    // already had — everything on.
    particles: z.boolean().default(true),
    vfx: z.boolean().default(true),
    animations: z.boolean().default(true),
    // `.default(true)` for the same reason as the three above: a settings blob written before this
    // field existed parses into the behaviour that player already had — 156 shipped them on.
    battleLogs: z.boolean().default(true),
});

export const DEFAULT_SETTINGS: ISettings = {
    reducedMotion: 'system', textScale: 1, autoSaveRunLog: false,
    particles: true, vfx: true, animations: true, battleLogs: true,
};

/** What `vfx` resolves to once reduced motion has had its say. */
export type VfxLevel = 'full' | 'flashes' | 'off';

/** The three switches as the layer and the stylesheet actually see them. */
export interface VfxGates {
    readonly particles: boolean;
    readonly animations: boolean;
    readonly vfx: VfxLevel;
}

/**
 * RESOLVE THE SWITCHES AGAINST REDUCED MOTION — ticket 146a's mapping, in one place.
 *
 * *"`reducedMotion` stays and maps to: particles off, animations off, vfx → flashes only."*
 *
 * Reduced motion OUTRANKS the three switches rather than sitting beside them, and the asymmetry is
 * the point: a player who has asked their OS for less motion has said something about their body,
 * and a stored `animations: true` from before that is not consent. The switches can only ever turn
 * things further off.
 *
 * `flashes only` is what survives: a flash has no motion in it — it is one frame brighter — so it
 * keeps the feedback that says WHICH unit was hit without any of the movement that is being
 * declined. It is the reason `vfx` is three-valued here and a boolean in storage.
 *
 * One function, called by `applySettings` for the DOM attributes and by the layer for its own gate,
 * so CSS and JavaScript cannot come to different conclusions about the same player.
 */
export function resolveVfxGates(settings: ISettings, reduced: boolean = prefersReducedMotion()): VfxGates {
    if (reduced) return { particles: false, animations: false, vfx: 'flashes' };
    return {
        particles: settings.particles,
        animations: settings.animations,
        vfx: settings.vfx ? 'full' : 'off',
    };
}

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

    /*
     * Ticket 146a: *"Each switch is a `data-` attribute on the root like `data-reduced-motion` so
     * CSS and the layer read the same truth."*
     *
     * The RESOLVED gates are stamped, not the raw stored booleans. A stylesheet asking
     * `[data-particles="off"]` wants to know whether particles are running, and under reduced
     * motion they are not — whatever the stored switch says. Publishing the raw value here is how
     * CSS and JavaScript end up disagreeing about the same player.
     *
     * `setReducedMotionOverride` above runs first on purpose: `resolveVfxGates` defaults to
     * `prefersReducedMotion()`, which reads that override.
     */
    const gates = resolveVfxGates(settings);
    element.setAttribute('data-particles', gates.particles ? 'on' : 'off');
    element.setAttribute('data-animations', gates.animations ? 'on' : 'off');
    element.setAttribute('data-vfx', gates.vfx);
}
