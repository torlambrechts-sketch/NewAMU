// TasksAllePage — Phase 0 placeholder.
// Rebuilt in Phase 1 against task_items relational table.

import { Construction } from 'lucide-react'

export function TasksAllePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-neutral-500">
      <Construction className="w-10 h-10 opacity-40" />
      <div className="text-center">
        <p className="font-medium text-neutral-700">Alle oppgaver — under bygging</p>
        <p className="text-sm mt-1">Implementeres i fase 1.</p>
      </div>
    </div>
  )
}
