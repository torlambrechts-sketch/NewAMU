// Shared "Phase 2a embedder coming soon" placeholder.
//
// Phase 1 ships every scope with a stub embedder that points users at
// the existing module-admin surface for now. Centralising the UX here
// means we replace 7 yellow-box clones with one design-system aligned
// empty state — and when Phase 2a Task 2a.1 wraps the real editors,
// we drop only the per-scope embedders (the placeholder file itself
// can stay for any future "this kind is still in beta" use case).

import { ExternalLink } from 'lucide-react'
import { Button } from '../../ui/Button'

export type DeferredEmbedderPlaceholderProps = {
  /** Scope's plural label, e.g. "Sjekklister og samsvar". */
  scopeLabel: string
  /** Existing module admin page to link out to. */
  fallbackHref: string
  /** Label for the link out, e.g. "Innstillinger → Sjekklister". */
  fallbackLabel: string
  /** Studio mode mounted in — Simple bypasses the embedder entirely. */
  mode: 'simple' | 'advanced'
}

export function DeferredEmbedderPlaceholder({
  scopeLabel,
  fallbackHref,
  fallbackLabel,
  mode,
}: DeferredEmbedderPlaceholderProps) {
  return (
    <div
      data-studio-mode={mode}
      className="rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center"
    >
      <div className="mx-auto max-w-md space-y-4">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
          <ExternalLink className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-neutral-900 font-serif">
            Avansert redigering for {scopeLabel}
          </p>
          <p className="text-xs text-neutral-600">
            Studio mounter den eksisterende editoren her i Phase 2a. Inntil videre
            redigerer du innholdet på det opprinnelige innstillinger-skjermbildet.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            window.location.href = fallbackHref
          }}
        >
          Åpne {fallbackLabel}
          <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
