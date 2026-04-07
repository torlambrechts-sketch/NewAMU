import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Lock,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react'
import { LegalDisclaimer } from '../components/internalControl/LegalDisclaimer'
import { ROS_TEMPLATE_HELP, RISK_COLOUR_CLASSES, computeRiskScore, riskColour, emptyRosRow } from '../data/rosTemplate'
import {
  ROS_CHEMICAL_ROW_PRESET,
  ROS_WORKSPACE_PRESET_HAZARDS,
} from '../data/rosWizardPresets'
import { useInternalControl } from '../hooks/useInternalControl'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import type { RosAssessment, RosCategory, RosRiskRow, RosWorkspaceCategory } from '../types/internalControl'
import { O_ROS_PRESET_HAZARDS } from '../types/internalControl'
import { useHrCompliance } from '../hooks/useHrCompliance'
import { useTasks } from '../hooks/useTasks'
import { WizardButton } from '../components/wizard/WizardButton'
import { makeRosWizard } from '../components/wizard/wizards'
import {
  mergeLayoutPayload,
  table1BodyRowClass,
  table1CellPadding,
  table1HeaderRowClass,
} from '../lib/layoutLabTokens'
import { useOrgMenu1Styles } from '../hooks/useOrgMenu1Styles'
import { useUiTheme } from '../hooks/useUiTheme'

const tabs = [
  { id: 'overview' as const, label: 'Oversikt', icon: LayoutDashboard },
  { id: 'ros' as const, label: 'ROS / risiko', icon: ClipboardList },
  { id: 'annual' as const, label: 'Årsgjennomgang', icon: Calendar },
  { id: 'audit' as const, label: 'Logg', icon: History },
]

const PAGE_WRAP = 'mx-auto max-w-[1400px] px-4 py-6 md:px-8'
const TABLE_CELL_BASE = 'align-middle text-sm text-neutral-800'
const HERO_ACTION_CLASS =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-none px-4 text-sm font-medium leading-none'
const TASK_PANEL_ROW_GRID =
  'grid grid-cols-1 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(0,40%)_minmax(0,60%)] md:items-start md:gap-10 md:px-5 md:py-5'
const SETTINGS_LEAD = 'text-sm leading-relaxed text-neutral-600'
const SETTINGS_FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-wider text-neutral-800'
const SETTINGS_INPUT =
  'mt-1.5 w-full rounded-none border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900'
const SETTINGS_FIELD_LABEL_ON_DARK = 'text-[10px] font-bold uppercase tracking-wider text-white/90'
const SETTINGS_INPUT_ON_DARK =
  'mt-1.5 w-full rounded-none border border-white/25 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/50 focus:border-white focus:outline-none focus:ring-1 focus:ring-white'
const ORG_MERGED_PANEL =
  'mt-6 flex flex-col gap-4 rounded-none border border-black/15 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6 md:p-5'
const ORG_MERGED_COL = 'min-w-0 flex-1 sm:max-w-[min(100%,280px)]'
const ORG_MERGED_ACTION_COL = 'flex w-full shrink-0 flex-col justify-end sm:w-auto sm:min-w-[160px]'
const SETTINGS_THRESHOLD_BOX =
  'flex min-h-[5.5rem] flex-col justify-center border border-black/15 px-4 py-3 text-white sm:px-5'

