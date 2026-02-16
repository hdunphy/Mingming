import { useState } from 'react'
import './App.css'
import BattleArena from './ui/components/BattleArena'
import DeckTerminal from './ui/screens/DeckTerminal'
import RosterTerminal from './ui/screens/RosterTerminal'
import SynthesisLab from './ui/screens/SynthesisLab'

type Tab = 'battle' | 'deck' | 'roster' | 'lab';

const TAB_CONFIG: { id: Tab; label: string; icon: string }[] = [
  { id: 'battle', label: 'Battle', icon: '⚔️' },
  { id: 'deck', label: 'Deck', icon: '🃏' },
  { id: 'roster', label: 'Roster', icon: '🤖' },
  { id: 'lab', label: 'Lab', icon: '🔬' },
];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('battle');

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
        {activeTab === 'battle' && <BattleArena />}
        {activeTab === 'deck' && <DeckTerminal />}
        {activeTab === 'roster' && <RosterTerminal />}
        {activeTab === 'lab' && <SynthesisLab />}
      </div>
    </main>
  )
}

export default App

