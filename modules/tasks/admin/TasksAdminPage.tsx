// TasksAdminPage — Phase 0 placeholder.
// Full admin with tabs (Maler, Kategorier, SLA, Varsler, Roller) lands in Phase 3.

import { Construction } from 'lucide-react'

export function TasksAdminPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-neutral-500">
      <Construction className="w-10 h-10 opacity-40" />
      <div className="text-center">
        <p className="font-medium text-neutral-700">Innstillinger — under bygging</p>
        <p className="text-sm mt-1">Implementeres i fase 3.</p>
      </div>
    </div>
  )
}
