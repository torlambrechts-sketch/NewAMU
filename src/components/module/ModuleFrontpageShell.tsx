import type { ReactNode } from 'react'
import { ModulePageShell } from './ModulePageShell'
import type { ModulePageShellProps } from './ModulePageShell'
import { ModuleLegalBanner } from './ModuleLegalBanner'
import type { ModuleLegalBannerProps } from './ModuleLegalBanner'

/**
 * Standard layout for a **group** frontpage / dashboard (e.g. Risiko &
 * Sikkerhet, Internkontroll, Arbeidsmiljø & AMU).
 *
 * Composes:
 *   1. `ModulePageShell` — breadcrumb, serif H1, description, tabs.
 *   2. `ModuleLegalBanner` — legal framework (mint surface, inner cards; dismiss + header switch).
 *   3. Slots the caller fills: `overview`, `dashboard`, `shortcuts`, `guidance`.
 *
 * Rule of thumb for slot order on a frontpage:
 *   overview  (KPI strip, at-a-glance stats)
 *   dashboard (charts / ReportModulesGrid / donuts)
 *   shortcuts (ModuleShortcutGrid to each sub-module)
 *   guidance  (InfoBoxes, «slik bruker du dette»-list, compliance tips)
 *
 * Reuse this for any of the 7 canonical nav groups — it is not coupled to a
 * specific domain.
 */
export interface ModuleFrontpageShellProps
  extends Omit<ModulePageShellProps, 'children' | 'loading' | 'notFound'> {
  /** Legal framework banner shown at the top of the body. */
  legal?: ModuleLegalBannerProps

  /** KPI-/stats row — typically `<LayoutScoreStatRow>`. */
  overview?: ReactNode
  /** Charts and dashboards — typically `<ReportModulesGrid>` or `<ModuleDonutCard>`s. */
  dashboard?: ReactNode
  /** Section that links into the sub-modules — typically `<ModuleShortcutGrid>`. */
  shortcuts?: ReactNode
  /** "Slik bruker du dette"-section — InfoBox, list of steps, etc. */
  guidance?: ReactNode

  /**
   * Optional title for the dashboard section. Default «Status og nøkkeltall».
   * Pass `null` to suppress.
   */
  dashboardTitle?: ReactNode | null
  /** Optional description for the dashboard section. */
  dashboardDescription?: ReactNode

  /** Optional title for the shortcuts section. Default «Moduler i gruppen». */
  shortcutsTitle?: ReactNode | null
  /** Optional description for the shortcuts section. */
  shortcutsDescription?: ReactNode

  /** Optional title for the guidance section. Default «Slik bruker du dette». */
  guidanceTitle?: ReactNode | null
  /** Optional description for the guidance section. */
  guidanceDescription?: ReactNode

  /** Raw extra content rendered below `guidance`. Escape hatch. */
  children?: ReactNode
}

function SectionHeading({
  title,
  description,
}: {
  title: ReactNode
  description?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <h2
        className="text-lg font-semibold tracking-tight text-neutral-900 md:text-xl"
        style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
      >
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm leading-relaxed text-neutral-600">{description}</p> : null}
    </div>
  )
}

export function ModuleFrontpageShell({
  breadcrumb,
  title,
  description,
  headerActions,
  tabs,
  legal,
  overview,
  dashboard,
  shortcuts,
  guidance,
  dashboardTitle = 'Status og nøkkeltall',
  dashboardDescription,
  shortcutsTitle = 'Moduler i gruppen',
  shortcutsDescription,
  guidanceTitle = 'Slik bruker du dette',
  guidanceDescription,
  children,
}: ModuleFrontpageShellProps) {
  return (
    <ModulePageShell
      breadcrumb={breadcrumb}
      title={title}
      description={description}
      headerActions={headerActions}
      tabs={tabs}
    >
      {legal ? <ModuleLegalBanner {...legal} /> : null}

      {overview ? <section className="space-y-4">{overview}</section> : null}

      {dashboard ? (
        <section className="space-y-4">
          {dashboardTitle ? (
            <SectionHeading title={dashboardTitle} description={dashboardDescription} />
          ) : null}
          {dashboard}
        </section>
      ) : null}

      {shortcuts ? (
        <section className="space-y-4">
          {shortcutsTitle ? (
            <SectionHeading title={shortcutsTitle} description={shortcutsDescription} />
          ) : null}
          {shortcuts}
        </section>
      ) : null}

      {guidance ? (
        <section className="space-y-4">
          {guidanceTitle ? (
            <SectionHeading title={guidanceTitle} description={guidanceDescription} />
          ) : null}
          {guidance}
        </section>
      ) : null}

      {children}
    </ModulePageShell>
  )
}
