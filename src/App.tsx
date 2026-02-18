import { useState, useEffect } from 'react'
import './App.css'
import { useDispatch, useSelector } from 'react-redux'
import BattleArena from './ui/components/BattleArena'
import DeckTerminal from './ui/screens/DeckTerminal'
import RosterTerminal from './ui/screens/RosterTerminal'
import SynthesisLab from './ui/screens/SynthesisLab'
import HubScreen from './ui/screens/HubScreen'
import MainMenuView from './ui/components/MainMenuView'
import { loadGame } from './engine/SaveSystem'
import { loadSave } from './ui/store/gameSlice'
import type { RootState } from './ui/store/store'

type Tab = 'hub' | 'battle' | 'deck' | 'roster' | 'lab';

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'hub', label: 'Hub', icon: '🏠' },
  { id: 'deck', label: 'Deck', icon: '🃏' },
  { id: 'roster', label: 'Roster', icon: '🤖' },
  { id: 'lab', label: 'Lab', icon: '🔬' },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('hub');
  const dispatch = useDispatch();
  const rosterSize = useSelector((state: RootState) => state.game.roster.length);
  const isInBattle = useSelector((state: RootState) => state.battle.battle !== null);

  useEffect(() => {
    const result = loadGame();
    if (result.data) {
      dispatch(loadSave(result.data));
    }
  }, [dispatch]);

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
        {activeTab === 'deck' && <DeckTerminal />}
        {activeTab === 'roster' && <RosterTerminal />}
        {activeTab === 'lab' && <SynthesisLab />}
      </div>
    </main>
  );
}

export default App

