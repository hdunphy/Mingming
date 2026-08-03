import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './ui/store/store'
import './index.css'
import App from './App.tsx'

// DEV-only: attaches `window.runSim` for console debugging. `import.meta.env.DEV` folds to
// `false` in a production build, making the dynamic import unreachable so Rollup drops the
// chunk. Imported here rather than from DebugRoot so the global exists from boot, not only
// after the lazy debug chunk loads.
if (import.meta.env.DEV) {
  import('./engine/SimRunner');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
