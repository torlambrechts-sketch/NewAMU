// ChecklistsLibraryPage — "Bibliotek" — Direction 5a side-by-side page.
//
// Three-lens view: Lovverk | Roller | Alle
//   • Lovverk  — sub-tabs per licensed pack; context card shows pack info
//   • Roller   — sub-tabs per category; context card shows category info
//   • Alle     — two-column grid: all templates + all executions
//   • Analyse  — inline ModuleAnalyticsDashboard (no separate page navigation)
//
// The header + tab bar are sticky so they remain visible while dashboard or
// library content scrolls beneath them.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  LayoutGrid,
  Plus,
  Scale,
  User,
  Users,
  Wrench,
} from 'lucide-react'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useChecklistModule } from './useChecklistModule'
import type { ComplianceExecutionRow, ComplianceTemplateRow } from './types'

// Dashboard engine imports
import { ModuleAnalyticsDashboard } from '../../src/components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../src/components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../src/components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../src/components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../src/components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../src/components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../src/components/module/dashboard/DashboardChooser'
import { downloadCsv, widgetToCsv } from '../../src/lib/reports/widgetCsv'
import { defaultCompatibleKinds } from '../../src/components/module/dashboard/dashboardWidgetKinds'
import {
  CHECKLIST_DASHBOARD_SCOPE_ID,
} from './dashboards/checklistDashboardScope'
import './dashboards/checklistDashboardScope'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { freshId } from '../../src/lib/dashboards/freshId'
import { getDashboardScope } from '../../src/lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../src/components/reports/PublishReportButton'
import { useRegulationFilter } from '../../src/context/RegulationFilterContext'
import { useComplianceNav } from './useComplianceNav'
import { packAccentFor } from './dashboards/packAccents'
import {
  STATUS_OPTIONS,
  SEVERITY_OPTIONS,
  useChecklistDatasets,
} from './dashboards/useChecklistDatasets'
import type { ReportModule } from '../../src/types/reportBuilder'
import type { DashboardDimension } from '../../src/lib/dashboards/dashboardFilters'
import { makeFilter } from '../../src/lib/dashboards/dashboardFilters'
import type { DrillDownEvent } from '../../src/components/reports/ReportModuleWidget'

type Lens = 'lovverk' | 'roller' | 'alle'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Kladd',
  active: 'Pågående',
  signed: 'Fullført',
}
const STATUS_BADGE = {
  draft: 'draft',
  active: 'active',
  signed: 'signed',
} as const

const SERIF = "'Libre Baskerville', 'Source Serif 4', Georgia, serif"

