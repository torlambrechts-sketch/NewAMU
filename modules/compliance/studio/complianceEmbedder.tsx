// Compliance embedder — Studio Builder Phase 1 stub.
//
// Phase 2a Task 2a.1 will replace this with a thin adapter wrapping
// modules/compliance/admin/TemplateEditorPanel.tsx (slide-panel form,
// ~150 LoC adapter). For Phase 1 we ship a stub that explains what the
// embedder slot is for — the Simple-mode wizards bypass it entirely and
// the Advanced canvas isn't built yet.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function ComplianceEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode} className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Avansert redigering kommer i Phase 2a</p>
      <p className="mt-1 text-xs">
        Pakker, sjekkliste-maler og lovreferanser redigeres inntil videre i{' '}
        <a className="underline" href="/compliance/checklists/admin">
          Innstillinger → Sjekklister
        </a>
        . Studio-shellen mounter den eksisterende editoren her i Phase 2a.
      </p>
    </div>
  )
}
