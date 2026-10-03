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
import { setCombatSounds } from '../audio/AudioEngine';
import { BATTLE_SPEEDS, DEFAULT_BATTLE_SPEED, isInstantTier, type BattleSpeedTier } from '../vfx/clock/battleSpeedTiers';
import { patchBattleSpeedInputs } from '../vfx/clock/battleClockRuntime';

export { BATTLE_SPEEDS, type BattleSpeedTier };

/** The shake slider runs 0-100; 60 is the ruled default (Henry, 2026-10-02: "60% is good"). */
export const SHAKE_MIN = 0;
export const SHAKE_MAX = 100;
export const DEFAULT_SCREEN_SHAKE = 60;

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
     * ── TICKET 146a's `particles`, AND TICKET 190a's BATTLE SWITCHES ───────────────────────────
     *
     * `particles` — the canvas layer. The first thing to cost frames on a weak machine, and the one
     * a player is most likely to turn off for performance rather than for comfort.
     *
     * 190a retired the two other 146a switches (`vfx` "Effects" and `animations` "Animations", ruled
     * D1, 2026-10-02) in favour of the five battle speeds. An old save is migrated on load:
     * `animations: false` becomes Instant, and `vfx: false` becomes `flashes: false`.
     *
     * All default ON / Showy. Reduced motion still outranks every one of them (`resolveVfxGates`).
     */
    readonly particles: boolean;
    /** Slow · Showy · Snappy · Fast · Instant. Default Showy (ruled). Instant skips every effect AND every wait. */
    readonly battleSpeed: BattleSpeedTier;
    /** Camera shake strength, 0-100. Default 60 (ruled). The target's own shudder is not part of it. */
    readonly screenShake: number;
    /** The freeze on a heavy hit. */
    readonly hitStop: boolean;
    /** Hit flashes and the big-move stage dim. Keep under WCAG's three flashes a second. */
    readonly flashes: boolean;
    /** When cards are queued the clock runs up to x1.6. Default ON (ruled). */
    readonly catchUp: boolean;

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

    /**
     * ── COMBAT SOUNDS — ticket 147b. ────────────────────────────────────────
     *
     * The fight's own noise — casts, impacts, ticks, cries, OS tells — as distinct from the
     * interface's clicks and the run's stingers, which stay.
     *
     * **147b is explicit that the 146 `vfx` switch does NOT mute.** They are different senses and
     * different reasons: somebody turns particles off for frames and somebody turns combat sounds
     * off to hear something else, and tying them would mean a player who wanted a quiet fight lost
     * their impact flashes too. The volume slider is a THIRD thing again — it governs everything,
     * and this governs which half of everything exists.
     *
     * ON by default, like every other switch here.
     */
    readonly combatSounds: boolean;

    /**
     * ── SHOW ENEMY HAND — ticket 159c. ──────────────────────────────────────
     *
     * The edge tab and its panel: what the enemy is holding, or about to draw. 159 §5 ruled it a
     * switch defaulting ON, because 159 exists to close a visibility gap and a telegraph nobody
     * can see closes nothing — but a player who wants to work it out for themselves should be able
     * to, and a streamer who finds the tab in shot should be able to move it out.
     *
     * **Deliberately NOT under `resolveVfxGates`.** The three 146a switches are overruled by
     * reduced motion, which is right for them and wrong here: reduced motion is a statement about
     * MOVEMENT, and taking information away from a player who asked for less of it would be a
     * different decision made on their behalf. This one is theirs alone.
     */
    readonly showEnemyHand: boolean;

    /**
     * ── SHOW ADVANCED CONTENT — ticket 182b/d. ──────────────────────────────
     *
     * Every hide-when-empty rule (an empty macro rack, a tier row nobody has unlocked, a party
     * picker with one Mingming...) is switched off by this: the screen looks as it did before 182.
     * About the PERSON rather than the save, like text size, so it carries to a new save slot.
     * OFF by default. Read it through `useAdvancedContent()`, never directly.
     */
    readonly showAdvancedContent: boolean;

    /**
     * ── SHOW TIPS — ticket 183d (it moves the control 182 cut off the toast). ──
     *
     * The one-line onboarding toasts (`Callout`). ON by default: a new player is the one they are
     * for. Off draws none and marks none seen, so turning it back on resumes where they left off.
     * About the PERSON, like Show advanced content. Read it through `useShowTips()`.
     */
    readonly showTips: boolean;
}

