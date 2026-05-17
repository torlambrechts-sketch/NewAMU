import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './ui/Button'

type Props = { children: ReactNode; title?: string }

type State = { error: Error | null }

const CHUNK_RELOAD_KEY = 'atics-chunk-reload-v1'

function isChunkLoadError(error: Error): boolean {
  return (
    error.message.includes('Failed to fetch dynamically imported module') ||
    error.message.includes('Importing a module script failed') ||
    error.message.includes('error loading dynamically imported module') ||
    error.name === 'ChunkLoadError'
  )
}

/**
 * Catches render errors below the route; without this, React 19 can leave a blank main area.
 *
 * Stale-deployment chunk errors ("Failed to fetch dynamically imported module") are handled
 * transparently: the boundary reloads the page once so the browser picks up the new asset
 * hashes. A sessionStorage flag prevents an infinite reload loop if the chunk genuinely
 * doesn't exist even after a fresh load.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RouteErrorBoundary]', error, info.componentStack)

    if (isChunkLoadError(error)) {
      try {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
          window.location.reload()
          return
        }
      } catch {
        // sessionStorage unavailable (private mode) — fall through to error UI
      }
    }
  }

  render() {
    const { error } = this.state
    const { children, title = 'Noe gikk galt' } = this.props
    if (error) {
      const isChunk = isChunkLoadError(error)
      return (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-lg font-semibold text-neutral-900">
            {isChunk ? 'Applikasjonen er oppdatert' : title}
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            {isChunk
              ? 'En ny versjon av appen er tilgjengelig. Last siden på nytt for å fortsette.'
              : 'Siden kunne ikke vises. Prøv å laste på nytt.'}
          </p>
          <Button
            variant="primary"
            onClick={() => {
              try { sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch { /* ignore */ }
              window.location.reload()
            }}
            className="mt-6 inline-flex items-center rounded-md bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Last siden på nytt
          </Button>
          {!isChunk && (
            <Link to="/" className="mt-4 block text-sm text-neutral-500 underline">
              ← Til forsiden
            </Link>
          )}
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-left text-xs text-red-900">
              {error.message}
            </pre>
          )}
        </div>
      )
    }

    // Clear the reload-guard when the route renders successfully after a reload.
    try { sessionStorage.removeItem(CHUNK_RELOAD_KEY) } catch { /* ignore */ }
    return children
  }
}
