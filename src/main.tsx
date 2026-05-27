import './lib/i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OptionalVercelMetrics } from './components/OptionalVercelMetrics'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Missing #root element')
}

// Alerts intake PWA — register the service worker only when on a
// /alerts/public/* route. Same-origin guarded by the SW itself.
if (
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  window.location.pathname.startsWith('/alerts/public')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/alerts-sw.js', { scope: '/alerts/public' }).catch(() => null)
  })
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
    <OptionalVercelMetrics />
  </StrictMode>,
)
