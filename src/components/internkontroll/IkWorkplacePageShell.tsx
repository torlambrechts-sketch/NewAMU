import type { ReactNode } from 'react'
import { WorkplacePageHeading1, type WorkplaceBreadcrumbItem } from '../layout/WorkplacePageHeading1'
import { WORKPLACE_MODULE_CARD, WORKPLACE_MODULE_CARD_SHADOW } from '../layout/workplaceModuleSurface'

type Props = {
  breadcrumb: WorkplaceBreadcrumbItem[]
  title: string
  description: ReactNode
  children: ReactNode
}

/**
 * Wraps Internkontroll pillar pages with the same chrome as {@link InspectionModuleView}:
 * serif H1 + description, then content in a rounded white card on the cream canvas.
 */
export function IkWorkplacePageShell({ breadcrumb, title, description, children }: Props) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <WorkplacePageHeading1
        breadcrumb={breadcrumb}
        title={title}
        description={<div className="max-w-3xl">{description}</div>}
      />
      <div className={`mt-6 ${WORKPLACE_MODULE_CARD} p-5 md:p-6`} style={WORKPLACE_MODULE_CARD_SHADOW}>
        {children}
      </div>
    </div>
  )
}
