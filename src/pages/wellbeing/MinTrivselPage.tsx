// Min trivsel — personlig speil av Arbeidsmiljøstrategi.
//
// Ikke en mini-org-side: dette er ansattes inngang. Brukeren får
// kontekst (org-en sin visjon + årets fokus), så hva de selv kan
// gjøre (svare på undersøkelser, fullføre kurs, fornye sertifikat),
// og en oversikt over kanalene de kan løfte stemmen sin gjennom.
//
// Trivsels-aksen rapporterer aldri individuelle psykososial-svar
// (AML § 4-3 anonymitet). Den viser kun deltakelse og tilgang til
// kanaler — ikke skår.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ExternalLink,
  HeartPulse,
  Megaphone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { useDashboardLayout } from '../../lib/dashboards/useDashboardLayout'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { useLearning } from '../../hooks/useLearning'
import {
  PERSONAL_WELLBEING_SCOPE_ID,
} from './dashboards/personalWellbeingDashboardScope'
// Side-effect imports — register scope before layout query runs.
import './dashboards/personalWellbeingDashboardScope'
import { usePersonalWellbeingDatasets } from './dashboards/usePersonalWellbeingDatasets'
import { useWellbeingStrategy } from './hooks/useWellbeingStrategy'
import {
  WELLBEING_AXIS_LABELS,
  WELLBEING_AXIS_LAW,
  type WellbeingAxisKey,
} from './dashboards/useWorkerWellbeingDatasets'

