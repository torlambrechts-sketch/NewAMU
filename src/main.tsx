import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OptionalVercelMetrics } from './components/OptionalVercelMetrics'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Missing #root element')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
    <OptionalVercelMetrics />
  </StrictMode>,
)
