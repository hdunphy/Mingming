import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './engine/SimRunner'; // Expose Simulation Runner for testing
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
