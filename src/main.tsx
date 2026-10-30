import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import { AccessGate } from '@/features/connection/gate'
import { TitlebarStrip } from '@/ui/titlebar'
import './styles.css'

// The service worker keeps the app's shell for opening offline (public/sw.js). Pushes use the same one.
if (import.meta.env.PROD && 'serviceWorker' in navigator)
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The desktop app's window drags by its top edge; first, so everything after can opt out. */}
    <TitlebarStrip />
    {/* Standalone installs can require a password before anything connects. */}
    <AccessGate>
      <App />
    </AccessGate>
  </StrictMode>,
)