// Compact inline dropdown filter chip
function MiniFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | null
  options: { id: string; label: string }[]
  onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.id === value)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
          value
            ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
        }`}
      >
        {label}
        {current ? `: ${current.label}` : ''}
        <ChevronRight className="h-3 w-3 rotate-90" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-30 min-w-[160px] rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-50 ${!value ? 'font-semibold text-neutral-900' : 'text-neutral-700'}`}
            >
              Alle
            </button>
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false) }}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-50 ${
                  value === o.id ? 'font-semibold text-[#1a3d32]' : 'text-neutral-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Template card (compact)
function TemplateCard({
  template,
  categoryName,
  onClick,
}: {
  template: ComplianceTemplateRow
  categoryName: string | null
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-xl border border-neutral-200 bg-white p-3.5 text-left shadow-sm transition-colors hover:border-[#1a3d32]/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-semibold leading-snug text-neutral-900 group-hover:text-[#1a3d32]">
          {template.name}
        </span>
        {template.review_status === 'approved' && (
          <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1a3d32]" />
        )}
      </div>
      {categoryName ? (
        <p className="mt-0.5 text-xs text-neutral-500">{categoryName}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1">
        {template.cadence_hint ? (
          <Badge variant="info">{template.cadence_hint}</Badge>
        ) : null}
        {template.review_status === 'approved' ? (
          <Badge variant="success">Offisiell</Badge>
        ) : template.review_status === 'reviewed' ? (
          <Badge variant="neutral">Verifisert</Badge>
        ) : null}
      </div>
    </button>
  )
}

// Single activity/execution row (feed style from design)
function ActivityRow({
  execution,
  templateName,
  categoryName,
}: {
  execution: ComplianceExecutionRow
  templateName: string | null
  categoryName: string | null
}) {
  const navigate = useNavigate()
  const initials = execution.title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()

  const statusIcon =
    execution.status === 'signed'
      ? { bg: 'bg-emerald-100', fg: 'text-emerald-600' }
      : execution.status === 'active'
        ? { bg: 'bg-[#e8f0ec]', fg: 'text-[#1a3d32]' }
        : { bg: 'bg-neutral-100', fg: 'text-neutral-500' }

  return (
    <button
      onClick={() => navigate(`/compliance/checklists/${execution.id}`)}
      className="flex w-full items-start gap-3 border-t border-neutral-100 px-4 py-3 text-left transition-colors hover:bg-neutral-50 first:border-t-0"
    >
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${statusIcon.bg} ${statusIcon.fg}`}
      >
        {initials || '??'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug">
          <span className="font-medium text-neutral-900">{execution.title}</span>
          {templateName ? (
            <span className="text-neutral-500"> · {templateName}</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-neutral-500">
          {categoryName ? `${categoryName} · ` : ''}
          {new Date(execution.updated_at).toLocaleDateString('nb-NO', { dateStyle: 'short' })}
        </p>
      </div>
      <Badge variant={STATUS_BADGE[execution.status] ?? 'neutral'}>
        {STATUS_LABEL[execution.status] ?? execution.status}
      </Badge>
    </button>
  )
}

export function ChecklistsLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const lens = (searchParams.get('lens') as Lens) ?? 'lovverk'
  const lensVal = searchParams.get('lv')

  // 'library' shows the two-column content; 'analyse' embeds the dashboard inline
  const [view, setView] = useState<'library' | 'analyse'>('library')

  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)

  const licensedPacks = useLicensedPacks()
  const orgSetup = useOrgSetupContext()
  const { supabase } = orgSetup
  const cl = useChecklistModule({ supabase })
  const navigate = useNavigate()

  const [tplStatus, setTplStatus] = useState<string | null>(null)
  const [actStatus, setActStatus] = useState<string | null>(null)

  useEffect(() => {
    void cl.load()
  }, [cl])

  // ── Dashboard engine wiring (mirrors ChecklistsAnalysePage) ──────────────

  const activePack = searchParams.get('pack')
  const accent =
    packAccentFor(activePack) ?? getDashboardScope(CHECKLIST_DASHBOARD_SCOPE_ID)?.accent

  const dashboard = useDashboardLayout({ supabase, scopeId: CHECKLIST_DASHBOARD_SCOPE_ID })

  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'pack',
        label: 'Pakke',
        description: 'Begrens til en eller flere regulative pakker.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => licensedPacks.map((p) => ({ id: p.slug, label: p.shortName })),
      },
      {
        id: 'template',
        label: 'Mal',
        description: 'Filtrer på en eller flere maler.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () =>
          cl.templates.filter((t) => t.is_active).map((t) => ({ id: t.id, label: t.name })),
      },
      {
        id: 'status',
        label: 'Status',
        description: 'Kladd, aktiv eller signert.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'severity',
        label: 'Alvorlighetsgrad',
        description: 'Brukes på funn-baserte widgets.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => SEVERITY_OPTIONS.map((s) => ({ id: s.id, label: s.label })),
      },
      {
        id: 'location',
        label: 'Lokasjon',
        description: 'Filtrer på utførelsens lokasjon.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => orgSetup.locations.map((l) => ({ id: l.id, label: l.name })),
      },
      {
        id: 'department',
        label: 'Avdeling',
        description: 'Filtrer på utførelsens avdeling.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => orgSetup.departments.map((d) => ({ id: d.id, label: d.name })),
      },
      {
        id: 'participant',
        label: 'Deltaker',
        description: 'Inkluder kun utførelser der disse medlemmene var deltakere.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => orgSetup.members.map((m) => ({ id: m.id, label: m.display_name })),
      },
      {
        id: 'date',
        label: 'Periode',
        description: 'Filter på opprettet/signert dato.',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [licensedPacks, cl.templates, orgSetup.locations, orgSetup.departments, orgSetup.members],
  )

  const complianceNav = useComplianceNav()
  const { isActive: isRegulationActive } = useRegulationFilter()
  const filteredExecutionsForDashboard = useMemo(() => {
    const categoryRegulationById = new Map(
      complianceNav.categories.map((c) => [c.id, c.regulationId] as const),
    )
    const templateCategoryById = new Map(cl.templates.map((t) => [t.id, t.category_id] as const))
    return cl.executions.filter((e) => {
      const catId = templateCategoryById.get(e.template_id) ?? null
      const regId = catId ? (categoryRegulationById.get(catId) ?? null) : null
      return isRegulationActive(regId)
    })
  }, [cl.executions, cl.templates, complianceNav.categories, isRegulationActive])

  const datasets = useChecklistDatasets({
    filters: dashboard.filters,
    executions: filteredExecutionsForDashboard,
    responsesByExecutionId: cl.responsesByExecutionId,
    templates: cl.templates,
    packs: licensedPacks,
    locations: orgSetup.locations,
    departments: orgSetup.departments,
  })

  const dashboardLayout = useMemo(
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

  const editChrome = useDashboardEditChrome({
    scopeId: CHECKLIST_DASHBOARD_SCOPE_ID,
    layout: dashboard.layout,
    saveLayout: dashboard.saveLayout,
  })

  const widgetControlSlot = (m: ReportModule) => (
    <DashboardWidgetMenu
      ariaLabel={`Meny for widget ${m.title}`}
      onEdit={() => setEditWidget(m)}
      onDuplicate={() => {
        const dup = { ...m, id: freshId('w'), title: `${m.title} (kopi)` }
        void dashboard.saveLayout([...dashboard.layout, dup])
      }}
      onExportCsv={() => downloadCsv(widgetToCsv(m, datasets))}
      onRemove={() => {
        if (!window.confirm(`Fjerne widgeten «${m.title}»?`)) return
        void dashboard.saveLayout(dashboard.layout.filter((x) => x.id !== m.id))
      }}
    />
  )

  const handleDrillDown = (e: DrillDownEvent) => {
    let resolvedId: string | null = null
    if (e.dimensionId === 'status') {
      const opt = STATUS_OPTIONS.find((s) => s.label === e.segmentLabel)
      resolvedId = opt?.id ?? null
    } else if (e.dimensionId === 'severity') {
      const opt = SEVERITY_OPTIONS.find((s) => s.label === e.segmentLabel)
      resolvedId = opt?.id ?? null
    } else if (e.dimensionId === 'pack') {
      const p = licensedPacks.find((x) => x.shortName === e.segmentLabel || x.slug === e.segmentLabel)
      resolvedId = p?.slug ?? null
    } else if (e.dimensionId === 'template') {
      const t = cl.templates.find((x) => x.name === e.segmentLabel)
      resolvedId = t?.id ?? null
    } else if (e.dimensionId === 'location') {
      const loc = orgSetup.locations.find((l) => l.name === e.segmentLabel)
      resolvedId = loc?.id ?? null
    } else if (e.dimensionId === 'department') {
      const dep = orgSetup.departments.find((d) => d.name === e.segmentLabel)
      resolvedId = dep?.id ?? null
    }
    if (!resolvedId) return
    const existing = dashboard.filters.find(
      (f) => f.dimensionId === e.dimensionId && f.value === resolvedId,
    )
    const next = existing
      ? dashboard.filters.filter((f) => f.id !== existing.id)
      : [...dashboard.filters, makeFilter(e.dimensionId, 'is', resolvedId)]
    void dashboard.saveFilters(next)
  }

  const dashboardEmpty =
    cl.executions.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen sjekklister å analysere ennå. Opprett eller signer en kjøring for å se tallene her.
        </p>
      </div>
    ) : null

  // ── Library data ──────────────────────────────────────────────────────────

  function setLens(l: Lens) {
    const p = new URLSearchParams(searchParams)
    p.set('lens', l)
    p.delete('lv')
    setSearchParams(p, { replace: true })
    setView('library')
  }

  function setLensVal(v: string) {
    const p = new URLSearchParams(searchParams)
    p.set('lv', v)
    setSearchParams(p, { replace: true })
  }

  const categoryNameById = useMemo(
    () => new Map(cl.categories.map((c) => [c.id, c.name])),
    [cl.categories],
  )
  const templateById = useMemo(
    () => new Map(cl.templates.map((t) => [t.id, t])),
    [cl.templates],
  )

  const tabs = useMemo(() => {
    const activeTpls = cl.templates.filter((t) => t.is_active)
    if (lens === 'lovverk') {
      return licensedPacks.map((p) => ({
        id: p.slug,
        label: p.shortName,
        count:
          activeTpls.filter((t) => t.pack === p.slug).length +
          cl.executions.filter((e) => e.pack === p.slug).length,
      }))
    }
    if (lens === 'roller') {
      return cl.categories
        .filter((c) => c.is_active)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
        .map((c) => ({
          id: c.id,
          label: c.name,
          count:
            activeTpls.filter((t) => t.category_id === c.id).length +
            cl.executions.filter((e) => {
              const t = templateById.get(e.template_id)
              return t?.category_id === c.id
            }).length,
        }))
    }
    return []
  }, [lens, licensedPacks, cl.categories, cl.templates, cl.executions, templateById])

  const activeTab = tabs.find((t) => t.id === lensVal)?.id ?? tabs[0]?.id ?? null

  const activePackCtx =
    lens === 'lovverk' && activeTab
      ? (licensedPacks.find((p) => p.slug === activeTab) ?? null)
      : null
  const activeCat =
    lens === 'roller' && activeTab
      ? (cl.categories.find((c) => c.id === activeTab) ?? null)
      : null

  const filteredTemplates = useMemo(() => {
    let list = [...cl.templates].filter((t) => t.is_active)
    if (lens === 'lovverk' && activeTab) list = list.filter((t) => t.pack === activeTab)
    if (lens === 'roller' && activeTab) list = list.filter((t) => t.category_id === activeTab)
    if (tplStatus === 'approved') list = list.filter((t) => t.review_status === 'approved')
    if (tplStatus === 'reviewed') list = list.filter((t) => t.review_status === 'reviewed')
    if (tplStatus === 'pinned') list = list.filter((t) => t.nav_pinned)
    return list
  }, [cl.templates, lens, activeTab, tplStatus])

  const filteredExecutions = useMemo(() => {
    let list = [...cl.executions]
    if (lens === 'lovverk' && activeTab) list = list.filter((e) => e.pack === activeTab)
    if (lens === 'roller' && activeTab) {
      list = list.filter((e) => {
        const tpl = templateById.get(e.template_id)
        return tpl?.category_id === activeTab
      })
    }
    if (actStatus) list = list.filter((e) => e.status === actStatus)
    return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  }, [cl.executions, lens, activeTab, actStatus, templateById])

  const hasContextCard = activePackCtx !== null || activeCat !== null

  const TPL_FILTER_OPTS = [
    { id: 'approved', label: 'Offisiell' },
    { id: 'reviewed', label: 'Verifisert' },
    { id: 'pinned', label: 'Festet' },
  ]
  const ACT_FILTER_OPTS = [
    { id: 'active', label: 'Pågående' },
    { id: 'signed', label: 'Fullført' },
    { id: 'draft', label: 'Kladd' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-[#F9F7F2]">
      {/* ── LensHeader — sticky so it stays pinned while content scrolls ── */}
      <header className="sticky top-0 z-10 flex-shrink-0 border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-10 pb-0 pt-6">
          {/* Title row + segmented control + settings */}
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                Sjekklister · biblioteket
              </p>
              <h1
                className="text-3xl font-bold leading-tight text-neutral-900"
                style={{ fontFamily: SERIF }}
              >
                Sjekklister
              </h1>
              <p className="mt-1 text-[13px] text-neutral-600">
                Administrer og følg opp sjekklister mot lovverk, roller og standarder
              </p>
            </div>

            <div className="mt-1 flex shrink-0 items-center gap-2">
              {/* Tri-mode segmented control */}
              <div className="inline-flex rounded-lg bg-neutral-100 p-[3px] gap-0.5">
                {(
                  [
                    { id: 'lovverk', label: 'Lovverk', LucideIcon: Scale },
                    { id: 'roller', label: 'Rolle', LucideIcon: Users },
                    { id: 'alle', label: 'Alle', LucideIcon: LayoutGrid },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setLens(m.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-[7px] text-xs font-semibold transition-all ${
                      lens === m.id && view === 'library'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-800'
                    }`}
                  >
                    <m.LucideIcon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Settings wrench */}
              <button
                onClick={() => navigate('/admin/settings/compliance')}
                title="Innstillinger"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700"
              >
                <Wrench className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tab row: Analyse (persistent) + lens-specific tabs + Ny sjekkliste */}
          <div className="mt-4 flex items-end justify-between gap-2">
            <div className="flex gap-0 overflow-x-auto">
              {/* Analyse tab — always first; toggles inline dashboard */}
              <button
                onClick={() => setView(view === 'analyse' ? 'library' : 'analyse')}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-[18px] py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  view === 'analyse'
                    ? 'border-[#1a3d32] text-neutral-900'
                    : 'border-transparent text-neutral-600 hover:border-neutral-200 hover:text-neutral-700'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5 opacity-70" />
                Analyse
              </button>

              {/* Lens-specific tabs — only visible in library view */}
              {view === 'library' &&
                tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setLensVal(tab.id)}
                    className={`flex-shrink-0 border-b-2 px-[18px] py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'border-[#1a3d32] text-neutral-900'
                        : 'border-transparent text-neutral-600 hover:border-neutral-200 hover:text-neutral-700'
                    }`}
                  >
                    <span
                      style={{
                        fontFamily: lens === 'lovverk' ? SERIF : undefined,
                        fontWeight: 700,
                      }}
                    >
                      {tab.label}
                    </span>
                    {tab.count > 0 && (
                      <span className="ml-2 tabular-nums text-[12px] text-neutral-500">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
            </div>

            {/* Ny sjekkliste */}
            <div className="shrink-0 pb-1.5">
              <Button
                variant="primary"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => navigate('/compliance/checklists')}
              >
                Ny sjekkliste
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Inline Analyse dashboard ── */}
      {view === 'analyse' && (
        <>
          <ModuleAnalyticsDashboard
            accent={accent}
            breadcrumb={[]}
            title=""
            description=""
            titleChooser={
              <DashboardChooser
                available={dashboard.available}
                activeRow={dashboard.row}
                isDefault={dashboard.isDefault}
                currentUserId={dashboard.currentUserId}
                onSelect={dashboard.selectLayout}
                onSaveAs={dashboard.saveAs}
                onRename={dashboard.renameActive}
                onDelete={dashboard.deleteActive}
                onMarkDefault={dashboard.markActiveDefault}
              />
            }
            headerActions={
              <div className="flex flex-wrap items-center gap-2">
                {editChrome.toggleButton}
                <PublishReportButton
                  sourceDashboardId={dashboard.row?.id ?? null}
                  sourceDashboardName={dashboard.row?.name ?? null}
                  scopeId={CHECKLIST_DASHBOARD_SCOPE_ID}
                  scopeLabel="Sjekklister"
                  datasets={datasets}
                  ensureSavedRow={dashboard.ensureSavedRow}
                />
              </div>
            }
            layout={dashboardLayout}
            datasets={datasets}
            loading={cl.loading || dashboard.loading}
            error={cl.error ?? dashboard.error}
            emptyState={dashboardEmpty}
            onEdit={undefined}
            onAddWidget={editChrome.editMode ? undefined : () => setAddOpen(true)}
            widgetControlSlot={widgetControlSlot}
            onDrillDown={handleDrillDown}
            onResize={(w, next) =>
              void dashboard.saveLayout(
                dashboard.layout.map((x) => (x.id === w.id ? { ...x, colSpan: next } : x)),
              )
            }
            {...editChrome.moduleProps}
            filters={dashboard.filters}
            dimensions={dimensions}
            onFiltersChange={(next) => void dashboard.saveFilters(next)}
          />

          <DashboardEditLayoutPanel
            open={false}
            onClose={() => {}}
            layout={dashboard.layout}
            onSave={(next) => dashboard.saveLayout(next)}
            onResetToDefault={dashboard.isDefault ? undefined : () => dashboard.resetToDefault()}
          />

          <DashboardAddWidgetPanel
            open={addOpen}
            onClose={() => setAddOpen(false)}
            scopeId={CHECKLIST_DASHBOARD_SCOPE_ID}
            onAdd={(widget: ReportModule) => dashboard.saveLayout([...dashboard.layout, widget])}
          />

          <DashboardEditWidgetPanel
            open={editWidget !== null}
            widget={editWidget}
            datasets={datasets}
            onClose={() => setEditWidget(null)}
            onDuplicate={(w) => {
              const dup = { ...w, id: freshId('w'), title: `${w.title} (kopi)` }
              void dashboard.saveLayout([...dashboard.layout, dup])
            }}
            onRemove={(w) => {
              void dashboard.saveLayout(dashboard.layout.filter((m) => m.id !== w.id))
            }}
            onSave={async (next) => {
              const ok = await dashboard.saveLayout(
                dashboard.layout.map((m) => (m.id === next.id ? next : m)),
              )
              return ok
            }}
            compatibleKinds={editWidget ? defaultCompatibleKinds(editWidget.kind) : undefined}
          />
        </>
      )}

      {/* ── Library body ── */}
      {view === 'library' && (
        <div className="mx-auto w-full max-w-[1400px] px-10 py-6">
          <div
            className={`grid gap-6 ${
              hasContextCard ? 'lg:grid-cols-[240px_1fr_1fr]' : 'lg:grid-cols-2'
            }`}
          >
            {/* Context card — only in lovverk/roller mode when a tab is active */}
            {hasContextCard && (
              <div className="lg:sticky lg:top-[var(--header-h,140px)] lg:self-start">
                <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
                  {activePackCtx && (
                    <>
                      <div
                        className="mb-1 text-[26px] font-bold leading-none text-[#1a3d32]"
                        style={{ fontFamily: SERIF }}
                      >
                        {activePackCtx.shortName}
                      </div>
                      <div className="mb-3 text-[13px] font-semibold text-neutral-800">
                        {activePackCtx.pluralLabel}
                      </div>
                      {activePackCtx.legalReferences.length > 0 && (
                        <div className="mb-3">
                          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                            Sentrale paragrafer
                          </div>
                          {activePackCtx.legalReferences.slice(0, 5).map((ref, i) => (
                            <div
                              key={i}
                              className="border-t border-neutral-100 py-1.5 text-xs text-neutral-700 first:border-t-0"
                            >
                              {ref.code}
                            </div>
                          ))}
                        </div>
                      )}
                      {activePackCtx.description && (
                        <p className="text-xs leading-relaxed text-neutral-600">
                          {activePackCtx.description}
                        </p>
                      )}
                    </>
                  )}
                  {activeCat && (
                    <>
                      <div className="mb-3 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e8f0ec] text-[#1a3d32]">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <div
                            className="text-[17px] font-semibold text-neutral-900"
                            style={{ fontFamily: SERIF }}
                          >
                            {activeCat.name}
                          </div>
                          {activeCat.description ? (
                            <p className="text-xs text-neutral-500">{activeCat.description}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Hovedoppgaver
                      </div>
                      {['Daglige runder', 'Avviksmelding', 'Følge opp tiltak'].map((task, i) => (
                        <div
                          key={i}
                          className="border-t border-neutral-100 py-1.5 text-xs text-neutral-700 first:border-t-0"
                        >
                          {task}
                        </div>
                      ))}
                    </>
                  )}
                  {/* Stats */}
                  <div className="mt-4 flex gap-6 border-t border-neutral-100 pt-4">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Maler
                      </div>
                      <div className="text-[17px] font-bold tabular-nums text-neutral-900">
                        {filteredTemplates.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                        Aktivitet 7d
                      </div>
                      <div className="text-[17px] font-bold tabular-nums text-[#1a3d32]">
                        {filteredExecutions.length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Templates column */}
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[15px] font-semibold text-neutral-900">Maler å starte fra</h2>
                <Link
                  to="/compliance/checklists/maler"
                  className="text-xs font-semibold text-[#1a3d32] hover:underline"
                >
                  Se alle {cl.templates.filter((t) => t.is_active).length} →
                </Link>
              </div>

              {/* Inline filter chips */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <MiniFilter
                  label="Status"
                  value={tplStatus}
                  options={TPL_FILTER_OPTS}
                  onChange={setTplStatus}
                />
                {tplStatus && (
                  <button
                    onClick={() => setTplStatus(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Nullstill
                  </button>
                )}
                <span className="ml-auto text-xs text-neutral-500">
                  {filteredTemplates.length} treff
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {filteredTemplates.slice(0, 8).map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    categoryName={
                      t.category_id ? (categoryNameById.get(t.category_id) ?? null) : null
                    }
                    onClick={() =>
                      navigate(
                        `/compliance/checklists?template=${encodeURIComponent(t.slug)}&pack=${encodeURIComponent(t.pack)}`,
                      )
                    }
                  />
                ))}
                {filteredTemplates.length === 0 && (
                  <div className="rounded-xl border border-dashed border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
                    Ingen maler matcher filtrene.
                  </div>
                )}
              </div>
            </div>

            {/* Activity/Executions column */}
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-[15px] font-semibold text-neutral-900">Nylig aktivitet</h2>
                <Link
                  to="/compliance/checklists/aktivitet"
                  className="text-xs font-semibold text-[#1a3d32] hover:underline"
                >
                  Se all aktivitet →
                </Link>
              </div>

              {/* Inline filter chips */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <MiniFilter
                  label="Status"
                  value={actStatus}
                  options={ACT_FILTER_OPTS}
                  onChange={setActStatus}
                />
                {actStatus && (
                  <button
                    onClick={() => setActStatus(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Nullstill
                  </button>
                )}
                <span className="ml-auto text-xs text-neutral-500">
                  {filteredExecutions.length} treff
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                {filteredExecutions.slice(0, 8).map((e) => {
                  const tpl = templateById.get(e.template_id)
                  const catId = tpl?.category_id ?? null
                  return (
                    <ActivityRow
                      key={e.id}
                      execution={e}
                      templateName={tpl?.name ?? null}
                      categoryName={catId ? (categoryNameById.get(catId) ?? null) : null}
                    />
                  )
                })}
                {filteredExecutions.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-neutral-500">
                    Ingen aktivitet matcher filtrene.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
