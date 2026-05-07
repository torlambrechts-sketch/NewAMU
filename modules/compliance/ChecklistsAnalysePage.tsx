// Compliance Checklists analytics — first consumer of the new
// ModuleAnalyticsDashboard runtime + dashboardRegistry.
//
// The page owns the source data (executions, responses, templates) and
// computes the registry's published datasets from it. Filter chips
// (DashboardFilterBar inside the runtime) are persisted as part of
// dashboard_layouts.filters; chip changes re-run the dataset compute
// against a filtered subset of executions / responses.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../src/components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../src/components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../src/components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../src/components/module/dashboard/DashboardEditWidgetPanel'
import { DashboardWidgetMenu } from '../../src/components/module/dashboard/DashboardWidgetMenu'
import { defaultCompatibleKinds } from '../../src/components/module/dashboard/dashboardWidgetKinds'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import {
  CHECKLIST_DASHBOARD_SCOPE_ID,
  // Side-effect import: registers the scope on module load.
} from './dashboards/checklistDashboardScope'
import './dashboards/checklistDashboardScope'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { useChecklistModule } from './useChecklistModule'
import type {
  ComplianceExecutionRow,
  ComplianceResponseRow,
  ComplianceSeverity,
} from './types'
import type { ReportModule } from '../../src/types/reportBuilder'
import type {
  DashboardDimension,
  DashboardFilter,
} from '../../src/lib/dashboards/dashboardFilters'

const STATUS_OPTIONS = [
  { id: 'draft', label: 'Kladd' },
  { id: 'active', label: 'Aktiv' },
  { id: 'signed', label: 'Signert' },
] as const

const SEVERITY_OPTIONS: { id: ComplianceSeverity; label: string }[] = [
  { id: 'low', label: 'Lav' },
  { id: 'medium', label: 'Middels' },
  { id: 'high', label: 'Høy' },
  { id: 'critical', label: 'Kritisk' },
]

/**
 * Reduce a filter list to a typed selector usable by the dataset
 * compute. Centralised here so filter semantics (especially "is" vs
 * "in" vs "is_not") stay consistent across the bucket loops below.
 */
type FilterSelectors = {
  packs: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  templates: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  statuses: { ids: Set<string>; mode: 'include' | 'exclude' } | null
  severities: { ids: Set<ComplianceSeverity>; mode: 'include' | 'exclude' } | null
  from: Date | null
  to: Date | null
}

function buildSelectors(filters: DashboardFilter[]): FilterSelectors {
  const out: FilterSelectors = {
    packs: null,
    templates: null,
    statuses: null,
    severities: null,
    from: null,
    to: null,
  }
  const setOf = <T extends string>(v: unknown): Set<T> =>
    new Set(Array.isArray(v) ? (v as T[]) : typeof v === 'string' && v ? [v as T] : [])

  for (const f of filters) {
    const mode = f.operator === 'is_not' ? 'exclude' : 'include'
    if (f.dimensionId === 'pack') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.packs = { ids, mode }
    } else if (f.dimensionId === 'template') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.templates = { ids, mode }
    } else if (f.dimensionId === 'status') {
      const ids = setOf<string>(f.value)
      if (ids.size) out.statuses = { ids, mode }
    } else if (f.dimensionId === 'severity') {
      const ids = setOf<ComplianceSeverity>(f.value)
      if (ids.size) out.severities = { ids, mode }
    } else if (f.dimensionId === 'date') {
      if (f.operator === 'between' && f.value && typeof f.value === 'object') {
        const r = f.value as { from?: string; to?: string }
        if (r.from) out.from = new Date(r.from)
        if (r.to) out.to = new Date(r.to + 'T23:59:59')
      } else if (f.operator === 'after' && typeof f.value === 'string' && f.value) {
        out.from = new Date(f.value)
      } else if (f.operator === 'before' && typeof f.value === 'string' && f.value) {
        out.to = new Date(f.value + 'T23:59:59')
      }
    }
  }
  return out
}

