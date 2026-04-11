import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Briefcase,
  ClipboardList,
  HardHat,
  HeartPulse,
  History,
  LayoutDashboard,
} from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useInternalControl } from '../hooks/useInternalControl'
import { useHse } from '../hooks/useHse'
import { useOrgHealth } from '../hooks/useOrgHealth'
import { PostingsStyleSurface, TASK_POSTINGS_FOREST } from '../components/tasks/tasksPostingsLayout'
import { HubMenu1Bar, type HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import type { PermissionKey } from '../lib/permissionKeys'

type ModuleCard = {
  perm: PermissionKey
  to: string
  title: string
  blurb: string
  icon: typeof ClipboardList
  stats?: { label: string; value: string }[]
}

export function ComplianceDashboardPage() {
  const { can } = useOrgSetupContext()
  const ic = useInternalControl()
  const hse = useHse()
  const oh = useOrgHealth()

  const rosDrafts = ic.rosAssessments.filter((r) => !r.locked).length
  const annualOpen =
    ic.annualReviews.filter((a) => !a.locked && (a.status === 'draft' || a.status === 'pending_safety_rep')).length

  const cards: ModuleCard[] = [
    {
      perm: 'module.view.internal_control',
      to: '/internal-control',
      title: 'Internkontroll',
      blurb: 'ROS, risiko og årsgjennomgang — samme innsikt som oversiktsfanen, samlet inngang.',
      icon: ClipboardList,
      stats: [
        { label: 'ROS (totalt)', value: String(ic.rosAssessments.length) },
        { label: 'ROS-utkast', value: String(rosDrafts) },
        { label: 'Årsgj. åpne', value: String(annualOpen) },
      ],
    },
    {
      perm: 'module.view.hse',
      to: '/hse',
      title: 'HSE / HMS',
      blurb: 'Vernerunder, inspeksjoner, SJA, opplæring og sykefravær — operativt arbeidsmiljøarbeid.',
      icon: HardHat,
      stats: [
        { label: 'Åpne inspeksjoner', value: String(hse.stats.openInspections) },
        { label: 'SJA (utkast)', value: String(hse.stats.openSja) },
        { label: 'Utløpt opplæring', value: String(hse.stats.expiredTraining) },
      ],
    },
    {
      perm: 'module.view.org_health',
      to: '/org-health',
      title: 'Organisasjonshelse',
      blurb: 'Undersøkelser, NAV-fravær, AML-indikatorer og anonym rapportering.',
      icon: HeartPulse,
      stats: [
        { label: 'Undersøkelser', value: String(oh.surveys.length) },
        { label: 'Åpne undersøkelser', value: String(oh.surveys.filter((s) => s.status === 'open').length) },
      ],
    },
    {
      perm: 'module.view.hr_compliance',
      to: '/hr',
      title: 'HR & rettssikkerhet',
      blurb: 'Drøftelsessamtale § 15-1, AML kap. 8 og O-ROS med sporbarhet og RLS.',
      icon: Briefcase,
    },
  ]

  const visible = cards.filter((c) => can(c.perm))

  const complianceHubItems: HubMenu1Item[] = useMemo(() => {
    const fromCards = visible.map((c) => ({
      key: c.to,
      label: c.title,
      icon: c.icon,
      active: false,
      to: c.to,
      end: true as const,
    }))
    if (can('module.view.dashboard')) {
      return [
        ...fromCards,
        {
          key: 'audit',
          label: 'Revisjonslogg',
          icon: History,
          active: false,
          to: '/workspace/revisjonslogg',
          end: true as const,
        },
      ]
    }
    return fromCards
  }, [visible, can])

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Samsvar' }, { label: 'Oversikt' }]}
        title="Samsvar — oversikt"
        description="Samlet inngang til internkontroll, HMS, organisasjonshelse og HR-prosesser. Velg modul under — samme funksjonalitet som før."
        headerActions={
          can('module.view.dashboard') ? (
            <Link
              to="/workspace/revisjonslogg"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <History className="size-4 opacity-80" />
              Revisjonslogg
            </Link>
          ) : null
        }
        menu={<HubMenu1Bar ariaLabel="Samsvar — moduler" items={complianceHubItems} />}
      />

      <PostingsStyleSurface className="mt-8 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-5 text-neutral-500" />
            <span className="text-sm font-semibold text-neutral-800">Moduler</span>
          </div>
          <span className="text-xs text-neutral-500">{visible.length} tilgjengelig for din rolle</span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          {visible.map((c) => {
            const Icon = c.icon
            return (
              <Link
                key={c.to}
                to={c.to}
                className="group flex flex-col rounded-md border border-neutral-200/90 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-white"
                    style={{ backgroundColor: TASK_POSTINGS_FOREST }}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-neutral-900">{c.title}</h2>
                    <p className="mt-1 text-sm text-neutral-600">{c.blurb}</p>
                  </div>
                </div>
                {c.stats && c.stats.length > 0 ? (
                  <ul className="mt-4 grid gap-2 border-t border-neutral-100 pt-4 text-sm">
                    {c.stats.map((s) => (
                      <li key={s.label} className="flex justify-between gap-2 text-neutral-700">
                        <span className="text-neutral-500">{s.label}</span>
                        <span className="font-semibold tabular-nums text-neutral-900">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#1a3d32] group-hover:underline">
                  Åpne modul
                  <ArrowRight className="size-3.5" />
                </span>
              </Link>
            )
          })}
        </div>
      </PostingsStyleSurface>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-600">Du har ikke tilgang til noen samsvarsmoduler. Kontakt administrator.</p>
      ) : null}
    </div>
  )
}
