import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

/** Same serif as layout-composer «Overskrift 1» and ComplianceModuleChrome */
export const WORKPLACE_PAGE_SERIF = "'Libre Baskerville', Georgia, serif"

export type WorkplaceBreadcrumbItem = { label: string; to?: string }

/**
 * Standard page top: brødsmule › serif H1 › beskrivelse › valgfri handlinger › hub-meny.
 * Matches platform-admin layout-composer «Overskrift 1» with an added description block.
 */
export function WorkplacePageHeading1({
  breadcrumb,
  title,
  description,
  menu,
  headerActions,
  className = '',
  id,
}: {
  breadcrumb: WorkplaceBreadcrumbItem[]
  title: ReactNode
  description?: ReactNode
  /** Hub navigation row (e.g. HubMenu1Bar or WorkplaceBoardTabStrip) */
  menu?: ReactNode
  headerActions?: ReactNode
  className?: string
  /** Set when the page has no hub menu so skip-link targets still exist */
  id?: string
}) {
  return (
    <header className={`space-y-4 ${className}`.trim()} id={id}>
      <nav aria-label="Brødsmule" className="text-xs text-neutral-500">
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
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            {title}
          </h1>
          {description ? <div className="mt-2 text-sm text-neutral-600">{description}</div> : null}
        </div>
        {headerActions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">{headerActions}</div>
        ) : null}
      </div>

      {menu ? <div>{menu}</div> : null}
    </header>
  )
}