const matchesSet = <T,>(s: { ids: Set<T>; mode: 'include' | 'exclude' } | null, v: T): boolean => {
  if (!s) return true
  return s.mode === 'include' ? s.ids.has(v) : !s.ids.has(v)
}

const dateInRange = (d: Date | null, from: Date | null, to: Date | null): boolean => {
  if (!d) return true
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

export function ChecklistsAnalysePage() {
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const packs = useLicensedPacks()

  const { load } = cl
  useEffect(() => {
    void load()
  }, [load])

  const dashboard = useDashboardLayout({ supabase, scopeId: CHECKLIST_DASHBOARD_SCOPE_ID })

  // Filter dimensions are page-side because their loadOptions need
  // live org data (packs, templates). Status + severity + date are
  // static and could move to the registry; we keep them together here
  // for cohesion.
  const dimensions: DashboardDimension[] = useMemo(
    () => [
      {
        id: 'pack',
        label: 'Pakke',
        description: 'Begrens til en eller flere regulative pakker.',
        kind: 'enum',
        defaultOperator: 'in',
        loadOptions: () => packs.map((p) => ({ id: p.slug, label: p.shortName })),
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
        id: 'date',
        label: 'Periode',
        description: 'Filter på opprettet/signert dato.',
        kind: 'date_range',
        defaultOperator: 'between',
      },
    ],
    [packs, cl.templates],
  )

  const datasets = useMemo(() => {
    const sel = buildSelectors(dashboard.filters)

    // Filter executions first; nearly every dataset is downstream of
    // this set. Apply pack / template / status / date filters.
    const executions = cl.executions.filter((e: ComplianceExecutionRow) => {
      if (!matchesSet(sel.packs, e.pack)) return false
      if (!matchesSet(sel.templates, e.template_id)) return false
      if (!matchesSet(sel.statuses, e.status)) return false
      if (sel.from || sel.to) {
        const at = e.signed_at ? new Date(e.signed_at) : e.created_at ? new Date(e.created_at) : null
        if (!dateInRange(at, sel.from, sel.to)) return false
      }
      return true
    })
    const execIds = new Set(executions.map((e) => e.id))

    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    let total = 0
    let open = 0
    let signed = 0
    let ytd = 0
    const statusCounts: Record<string, number> = { Kladd: 0, Aktiv: 0, Signert: 0 }
    const packCounts: Record<string, number> = {}
    const templateCounts = new Map<string, number>()

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = (d: Date) =>
      d.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' })
    const months: { key: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({ key: monthKey(d), label: monthLabel(d) })
    }
    const execByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))
    const findByMonth = new Map<string, number>(months.map((m) => [m.key, 0]))

    for (const e of executions) {
      total += 1
      if (e.status === 'signed') {
        signed += 1
        statusCounts.Signert = (statusCounts.Signert ?? 0) + 1
        if (e.signed_at && new Date(e.signed_at) >= yearStart) ytd += 1
      } else if (e.status === 'active') {
        open += 1
        statusCounts.Aktiv = (statusCounts.Aktiv ?? 0) + 1
      } else {
        open += 1
        statusCounts.Kladd = (statusCounts.Kladd ?? 0) + 1
      }

      const packLabel = packs.find((p) => p.slug === e.pack)?.shortName ?? e.pack
      packCounts[packLabel] = (packCounts[packLabel] ?? 0) + 1

      const tpl = cl.templates.find((t) => t.id === e.template_id)
      const tplName = tpl?.name ?? 'Ukjent mal'
      templateCounts.set(tplName, (templateCounts.get(tplName) ?? 0) + 1)

      const created = e.created_at ? new Date(e.created_at) : null
      if (created) {
        const k = monthKey(created)
        if (execByMonth.has(k)) execByMonth.set(k, (execByMonth.get(k) ?? 0) + 1)
      }
    }

    const sev: Record<ComplianceSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }
    let findings = 0
    let critical = 0
    for (const [execId, list] of Object.entries(cl.responsesByExecutionId)) {
      if (!execIds.has(execId)) continue
      for (const r of list as ComplianceResponseRow[]) {
        if (!r.is_finding) continue
        if (r.severity && !matchesSet(sel.severities, r.severity)) continue
        findings += 1
        if (r.severity) sev[r.severity] = (sev[r.severity] ?? 0) + 1
        if (r.severity === 'critical') critical += 1
        const at = r.created_at ? new Date(r.created_at) : null
        if (at) {
          const k = monthKey(at)
          if (findByMonth.has(k)) findByMonth.set(k, (findByMonth.get(k) ?? 0) + 1)
        }
      }
    }

    const topTemplates = [...templateCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const templateBar: Record<string, number> = {}
    for (const [name, count] of topTemplates) templateBar[name] = count

    return {
      checklist_kpi_summary: {
        total,
        open,
        signed,
        ytd,
        findings,
        critical,
      },
      checklist_executions_by_status: statusCounts,
      checklist_findings_by_severity: {
        Lav: sev.low,
        Middels: sev.medium,
        Høy: sev.high,
        Kritisk: sev.critical,
      },
      checklist_executions_by_template: templateBar,
      checklist_executions_by_pack: packCounts,
      checklist_executions_over_time: months.map((m) => ({
        x: m.label,
        y: execByMonth.get(m.key) ?? 0,
      })),
      checklist_findings_over_time: months.map((m) => ({
        x: m.label,
        y: findByMonth.get(m.key) ?? 0,
      })),
    } as Record<string, unknown>
  }, [cl.executions, cl.responsesByExecutionId, cl.templates, packs, dashboard.filters])

  // Layout: persisted dashboard_layouts row when one exists, otherwise
  // the registry default. Either way bar widgets with empty seriesKeys
  // get their keys filled from the live dataset so the bar renders.
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

  const empty =
    cl.executions.length === 0 ? (
      <div className="rounded-md border border-dashed border-neutral-300 bg-white p-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
        <p className="mt-3 text-sm text-neutral-600">
          Ingen sjekklister å analysere ennå. Opprett eller signer en kjøring for å se
          tallene her.
        </p>
      </div>
    ) : null

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)

  const widgetControlSlot = (m: ReportModule) => (
    <DashboardWidgetMenu
      ariaLabel={`Meny for widget ${m.title}`}
      onEdit={() => setEditWidget(m)}
      onDuplicate={() => {
        const dup = { ...m, id: cryptoUuid(), title: `${m.title} (kopi)` }
        void dashboard.saveLayout([...dashboard.layout, dup])
      }}
      onRemove={() => {
        if (!window.confirm(`Fjerne widgeten «${m.title}»?`)) return
        void dashboard.saveLayout(dashboard.layout.filter((x) => x.id !== m.id))
      }}
    />
  )

  return (
    <>
      <ModuleAnalyticsDashboard
        breadcrumb={[
          { label: 'HMS' },
          { label: 'Sjekklister', to: '/compliance/checklists' },
          { label: 'Analyse' },
        ]}
        title="Analyse"
        description="Volum, status, alvorlighetsgrader og malbruk på tvers av alle sjekklistepakker."
        headerActions={
          // Match the Button component's default secondary size so this
          // sits flush with "Rediger oppsett" / "Legg til widget" added
          // by ModuleAnalyticsDashboard.
          <Link
            to="/compliance/checklists"
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </Link>
        }
        layout={layout}
        datasets={datasets}
        loading={cl.loading || dashboard.loading}
        error={cl.error ?? dashboard.error}
        emptyState={empty}
        onEdit={() => setEditOpen(true)}
        onAddWidget={() => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
        filters={dashboard.filters}
        dimensions={dimensions}
        onFiltersChange={(next) => void dashboard.saveFilters(next)}
      />

      <DashboardEditLayoutPanel
        open={editOpen}
        onClose={() => setEditOpen(false)}
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
          const dup = { ...w, id: cryptoUuid(), title: `${w.title} (kopi)` }
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
  )
}

const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
function cryptoUuid(): string {
  if (typeof cryptoLike?.randomUUID === 'function') return cryptoLike.randomUUID()
  return `w_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}
