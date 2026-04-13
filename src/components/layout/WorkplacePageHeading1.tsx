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
  headerActionsLayout = 'default',
  className = '',
  id,
}: {
  breadcrumb: WorkplaceBreadcrumbItem[]
  title: ReactNode
  description?: ReactNode
  /** Hub navigation row (e.g. HubMenu1Bar or WorkplaceBoardTabStrip) */
  menu?: ReactNode
  headerActions?: ReactNode
  /** `split7030` — tittel ~2/3, handlinger ~1/3 på lg (f.eks. Varslingssaker) */
  headerActionsLayout?: 'default' | 'split7030'
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

      <div
        className={
          headerActionsLayout === 'split7030'
            ? 'grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start lg:gap-6'
            : 'flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'
        }
      >
        <div className="min-w-0 lg:min-w-0">
          <h1
            className="text-2xl font-semibold tracking-tight text-neutral-900 md:text-3xl"
            style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
          >
            {title}
          </h1>
          {description ? <div className="mt-2 text-sm text-neutral-600">{description}</div> : null}
        </div>
        {headerActions ? (
          <div
            className={
              headerActionsLayout === 'split7030'
                ? 'flex min-w-0 flex-wrap items-center justify-start gap-2 lg:min-w-0 lg:justify-end'
                : 'flex shrink-0 flex-wrap items-center gap-2 lg:justify-end'
            }
          >
            {headerActions}
          </div>
        ) : null}
      </div>

      {menu ? <div>{menu}</div> : null}
    </header>
  )
}

/**
 * Section title using the same serif as «Overskrift 1» (smaller step) — e.g. under {@link WorkplacePageHeading1}.
 * Matches platform layout-composer section headings.
 */
export function WorkplaceSerifSectionTitle({
  children,
  className = '',
  as: Tag = 'h2',
  variant = 'default',
}: {
  children: ReactNode
  className?: string
  as?: 'h2' | 'h3'
  /** `compact` — nested title inside a card (e.g. platform layout boks header). */
  variant?: 'default' | 'compact'
}) {
  const size =
    variant === 'compact'
      ? 'text-base font-semibold tracking-tight sm:text-lg'
      : 'text-lg font-semibold tracking-tight sm:text-xl'
  return (
    <Tag className={`${size} text-neutral-900 ${className}`.trim()} style={{ fontFamily: WORKPLACE_PAGE_SERIF }}>
      {children}
    </Tag>
  )
}
