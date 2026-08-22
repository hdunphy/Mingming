import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import './App.css'
import { useDispatch, useSelector } from 'react-redux'
import BattleArena from './ui/components/BattleArena'
import RanchScreen from './ui/screens/RanchScreen'
import MainMenuView from './ui/components/MainMenuView'

import RunScreen from './ui/screens/RunScreen'
import { loadGameState } from './engine/SaveSystem'
import { loadSave } from './ui/store/gameSlice'
import { setRun } from './ui/store/runSlice'
import type { RootState } from './ui/store/store'
import { initAudio, playSfx } from './ui/audio/AudioEngine'
import AudioControls from './ui/components/AudioControls'
import SettingsScreen from './ui/screens/SettingsScreen'
import { openSettings } from './ui/store/uiSlice'
import { applySettings, loadSettings } from './ui/settings/settings'

// The single import edge between the game and the debug toolkit. `import.meta.env.DEV` is
// statically replaced by `false` in a production build, the ternary folds to `null`, and the
// dynamic import becomes unreachable, so Rollup never emits the chunk. Verified after the fact
// by `scripts/assert-no-debug.mjs`. Nothing else anywhere may import from `./debug/`.
const DebugRoot = import.meta.env.DEV ? lazy(() => import('./debug/DebugRoot')) : null;

// Fixed-position debug layer. Rendered in every path below — including both early returns —
// so it stays reachable at roster 0, mid-battle and in the hub.
const debugLayer = DebugRoot ? (
  <Suspense fallback={null}>
    <DebugRoot />
  </Suspense>
) : null;

/**
 * TICKET 11: **there are exactly two places to be — the ranch, or a run.**
 *
 * Ticket 20 folded Roster, Lab and Relics into `RanchScreen` and demoted Hub, Sectors and Deck to
 * DEV-only "legacy" tabs, because they were still the only way to start a fight. They are gone now:
 * run start replaced QUICK DEPLOY (ticket 09), `RegionMap` replaced the sector list (ticket 10), and
 * this ticket replaced the sector battle with the node trigger. The deck builder went with them —
 * cards are run-scoped and the team is the deck, so there is nothing at the ranch to build.
 */
type Tab = 'ranch' | 'debug';

