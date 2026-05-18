// Workflows embedder — Phase 1.5 deep-link to existing builder.
//
// Phase 2a-equivalent in-shell embedding lands when
// workflow-engine-review.md Phase B ships its v3 three-column canvas.
// Until then we surface the scope but link out to the current
// /workflow page so the round-trip is at least one click.

import { Button } from '../../../src/components/ui/Button'
import { ExternalLink } from 'lucide-react'
import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function WorkflowsEmbedder({ mode }: EmbedderProps) {
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
            Arbeidsflyt-bygger v3 kommer
          </p>
          <p className="text-xs text-neutral-600">
            Den nye tre-kolonne-kanvasen (workflow-engine-review.md Phase B) integreres
            inline her. Inntil den lander redigerer du arbeidsflyter på dagens side.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            window.location.href = '/workflow'
          }}
        >
          Åpne arbeidsflyt-bygger
          <ExternalLink className="ml-1 h-3 w-3" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
