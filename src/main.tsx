import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PlatformProvider } from './lib/store'
import { App } from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlatformProvider>
      <App />
    </PlatformProvider>
  </StrictMode>,
)
