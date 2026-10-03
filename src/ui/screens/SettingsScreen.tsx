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
    BATTLE_SPEEDS,
    SHAKE_MAX,
    SHAKE_MIN,
    type BattleSpeedTier,
} from '../settings/settings';
import { wipeSave } from '../settings/wipeSave';
import { prefersReducedMotion } from '../utils/motionPrefs';
import { canQuit, quitGame } from '../settings/quitGame';
import {
    RUN_LOG_RUNS,
    exportRunLogs,
    revealRunLogDirectory,
    runLogDirectory,
    storedRunLogCount,
} from '../settings/exportRunLog';
import { FIGHT_LOG_CAP } from '../../engine/run/fightLog';
import { playSfx } from '../audio/AudioEngine';
import { useFullscreen } from '../hooks/useFullscreen';
import { BUILD_INFO, buildText } from '../buildInfo';
import AbandonRunSetting from './AbandonRunSetting';
import GameSwitches from './GameSwitches';
import '../theme/kit/kit.css';
import './SettingsScreen.css';

/**
 * The on/off battle switches, as rows. Ticket 146a, rebuilt by 190a.
 *
 * A table rather than hand-written blocks because they are genuinely the same control repeated, and
 * the notes are where the difference lives: each one says what a player LOSES, since "Particles:
 * Off" tells you nothing about whether the fight still reads. 190a retired the Effects and
 * Animations rows (the five speeds below replace them) and added hit-stop, flashes and catch-up.
 */
const BATTLE_SWITCHES: ReadonlyArray<{
    key: 'particles' | 'hitStop' | 'flashes' | 'catchUp';
    label: string;
    note: string;
}> = [
    {
        key: 'hitStop',
        label: 'Hit-stop',
        note: 'The tiny freeze on a heavy hit, so it feels like it landed.',
    },
    {
        key: 'flashes',
        label: 'Flashes',
        note: 'The white flash on a hit and the dimmed stage on a big move. Off if flashing bothers you.',
    },
    {
        key: 'catchUp',
        label: 'Catch-up',
        note: 'When cards pile up, the fight speeds up a little (up to 1.6 times) so long turns do not drag.',
    },
    {
        key: 'particles',
        label: 'Particles',
        note: 'Flames, drops, leaves, sparks. The first thing to turn off on a machine that struggles.',
    },
];

const SPEED_LABEL: Record<BattleSpeedTier, string> = {
    slow: 'Slow',
    showy: 'Showy',
    snappy: 'Snappy',
    fast: 'Fast',
    instant: 'Instant',
};

