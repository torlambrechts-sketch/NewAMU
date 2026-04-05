import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = { children: ReactNode; title?: string }

type State = { error: Error | null }

/**
 * Catches render errors below the route; without this, React 19 can leave a blank main area.
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
  }

  render() {
    const { error } = this.state
    const { children, title = 'Noe gikk galt' } = this.props
    if (error) {
      return (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Siden kunne ikke vises. Prøv å laste på nytt, eller gå tilbake til dokumenter.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-left text-xs text-red-900">
              {error.message}
            </pre>
          )}
          <Link to="/documents" className="mt-6 inline-block text-sm font-medium text-[#1a3d32] underline">
            ← Til dokumenter
          </Link>
        </div>
      )
    }
    return children
  }
}
