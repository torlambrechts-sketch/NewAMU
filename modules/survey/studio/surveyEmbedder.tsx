// Survey embedder — Phase 1 stub. Phase 2a Task 2a.1 wraps
// modules/survey/SurveyBuilderStage.tsx as the real adapter.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function SurveyEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode} className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Avansert spørreredigering kommer i Phase 2a</p>
      <p className="mt-1 text-xs">
        Inntil videre redigeres spørsmål i{' '}
        <a className="underline" href="/survey/admin">
          Undersøkelser → Innstillinger
        </a>
        .
      </p>
    </div>
  )
}
