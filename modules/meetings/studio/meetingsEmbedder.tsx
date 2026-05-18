// Meetings embedder — Phase 1 stub. Phase 2a Task 2a.1 wraps
// src/pages/meetings/MeetingsTemplateEditorPanel.tsx (slide-panel form).

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function MeetingsEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode} className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Møte-mal-editor kommer i Phase 2a</p>
      <p className="mt-1 text-xs">
        Eksisterende editor er på{' '}
        <a className="underline" href="/meetings/admin">
          Møter → Innstillinger
        </a>
        .
      </p>
    </div>
  )
}
