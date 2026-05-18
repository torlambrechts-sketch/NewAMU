// Dashboards embedder — Phase 1 stub. Phase 2a Task 2a.1 wraps
// src/components/module/dashboard/DashboardEditLayoutPanel.tsx.

import type { EmbedderProps } from '../../../src/lib/studio/studioTypes'

export default function DashboardsEmbedder({ mode }: EmbedderProps) {
  return (
    <div data-studio-mode={mode} className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">Dashboard-layouteditor kommer i Phase 2a</p>
      <p className="mt-1 text-xs">
        Eksisterende layouteditor åpnes via en hvilken som helst Analyse-side
        («Rediger layout»-knapp).
      </p>
    </div>
  )
}