function buildWizardRosRows(v: Record<string, string | boolean>): RosRiskRow[] {
  const legal = String(v.rosLegalCategory ?? 'general') as RosCategory
  if (legal === 'organizational_change') {
    return O_ROS_PRESET_HAZARDS.map((h) => ({
      ...emptyRosRow(),
      id: crypto.randomUUID(),
      activity: h.activity,
      hazard: h.hazard,
      existingControls: h.existingControls,
      severity: 3,
      likelihood: 3,
      riskScore: 9,
    }))
  }
  const ws = String(v.workspaceCategory ?? 'general') as RosWorkspaceCategory
  const presetList = ROS_WORKSPACE_PRESET_HAZARDS[ws] ?? ROS_WORKSPACE_PRESET_HAZARDS.general
  const rows: RosRiskRow[] = presetList.map((h) => ({
    ...emptyRosRow(),
    id: crypto.randomUUID(),
    activity: h.activity,
    hazard: h.hazard,
    existingControls: h.existingControls,
    severity: 3,
    likelihood: 3,
    riskScore: 9,
  }))
  const chem =
    v.chemicalsYes === true ||
    v.chemicalsYes === 'yes' ||
    v.chemicalsYes === 'true'
  if ((ws === 'production' || ws === 'warehouse') && chem) {
    rows.push({
      ...emptyRosRow(),
      id: crypto.randomUUID(),
      activity: ROS_CHEMICAL_ROW_PRESET.activity,
      hazard: ROS_CHEMICAL_ROW_PRESET.hazard,
      existingControls: ROS_CHEMICAL_ROW_PRESET.existingControls,
      severity: 3,
      likelihood: 3,
      riskScore: 9,
    })
  }
  return rows
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('no-NO', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function InternalControlModule() {
  const menu1 = useOrgMenu1Styles()
  const { payload: layoutPayload } = useUiTheme()
  const layout = mergeLayoutPayload(layoutPayload)
  const tableCell = `${table1CellPadding(layout)} ${TABLE_CELL_BASE}`
  const theadRow = table1HeaderRowClass(layout)

  const ic = useInternalControl()
  const hr = useHrCompliance()
  const { addTask } = useTasks()
  const { supabaseConfigured } = useOrgSetupContext()
  const [searchParams, setSearchParams] = useSearchParams()
  type TabId = (typeof tabs)[number]['id']
  const tabParam = searchParams.get('tab')
  const tab: TabId =
    tabParam && tabs.some((x) => x.id === tabParam) ? (tabParam as TabId) : 'overview'
  const setTab = (id: TabId) => setSearchParams({ tab: id }, { replace: true })

  const [rosTitle, setRosTitle] = useState('')
  const [rosDept, setRosDept] = useState('')
  const [rosAssessor, setRosAssessor] = useState('')
  const [rosCategory, setRosCategory] = useState<RosCategory>('general')
  const [rosWorkspace, setRosWorkspace] = useState<RosWorkspaceCategory>('general')
  const [oRosAmuId, setORosAmuId] = useState('')
  const [oRosVoId, setORosVoId] = useState('')
  const [rosPanelOpen, setRosPanelOpen] = useState(false)
  const [annualYear, setAnnualYear] = useState(new Date().getFullYear())
  const [annualReviewer, setAnnualReviewer] = useState('')
  const [annualSummary, setAnnualSummary] = useState('')
  const [annualNext, setAnnualNext] = useState(
    `${new Date().getFullYear() + 1}-12-31`,
  )

  const resetRosPanelForm = useCallback(() => {
    setRosTitle('')
    setRosDept('')
    setRosAssessor('')
    setRosCategory('general')
    setRosWorkspace('general')
    setORosAmuId('')
    setORosVoId('')
  }, [])

  const closeRosPanel = useCallback(() => {
    setRosPanelOpen(false)
    resetRosPanelForm()
  }, [resetRosPanelForm])

  useEffect(() => {
    if (!rosPanelOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [rosPanelOpen])

  useEffect(() => {
    if (!rosPanelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRosPanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rosPanelOpen, closeRosPanel])

  const sortedAudit = useMemo(
    () => [...ic.auditTrail].sort((a, b) => b.at.localeCompare(a.at)),
    [ic.auditTrail],
  )

  const rosStats = useMemo(() => {
    const list = ic.rosAssessments
    const locked = list.filter((r) => r.locked).length
    const drafts = list.filter((r) => !r.locked).length
    return { total: list.length, locked, drafts }
  }, [ic.rosAssessments])

  const handleRosLockTasks = useCallback(
    (ros: RosAssessment) => {
      for (const row of ros.rows) {
        const measure = row.proposedMeasures?.trim()
        const who = row.responsible?.trim()
        const due = row.dueDate?.trim()
        if (!measure || !who || !due) continue
        addTask({
          title: `ROS-tiltak: ${measure.slice(0, 80)}${measure.length > 80 ? '…' : ''}`,
          description: `Automatisk fra låst ROS «${ros.title}».\n\nAktivitet: ${row.activity}\nFare: ${row.hazard}\nForeslått tiltak: ${measure}`,
          assignee: who,
          ownerRole: 'Ansvarlig (ROS)',
          dueDate: due,
          status: 'todo',
          module: 'hse',
          sourceType: 'ros_measure',
          sourceId: ros.id,
          sourceLabel: `ROS-rad ${row.id.slice(0, 8)}`,
          requiresManagementSignOff: false,
        })
      }
    },
    [addTask],
  )

  return (
    <div className={PAGE_WRAP}>
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-neutral-500 hover:text-[#1a3d32]">
          Prosjekter
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Internkontroll</span>
      </nav>

      <LegalDisclaimer />

      {ic.error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{ic.error}</p>
      )}
      {ic.loading && supabaseConfigured && (
        <p className="mt-4 text-sm text-neutral-500">Laster internkontrolldata…</p>
      )}

      <div className="flex flex-col gap-6 border-b border-neutral-200/80 pb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Internkontroll
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {tab === 'ros' ? (
              <>
                ROS, årsgjennomgang og logg. Varsling ligger under{' '}
                <Link to="/tasks?view=whistle" className="font-medium text-[#1a3d32] underline">
                  Oppgaver → Varslingssaker
                </Link>
                .
              </>
            ) : (
              <>
                <strong>ROS / risiko</strong>, <strong>årsgjennomgang</strong> og revisjonslogg. Varsling (AML kap. 2A) i{' '}
                <Link to="/tasks?view=whistle" className="font-medium text-[#1a3d32] underline">Oppgaver → Varslingssaker</Link>.
              </>
            )}
          </p>
          {tab === 'ros' ? (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className={`${HERO_ACTION_CLASS} bg-neutral-200/80 text-neutral-800`}>
                Totalt <strong className="ml-1 font-semibold">{rosStats.total}</strong>
              </span>
              <span className={`${HERO_ACTION_CLASS} bg-sky-100 text-sky-900`}>
                Utkast <strong className="ml-1 font-semibold">{rosStats.drafts}</strong>
              </span>
              <span className={`${HERO_ACTION_CLASS} bg-emerald-100 text-emerald-900`}>
                Låst <strong className="ml-1 font-semibold">{rosStats.locked}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  resetRosPanelForm()
                  setRosPanelOpen(true)
                }}
                className={`${HERO_ACTION_CLASS} gap-2 bg-[#1a3d32] text-white hover:bg-[#142e26]`}
              >
                <Plus className="size-4 shrink-0" />
                Ny ROS
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className={menu1.barOuterClass} style={menu1.barStyle}>
        <div className={menu1.innerRowClass}>
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            const tb = menu1.tabButton(active)
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={tb.className}
                style={tb.style}
              >
                <Icon className="size-4 shrink-0 opacity-90" />
                <span className="whitespace-nowrap">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-neutral-900">Status</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">{ic.stats.rosCount}</div>
                <div className="text-sm text-neutral-600">ROS-vurderinger</div>
              </div>
              <div className="rounded-xl bg-[#faf8f4] p-4 ring-1 ring-neutral-100">
                <div className="text-2xl font-semibold text-[#1a3d32]">{ic.stats.annualCount}</div>
                <div className="text-sm text-neutral-600">Årsgjennomganger</div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab('ros')}
                className="rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
              >
                Ny ROS
              </button>
              <Link
                to="/tasks?view=whistle"
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
              >
                Varslingssaker (lukket hvelv)
              </Link>
              <Link
                to="/org-health?tab=reporting"
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-[#1a3d32] hover:bg-neutral-50"
              >
                Anonym rapportering (org.health)
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Meldingsflyt (oversikt)</h2>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-neutral-700">
              <li>Mottatt → vurdering → undersøkelse</li>
              <li>
                <strong>Intern revisjon</strong> når saken etter rutine skal behandles av HR/ledelse/revisor
              </li>
              <li>Avsluttet når dokumentert oppfølging er gjort</li>
            </ol>
            <p className="mt-4 text-xs text-neutral-500">
              Kobling fra anonym AML-melding oppretter sak med referanse-ID — innholdet fra anonym innsending lagres ikke
              i org.health.
            </p>
          </div>
        </div>
      )}

      {tab === 'ros' && (
        <div className="mt-6 space-y-8">
          <LegalDisclaimer compact />

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                { title: 'Totalt', sub: 'ROS-vurderinger', value: `${rosStats.total}` },
                { title: 'Utkast', sub: 'Ikke signert / låst', value: `${rosStats.drafts}` },
                { title: 'Låst', sub: 'Signert leder + VO', value: `${rosStats.locked}` },
                {
                  title: 'Oppfølging',
                  sub: 'Oppgaver fra ROS',
                  value: (
                    <Link to="/tasks" className="mt-1 inline-block text-sm font-semibold text-white underline">
                      Åpne oppgaver
                    </Link>
                  ),
                },
              ] as const
            ).map((item) => (
              <div key={item.title} className={SETTINGS_THRESHOLD_BOX} style={menu1.barStyle}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{item.title}</p>
                <p className="mt-1 text-xs text-white/70">{item.sub}</p>
                {typeof item.value === 'string' ? (
                  <p className="mt-2 text-lg font-semibold tabular-nums text-white">{item.value}</p>
                ) : (
                  <div className="mt-1">{item.value}</div>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-none border border-neutral-200 bg-white p-5 text-sm text-neutral-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#1a3d32]">{ROS_TEMPLATE_HELP.title}</p>
                <p className="mt-2">{ROS_TEMPLATE_HELP.intro}</p>
              </div>
              <WizardButton
                label="Veiviser"
                variant="solid"
                className="rounded-none"
                def={makeRosWizard((data) => {
                  const legal = String(data.rosLegalCategory ?? 'general') as RosCategory
                  const ws = String(data.workspaceCategory ?? 'general') as RosWorkspaceCategory
                  const rows = buildWizardRosRows({ ...data, rosLegalCategory: legal, workspaceCategory: ws })
                  ic.createRosAssessment(String(data.title), String(data.department), String(data.assessor), {
                    category: legal,
                    seedORosRows: legal === 'organizational_change',
                    workspaceCategory: ws,
                    initialRows: legal === 'organizational_change' ? undefined : rows,
                  })
                })}
              />
            </div>
            <ul className="mt-3 list-inside list-disc text-xs text-neutral-600">
              <li>{ROS_TEMPLATE_HELP.severityScale}</li>
              <li>{ROS_TEMPLATE_HELP.likelihoodScale}</li>
              <li>
                Ved <strong>rød restrisiko (15–25)</strong> kreves utfylt «Strakstiltak / eskalering» før signering.
              </li>
              <li>Når ROS låses, opprettes oppgaver på tavlen for rader med tiltak, ansvarlig og frist.</li>
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['green', 'yellow', 'red'] as const).map((c) => {
                const cls = RISK_COLOUR_CLASSES[c]
                return (
                  <span
                    key={c}
                    className={`inline-flex items-center gap-1.5 rounded-none border px-3 py-1.5 text-xs font-medium ${cls.bg} ${cls.text} ${cls.border}`}
                  >
                    {cls.label} {c === 'green' ? '(1–6)' : c === 'yellow' ? '(7–12)' : '(15–25)'}
                  </span>
                )
              })}
            </div>
          </div>

          <section className="overflow-hidden rounded-none border border-neutral-200 bg-white">
            <div className="border-b border-neutral-200 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">ROS-vurderinger</h2>
              <p className="mt-1 text-xs text-neutral-500">
                Åpne dokumentet under for redigering, signering og revisjon. Låste ROS kan kopieres til nytt år.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className={theadRow}>
                    <th className={`${tableCell} font-medium`}>Tittel</th>
                    <th className={`${tableCell} font-medium`}>Avdeling</th>
                    <th className={`${tableCell} font-medium`}>Status</th>
                    <th className={`${tableCell} font-medium`}>Dato</th>
                    <th className={`${tableCell} font-medium`}>Rader</th>
                  </tr>
                </thead>
                <tbody>
                  {ic.rosAssessments.map((r, ri) => (
                    <tr key={r.id} className={table1BodyRowClass(layout, ri)}>
                      <td className={`${tableCell} font-medium text-neutral-900`}>{r.title}</td>
                      <td className={tableCell}>{r.department || '—'}</td>
                      <td className={tableCell}>
                        {r.locked ? (
                          <span className="rounded-none border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Låst
                          </span>
                        ) : (
                          <span className="rounded-none border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                            Utkast
                          </span>
                        )}
                      </td>
                      <td className={`${tableCell} text-neutral-600`}>{r.assessedAt}</td>
                      <td className={tableCell}>{r.rows.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {ic.rosAssessments.map((ros) => (
            <RosAssessmentCard
              key={ros.id}
              ros={ros}
              ic={ic}
              hr={hr}
              onLocked={handleRosLockTasks}
              duplicateRevision={ic.duplicateRosRevision}
            />
          ))}

          {rosPanelOpen ? (
            <div
              className="fixed inset-0 z-[100] flex justify-end bg-black/45 backdrop-blur-[2px]"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeRosPanel()
              }}
            >
              <div
                className="flex h-full w-full max-w-[min(100vw,920px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ros-panel-title"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5 sm:px-8 sm:py-6">
                  <h2
                    id="ros-panel-title"
                    className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
                    style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
                  >
                    Ny ROS-vurdering
                  </h2>
                  <button
                    type="button"
                    onClick={closeRosPanel}
                    className="rounded-none p-2 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-800"
                    aria-label="Lukk"
                  >
                    <X className="size-6" />
                  </button>
                </header>

                <form
                  className="flex min-h-0 flex-1 flex-col"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!rosTitle.trim() || !rosAssessor.trim()) return
                    const isO = rosCategory === 'organizational_change'
                    const r = ic.createRosAssessment(rosTitle.trim(), rosDept.trim(), rosAssessor.trim(), {
                      category: rosCategory,
                      seedORosRows: isO,
                      workspaceCategory: rosWorkspace,
                    })
                    if (isO && r && supabaseConfigured && oRosAmuId && oRosVoId) {
                      void hr.upsertRosSignoff(r.id, oRosAmuId, oRosVoId)
                    }
                    closeRosPanel()
                  }}
                >
                  <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-8">
                    <div className={TASK_PANEL_ROW_GRID}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Kontekst</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          Gi ROS-en et tydelig navn og område. Juridisk kategori (generell vs. O-ROS) styrer forhåndsutfylling
                          og krav til HR-signatur.
                        </p>
                      </div>
                      <div className="rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6">
                        <div className="space-y-4">
                          <div>
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-title-input">
                              Tittel
                            </label>
                            <input
                              id="ros-panel-title-input"
                              value={rosTitle}
                              onChange={(e) => setRosTitle(e.target.value)}
                              required
                              className={SETTINGS_INPUT}
                              placeholder="f.eks. ROS — Lager 2027"
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-dept">
                              Avdeling / område
                            </label>
                            <input
                              id="ros-panel-dept"
                              value={rosDept}
                              onChange={(e) => setRosDept(e.target.value)}
                              className={SETTINGS_INPUT}
                              placeholder="f.eks. Produksjon"
                            />
                          </div>
                          <div>
                            <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-assessor">
                              Vurdert av
                            </label>
                            <input
                              id="ros-panel-assessor"
                              value={rosAssessor}
                              onChange={(e) => setRosAssessor(e.target.value)}
                              required
                              className={SETTINGS_INPUT}
                              placeholder="Navn / rolle"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="my-8 border-t border-neutral-200/90" />

                    <div className={TASK_PANEL_ROW_GRID}>
                      <div>
                        <h3 className="text-base font-semibold text-neutral-900">Kategori</h3>
                        <p className={`${SETTINGS_LEAD} mt-2`}>
                          O-ROS krever AMU/VO under HR før låsing. For forslagsrader etter arbeidsområde, bruk veiviseren
                          øverst på siden.
                        </p>
                      </div>
                      <div className="rounded-none border border-neutral-200/90 bg-[#f4f1ea] p-5 sm:p-6 space-y-4">
                        <div>
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-legal-cat">
                            Juridisk type
                          </label>
                          <select
                            id="ros-panel-legal-cat"
                            value={rosCategory}
                            onChange={(e) => setRosCategory(e.target.value as RosCategory)}
                            className={SETTINGS_INPUT}
                          >
                            <option value="general">Generell ROS</option>
                            <option value="organizational_change">Organisatorisk endring (O-ROS)</option>
                          </select>
                        </div>
                        <div>
                          <label className={SETTINGS_FIELD_LABEL} htmlFor="ros-panel-ws">
                            Arbeidsområde (veiledning)
                          </label>
                          <select
                            id="ros-panel-ws"
                            value={rosWorkspace}
                            onChange={(e) => setRosWorkspace(e.target.value as RosWorkspaceCategory)}
                            className={SETTINGS_INPUT}
                          >
                            <option value="general">Generelt</option>
                            <option value="production">Produksjon</option>
                            <option value="office">Kontor</option>
                            <option value="warehouse">Lager / logistikk</option>
                            <option value="construction">Bygg / anlegg</option>
                            <option value="healthcare">Helse / omsorg</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {rosCategory === 'organizational_change' && hr.orgUsers.length > 0 ? (
                      <>
                        <div className="my-8 border-t border-neutral-200/90" />
                        <div className={ORG_MERGED_PANEL} style={menu1.barStyle}>
                          <div className={ORG_MERGED_COL}>
                            <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="ros-panel-amu">
                              AMU-representant
                            </label>
                            <select
                              id="ros-panel-amu"
                              value={oRosAmuId}
                              onChange={(e) => setORosAmuId(e.target.value)}
                              className={SETTINGS_INPUT_ON_DARK}
                            >
                              <option value="">—</option>
                              {hr.orgUsers.map((u) => (
                                <option key={u.user_id} value={u.user_id}>
                                  {u.display_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={ORG_MERGED_COL}>
                            <label className={SETTINGS_FIELD_LABEL_ON_DARK} htmlFor="ros-panel-vo">
                              Verneombud
                            </label>
                            <select
                              id="ros-panel-vo"
                              value={oRosVoId}
                              onChange={(e) => setORosVoId(e.target.value)}
                              className={SETTINGS_INPUT_ON_DARK}
                            >
                              <option value="">—</option>
                              {hr.orgUsers.map((u) => (
                                <option key={u.user_id} value={u.user_id}>
                                  {u.display_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={ORG_MERGED_ACTION_COL} />
                        </div>
                        <p className="mt-2 text-xs text-amber-800">
                          O-ROS kan ikke låses før AMU og verneombud har signert under HR → O-ROS.
                        </p>
                      </>
                    ) : null}
                  </div>

                  <footer className="shrink-0 border-t border-neutral-200/90 bg-[#f0efe9] px-6 py-5 sm:px-8">
                    <button
                      type="submit"
                      className="w-full rounded-none bg-[#1a3d32] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Opprett ROS
                    </button>
                    <button
                      type="button"
                      onClick={closeRosPanel}
                      className="mt-3 w-full rounded-none border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700"
                    >
                      Avbryt
                    </button>
                  </footer>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {tab === 'annual' && (
        <div className="mt-8 space-y-6">
          <LegalDisclaimer compact />
          <form
            className="rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault()
              ic.addAnnualReview({
                year: annualYear,
                reviewedAt: new Date().toISOString().slice(0, 10),
                reviewer: annualReviewer.trim() || 'Ukjent',
                summary: annualSummary.trim(),
                nextReviewDue: annualNext,
              })
              setAnnualSummary('')
            }}
          >
            <h2 className="text-lg font-semibold text-neutral-900">Registrer årsgjennomgang</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Dokumenter at internkontrollen er gjennomgått (jf. internkontrollforskriften § 5) —{' '}
              <strong>illustrativt skjema</strong>.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-neutral-500">År</label>
                <input
                  type="number"
                  value={annualYear}
                  onChange={(e) => setAnnualYear(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500">Gjennomført av</label>
                <input
                  value={annualReviewer}
                  onChange={(e) => setAnnualReviewer(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                  placeholder="Navn / rolle"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Oppsummering</label>
                <textarea
                  value={annualSummary}
                  onChange={(e) => setAnnualSummary(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                  required
                  placeholder="Hva ble vurdert, hovedfunn, vedtatte tiltak …"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-neutral-500">Neste planlagte gjennomgang (dato)</label>
                <input
                  type="date"
                  value={annualNext}
                  onChange={(e) => setAnnualNext(e.target.value)}
                  className="mt-1 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white"
            >
              <FileText className="size-4" />
              Lagre årsgjennomgang
            </button>
          </form>

          <ul className="space-y-3">
            {ic.annualReviews.map((a) => (
              <li key={a.id} className="rounded-xl border border-neutral-200 bg-[#faf8f4] p-4 text-sm">
                <div className="font-semibold text-[#1a3d32]">
                  År {a.year} — {a.reviewer}
                </div>
                <div className="text-xs text-neutral-500">
                  Registrert {a.reviewedAt} · Neste: {a.nextReviewDue}
                </div>
                <p className="mt-2 text-neutral-800">{a.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'audit' && (
        <div className="mt-8">
          <div className="overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
            <div className="border-b border-neutral-200 px-4 py-3">
              <h2 className="font-semibold text-neutral-900">Hendelseslogg (internkontroll)</h2>
            </div>
            <ul className="max-h-[560px] divide-y divide-neutral-100 overflow-y-auto text-sm">
              {sortedAudit.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="text-xs text-neutral-500">{formatWhen(a.at)} · {a.action}</div>
                  <p className="mt-1 text-neutral-800">{a.message}</p>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm('Tilbakestill internkontroll-demo?')) ic.resetDemo()
            }}
            className="mt-4 text-sm text-neutral-500 underline hover:text-neutral-800"
          >
            Tilbakestill demo
          </button>
        </div>
      )}
    </div>
  )
}

// ─── RosAssessmentCard ────────────────────────────────────────────────────────

function RosAssessmentCard({
  ros,
  ic,
  hr,
  onLocked,
  duplicateRevision,
}: {
  ros: RosAssessment
  ic: ReturnType<typeof useInternalControl>
  hr: ReturnType<typeof useHrCompliance>
  onLocked: (ros: RosAssessment) => void
  duplicateRevision: (lockedSourceId: string) => void
}) {
  const [leaderName, setLeaderName] = useState('')
  const [verneombudName, setVerneombudName] = useState('')

  const leaderSig = ros.signatures.find((s) => s.role === 'leader')
  const verneombudSig = ros.signatures.find((s) => s.role === 'verneombud')
  const bothSigned = !!leaderSig && !!verneombudSig
  const oRosBlock = hr.rosSignoffs.find((s) => s.ros_assessment_id === ros.id)
  const oRosBlocked = ros.rosCategory === 'organizational_change' && oRosBlock?.blocked === true
  const isLocked = ros.locked

  function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleDateString('no-NO', { dateStyle: 'short' }) } catch { return iso }
  }

  // 5×5 risk matrix — plot rows by gross score position
  const matrix = Array.from({ length: 5 }, (_, si) =>
    Array.from({ length: 5 }, (_, li) => {
      const s = 5 - si   // severity top=5, bottom=1
      const l = li + 1   // likelihood left=1, right=5
      const score = s * l
      const colour = riskColour(score)
      const rowsHere = ros.rows.filter((r) => r.severity === s && r.likelihood === l)
      const residualHere = ros.rows.filter((r) =>
        r.residualSeverity === s && r.residualLikelihood === l,
      )
      return { s, l, score, colour, rows: rowsHere, residual: residualHere }
    }),
  )

  return (
    <div className={`overflow-hidden rounded-none border bg-white shadow-sm ${isLocked ? 'border-emerald-200' : 'border-neutral-200/90'}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-neutral-900">{ros.title}</h3>
            {ros.rosCategory === 'organizational_change' && (
              <span className="rounded-none bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-900">
                O-ROS
              </span>
            )}
            {isLocked && <Lock className="size-4 text-emerald-600" aria-label="Låst — begge signaturer innhentet" />}
          </div>
          {oRosBlocked && (
            <p className="mt-1 text-xs font-medium text-amber-800">
              Sperret til AMU og verneombud har signert under HR → O-ROS.
            </p>
          )}
          <p className="text-xs text-neutral-500">{ros.department} · {ros.assessor} · {ros.assessedAt}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isLocked ? (
            <button
              type="button"
              onClick={() => duplicateRevision(ros.id)}
              className="rounded-none border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Opprett ny revisjon
            </button>
          ) : (
            <button
              type="button"
              onClick={() => ic.addRosRow(ros.id)}
              className="text-sm font-medium text-[#1a3d32] hover:underline"
            >
              + Rad
            </button>
          )}
        </div>
      </div>

      {/* 5×5 visual risk matrix */}
      <div className="border-b border-neutral-100 p-4">
        <p className="mb-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Risikomatrise (5×5)</p>
        <div className="flex gap-2">
          {/* Y-axis label */}
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] text-neutral-400 rotate-[-90deg] whitespace-nowrap mt-8">Alvorlighetsgrad →</span>
          </div>
          <div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(5,2.25rem)', gridTemplateRows: 'repeat(5,2.25rem)', gap: '2px' }}>
              {matrix.map((row, ri) =>
                row.map((cell, ci) => {
                  const cls = RISK_COLOUR_CLASSES[cell.colour]
                  return (
                    <div key={`${ri}-${ci}`}
                      className={`relative flex items-center justify-center rounded-none text-xs font-bold ${cls.bg} ${cls.text}`}
                      title={`Alvor ${cell.s} × Sanns. ${cell.l} = ${cell.score}`}>
                      <span>{cell.score}</span>
                      {/* Gross risk dots */}
                      {cell.rows.map((r) => (
                        <span key={r.id} className="absolute top-0.5 right-0.5 size-2 rounded-full bg-neutral-800 ring-1 ring-white" title={r.hazard} />
                      ))}
                      {/* Residual risk dots (lighter) */}
                      {cell.residual.map((r) => (
                        <span key={`res-${r.id}`} className="absolute bottom-0.5 left-0.5 size-1.5 rounded-full bg-white ring-1 ring-neutral-400" title={`Restrisiko: ${r.hazard}`} />
                      ))}
                    </div>
                  )
                }),
              )}
            </div>
            {/* X-axis */}
            <div className="mt-1 grid text-center" style={{ gridTemplateColumns: 'repeat(5,2.25rem)', gap: '2px' }}>
              {[1,2,3,4,5].map((n) => <div key={n} className="text-[10px] text-neutral-400">{n}</div>)}
            </div>
            <p className="mt-0.5 text-center text-[10px] text-neutral-400">Sannsynlighet →</p>
          </div>
          <div className="ml-3 flex flex-col gap-1 justify-center text-[10px] text-neutral-500">
            <span>● Brutto (før tiltak)</span>
            <span>○ Restrisiko (etter)</span>
          </div>
        </div>
      </div>

      {/* Rows table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-amber-50/80 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              <th className="px-2 py-2">Aktivitet</th>
              <th className="px-2 py-2">Fare</th>
              <th className="px-2 py-2">Eks. tiltak</th>
              <th className="px-2 py-2 text-center">Alv.</th>
              <th className="px-2 py-2 text-center">San.</th>
              <th className="px-2 py-2 text-center">Score</th>
              <th className="px-2 py-2">Foreslått tiltak</th>
              <th className="px-2 py-2 text-center bg-sky-50">Rest-alv.</th>
              <th className="px-2 py-2 text-center bg-sky-50">Rest-san.</th>
              <th className="px-2 py-2 text-center bg-sky-50">Restrisiko</th>
              <th className="min-w-[140px] px-2 py-2 bg-rose-50/80">Strakstiltak / eskalering (ved rød rest)</th>
              <th className="px-2 py-2">Ansvarlig</th>
              <th className="px-2 py-2">Frist</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {ros.rows.map((row, idx) => {
              const grossColour = riskColour(row.riskScore)
              const grossCls = RISK_COLOUR_CLASSES[grossColour]
              const residual = row.residualScore != null ? row.residualScore : null
              const residualColour = residual != null ? riskColour(residual) : null
              const residualCls = residualColour ? RISK_COLOUR_CLASSES[residualColour] : null
              const rowClosed = row.status === 'closed'
              const redResidual = residual != null && residual >= 15
              const needJust = redResidual && !(row.redResidualJustification && row.redResidualJustification.trim().length >= 10)
              return (
                <tr key={row.id} className={`border-b border-neutral-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'} ${rowClosed ? 'opacity-60' : ''}`}>
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.activity} onChange={(e) => ic.updateRosRow(ros.id, row.id, { activity: e.target.value })} className="w-full min-w-[90px] rounded-none border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.hazard} onChange={(e) => ic.updateRosRow(ros.id, row.id, { hazard: e.target.value })} className="w-full min-w-[90px] rounded-none border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.existingControls} onChange={(e) => ic.updateRosRow(ros.id, row.id, { existingControls: e.target.value })} className="w-full min-w-[90px] rounded-none border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Gross severity */}
                  <td className="px-1 py-1.5 text-center">
                    <input disabled={isLocked} type="number" min={1} max={5} value={row.severity} onChange={(e) => ic.updateRosRow(ros.id, row.id, { severity: Number(e.target.value) || 1 })} className="w-10 rounded-none border border-neutral-200 px-1 text-center disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Gross likelihood */}
                  <td className="px-1 py-1.5 text-center">
                    <input disabled={isLocked} type="number" min={1} max={5} value={row.likelihood} onChange={(e) => ic.updateRosRow(ros.id, row.id, { likelihood: Number(e.target.value) || 1 })} className="w-10 rounded-none border border-neutral-200 px-1 text-center disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Gross score — colour-coded */}
                  <td className="px-2 py-1.5 text-center">
                    <span className={`inline-flex h-7 w-9 items-center justify-center rounded-none text-xs font-bold ${grossCls.bg} ${grossCls.text}`}>
                      {row.riskScore}
                    </span>
                  </td>
                  {/* Proposed measures */}
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.proposedMeasures} onChange={(e) => ic.updateRosRow(ros.id, row.id, { proposedMeasures: e.target.value })} className="w-full min-w-[110px] rounded-none border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Residual severity */}
                  <td className="bg-sky-50/50 px-1 py-1.5 text-center">
                    <input disabled={isLocked} type="number" min={1} max={5} value={row.residualSeverity ?? ''} placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : undefined
                        const rs = v ?? row.severity
                        const rl = row.residualLikelihood ?? row.likelihood
                        ic.updateRosRow(ros.id, row.id, { residualSeverity: v, residualScore: v != null ? computeRiskScore(rs, rl) : undefined })
                      }}
                      className="w-10 rounded-none border border-sky-200 bg-sky-50 px-1 text-center placeholder:text-neutral-300 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Residual likelihood */}
                  <td className="bg-sky-50/50 px-1 py-1.5 text-center">
                    <input disabled={isLocked} type="number" min={1} max={5} value={row.residualLikelihood ?? ''} placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value ? Number(e.target.value) : undefined
                        const rs = row.residualSeverity ?? row.severity
                        const rl = v ?? row.likelihood
                        ic.updateRosRow(ros.id, row.id, { residualLikelihood: v, residualScore: v != null ? computeRiskScore(rs, rl) : undefined })
                      }}
                      className="w-10 rounded-none border border-sky-200 bg-sky-50 px-1 text-center placeholder:text-neutral-300 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Residual score — colour-coded */}
                  <td className="bg-sky-50/50 px-2 py-1.5 text-center">
                    {residual != null && residualCls ? (
                      <span className={`inline-flex h-7 w-9 items-center justify-center rounded-none text-xs font-bold ${residualCls.bg} ${residualCls.text}`}>
                        {residual}
                      </span>
                    ) : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className={`px-1 py-1.5 ${needJust && !isLocked ? 'bg-rose-50' : 'bg-rose-50/30'}`}>
                    <textarea
                      disabled={isLocked}
                      value={row.redResidualJustification ?? ''}
                      onChange={(e) => ic.updateRosRow(ros.id, row.id, { redResidualJustification: e.target.value })}
                      rows={2}
                      placeholder={redResidual ? 'Påkrevd ved rød restrisiko (min. 10 tegn)…' : 'Kun ved behov…'}
                      className={`w-full min-w-[120px] rounded-none border px-1 py-0.5 text-[11px] disabled:bg-transparent disabled:border-transparent ${
                        needJust && !isLocked ? 'border-rose-400 bg-white' : 'border-neutral-200'
                      }`}
                    />
                  </td>
                  {/* Responsible */}
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} value={row.responsible} onChange={(e) => ic.updateRosRow(ros.id, row.id, { responsible: e.target.value })} className="w-full min-w-[70px] rounded-none border border-neutral-200 px-1 py-0.5 disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Due date */}
                  <td className="px-1 py-1.5">
                    <input disabled={isLocked} type="date" value={row.dueDate} onChange={(e) => ic.updateRosRow(ros.id, row.id, { dueDate: e.target.value })} className="rounded-none border border-neutral-200 px-1 py-0.5 text-xs disabled:bg-transparent disabled:border-transparent" />
                  </td>
                  {/* Status — replaces OK checkbox */}
                  <td className="px-1 py-1.5">
                    <select disabled={isLocked} value={row.status} onChange={(e) => ic.updateRosRow(ros.id, row.id, { status: e.target.value as import('../types/internalControl').RosRowStatus })}
                      className={`rounded-none border px-2 py-0.5 text-[10px] font-medium disabled:cursor-default ${
                        row.status === 'closed' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' :
                        row.status === 'in_progress' ? 'border-sky-300 bg-sky-100 text-sky-800' :
                        'border-neutral-300 bg-neutral-100 text-neutral-700'
                      }`}>
                      <option value="open">Åpen</option>
                      <option value="in_progress">Pågår</option>
                      <option value="closed">Lukket</option>
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Dual electronic signature section (AML §3-1 medvirkning) */}
      <div className="border-t border-neutral-100 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="size-4 text-[#1a3d32]" />
          <h4 className="text-sm font-semibold text-neutral-800">Behandlet og godkjent av</h4>
          <span className="text-xs text-neutral-400">(AML §3-1 — medvirkning fra arbeidstakere)</span>
        </div>

        {isLocked ? (
          <div className="flex flex-wrap gap-4">
            {ros.signatures.map((sig) => (
              <div key={sig.role} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    {sig.role === 'leader' ? 'Leder' : 'Verneombud'}: {sig.signerName}
                  </p>
                  <p className="text-xs text-emerald-700">{fmtDate(sig.signedAt)}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-3">
              <Lock className="size-4 text-emerald-700" />
              <span className="text-sm font-medium text-emerald-900">Dokumentet er låst og read-only</span>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Leader sign */}
            <div className={`rounded-xl border p-4 ${leaderSig ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
              <p className="text-xs font-semibold text-neutral-700 mb-2">Leder</p>
              {leaderSig ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-sm text-emerald-800">{leaderSig.signerName} — {fmtDate(leaderSig.signedAt)}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={leaderName} onChange={(e) => setLeaderName(e.target.value)} placeholder="Leders fulle navn" className="flex-1 rounded-none border border-neutral-200 px-2 py-1.5 text-sm" />
                  <button type="button" disabled={!leaderName.trim() || oRosBlocked} onClick={() => { void ic.signRos(ros.id, 'leader', leaderName, { onLocked }); setLeaderName('') }} className="rounded-none bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-[#142e26]">
                    Signer
                  </button>
                </div>
              )}
            </div>
            {/* Verneombud sign */}
            <div className={`rounded-xl border p-4 ${verneombudSig ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-200 bg-neutral-50'}`}>
              <p className="text-xs font-semibold text-neutral-700 mb-2">Verneombud</p>
              {verneombudSig ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <span className="text-sm text-emerald-800">{verneombudSig.signerName} — {fmtDate(verneombudSig.signedAt)}</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input value={verneombudName} onChange={(e) => setVerneombudName(e.target.value)} placeholder="Verneombudets fulle navn" className="flex-1 rounded-none border border-neutral-200 px-2 py-1.5 text-sm" />
                  <button type="button" disabled={!verneombudName.trim() || oRosBlocked} onClick={() => { void ic.signRos(ros.id, 'verneombud', verneombudName, { onLocked }); setVerneombudName('') }} className="rounded-none bg-[#1a3d32] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-[#142e26]">
                    Signer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {!isLocked && !bothSigned && (
          <p className="mt-3 text-xs text-neutral-400">
            Dokumentet låses automatisk når begge parter har signert.
          </p>
        )}
      </div>
    </div>
  )
}
