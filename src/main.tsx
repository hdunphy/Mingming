import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './ui/store/store'
import { setBattleState } from './ui/store/battleSlice'
import ErrorBoundary from './ui/components/ErrorBoundary'
import SaveHealthBanner from './ui/components/SaveHealthBanner'
import './index.css'
import App from './App.tsx'

// Ticket 04 (steam-release map). The boundary sits INSIDE the Provider so `onReturnToRanch` can
// dispatch, and OUTSIDE App so a throw in any screen — including both of App's early returns —
// is caught rather than unmounting the tree into a white screen.
//
// Return-to-ranch clears the live battle and nothing else: `battle` is the only slice that is not
// persisted, so dropping it costs the run in progress and never the save. `App` then falls back
// to the hub on its own, because `isInBattle` is what put it on `BattleArena` in the first place.
//
// The banner is a sibling of the boundary rather than a child: a save that has stopped writing is
// exactly the situation where a second, unrelated render fault must not take the warning down
// with it.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <SaveHealthBanner />
      <ErrorBoundary
        onReturnToRanch={() => store.dispatch(setBattleState(null))}
        snapshotState={() => store.getState()}
      >
        <App />
      </ErrorBoundary>
    </Provider>
  </StrictMode>,
)