/**
 * `.default()` and not `.catch()` — ticket 23's argument, applied to a much smaller stake.
 *
 * A malformed settings blob fails the parse and `loadSettings` falls back to the defaults *without
 * writing*, so a hand-edited file is not silently rewritten. `textScale` is bounded rather than
 * enumerated so that a future rung does not invalidate a stored value from a newer build.
 */
const SettingsFields = z.object({
    reducedMotion: z.enum(MOTION_CHOICES).default('system'),
    textScale: z.number().min(0.5).max(2).default(1),
    // `.default(false)` rather than required, so a settings blob written before this field existed
    // still parses. An older save turning auto-save ON would be the wrong direction of surprise.
    autoSaveRunLog: z.boolean().default(false),
    // `.default(true)` for the same reason `autoSaveRunLog` defaults false: a settings blob written
    // before these fields existed still parses, and it parses into the behaviour that player
    // already had — everything on.
    particles: z.boolean().default(true),
    // 190a. `.default()` so a blob from before the five tiers parses into Showy and everything on.
    battleSpeed: z.enum(BATTLE_SPEEDS).default(DEFAULT_BATTLE_SPEED),
    screenShake: z.number().min(SHAKE_MIN).max(SHAKE_MAX).default(DEFAULT_SCREEN_SHAKE),
    hitStop: z.boolean().default(true),
    flashes: z.boolean().default(true),
    catchUp: z.boolean().default(true),
    // `.default(true)` for the same reason as the three above: a settings blob written before this
    // field existed parses into the behaviour that player already had — 156 shipped them on.
    battleLogs: z.boolean().default(true),
    // `.default(true)` as above: a blob written before this field parses into the behaviour that
    // player already had — the fight made noise.
    combatSounds: z.boolean().default(true),
    // `.default(true)` as above: a blob written before this field parses into the behaviour that
    // player already had — 159b shipped the tab on.
    showEnemyHand: z.boolean().default(true),
    // `.default(false)`: a blob written before 182 parses into the screens as a new player sees them.
    showAdvancedContent: z.boolean().default(false),
    // `.default(true)`: a blob written before 183d parses into the behaviour that player had — tips on.
    showTips: z.boolean().default(true),
});

/**
 * The retired 146a switches, read out of an old blob BEFORE the strict parse drops them (zod strips
 * unknown keys). `animations: false` -> Instant; `vfx: false` -> flashes off. A value the player has
 * already chosen on the new build is never overridden.
 */
export function migrateLegacySettings(raw: unknown): unknown {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
    const old = raw as Record<string, unknown>;
    const next: Record<string, unknown> = { ...old };
    if (old.animations === false && old.battleSpeed === undefined) next.battleSpeed = 'instant';
    if (old.vfx === false && old.flashes === undefined) next.flashes = false;
    delete next.animations;
    delete next.vfx;
    return next;
}

export const SettingsSchema = z.preprocess(migrateLegacySettings, SettingsFields);

export const DEFAULT_SETTINGS: ISettings = {
    reducedMotion: 'system', textScale: 1, autoSaveRunLog: false,
    particles: true, battleSpeed: DEFAULT_BATTLE_SPEED, screenShake: DEFAULT_SCREEN_SHAKE,
    hitStop: true, flashes: true, catchUp: true, battleLogs: true, combatSounds: true,
    showEnemyHand: true, showAdvancedContent: false, showTips: true,
};

/** What the effects layer resolves to once reduced motion and Instant have had their say. */
export type VfxLevel = 'full' | 'flashes' | 'off';

/** The switches as the layer and the stylesheet actually see them. */
export interface VfxGates {
    readonly particles: boolean;
    /** Movement: lunges, card flight, sprite motion. Off under reduced motion and at Instant. */
    readonly animations: boolean;
    readonly vfx: VfxLevel;
    /** The freeze on a heavy hit. */
    readonly hitStop: boolean;
    /** Camera shake strength, 0-1. */
    readonly shake: number;
    /** Hit flashes and the big-move dim. */
    readonly flashes: boolean;
}

