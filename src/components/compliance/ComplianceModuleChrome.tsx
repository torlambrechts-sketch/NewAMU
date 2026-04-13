import type { ReactNode } from 'react'
import { HubMenu1Bar, type HubMenu1Item } from '../layout/HubMenu1Bar'
import { WorkplacePageHeading1, WORKPLACE_PAGE_SERIF } from '../layout/WorkplacePageHeading1'

export const COMPLIANCE_SERIF = WORKPLACE_PAGE_SERIF

const SHELL = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const CONTENT_PANEL =
  'rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm md:p-6'

type BreadcrumbItem = { label: string; to?: string }

type Props = {
  breadcrumb?: BreadcrumbItem[]
  title: string
  description?: ReactNode
  headerActions?: ReactNode
  /** Hide module H1/description row; tab content may render Overskrift 1 from layout (e.g. Vernerunder). */
  showTitleBlock?: boolean
  hubAriaLabel: string
  hubItems: HubMenu1Item[]
  children: ReactNode
  /** When true (default), tab body is a white card on the cream canvas. Set false for full-bleed content (e.g. nested shells). */
  contentCard?: boolean
}

/**
 * Pinpoint-style compliance shell: breadcrumb, serif title, HubMenu1Bar (no faux app top bar).
 * Body sits on {@link WORKPLACE_CREAM} (from WorkplaceChrome); tab content is a white card like layout-reference tables.
 */
export function ComplianceModuleChrome({
  breadcrumb = [{ label: 'Workspace', to: '/' }, { label: 'Samsvar' }],
  title,
  description,
  headerActions,
  showTitleBlock = true,
  hubAriaLabel,
  hubItems,
  children,
  contentCard = true,
}: Props) {
  return (
    <div
      className={SHELL}
      style={{ fontFamily: 'Inter, system-ui, sans-serif', color: '#171717' }}
    >
      <WorkplacePageHeading1
        breadcrumb={breadcrumb}
        title={title}
        description={description}
        headerActions={headerActions}
        showTitleBlock={showTitleBlock}
        menu={<HubMenu1Bar ariaLabel={hubAriaLabel} items={hubItems} />}
      />

      {contentCard ? (
        <div className={`mt-6 ${CONTENT_PANEL}`} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          {children}
        </div>
      ) : (
        <div className="mt-6">{children}</div>
      )}
    </div>
  )
}
