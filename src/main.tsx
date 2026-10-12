import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DEMO, LocalPlatformProvider } from './lib/store'
import { CloudPlatformProvider } from './lib/cloud'
import { App } from './App'
import './styles.css'

const Provider = DEMO ? LocalPlatformProvider : CloudPlatformProvider

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider>
      <App />
    </Provider>
  </StrictMode>,
)
