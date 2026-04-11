import { Link, useLocation } from 'react-router-dom'
import {
  WORKPLACE_REPORTING_NAV,
  canAccessWorkplaceReportingItem,
  workplaceReportingNavMatch,
} from '../data/workplaceReportingNav'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { WorkplaceReportingCasesSection } from '../components/workplace/WorkplaceReportingCasesSection'
import { WorkplaceReportingHubMenu } from '../components/workplace/WorkplaceReportingHubMenu'
import { WorkplacePageHeading1, WorkplaceSerifSectionTitle } from '../components/layout/WorkplacePageHeading1'
import { WORKPLACE_LAYOUT_BOX_CARD, WORKPLACE_LAYOUT_BOX_SHADOW } from '../components/layout/workplaceLayoutKit'

const PAGE = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const HERO_BTN =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-4 text-sm font-medium text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50'

export function WorkplaceReportingPage() {
  const { can } = useOrgSetupContext()
  const { pathname, search } = useLocation()
  const section =
    WORKPLACE_REPORTING_NAV.filter((item) => canAccessWorkplaceReportingItem(item, can)).find((item) =>
      workplaceReportingNavMatch(item.to, item.end, pathname, search),
    )?.label ?? 'Oversikt'

  return (
    <div className={PAGE}>
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Arbeidsplassrapportering' }, { label: section }]}
        title="Arbeidsplassrapportering"
        description="Meldinger fra arbeidsplassen: hendelser, anonym kanal og varslingssaker — pluss rapporter, inspeksjoner og samsvar. Samme undermeny som i navigasjonen (som under HSE)."
        menu={<WorkplaceReportingHubMenu />}
      />

      <WorkplaceReportingCasesSection />

      <section id="oversikt" className="mt-10 space-y-4">
        <WorkplaceSerifSectionTitle>Innganger og verktøy</WorkplaceSerifSectionTitle>
        <p className="max-w-2xl text-sm text-neutral-600">
          Samme boksstil som i plattform-admin layout (liste/boks). Snarveier til delmoduler under arbeidsplassrapportering.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKPLACE_REPORTING_NAV.map(({ to, label, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`${WORKPLACE_LAYOUT_BOX_CARD} block p-5 transition hover:border-neutral-300`}
              style={WORKPLACE_LAYOUT_BOX_SHADOW}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1a3d32]/10 text-[#1a3d32]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-neutral-900">{label}</h3>
                  <p className="mt-1 text-sm text-neutral-600">{desc}</p>
                  <span className={`${HERO_BTN} mt-4`}>Åpne →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-10 rounded-lg border border-sky-200 bg-sky-50/90 px-4 py-3 text-sm text-sky-950 shadow-sm">
        <strong>Tips:</strong> Hendelsesregisteret ligger nå her (ikke lenger som egen fane under HSE). Gamle lenker til{' '}
        <code className="rounded-none bg-white/80 px-1 text-xs">/hse?tab=incidents</code> omdirigeres automatisk.
      </div>
    </div>
  )
}
