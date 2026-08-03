import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import './App.css'
import { useDispatch, useSelector } from 'react-redux'
import BattleArena from './ui/components/BattleArena'
import DeckTerminal from './ui/screens/DeckTerminal'
import RosterTerminal from './ui/screens/RosterTerminal'
import SynthesisLab from './ui/screens/SynthesisLab'
import HubScreen from './ui/screens/HubScreen'
import MainMenuView from './ui/components/MainMenuView'
import BalanceTester from './ui/screens/BalanceTester'
import SectorTerminal from './ui/screens/SectorTerminal'
import CardStudio from './ui/screens/CardStudio'
import RelicTerminal from './ui/screens/RelicTerminal'

import { loadGame } from './engine/SaveSystem'
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

type Tab = 'hub' | 'terminal' | 'battle' | 'deck' | 'roster' | 'lab' | 'relic' | 'balance' | 'studio' | 'debug';

const debugTab: { id: Tab; label: string; icon: string } = { id: 'debug', label: 'Debug', icon: '🐞' };

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'hub', label: 'Hub', icon: '🏠' },
  { id: 'terminal', label: 'Terminal', icon: '📟' },
  { id: 'deck', label: 'Deck', icon: '🃏' },
  { id: 'roster', label: 'Roster', icon: '🤖' },
  { id: 'lab', label: 'Lab', icon: '🔬' },
  { id: 'relic', label: 'Relics', icon: '💎' },
  { id: 'balance', label: 'Balance', icon: '⚖️' },
  { id: 'studio', label: 'Studio', icon: '🏗️' },
  ...(import.meta.env.DEV ? [debugTab] : []),
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('hub');
  const dispatch = useDispatch();
  const rosterSize = useSelector((state: RootState) => state.game.roster.length);
  const isInBattle = useSelector((state: RootState) => state.battle.battle !== null);
  const gauntlet = useSelector((state: RootState) => state.game.gauntlet);

  useEffect(() => {
    const result = loadGame();
    if (result.data) {
      dispatch(loadSave(result.data));
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

  if (rosterSize === 0) {
    return <>{debugLayer}<MainMenuView /></>;
  }

  if (isInBattle) {
    return <>{debugLayer}<BattleArena /></>;
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
        {activeTab === 'balance' && <BalanceTester />}
        {activeTab === 'studio' && <CardStudio />}
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

