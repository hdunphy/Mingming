import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import './App.css'
import { useDispatch, useSelector } from 'react-redux'
import BattleArena from './ui/components/BattleArena'
import DeckTerminal from './ui/screens/DeckTerminal'
import RosterTerminal from './ui/screens/RosterTerminal'
import SynthesisLab from './ui/screens/SynthesisLab'
import HubScreen from './ui/screens/HubScreen'
import MainMenuView from './ui/components/MainMenuView'
import SectorTerminal from './ui/screens/SectorTerminal'
import RelicTerminal from './ui/screens/RelicTerminal'

import { loadGameState } from './engine/SaveSystem'
import { applyRanchState } from './engine/save/ranchProjection'
import { createDefaultSave } from './engine/gameTypes'
import { loadSave } from './ui/store/gameSlice'
import type { RootState } from './ui/store/store'
import { initAudio, playSfx } from './ui/audio/AudioEngine'
import AudioControls from './ui/components/AudioControls'

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

type Tab = 'hub' | 'terminal' | 'battle' | 'deck' | 'roster' | 'lab' | 'relic' | 'debug';

const debugTab: { id: Tab; label: string; icon: string } = { id: 'debug', label: 'Debug', icon: '🐞' };

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'hub', label: 'Hub', icon: '🏠' },
  { id: 'terminal', label: 'Terminal', icon: '📟' },
  { id: 'deck', label: 'Deck', icon: '🃏' },
  { id: 'roster', label: 'Roster', icon: '🤖' },
  { id: 'lab', label: 'Lab', icon: '🔬' },
  { id: 'relic', label: 'Relics', icon: '💎' },
  ...(import.meta.env.DEV ? [debugTab] : []),
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('hub');
  const dispatch = useDispatch();
  const rosterSize = useSelector((state: RootState) => state.game.roster.length);
  const isInBattle = useSelector((state: RootState) => state.battle.battle !== null);
  const gauntlet = useSelector((state: RootState) => state.game.gauntlet);

  // Ticket 23: load reads save v4's two keys and reconciles them. Only the ranch half has a home
  // in the store today — the run half waits for tickets 09–15 — so a discarded run is logged and
  // dropped rather than dispatched. `loadGameState` already guarantees a discarded run never costs
  // the ranch.
  useEffect(() => {
    const result = loadGameState();
    if (result.discarded) {
      console.warn(`[Load] In-progress run discarded: ${result.discarded}. Your ranch is intact.`);
    }
    if (result.ranch) {
      dispatch(loadSave(applyRanchState(createDefaultSave(), result.ranch)));
    }
  }, [dispatch]);

  // Arm the one-time gesture unlockers for the synthesized audio engine
  // (browser autoplay policy: the AudioContext resumes on first input).
  useEffect(() => {
    initAudio();
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
        setActiveTab('hub');
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
  // alongside an empty roster except by debug injection. The defeat path only deletes the *stored*
  // save while the overlay is up — state.game.roster stays populated — and both wipe paths
  // (BattleArena's handleDefeatReset, HubScreen's handleRestart) call window.location.reload()
  // immediately after resetSave(), so there is no frame where this order shows the wrong screen.
  if (isInBattle) {
    return <>{debugLayer}<BattleArena /></>;
  }

  if (rosterSize === 0) {
    return <>{debugLayer}<MainMenuView /></>;
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
      </nav>

      {/* Screen Content */}
      <div className="screen-content">
        {activeTab === 'hub' && <HubScreen />}
        {activeTab === 'terminal' && <SectorTerminal />}
        {activeTab === 'deck' && <DeckTerminal />}
        {activeTab === 'roster' && <RosterTerminal />}
        {activeTab === 'lab' && <SynthesisLab />}
        {activeTab === 'relic' && <RelicTerminal />}
        {activeTab === 'debug' && DebugRoot && (
          <Suspense fallback={null}>
            <DebugRoot mode="docked" />
          </Suspense>
        )}
      </div>
    </main>
    </>
  );
}

export default App