const debugTab: { id: Tab; label: string; icon: string } = { id: 'debug', label: 'Debug', icon: '🐞' };

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'ranch', label: 'Ranch', icon: '🏡' },
  ...(import.meta.env.DEV ? [debugTab] : []),
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('ranch');
  const dispatch = useDispatch();
  const rosterSize = useSelector((state: RootState) => state.game.roster.length);
  const isInBattle = useSelector((state: RootState) => state.battle.battle !== null);
  // Ticket 11: the gauntlet is run state (`IRunState.gauntlet`), not ranch state. Ticket 18 owns
  // advancing it; all this needs to know is whether the battle on screen belongs to one.
  const gauntlet = useSelector((state: RootState) => state.run.run?.gauntlet ?? null);
  const hasRun = useSelector((state: RootState) => state.run.run !== null);
  // Ticket 36. Session-only shell state — see `uiSlice` for why one boolean earned a slice.
  const settingsOpen = useSelector((state: RootState) => state.ui.settingsOpen);

  // Ticket 23 reads save v4's two keys and reconciles them; ticket 09 gives the run half a home.
  // A discarded run is reported and dropped — `loadGameState` guarantees it never costs the ranch,
  // which is the entire reason the two keys are separate.
  //
  // Ordering matters: the ranch is dispatched first, because the run's `partyIds` point into the
  // roster and a run installed against an empty roster would render a party of nothing for one
  // frame.
  useEffect(() => {
    const result = loadGameState();
    if (result.discarded) {
      console.warn(`[Load] In-progress run discarded: ${result.discarded}. Your ranch is intact.`);
    }
    // Ticket 11: `loadSave` takes the ranch verbatim. There is no projection step any more — the
    // slice's shape and the stored shape are the same type.
    if (result.ranch) {
      dispatch(loadSave(result.ranch));
    }
    if (result.run) {
      dispatch(setRun(result.run));
    }
  }, [dispatch]);

  // Arm the one-time gesture unlockers for the synthesized audio engine
  // (browser autoplay policy: the AudioContext resumes on first input).
  useEffect(() => {
    initAudio();
  }, []);

  /*
   * TICKET 36: the stored settings reach the document exactly once, at boot.
   *
   * Root font size and the reduced-motion attribute are both properties of `<html>`, which no
   * component owns, so there is nowhere else this could live. It runs before anything the player
   * can see because a text scale applied one frame late is a visible jump.
   */
  useEffect(() => {
    applySettings(loadSettings());
  }, []);

  const prevInBattle = useRef(isInBattle);
  // Remember that the current battle belongs to a gauntlet: completeGauntlet()
  // (nulls gauntlet) and setBattleState(null) land in the same React batch, so
  // by the time this effect fires after the final battle, `gauntlet` is already null.
  const wasGauntletBattle = useRef(false);
  useEffect(() => {
    if (isInBattle && gauntlet) {
      wasGauntletBattle.current = true;
    }
    if (prevInBattle.current && !isInBattle) {
      if (gauntlet || wasGauntletBattle.current) {
        setActiveTab('ranch');
      }
      wasGauntletBattle.current = false;
    }
    prevInBattle.current = isInBattle;
  }, [isInBattle, gauntlet]);

  // A live battle outranks an empty roster. These used to be the other way round, which meant a
  // scenario launched into a fresh save slot was created in the store and then never rendered:
  // the slot's roster is empty, so this component returned MainMenuView and BattleArena never got
  // a look in. Composing a party from scratch is the launcher's whole purpose, so roster-0 is the
  // normal case there rather than an edge one.
  //
  // Safe in ordinary play: createBattleState throws on an empty party, so no battle can exist
  // alongside an empty roster except by debug injection. Ticket 11 removed the last thing that
  // could have made that untrue mid-battle — the defeat path used to call `deleteSave()` while the
  // overlay was still up. It does not any more: a defeat ends the run (`endRun('defeat')`) and
  // touches nothing on the ranch, so the roster this branch reads is never emptied under it.
  /*
   * The settings overlay rides above every branch, `debugLayer`'s pattern and for the same reason:
   * it is layered over whatever is on screen rather than replacing it. In a fight that IS the pause
   * — the battle stays mounted and untouched, and nothing here dispatches at the battle reducer.
   */
  const settingsLayer = settingsOpen ? <SettingsScreen /> : null;

  if (isInBattle) {
    return <>{debugLayer}<BattleArena />{settingsLayer}</>;
  }

  if (rosterSize === 0) {
    return <>{debugLayer}<MainMenuView />{settingsLayer}</>;
  }

  // TICKET 09: a run in progress outranks the ranch. There is no tab for it — you are either at
  // the ranch or in a run, and the only ways out are finishing it or abandoning it. Ticket 10
  // replaces `RunScreen`'s body with the real region map.
  if (hasRun) {
    return <>{debugLayer}<RunScreen />{settingsLayer}</>;
  }

  return (
    <>
    {debugLayer}
    <main style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Navigation */}
      <nav className="main-nav" style={{ position: 'relative' }}>
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { playSfx('uiClick'); setActiveTab(tab.id); }}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
        <AudioControls />
        {/*
          * TICKET 36. The ticket says the settings screen is "reachable from the main menu", and
          * there is no main menu — `MainMenuView` is the first-run starter picker. The nav bar is
          * the shell every non-fight screen actually has, so this is where it goes; inside a fight
          * the entry point is Escape.
          */}
        <button
          type="button"
          className="nav-tab nav-settings"
          onClick={() => { playSfx('uiClick'); dispatch(openSettings()); }}
        >
          <span className="nav-icon">⚙</span>
          <span className="nav-label">Settings</span>
        </button>
      </nav>

      {/* Screen Content */}
      <div className="screen-content">
        {activeTab === 'ranch' && <RanchScreen />}
        {activeTab === 'debug' && DebugRoot && (
          <Suspense fallback={null}>
            <DebugRoot mode="docked" />
          </Suspense>
        )}
      </div>
    </main>
    {settingsLayer}
    </>
  );
}

export default App