const SPEED_NOTE: Record<BattleSpeedTier, string> = {
    slow: 'A heavier, slower Showy. Every hit gets its moment.',
    showy: 'The full show: wind-up, lunge, the attack, the hit.',
    snappy: 'The same hits, quicker and plainer.',
    fast: 'Snappy at double speed.',
    instant: 'No animation and no waiting. The numbers and bars update at once.',
};

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
    /*
     * THE 2026-08-30 PLAYTEST: *"Only way to exit is the window X button."*
     *
     * Read once, at mount, like `logsDir` above and for the same reason — whether this build can
     * quit is a property of the build, not a thing that changes while an overlay is open. The
     * button is ABSENT in the web build rather than disabled: see `settings/quitGame.ts`, and the
     * "Not here yet" section below, which exists because ticket 36 would not ship dead controls.
     */
    const [quitAvailable] = useState(() => canQuit());
    const [quitArmed, setQuitArmed] = useState(false);
    // Ticket 59. Read once on mount: the count only changes when a run ends, which cannot happen
    // while this overlay is up.
    const [runLogCount] = useState(() => storedRunLogCount());

    /*
     * TICKET 42. The copy below was written for a browser and says "downloads folder" four times.
     * In the packaged build that is wrong in the way that matters most — the tester goes looking in
     * the place the game named and finds nothing — so the path is read once here and the sentences
     * branch on it. Null in the web build, which keeps the original wording exactly.
     */
    const [logsDir] = useState(() => runLogDirectory());
    const [exported, setExported] = useState<string | null>(null);
    // TICKET 37: the Display group below renders only when the host offers the Fullscreen API.
    const fullscreen = useFullscreen();

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
                    <button type="button" className="settings-close k-button is-quiet" onClick={close}>
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
                        No music yet. Volume and mute are kept apart from your save.
                    </p>

                    {/*
                      * TICKET 147b. Beside the slider, because they are the two audio decisions and
                      * they are different ones: the slider says how loud, this says whether the
                      * FIGHT is part of it. Deliberately NOT tied to the Effects switch below —
                      * 147b is explicit that turning effects off does not mute, and somebody who
                      * wants a quiet fight should not lose their impact flashes for it.
                      */}
                    <div className="settings-row">
                        <span className="settings-label">Combat sounds</span>
                        <div className="settings-control settings-choices">
                            {([false, true] as const).map((choice) => (
                                <button
                                    key={String(choice)}
                                    type="button"
                                    className={`settings-choice k-button is-quiet ${settings.combatSounds === choice ? 'active is-on' : ''}`}
                                    aria-pressed={settings.combatSounds === choice}
                                    onClick={() => update({ ...settings, combatSounds: choice })}
                                >
                                    {choice ? 'On' : 'Off'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="settings-note">
                        {settings.combatSounds
                            ? 'On. Casts, impacts, statuses and creature cries.'
                            : 'Off. The fight is quiet; menus still answer and a win still sounds.'}
                    </p>
                </section>

                {/*
                  * TICKET 37 — DISPLAY. One control, and the control is conditional.
                  *
                  * `supported` is false where the Fullscreen API is absent or disallowed (an
                  * embedded webview, an older WebKit), and the row is then not rendered at all
                  * rather than rendered disabled. A dead toggle in a settings screen reads as a
                  * bug in the game; an absent one reads as a feature the host does not offer,
                  * which is the true statement.
                  *
                  * The label is driven by `isFullscreen`, which this hook re-reads from the
                  * document on every `fullscreenchange` — so leaving fullscreen with Escape or F11,
                  * without touching this button, still updates it.
                  */}
                {fullscreen.supported ? (
                    <section className="settings-group">
                        <h3>Display</h3>
                        <div className="settings-row">
                            <span className="settings-label">Fullscreen</span>
                            <button
                                type="button"
                                className="settings-button k-button"
                                aria-pressed={fullscreen.isFullscreen}
                                onClick={() => {
                                    playSfx('uiClick');
                                    fullscreen.toggle();
                                }}
                            >
                                {fullscreen.isFullscreen ? 'Leave fullscreen' : 'Go fullscreen'}
                            </button>
                        </div>
                        <p className="settings-note">
                            F11 does the same.
                        </p>
                    </section>
                ) : null}

                <section className="settings-group">
                    <h3>Motion</h3>
                    <div className="settings-row">
                        <span className="settings-label">Reduced motion</span>
                        <div className="settings-control settings-choices">
                            {MOTION_CHOICES.map((choice) => (
                                <button
                                    key={choice}
                                    type="button"
                                    className={`settings-choice k-button is-quiet ${settings.reducedMotion === choice ? 'active is-on' : ''}`}
                                    aria-pressed={settings.reducedMotion === choice}
                                    onClick={() => update({ ...settings, reducedMotion: choice })}
                                >
                                    {MOTION_LABEL[choice]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="settings-note">
                        <strong>Follow system</strong> uses your computer&apos;s setting. The other two override it.
                    </p>

                    {/*
                      * TICKET 190a — THE BATTLE SPEED, AND THE SWITCHES THAT STAY.
                      *
                      * Under Motion rather than in a group of their own, for 146a's reason: reduced
                      * motion OVERRULES every one of these (see `resolveVfxGates`), and a player who
                      * turns that on and then finds the controls elsewhere still claiming to be on has
                      * been told something false. Sitting together, the note below can say so in one line.
                      */}
                    <div className="settings-row">
                        <span className="settings-label">Battle speed</span>
                        <div className="settings-control settings-choices">
                            {BATTLE_SPEEDS.map((tier) => (
                                <button
                                    key={tier}
                                    type="button"
                                    className={`settings-choice k-button is-quiet ${settings.battleSpeed === tier ? 'active is-on' : ''}`}
                                    aria-pressed={settings.battleSpeed === tier}
                                    onClick={() => update({ ...settings, battleSpeed: tier })}
                                >
                                    {SPEED_LABEL[tier]}
                                </button>
                            ))}
                        </div>
                        <p className="settings-note">{SPEED_NOTE[settings.battleSpeed]}</p>
                    </div>
                    <div className="settings-row">
                        <span className="settings-label">Screen shake</span>
                        <div className="settings-control">
                            <input
                                type="range"
                                min={SHAKE_MIN}
                                max={SHAKE_MAX}
                                step={5}
                                value={settings.screenShake}
                                aria-label="Screen shake"
                                onChange={(event) => update({ ...settings, screenShake: Number(event.target.value) })}
                            />
                            <span className="settings-value">{settings.screenShake}%</span>
                        </div>
                        <p className="settings-note">How hard the whole screen shakes on a big hit. 0 turns the camera shake off.</p>
                    </div>
                    {BATTLE_SWITCHES.map(({ key, label, note }) => (
                        <div className="settings-row" key={key}>
                            <span className="settings-label">{label}</span>
                            <div className="settings-control settings-choices">
                                {([true, false] as const).map((choice) => (
                                    <button
                                        key={String(choice)}
                                        type="button"
                                        className={`settings-choice k-button is-quiet ${settings[key] === choice ? 'active is-on' : ''}`}
                                        aria-pressed={settings[key] === choice}
                                        onClick={() => update({ ...settings, [key]: choice })}
                                    >
                                        {choice ? 'On' : 'Off'}
                                    </button>
                                ))}
                            </div>
                            <p className="settings-note">{note}</p>
                        </div>
                    ))}
                    <p className="settings-note">
                        Hold Right Shift in a fight to fast-forward.{' '}
                        {prefersReducedMotion()
                            ? <strong>Reduced motion is on: movement, particles, the freeze and the shake are off whatever these say.</strong>
                            : null}
                    </p>
                </section>

                {/*
                  * TICKET 159c — ITS OWN GROUP, NOT A FOURTH ROW UNDER MOTION.
                  *
                  * §5 says "beside 146's three", and it cannot literally sit there: those three are
                  * overruled by reduced motion (`resolveVfxGates`), and the note under them says so
                  * out loud. A player who turns reduced motion on and reads "so particles and
                  * animations are off whatever these say" directly above a switch that reduced
                  * motion does NOT touch has been told something false about this one. Reduced
                  * motion is a statement about movement; hiding information is a different
                  * decision, and it stays the player's.
                  */}
                <section className="settings-group">
                    <h3>Battle</h3>
                    <div className="settings-row">
                        <span className="settings-label">Show enemy hand</span>
                        <div className="settings-control settings-choices">
                            {([true, false] as const).map((choice) => (
                                <button
                                    key={String(choice)}
                                    type="button"
                                    className={`settings-choice k-button is-quiet ${settings.showEnemyHand === choice ? 'active is-on' : ''}`}
                                    aria-pressed={settings.showEnemyHand === choice}
                                    onClick={() => update({ ...settings, showEnemyHand: choice })}
                                >
                                    {choice ? 'On' : 'Off'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="settings-note">
                        {settings.showEnemyHand
                            ? 'On. A tab at the right edge shows what the enemy holds, and what they draw next.'
                              : 'Off. Their cards stay hidden.'}
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
                                    className={`settings-choice k-button is-quiet ${settings.textScale === scale ? 'active is-on' : ''}`}
                                    aria-pressed={settings.textScale === scale}
                                    onClick={() => update({ ...settings, textScale: scale })}
                                >
                                    {Math.round(scale * 100)}%
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="settings-note">
                        Scales all text. The largest step can crowd the hand.
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
                        Not remappable yet.
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
                                    className={`settings-choice k-button is-quiet ${settings.autoSaveRunLog === choice ? 'active is-on' : ''}`}
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
                            ? logsDir
                                ? `On. Every run saves to ${logsDir} when it ends.`
                                : 'On. Every run saves to your downloads folder when it ends. Allow multiple downloads if asked.'
                            : logsDir
                              ? `Off. Only the last ${RUN_LOG_RUNS} runs are kept. Turn this on to save them all to ${logsDir}.`
                              : `Off. Only the last ${RUN_LOG_RUNS} runs are kept. Turn this on to save them all.`}
                    </p>

                    {/*
                      * TICKET 156 / Henry, 2026-09-20. Under the auto-save toggle because it is the
                      * same subject one level down: that one decides whether a run is KEPT, this one
                      * decides how much of each fight is in it.
                      */}
                    <div className="settings-row">
                        <span className="settings-label">Save battle logs</span>
                        <div className="settings-control settings-choices">
                            {([false, true] as const).map((choice) => (
                                <button
                                    key={String(choice)}
                                    type="button"
                                    className={`settings-choice k-button is-quiet ${settings.battleLogs === choice ? 'active is-on' : ''}`}
                                    aria-pressed={settings.battleLogs === choice}
                                    onClick={() => update({ ...settings, battleLogs: choice })}
                                >
                                    {choice ? 'On' : 'Off'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="settings-note">
                        {settings.battleLogs
                            ? `On. Each fight's combat log is kept, up to ${FIGHT_LOG_CAP} lines.`
                            : 'Off. Runs keep every turn and deck, but not the combat text.'}
                    </p>

                    {/*
                      * Desktop only, and only when the toggle is on: a folder the player has been told
                      * about is a folder they should be able to open without hunting for AppData.
                      */}
                    {logsDir && settings.autoSaveRunLog ? (
                        <div className="settings-row">
                            <span className="settings-label">Run log folder</span>
                            <button
                                type="button"
                                className="settings-button k-button"
                                onClick={() => {
                                    playSfx('uiClick');
                                    revealRunLogDirectory();
                                }}
                            >
                                Open the folder
                            </button>
                        </div>
                    ) : null}

                    <div className="settings-row">
                        <span className="settings-label">Export run log</span>
                        <button
                            type="button"
                            className="settings-button k-button"
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
                            ? `Saved as ${exported}. Attach it to your notes.`
                            : `A transcript of your last ${RUN_LOG_RUNS} runs. It stays on this machine until you send it.`}
                    </p>
                    {/* TICKET 181a: the build a bug report should quote, next to the log that names it too. */}
                    <p className="settings-note" data-testid="settings-build">
                        Build: {buildText(BUILD_INFO)}
                    </p>
                </section>

                {/* TICKET 182a (R5): Abandon run lives here, only while a run is in progress. */}
                <GameSwitches />
                <AbandonRunSetting />

                {quitAvailable && (
                    <section className="settings-group">
                        <h3>Quit</h3>
                        <div className="settings-row">
                            <span className="settings-label">Leave the game</span>
                            <div className="settings-control">
                                {quitArmed ? (
                                    <>
                                        <button
                                            type="button"
                                            className="settings-button k-button"
                                            onClick={() => {
                                                playSfx('uiClick');
                                                quitGame();
                                            }}
                                        >
                                            Quit now
                                        </button>
                                        <button
                                            type="button"
                                            className="settings-choice k-button is-quiet"
                                            onClick={() => {
                                                playSfx('uiClick');
                                                setQuitArmed(false);
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className="settings-button k-button"
                                        onClick={() => {
                                            playSfx('uiClick');
                                            setQuitArmed(true);
                                        }}
                                    >
                                        Quit game
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className="settings-note">
                            {/*
                              * The two steps are about a stray click on a screen you opened to
                              * change the volume — not about your progress, which is the point of
                              * the second sentence. It is true: `store.subscribe` writes the ranch
                              * and the run on every change, so quitting mid-fight costs the fight
                              * and nothing else.
                              */}
                            Closes the game. Your ranch and run are already saved.
                        </p>
                    </section>
                )}

                <section className="settings-group settings-danger">
                    <h3>Save</h3>
                    {wiped ? (
                        <p className="settings-note settings-wiped">
                            Wiped. Roster, traces, codex and run history are gone. Settings and volume are kept.
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
                                                className="settings-wipe-confirm k-button is-danger"
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
                                                className="settings-choice k-button is-quiet"
                                                onClick={() => setWipeArmed(false)}
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            className="settings-wipe k-button is-danger"
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
                                Deletes the roster, traces, codex and any run. There is no undo.
                            </p>
                        </>
                    )}
                </section>

                <section className="settings-group">
                    <h3>Not here yet</h3>
                    <ul className="settings-pending">
                        <li><strong>Resolution</strong> — the game lays out fluidly; fullscreen is under Display.</li>
                        <li><strong>Colourblind-safe colours</strong> — not designed yet.</li>
                        <li><strong>Key remapping</strong> — not built yet.</li>
                    </ul>
                </section>

                <section className="settings-group">
                    <h3>Credits</h3>
                    <p className="settings-note">
                        Mingming: Midgard Circuit, built by Henry Dunphy.
                    </p>
                    <p className="settings-note">
                        Made with React, Redux Toolkit, Framer Motion, Zod and Vite. Every sound is synthesized. Licences ship with the release build.
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
