import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const FOREST = '#1a3d32'
const CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

export type ModuleDocumentsForestCardProps = {
  icon: LucideIcon
  title: string
  children: ReactNode
  className?: string
}

/**
 * Compact forest-green surface for documents aside (storage, status, alerts).
 * Not a white `ModuleSectionCard` — keeps visual hierarchy next to {@link ModuleDocumentsInsightPanel}.
 */
export function ModuleDocumentsForestCard({ icon: Icon, title, children, className = '' }: ModuleDocumentsForestCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-emerald-900/25 text-white shadow-sm ${className}`.trim()}
      style={{ backgroundColor: FOREST, ...CARD_SHADOW }}
    >
      <div className="p-4">
        <div className="flex items-center gap-1.5">
          <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/95">{title}</h3>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  )
}
