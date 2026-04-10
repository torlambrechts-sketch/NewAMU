import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { HubMenu1Bar, type HubMenu1Item } from '../layout/HubMenu1Bar'

export const COMPLIANCE_SERIF = "'Libre Baskerville', Georgia, serif"

const SHELL = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const CONTENT_PANEL =
  'rounded-xl border border-neutral-200/80 bg-white p-4 shadow-sm md:p-6'

type BreadcrumbItem = { label: string; to?: string }

type Props = {
  breadcrumb?: BreadcrumbItem[]
  title: string
  description?: ReactNode
  headerActions?: ReactNode
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
      <p className="mb-3 text-xs text-neutral-500">
        {breadcrumb.map((b, i) => (
          <span key={`${b.label}-${i}`}>
            {i > 0 ? <span className="mx-1.5 text-neutral-300">›</span> : null}
            {b.to ? (
              <Link to={b.to} className="hover:text-neutral-700">
                {b.label}
              </Link>
            ) : (
              <span className="text-neutral-600">{b.label}</span>
            )}
          </span>
        ))}
      </p>

      <div className="flex flex-col gap-3 border-b border-neutral-200/80 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
            style={{ fontFamily: COMPLIANCE_SERIF }}
          >
            {title}
          </h1>
          {description ? <div className="mt-2 text-sm text-neutral-600">{description}</div> : null}
        </div>
        {headerActions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{headerActions}</div> : null}
      </div>

      <div className="mt-5">
        <HubMenu1Bar ariaLabel={hubAriaLabel} items={hubItems} />
      </div>

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