/**
 * RESOLVE THE SWITCHES AGAINST REDUCED MOTION AND INSTANT — ticket 146a's mapping, in one place,
 * widened by ticket 190a.
 *
 * *"`reducedMotion` stays and maps to: particles off, animations off, vfx -> flashes only."* Reduced
 * motion OUTRANKS the switches rather than sitting beside them, and the asymmetry is the point: a
 * player who has asked their OS for less motion has said something about their body, and a stored
 * `hitStop: true` or a shake of 100 from before that is not consent. The switches can only ever turn
 * things further off. With 190a that adds: no hit-stop and no shake.
 *
 * `flashes only` is what survives reduced motion: a flash has no motion in it - it is one frame
 * brighter - so it keeps the feedback that says WHICH unit was hit without any of the movement that
 * is being declined. It is still the player's own switch: `flashes: false` turns it off there too.
 *
 * INSTANT runs nothing: no particles, no movement, no effects, no freeze, no shake, no flash. The
 * numbers and the HP bar are the whole of the feedback.
 *
 * One function, called by `applySettings` for the DOM attributes and by the layers for their own
 * gates, so CSS and JavaScript cannot come to different conclusions about the same player.
 */
export function resolveVfxGates(settings: ISettings, reduced: boolean = prefersReducedMotion()): VfxGates {
    if (isInstantTier(settings.battleSpeed)) {
        return { particles: false, animations: false, vfx: 'off', hitStop: false, shake: 0, flashes: false };
    }
    if (reduced) {
        return {
            particles: false, animations: false, vfx: 'flashes', hitStop: false, shake: 0, flashes: settings.flashes,
        };
    }
    return {
        particles: settings.particles,
        animations: true,
        vfx: 'full',
        hitStop: settings.hitStop,
        shake: settings.screenShake / SHAKE_MAX,
        flashes: settings.flashes,
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
    // Tell anything that mirrors a setting (`useAdvancedContent`) to read it again.
    for (const listener of [...settingsListeners]) listener();
}

const settingsListeners = new Set<() => void>();

/** Subscribe to saves. Returns the unsubscribe. For `useSyncExternalStore`; nothing else needs it. */
export function subscribeSettings(listener: () => void): () => void {
    settingsListeners.add(listener);
    return () => { settingsListeners.delete(listener); };
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
    /*
     * Ticket 147b. Pushed rather than polled: `playSfx` runs several times a second in a busy turn
     * and a storage read per sound is a cost with no upside. Before the DOM guard below, because
     * the balance harness has no document and the audio gate is still a real setting there.
     */
    setCombatSounds(settings.combatSounds);

    /*
     * Ticket 190a: the battle speed and catch-up reach the battle clock. Before the DOM guard for
     * the same reason as the line above. Reduced motion does not touch the clock speed: it removes
     * movement, not time.
     */
    patchBattleSpeedInputs({ tier: settings.battleSpeed, catchUp: settings.catchUp });

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
     * CSS and the layer read the same truth."* 190a (ruled D1) removed `data-vfx` and
     * `data-animations` with the switches they mirrored; `data-particles` stays.
     *
     * The RESOLVED gate is stamped, not the raw stored boolean. A stylesheet asking
     * `[data-particles="off"]` wants to know whether particles are running, and under reduced
     * motion they are not - whatever the stored switch says.
     *
     * `setReducedMotionOverride` above runs first on purpose: `resolveVfxGates` defaults to
     * `prefersReducedMotion()`, which reads that override.
     */
    const gates = resolveVfxGates(settings);
    element.setAttribute('data-particles', gates.particles ? 'on' : 'off');

    /*
     * TICKET 159c, stamped the same way and pointedly NOT through `gates`.
     *
     * A `data-` attribute rather than a prop threaded into `EnemyHandPanel`, because the settings
     * screen is an OVERLAY on the battle rather than a route away from it: the fight stays mounted
     * while it is open, so the read-once-per-mount pattern the VFX components use would leave the
     * tab on screen until the next fight. Flipping a visibility switch and watching nothing happen
     * is the one failure a player is guaranteed to notice, since watching it happen is why they
     * flipped it.
     *
     * The panel still renders and still builds its list while hidden — one memo over at most
     * fifteen cards, against a re-render of the stage on every settings change. `display: none`
     * takes it out of the layout, the hit-testing and the accessibility tree, which is the whole of
     * what "off" has to mean.
     */
    element.setAttribute('data-enemy-hand', settings.showEnemyHand ? 'on' : 'off');
}
