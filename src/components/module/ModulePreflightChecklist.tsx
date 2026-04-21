import type { ReactNode } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'
import { WPSTD_FORM_FIELD_LABEL } from '../layout/WorkplaceStandardFormPanel'

export interface ModulePreflightItem {
  ok: boolean
  label: ReactNode
}

export interface ModulePreflightChecklistProps {
  items: ModulePreflightItem[]
  /** Label above the checklist. Defaults to a standard Norwegian label. */
  heading?: ReactNode
}

/**
 * Pre-flight checklist shown before signing a module record. Used by ROS analyses
 * («Klar for signering?») and Inspeksjonsrunder («Sjekkliste før signering»).
 *
 * Renders each item as a 4×4 circle — green check when completed, outline when pending.
 */
export function ModulePreflightChecklist({
  items,
  heading = 'Sjekkliste før signering',
}: ModulePreflightChecklistProps) {
  return (
    <div className="space-y-1.5">
      {heading ? <p className={WPSTD_FORM_FIELD_LABEL}>{heading}</p> : null}
      {items.map((item, i) => (
        <div key={typeof item.label === 'string' ? item.label : i} className="flex items-center gap-2 text-xs">
          {item.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
          ) : (
            <Circle className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
          )}
          <span className={item.ok ? 'text-neutral-700' : 'text-neutral-400'}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
