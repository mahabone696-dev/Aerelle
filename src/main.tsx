import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DEMO, LocalPlatformProvider } from './lib/store'
import { CloudPlatformProvider } from './lib/cloud'
import { App } from './App'
import './styles.css'

// Links in Aerelle's emails arrive at /auth-action?mode=…&oobCode=…; the app routes with #, so move them there.
if (location.pathname.replace(/\/+$/, '') === '/auth-action') history.replaceState(null, '', '/#/auth-action' + location.search)

const Provider = DEMO ? LocalPlatformProvider : CloudPlatformProvider

// No zooming. iPhones ignore the viewport's user-scalable=no, so block pinch gestures directly,
// plus trackpad / ctrl+wheel and ctrl +/- zoom on desktop.
const stop = (e: Event) => e.preventDefault()
document.addEventListener('gesturestart', stop, { passive: false })
document.addEventListener('gesturechange', stop, { passive: false })
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault() }, { passive: false })
document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider>
      <App />
    </Provider>
  </StrictMode>,
)
