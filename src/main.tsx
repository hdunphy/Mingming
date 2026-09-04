import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { installDesktopSaveStorage } from './engine/save/desktopStorage'
import { store } from './ui/store/store'
import { setBattleState } from './ui/store/battleSlice'
import ErrorBoundary from './ui/components/ErrorBoundary'
import SaveHealthBanner from './ui/components/SaveHealthBanner'
import './index.css'
import App from './App.tsx'

/*
 * TICKET 42: swap the file-backed save backend in, before anything reads a save. A no-op in the
 * browser build, which is what lets this be unconditional.
 *
 * # WHY A STATEMENT HERE IS ENOUGH, GIVEN THAT IMPORTS HOIST
 *
 * `./ui/store/store` runs its module body before this line — ES imports always do — so the
 * placement alone proves nothing and the ordering was checked instead. Nothing in the import graph
 * touches storage at module scope: the store's slices start from `createEmptyRanch()` and
 * `{ run: null }`, and every `getSaveStorage()` caller in the repo resolves the backend at CALL
 * time (`SaveSystem`, `SaveSlots`, `runLog`, `runTelemetry`, `settings`, `AudioEngine` — the last
 * two through default parameters, which evaluate per call). The first actual read is inside the
 * render below.
 *
 * That ordering is the thing that matters, not tidiness: a boot that READ from `localStorage` and
 * then WROTE to a file would show the player an empty ranch and save over nothing, reporting no
 * error at any point.
 */
installDesktopSaveStorage()

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
