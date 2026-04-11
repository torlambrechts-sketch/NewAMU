import type { ReactNode } from 'react'
import type { HubMenu1Item } from './HubMenu1Bar'
import { HubMenu1Bar } from './HubMenu1Bar'
import type { WorkplaceBreadcrumbItem } from './WorkplacePageHeading1'
import { WorkplacePageHeading1 } from './WorkplacePageHeading1'

const SHELL = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'

export type WorkplaceDashboardShellProps = {
  breadcrumb: WorkplaceBreadcrumbItem[]
  title: ReactNode
  description?: ReactNode
  headerActions?: ReactNode
  /** Optional hub tabs under heading */
  hubAriaLabel?: string
  hubItems?: HubMenu1Item[]
  /** KPI / stat strip above main content (e.g. grid of tan cards) */
  kpiSlot?: ReactNode
  children: ReactNode
  className?: string
  /** Space between heading block and body (default mt-8) */
  bodyTopClassName?: string
}

/**
 * Standard dashboard page shell: brødsmule, serif H1, beskrivelse, optional hub, optional KPI-rad, then body.
 * Compose with {@link WorkplaceSplit7030Layout} for 70/30 overviews.
 */
export function WorkplaceDashboardShell({
  breadcrumb,
  title,
  description,
  headerActions,
  hubAriaLabel = 'Dashbord — faner',
  hubItems,
  kpiSlot,
  children,
  className = '',
  bodyTopClassName = 'mt-8',
}: WorkplaceDashboardShellProps) {
  return (
    <div className={`${SHELL} ${className}`.trim()}>
      <WorkplacePageHeading1
        breadcrumb={breadcrumb}
        title={title}
        description={description}
        headerActions={headerActions}
        menu={hubItems && hubItems.length > 0 ? <HubMenu1Bar ariaLabel={hubAriaLabel} items={hubItems} /> : undefined}
      />
      {kpiSlot ? <div className="mt-6">{kpiSlot}</div> : null}
      <div className={bodyTopClassName}>{children}</div>
    </div>
  )
}
