import { useState } from 'react';
import type { ReactNode } from 'react';
import { useDispatch } from 'react-redux';

import AudioControls from '../components/AudioControls';
import { KEYBINDS } from '../keybinds';
import { closeSettings } from '../store/uiSlice';
import {
    MOTION_CHOICES,
    TEXT_SCALES,
    applySettings,
    loadSettings,
    saveSettings,
    type ISettings,
    type MotionChoice,
} from '../settings/settings';
import { wipeSave } from '../settings/wipeSave';
import { RUN_LOG_RUNS, exportRunLogs, storedRunLogCount } from '../settings/exportRunLog';
import { playSfx } from '../audio/AudioEngine';
import './SettingsScreen.css';

/**
 * THE SETTINGS SCREEN — ticket 36.
 *
 * # WHAT THE TICKET ASKED FOR AND WHAT IS HERE
 *
 * The deliverable lists eleven things. Six shipped, three are somebody else's ticket and say so on
 * screen, and two were **wrong about the game** — recorded here rather than quietly dropped:
 *
 * - **"master/music/SFX volume"** — there is no music. `AudioEngine` is pure synthesized SFX with a
 *   single gain node and one `{volume, muted}` pair; there is not a second channel to put a second
 *   slider in front of. Three sliders where one thing exists is a settings screen that lies. One
 *   volume control ships (the existing `AudioControls`, not a reimplementation of it), and ticket 35
 *   (audio pass) is where music arrives and earns its own.
 * - **"reachable from the main menu"** — there is no main menu. `MainMenuView` is the first-run
 *   starter picker, shown only while the roster is empty; it has three cards and no menu. So the
 *   entry points are the nav bar (outside a fight) and Escape (inside one), which between them cover
 *   every screen the game actually has. A real main menu is ticket 34's UI pass.
 *
 * Deferred, and named on screen so nobody thinks they were forgotten: fullscreen/resolution
 * (ticket 37 owns the mechanism), the colourblind-safe element palette (ticket 38 — the eight
 * `--fire`/`--water`/... custom properties in `index.css` are the seam it will swap), and the
 * authoritative licence text (ticket 54).
 *
 * # AN OVERLAY, NOT A ROUTE
 *
 * The Done-when is "Esc in battle pauses to settings **without breaking the reducer**". So this
 * dispatches nothing at the battle: it is a fixed overlay above a game that stays mounted, which in
 * a turn-based game with no clock is exactly what a pause is. The battle reducer never learns it
 * happened.
 *
 * # WHY THE STATE IS LOCAL AND THE WRITE IS IMMEDIATE
 *
 * Settings persist outside the save (`settings.ts`), so there is nothing for Redux to hold. Each
 * control writes storage and applies to the document in the same handler — there is no Apply
 * button, because a settings screen with an Apply button is a settings screen you can lose work in.
 * `loadSettings()` in the initialiser is the round-trip the Done-when asks for.
 */
