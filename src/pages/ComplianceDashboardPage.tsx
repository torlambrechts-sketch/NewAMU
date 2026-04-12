import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Filter,
  HardHat,
  HeartPulse,
  History,
  LayoutGrid,
  List,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Search,
  Star,
  Users,
} from 'lucide-react'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { useInternalControl } from '../hooks/useInternalControl'
import { useHse } from '../hooks/useHse'
import { useOrgHealth } from '../hooks/useOrgHealth'
import { useWorkplaceReportingCases } from '../hooks/useWorkplaceReportingCases'
import { HubMenu1Bar, type HubMenu1Item } from '../components/layout/HubMenu1Bar'
import { WorkplacePageHeading1 } from '../components/layout/WorkplacePageHeading1'
import type { PermissionKey } from '../lib/permissionKeys'

/** Layout-referanse «Dashboard (kompakt)» — samme kremflate som TanStatCard i pinpoint. */
const DASH_COMPACT_CREAM = '#EFE8DC'

const MODULE_CARD_SHADOW = { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' } as const

type ModuleCard = {
  perm: PermissionKey
  to: string
  title: string
  blurb: string
  icon: LucideIcon
  stats?: { label: string; value: string }[]
}

function ComplianceTanStat({
  big,
  title,
  sub,
  to,
  linkLabel = 'Se',
}: {
  big: string
  title: string
  sub: string
  to?: string
  linkLabel?: string
}) {
  const inner = (
    <div
      className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200/60 px-5 py-4"
      style={{ backgroundColor: DASH_COMPACT_CREAM }}
    >
      <div>
        <p className="text-3xl font-bold tabular-nums text-neutral-900">{big}</p>
        <p className="mt-1 text-sm font-medium text-neutral-800">{title}</p>
        <p className="text-xs text-neutral-600">{sub}</p>
      </div>
      {to ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
          {linkLabel} <ChevronRight className="size-3.5" />
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          —
        </span>
      )}
    </div>
  )
  return to ? (
    <Link to={to} className="block transition hover:opacity-95">
      {inner}
    </Link>
  ) : (
    inner
  )
}

