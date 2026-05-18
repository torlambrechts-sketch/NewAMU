// Documents embedder — Phase 1 stub. Phase 2a Task 2a.1 wraps
// src/components/documents/DocumentEditorWorkbench.tsx (1,231 LoC TipTap +
// ContentBlock JSON) — the spec calls this out as the highest-effort
// adapter (locking surface lives inside the editor, not the shell).

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function DocumentsEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode} className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Dokument-editor kommer i Phase 2a</p>
      <p className="mt-1 text-xs">
        Eksisterende TipTap-editor finnes på{' '}
        <a className="underline" href="/documents">
          Dokumenter
        </a>{' '}
        — Studio mounter den her når Task 2a.1 er kjørt.
      </p>
    </div>
  )
}
