// Learning embedder — Phase 1 stub. Phase 2a Task 2a.1 wraps
// src/pages/learning/LearningCourseBuilder.tsx as the real adapter.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function LearningEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode} className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Kursbygger kommer i Phase 2a</p>
      <p className="mt-1 text-xs">
        Eksisterende byggsurface finnes på{' '}
        <a className="underline" href="/learning/admin">
          Læring → Admin
        </a>
        .
      </p>
    </div>
  )
}