/** «Modul — Jobbkort (Active jobs)»: hvitt kort med Open-pill og kandidat-rad (her: nøkkeltall). */
function ComplianceModuleJobCard({
  card,
}: {
  card: ModuleCard & { code: string; meta: string; primaryValue: number; primaryLabel: string; alertCount: number }
}) {
  const Icon = card.icon
  return (
    <Link
      to={card.to}
      className="block overflow-hidden rounded-lg border border-neutral-200/80 bg-white shadow-sm transition hover:border-neutral-300"
      style={MODULE_CARD_SHADOW}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-4">
        <div className="min-w-0">
          <p className="text-base font-semibold text-neutral-900">{card.title}</p>
          <p className="mt-1 text-sm text-neutral-500">{card.meta}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
            <Icon className="size-3.5 shrink-0 text-[#1a3d32]" aria-hidden />
            {card.code}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Star className="size-4 text-neutral-300" aria-hidden />
          <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-900">
            Aktiv
          </span>
          <span className="text-neutral-400" aria-hidden>
            <MoreHorizontal className="size-5" />
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xl font-bold tabular-nums text-neutral-900">{card.primaryValue}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{card.primaryLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {card.alertCount > 0 ? (
            <span className="rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-800">{card.alertCount}</span>
          ) : null}
          <Users className="size-4" aria-hidden />
          <MessageSquare className="size-4" aria-hidden />
          <Mail className="size-4" aria-hidden />
          <span className="text-emerald-600" aria-hidden>
            ✓
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-neutral-700">
          Gå til modul <ChevronDown className="size-3.5" />
        </span>
      </div>
      {card.stats && card.stats.length > 1 ? (
        <ul className="space-y-1.5 border-t border-neutral-100 px-4 py-3 text-xs text-neutral-600">
          {card.stats.slice(1).map((s) => (
            <li key={s.label} className="flex justify-between gap-2">
              <span className="text-neutral-500">{s.label}</span>
              <span className="font-semibold tabular-nums text-neutral-900">{s.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="border-t border-neutral-100 px-4 py-2 text-xs leading-relaxed text-neutral-600">{card.blurb}</p>
    </Link>
  )
}

export function ComplianceDashboardPage() {
  const { can } = useOrgSetupContext()
  const ic = useInternalControl()
  const hse = useHse()
  const oh = useOrgHealth()
  const wr = useWorkplaceReportingCases()

  const [moduleSearch, setModuleSearch] = useState('')
  const [moduleLayout, setModuleLayout] = useState<'grid' | 'list'>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [onlyWithAlerts, setOnlyWithAlerts] = useState(false)

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
      blurb: 'Undersøkelser, NAV-fravær og AML-indikatorer.',
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

  const jobCardData = useMemo(() => {
    return visible.map((c) => {
      const first = c.stats?.[0]
      const primaryValue = first ? Number.parseInt(first.value, 10) : 0
      const safePrimary = Number.isFinite(primaryValue) ? primaryValue : 0
      let alertCount = 0
      if (c.stats) {
        for (const s of c.stats) {
          const n = Number.parseInt(s.value, 10)
          if (
            Number.isFinite(n) &&
            n > 0 &&
            (s.label.toLowerCase().includes('utkast') ||
              s.label.toLowerCase().includes('åpen') ||
              s.label.toLowerCase().includes('utløpt'))
          ) {
            alertCount += n
          }
        }
      }
      const code = c.to.replace(/^\//, '').replaceAll('/', '-') || 'modul'
      const meta = `Samsvar · ${c.title}`
      return {
        ...c,
        code,
        meta,
        primaryValue: safePrimary,
        primaryLabel: first?.label ?? 'Nøkkeltall',
        alertCount,
      }
    })
  }, [visible])

  const filteredJobCards = useMemo(() => {
    const q = moduleSearch.trim().toLowerCase()
    return jobCardData.filter((c) => {
      if (onlyWithAlerts && c.alertCount === 0) return false
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        c.blurb.toLowerCase().includes(q) ||
        c.meta.toLowerCase().includes(q)
      )
    })
  }, [jobCardData, moduleSearch, onlyWithAlerts])

  const openSurveys = oh.surveys.filter((s) => s.status === 'open').length
  const openCompliancePoints = rosDrafts + annualOpen + hse.stats.openInspections + hse.stats.openSja + openSurveys

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

  const showAmlTile = can('module.view.workplace_reporting') || can('module.view.org_health')

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 font-[Inter,system-ui,sans-serif] text-[#171717] md:px-8">
      <WorkplacePageHeading1
        breadcrumb={[{ label: 'Workspace', to: '/' }, { label: 'Samsvar' }, { label: 'Oversikt' }]}
        title="Samsvar — oversikt"
        description="Samlet inngang til internkontroll, HMS, organisasjonshelse og HR. Dashboard (kompakt) fra layout-referanse, med modulkort i Active jobs-stil."
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

      {visible.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-600">Du har ikke tilgang til noen samsvarsmoduler. Kontakt administrator.</p>
      ) : (
        <>
          <section className="mt-8 space-y-4" aria-label="Dashboard kompakt">
            <div className="grid gap-4 sm:grid-cols-2">
              <ComplianceTanStat
                big={String(visible.length)}
                title="Aktive moduler"
                sub="Tilgjengelig for din rolle"
                to={visible[0]?.to ?? '/'}
                linkLabel="Åpne"
              />
              <ComplianceTanStat
                big={String(openCompliancePoints)}
                title="Åpne punkter"
                sub="ROS / årsgj. / inspeksjon / SJA / åpne undersøkelser"
                to="/internal-control"
                linkLabel="Internkontroll"
              />
              <ComplianceTanStat
                big={String(hse.stats.expiredTraining)}
                title="Utløpt opplæring"
                sub="HMS — krever oppmerksomhet"
                to="/hse"
                linkLabel="HSE"
              />
              {showAmlTile ? (
                <ComplianceTanStat
                  big={String(wr.amlReportStats.total)}
                  title="Anonyme henvendelser"
                  sub="Arbeidsplassrapportering (metadata)"
                  to="/workplace-reporting/anonymous-aml"
                  linkLabel="Åpne"
                />
              ) : (
                <ComplianceTanStat
                  big={String(openSurveys)}
                  title="Åpne undersøkelser"
                  sub="Organisasjonshelse"
                  to="/org-health"
                  linkLabel="Åpne"
                />
              )}
            </div>
          </section>

          <section className="mt-10 space-y-4" aria-label="Aktive moduler">
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200/80 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm font-semibold text-neutral-900">
                <span className="text-2xl font-bold tabular-nums text-neutral-900">{filteredJobCards.length}</span>{' '}
                <span className="font-medium text-neutral-600">Aktive moduler</span>
              </p>
              <div className="relative min-w-[200px] flex-1">
                <label htmlFor="compliance-module-search" className="sr-only">
                  Søk moduler
                </label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                <input
                  id="compliance-module-search"
                  type="search"
                  value={moduleSearch}
                  onChange={(e) => setModuleSearch(e.target.value)}
                  placeholder="Søk etter modul…"
                  className="w-full rounded-lg border border-neutral-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1a3d32]/25"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((o) => !o)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                    filtersOpen || onlyWithAlerts
                      ? 'border-neutral-400 bg-neutral-50 text-neutral-900'
                      : 'border-neutral-200 bg-white text-neutral-700'
                  }`}
                  aria-expanded={filtersOpen}
                >
                  <Filter className="size-3.5" />
                  Filters
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyWithAlerts((v) => !v)}
                  className={`rounded-lg p-2 ${onlyWithAlerts ? 'bg-amber-50 text-amber-700' : 'text-amber-600 hover:bg-amber-50'}`}
                  aria-label="Kun moduler med åpne punkter"
                  title="Kun moduler med åpne punkter"
                >
                  <Star className={`size-5 ${onlyWithAlerts ? 'fill-amber-400 text-amber-600' : ''}`} />
                </button>
                <div className="flex rounded-lg border border-neutral-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => setModuleLayout('grid')}
                    className={`rounded-md p-2 ${moduleLayout === 'grid' ? 'bg-[#EFE8DC] text-neutral-900' : 'text-neutral-500'}`}
                    aria-label="Rutenett"
                    aria-pressed={moduleLayout === 'grid'}
                  >
                    <LayoutGrid className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModuleLayout('list')}
                    className={`rounded-md p-2 ${moduleLayout === 'list' ? 'bg-[#EFE8DC] text-neutral-900' : 'text-neutral-500'}`}
                    aria-label="Liste"
                    aria-pressed={moduleLayout === 'list'}
                  >
                    <List className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {filtersOpen ? (
              <div
                className="rounded-lg border border-neutral-200/80 px-4 py-3 text-sm text-neutral-700"
                style={{ backgroundColor: DASH_COMPACT_CREAM }}
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={onlyWithAlerts}
                    onChange={(e) => setOnlyWithAlerts(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  <span>Kun moduler med åpne punkter (utkast / åpent / utløpt)</span>
                </label>
              </div>
            ) : null}

            <div
              className={
                moduleLayout === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-4'
              }
            >
              {filteredJobCards.map((c) => (
                <ComplianceModuleJobCard key={c.to} card={c} />
              ))}
            </div>

            {filteredJobCards.length === 0 ? (
              <p className="text-center text-sm text-neutral-500">Ingen moduler matcher søk eller filter.</p>
            ) : null}
          </section>
        </>
      )}
    </div>
  )
}
