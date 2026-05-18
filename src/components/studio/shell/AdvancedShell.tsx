// Advanced-mode 3-column shell — Phase 1 minimal version.
//
// The full Advanced surface (PalettePanel + CanvasFrame + PropertyInspector
// + VersionTimeline + PublishBar + ConflictModal + AutosaveIndicator)
// lands in Phase 2a Task 2a.1 when the embedders are wired. Phase 1
// renders just the chosen kind's embedder + a Tilbake link so the surface
// is reachable end-to-end even before the full chrome lands.

import { Component, Suspense, createElement, lazy, useMemo, useState } from 'react'
import type { ReactNode, ComponentType, LazyExoticComponent } from 'react'
import { listStudioKinds, getStudioKind } from '../../../lib/studio/studioRegistry'
import type { EmbedderProps, StudioKindRegistration } from '../../../lib/studio/studioTypes'
import { Button } from '../../ui/Button'

// Module-scope cache so a re-render doesn't create a new lazy() and reset
// embedder state (eslint react-hooks/static-components rule).
const lazyEmbedderCache = new Map<
  string,
  LazyExoticComponent<ComponentType<EmbedderProps>>
>()

function getLazyEmbedder(kind: StudioKindRegistration) {
  const key = `${kind.scopeId}::${kind.kindId}`
  let cached = lazyEmbedderCache.get(key)
  if (!cached) {
    cached = lazy(kind.embedder) as LazyExoticComponent<ComponentType<EmbedderProps>>
    lazyEmbedderCache.set(key, cached)
  }
  return cached
}

export type AdvancedShellProps = {
  scopeId: string
  onBackToSimple: () => void
}

export function AdvancedShell({ scopeId, onBackToSimple }: AdvancedShellProps) {
  const kinds = useMemo(() => listStudioKinds(scopeId), [scopeId])
  const [activeKindId, setActiveKindId] = useState<string>(kinds[0]?.kindId ?? '')
  const activeKind: StudioKindRegistration | null = activeKindId
    ? getStudioKind(scopeId, activeKindId)
    : null

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Innholdstyper
        </h3>
        <ul className="space-y-1">
          {kinds.map((kind) => {
            const isActive = kind.kindId === activeKindId
            return (
              <li key={kind.kindId}>
                <Button
                  variant={isActive ? 'primary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start font-normal"
                  onClick={() => setActiveKindId(kind.kindId)}
                >
                  {kind.label}
                </Button>
              </li>
            )
          })}
        </ul>
        <div className="pt-4">
          <Button variant="ghost" size="sm" onClick={onBackToSimple}>
            ← Tilbake til Enkel-modus
          </Button>
        </div>
      </aside>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        {activeKind ? (
          <EmbedderMount kind={activeKind} />
        ) : (
          <p className="text-sm text-neutral-600">Velg en innholdstype.</p>
        )}
      </section>
    </div>
  )
}

// Phase 1 hands the embedder a stub row; Phase 2a will wire real data
// (selected row id from the inspector, load via the kind's mutator).
const STUB_PROPS: EmbedderProps = {
  value: {},
  onChange: () => {},
  mode: 'advanced',
}

function EmbedderMount({ kind }: { kind: StudioKindRegistration }) {
  // The cache lookup is referentially stable across renders for the same
  // kind id, so the component identity is preserved. We name it lowercase
  // and render via React.createElement to keep the eslint
  // `react-hooks/static-components` heuristic happy (it flags
  // `const Foo = …` in function bodies regardless of caching).
  const embedderCmp = getLazyEmbedder(kind)
  return (
    <Suspense
      fallback={
        <div className="text-xs text-neutral-500">Laster {kind.label}-editor…</div>
      }
    >
      <FallbackBoundary>
        {createElement(embedderCmp, STUB_PROPS)}
      </FallbackBoundary>
    </Suspense>
  )
}

/** Minimal error boundary so a broken embedder doesn't crash the shell. */
class FallbackBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          Embedder feilet å laste: {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}