export default function SettingsScreen(): ReactNode {
    const dispatch = useDispatch();
    const [settings, setSettings] = useState<ISettings>(() => loadSettings());
    const [wipeArmed, setWipeArmed] = useState(false);
    const [wiped, setWiped] = useState(false);
    // Ticket 59. Read once on mount: the count only changes when a run ends, which cannot happen
    // while this overlay is up.
    const [runLogCount] = useState(() => storedRunLogCount());
    const [exported, setExported] = useState<string | null>(null);

    const update = (next: ISettings): void => {
        setSettings(next);
        saveSettings(next);
        applySettings(next);
        playSfx('uiClick');
    };

    const close = (): void => {
        playSfx('uiClick');
        dispatch(closeSettings());
    };

    return (
        <div className="settings-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
            <div className="settings-panel">
                <header className="settings-head">
                    <h2>Settings</h2>
                    <button type="button" className="settings-close" onClick={close}>
                        Close
                    </button>
                </header>

                <section className="settings-group">
                    <h3>Audio</h3>
                    <div className="settings-row">
                        <span className="settings-label">Volume</span>
                        <div className="settings-control settings-audio">
                            <AudioControls />
                        </div>
                    </div>
                    <p className="settings-note">
                        One channel, because the game has one: every sound is synthesized on the spot and
                        there is no music yet. Volume and mute are stored separately from your save, so
                        they follow you across slots.
                    </p>
                </section>

                <section className="settings-group">
                    <h3>Motion</h3>
                    <div className="settings-row">
                        <span className="settings-label">Reduced motion</span>
                        <div className="settings-control settings-choices">
                            {MOTION_CHOICES.map((choice) => (
                                <button
                                    key={choice}
                                    type="button"
                                    className={`settings-choice ${settings.reducedMotion === choice ? 'active' : ''}`}
                                    aria-pressed={settings.reducedMotion === choice}
                                    onClick={() => update({ ...settings, reducedMotion: choice })}
                                >
                                    {MOTION_LABEL[choice]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="settings-note">
                        <strong>Follow system</strong> uses your OS setting, which is what the game did
                        before this screen existed. The other two overrule it in either direction.
                    </p>
                </section>

                <section className="settings-group">
                    <h3>Text size</h3>
                    <div className="settings-row">
                        <span className="settings-label">Scale</span>
                        <div className="settings-control settings-choices">
                            {TEXT_SCALES.map((scale) => (
                                <button
                                    key={scale}
                                    type="button"
                                    className={`settings-choice ${settings.textScale === scale ? 'active' : ''}`}
                                    aria-pressed={settings.textScale === scale}
                                    onClick={() => update({ ...settings, textScale: scale })}
                                >
                                    {Math.round(scale * 100)}%
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="settings-note">
                        Scales everything measured in text. The battle console is laid out to the pixel,
                        so the largest step crowds the hand — worth knowing before you pick it.
                    </p>
                </section>

                <section className="settings-group">
                    <h3>Keyboard</h3>
                    <ul className="settings-keys">
                        {KEYBINDS.map((bind) => (
                            <li key={bind.id} className="settings-key">
                                <kbd className="settings-kbd">{bind.keys}</kbd>
                                <span className="settings-key-action">{bind.action}</span>
                                {bind.detail !== undefined && (
                                    <span className="settings-key-detail">{bind.detail}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                    <p className="settings-note">
                        Not remappable yet. This list and the strip under your hand are generated from the
                        same table, so it cannot drift from what the keys actually do.
                    </p>
                </section>

                {/*
                  * TICKET 59. Above the danger block on purpose: it is the one thing on this screen
                  * a playtester is asked to do, and it must not be one scroll away from the wipe.
                  *
                  * A playtester who cannot hand over the log is a playtester describing their run
                  * from memory, which is what the whole ticket exists to stop — every finding from
                  * the 2026-08-24 session was reconstructed that way.
                  */}
                <section className="settings-group">
                    <h3>Playtest</h3>

                    {/*
                      * Henry, 2026-08-24: "Having to export at the right time doesn't work. I often
                      * forget." So the toggle sits ABOVE the manual button — it is the one a tester
                      * is told to set, and once it is on the button below is for catching up on
                      * runs played before it was.
                      */}
                    <div className="settings-row">
                        <span className="settings-label">Auto-save every run</span>
                        <div className="settings-control settings-choices">
                            {([false, true] as const).map((choice) => (
                                <button
                                    key={String(choice)}
                                    type="button"
                                    className={`settings-choice ${settings.autoSaveRunLog === choice ? 'active' : ''}`}
                                    aria-pressed={settings.autoSaveRunLog === choice}
                                    onClick={() => update({ ...settings, autoSaveRunLog: choice })}
                                >
                                    {choice ? 'On' : 'Off'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="settings-note">
                        {settings.autoSaveRunLog
                            ? `On. Every run writes itself to your downloads folder the moment it ends,
                               as mingming-run-<date>-<outcome>.json. Your browser may ask once to allow
                               multiple downloads — say yes, or nothing will be saved. When you are done,
                               send every mingming-run-*.json you have.`
                            : `Off. Runs are still recorded and you can save them below, but only the
                               last ${RUN_LOG_RUNS} are kept — turn this on and each one writes itself to
                               your downloads folder as it ends, so nothing is lost to that window.`}
                    </p>

                    <div className="settings-row">
                        <span className="settings-label">Export run log</span>
                        <button
                            type="button"
                            className="settings-button"
                            disabled={runLogCount === 0}
                            onClick={() => {
                                playSfx('uiClick');
                                setExported(exportRunLogs());
                            }}
                        >
                            {runLogCount === 0
                                ? 'No runs recorded yet'
                                : `Save ${runLogCount} run${runLogCount === 1 ? '' : 's'} to a file`}
                        </button>
                    </div>
                    <p className="settings-note">
                        {exported
                            ? `Saved as ${exported}. Attach it to your notes — it carries every node you
                               entered, every card you took, skipped, bought or removed, and where the
                               scrap went.`
                            : `A JSON transcript of your last ${RUN_LOG_RUNS} runs. It stays on this
                               machine until you send it somewhere.`}
                    </p>
                </section>

                <section className="settings-group settings-danger">
                    <h3>Save</h3>
                    {wiped ? (
                        <p className="settings-note settings-wiped">
                            Wiped. Your roster, blueprints, codex, any run in progress and your run history
                            are gone. Volume and these settings are not — they were never part of the save.
                        </p>
                    ) : (
                        <>
                            <div className="settings-row">
                                <span className="settings-label">Delete everything</span>
                                <div className="settings-control">
                                    {wipeArmed ? (
                                        <>
                                            <button
                                                type="button"
                                                className="settings-wipe-confirm"
                                                onClick={() => {
                                                    wipeSave(dispatch);
                                                    setWipeArmed(false);
                                                    setWiped(true);
                                                }}
                                            >
                                                Confirm — this cannot be undone
                                            </button>
                                            <button
                                                type="button"
                                                className="settings-choice"
                                                onClick={() => setWipeArmed(false)}
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            className="settings-wipe"
                                            onClick={() => setWipeArmed(true)}
                                        >
                                            Wipe save
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="settings-note">
                                {/*
                                  * Two steps rather than `window.confirm`, which ticket 19 removed from
                                  * this codebase: a native modal in a game that draws its own UI, and
                                  * one no gamepad can reach (ticket 38).
                                  */}
                                Deletes the roster, the blueprints, the codex and any run in progress.
                                There is no undo and no backup.
                            </p>
                        </>
                    )}
                </section>

                <section className="settings-group">
                    <h3>Not here yet</h3>
                    <ul className="settings-pending">
                        <li>
                            <strong>Fullscreen and resolution</strong> — the game has no windowing control
                            of its own yet; your browser or the desktop build owns it until that lands.
                        </li>
                        <li>
                            <strong>Colourblind-safe element colours</strong> — the eight element colours
                            are defined in one place and can be swapped wholesale, but which palette is a
                            design decision, not a toggle to invent here.
                        </li>
                        <li>
                            <strong>Key remapping</strong> — the bindings are a table now, which is the
                            work remapping needed; the capture-and-conflict UI is not built.
                        </li>
                    </ul>
                </section>

                <section className="settings-group">
                    <h3>Credits</h3>
                    <p className="settings-note">
                        Mingming — built by Henry Dunphy. Runs on React, Redux Toolkit, Framer Motion, Zod
                        and Vite; every sound is synthesized in the browser with the Web Audio API, so
                        there are no sampled assets to credit. Full third-party licence text ships with the
                        release build.
                    </p>
                </section>
            </div>
        </div>
    );
}

const MOTION_LABEL: Record<MotionChoice, string> = {
    system: 'Follow system',
    on: 'Reduce motion',
    off: 'Full motion',
};