type AxisCardSpec = {
  key: WellbeingAxisKey
  myAction: string
  ctaLabel: string
  ctaPath: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

const AXIS_CARDS: AxisCardSpec[] = [
  {
    key: 'trygghet',
    myAction: 'Rapportér det som er utrygt — ingen avvik er for lite. Vernerunder bygger på din observasjon.',
    ctaLabel: 'Meld avvik',
    ctaPath: '/tasks/management?template=avvik',
    icon: ShieldCheck,
  },
  {
    key: 'trivsel',
    myAction: 'Når du blir invitert til en undersøkelse: svar. Dine ord former hva AMU jobber med neste kvartal.',
    ctaLabel: 'Mine undersøkelser',
    ctaPath: '/survey',
    icon: HeartPulse,
  },
  {
    key: 'medvirkning',
    myAction: 'Verneombud, varslingskanal og AMU er dine kanaler. Bruk den som passer situasjonen.',
    ctaLabel: 'Varsle',
    ctaPath: '/workplace-reporting/anonymous-aml',
    icon: Megaphone,
  },
  {
    key: 'mestring',
    myAction: 'Fullfør tildelt læring og hold sertifikatene dine oppdaterte. Det handler om din egen sikkerhet.',
    ctaLabel: 'Mine kurs',
    ctaPath: '/learning',
    icon: BookOpen,
  },
]

const AXIS_GRADIENT: Record<WellbeingAxisKey, string> = {
  trygghet: 'from-emerald-50 to-white border-emerald-200',
  trivsel: 'from-purple-50 to-white border-purple-200',
  medvirkning: 'from-blue-50 to-white border-blue-200',
  mestring: 'from-teal-50 to-white border-teal-200',
}

const AXIS_TEXT: Record<WellbeingAxisKey, string> = {
  trygghet: 'text-emerald-900',
  trivsel: 'text-purple-900',
  medvirkning: 'text-blue-900',
  mestring: 'text-teal-900',
}

export function MinTrivselPage() {
  const { supabase, profile } = useOrgSetupContext()
  const learning = useLearning()
  const wellbeingStrategy = useWellbeingStrategy()
  const dashboard = useDashboardLayout({ supabase, scopeId: PERSONAL_WELLBEING_SCOPE_ID })

  const datasets = usePersonalWellbeingDatasets({
    courses: learning.courses,
    progress: learning.progress,
    certificates: learning.certificates,
    focusAreas: wellbeingStrategy.focusAreas,
  })

  const layout = useMemo(
    () =>
      dashboard.layout.map((m) => {
        if (m.kind === 'bar' && m.seriesKeys.length === 0) {
          const ds = datasets[m.datasetKey] as Record<string, unknown> | undefined
          const keys = ds && typeof ds === 'object' ? Object.keys(ds) : []
          return { ...m, seriesKeys: keys }
        }
        return m
      }),
    [dashboard.layout, datasets],
  )

  const [tab, setTab] = useState<'oversikt' | 'analyse'>('oversikt')
  const accent = getDashboardScope(PERSONAL_WELLBEING_SCOPE_ID)?.accent ?? '#0d9488'
  const kpi = (datasets['pwb_kpi_summary'] as Record<string, number> | undefined) ?? {}
  const displayName = profile?.display_name ?? null

  const visionMd = wellbeingStrategy.strategy?.vision_md
  const activeFocus = wellbeingStrategy.focusAreas.slice(0, 3)

  // KPI-pille som hjelper brukeren raskt se: «har jeg noe utestående?»
  const axisCount: Record<WellbeingAxisKey, number> = {
    trygghet: 0,
    trivsel: kpi.pendingSurveys ?? 0,
    medvirkning: kpi.pendingSurveys ?? 0,
    mestring: (kpi.openCourses ?? 0) + (kpi.expiringSoon ?? 0),
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Hero */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Personlig speil
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              {displayName ? `Hei ${displayName.split(' ')[0]} — min trivsel` : 'Min trivsel'}
            </h1>
            <p className="max-w-2xl text-sm text-neutral-600">
              Det du kan bidra med, og kanalene du kan løfte stemmen din gjennom. Loven sier at
              du har rett til et trygt arbeidsmiljø — denne siden viser hvordan du selv er en del
              av det.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/overview/arbeidsmiljostrategi"
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors"
              style={{ borderColor: accent, color: accent }}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Arbeidsmiljøstrategi
            </Link>
          </div>
        </div>

        {/* Strategi-kontekst — bare hvis org-en har formulert noe */}
        {(visionMd || activeFocus.length > 0) && (
          <div
            className="rounded-lg border px-5 py-4"
            style={{ borderColor: `${accent}40`, background: `linear-gradient(to right, ${accent}0d, ${accent}03)` }}
          >
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
              Vi jobber sammen mot dette
            </div>
            {visionMd && (
              <p className="mt-1 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                {visionMd}
              </p>
            )}
            {activeFocus.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {activeFocus.map((f) => (
                  <li
                    key={f.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-700"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      {WELLBEING_AXIS_LABELS[f.axis_key as WellbeingAxisKey] ?? f.axis_key}
                    </span>
                    <span>{f.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-neutral-200">
        <TabButton active={tab === 'oversikt'} onClick={() => setTab('oversikt')}>
          Oversikt
        </TabButton>
        <TabButton active={tab === 'analyse'} onClick={() => setTab('analyse')}>
          <BarChart3 className="h-4 w-4" aria-hidden /> Tabeller
        </TabButton>
      </nav>

      {tab === 'oversikt' && (
        <section className="space-y-6">
          {/* KPI-rad */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile color={accent} title="Mine undersøkelser" value={kpi.pendingSurveys ?? 0} subtitle="Inviterte, ikke besvart" />
            <KpiTile color={accent} title="Mine kurs" value={kpi.openCourses ?? 0} subtitle="Åpne eller påbegynt" />
            <KpiTile color={accent} title="Fullført i år" value={kpi.completedYtd ?? 0} subtitle="Læring · YTD" />
            <KpiTile color={accent} title="Utløper snart" value={kpi.expiringSoon ?? 0} subtitle="Sertifikater · 90 dg" />
          </div>

          {/* Akse-kort */}
          <div className="grid gap-3 lg:grid-cols-2">
            {AXIS_CARDS.map((card) => {
              const Icon = card.icon
              const count = axisCount[card.key]
              return (
                <article
                  key={card.key}
                  className={`flex flex-col gap-3 rounded-lg border bg-gradient-to-br ${AXIS_GRADIENT[card.key]} p-5`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${AXIS_TEXT[card.key]}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {WELLBEING_AXIS_LABELS[card.key]}
                      </div>
                      <p className="mt-0.5 text-[10px] text-neutral-500">{WELLBEING_AXIS_LAW[card.key]}</p>
                    </div>
                    {count > 0 && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-neutral-900 shadow-sm">
                        {count} {count === 1 ? 'sak' : 'saker'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-800">{card.myAction}</p>
                  <Link
                    to={card.ctaPath}
                    className="mt-auto inline-flex items-center gap-1.5 self-start rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                  >
                    {card.ctaLabel} <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                </article>
              )
            })}
          </div>

          {/* Privacy-banner */}
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-700">
            <strong className="font-semibold">Personvern.</strong>{' '}
            Vi viser aldri dine individuelle psykososial-svar her, og heller ikke for andre.
            AML § 4-3 og GDPR krever k-anonymitet (typisk minst 10 svar) før vi kan vise
            sammenhenger på enheter eller team. Du kan trygt være ærlig.
          </div>
        </section>
      )}

      {tab === 'analyse' && (
        <ModuleAnalyticsDashboard
          accent={accent}
          breadcrumb={[
            { label: 'Arbeidsflate', to: '/' },
            { label: 'Arbeidsmiljøstrategi', to: '/overview/arbeidsmiljostrategi' },
            { label: 'Min trivsel' },
          ]}
          title="Mine tabeller"
          description="Konkrete handlinger du kan ta — invitasjoner, åpne kurs og utløpende sertifikater."
          layout={layout}
          datasets={datasets}
          loading={learning.learningLoading || wellbeingStrategy.loading || dashboard.loading}
          error={learning.learningError ?? dashboard.error}
          emptyState={
            <div className="rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
              Ingen widgets i dette oppsettet ennå.
            </div>
          }
          filters={dashboard.filters}
          onFiltersChange={(next) => void dashboard.saveFilters(next)}
        />
      )}
    </div>
  )
}

function KpiTile({
  color,
  title,
  value,
  subtitle,
}: {
  color: string
  title: string
  value: number
  subtitle: string
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm" style={{ borderColor: `${color}33` }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-600">{title}</div>
      <div className="mt-1 text-3xl font-bold text-neutral-900">{value}</div>
      <div className="mt-0.5 text-[11px] text-neutral-500">{subtitle}</div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? 'border-teal-600 text-teal-900'
          : 'border-transparent text-neutral-500 hover:border-neutral-200 hover:text-neutral-700'
      }`}
    >
      {children}
    </button>
  )
}
