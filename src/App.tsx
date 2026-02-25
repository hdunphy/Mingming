import { useState, useEffect, useRef } from 'react'
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

import { loadGame } from './engine/SaveSystem'
import { loadSave } from './ui/store/gameSlice'
import type { RootState } from './ui/store/store'

type Tab = 'hub' | 'terminal' | 'battle' | 'deck' | 'roster' | 'lab' | 'balance' | 'studio';

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'hub', label: 'Hub', icon: '🏠' },
  { id: 'terminal', label: 'Terminal', icon: '📟' },
  { id: 'deck', label: 'Deck', icon: '🃏' },
  { id: 'roster', label: 'Roster', icon: '🤖' },
  { id: 'lab', label: 'Lab', icon: '🔬' },
  { id: 'balance', label: 'Balance', icon: '⚖️' },
  { id: 'studio', label: 'Studio', icon: '🏗️' },
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

  const prevInBattle = useRef(isInBattle);
  useEffect(() => {
    if (prevInBattle.current && !isInBattle && gauntlet) {
      setActiveTab('hub');
    }
    prevInBattle.current = isInBattle;
  }, [isInBattle, gauntlet]);

  if (rosterSize === 0) {
    return <MainMenuView />;
  }

  if (isInBattle) {
    return <BattleArena />;
  }

  return (
    <main style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Navigation */}
      <nav className="main-nav">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="nav-icon">{tab.icon}</span>
            <span className="nav-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Screen Content */}
      <div className="screen-content">
        {activeTab === 'hub' && <HubScreen />}
        {activeTab === 'terminal' && <SectorTerminal />}
        {activeTab === 'deck' && <DeckTerminal />}
        {activeTab === 'roster' && <RosterTerminal />}
        {activeTab === 'lab' && <SynthesisLab />}
        {activeTab === 'balance' && <BalanceTester />}
        {activeTab === 'studio' && <CardStudio />}
      </div>
    </main>
  );
}

export default App

