// Registers embedder — Phase 1 stub. Phase 2a Task 2a.1 wraps
// src/pages/registers/RegistersScopeTyper.tsx (JSON-schema form).

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function RegistersEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode} className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Register-skjemaeditor kommer i Phase 2a</p>
      <p className="mt-1 text-xs">
        Eksisterende editor er på{' '}
        <a className="underline" href="/registers/admin">
          Register → Admin
        </a>
        .
      </p>
    </div>
  )
}
