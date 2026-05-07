// Compliance Checklists analytics — first consumer of the new
// ModuleAnalyticsDashboard runtime + dashboardRegistry.
//
// The page resolves datasets from useChecklistModule and hands them to
// the runtime alongside the registered default layout. Phase 1 (this
// commit): pure refactor — no UX change. Phase 2 will swap the default
// layout for a persisted dashboard_layouts row when one exists. Phase 3
// adds the Edit Layout / Add Widget callbacks the runtime already has
// hooks for.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../src/components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../src/components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../src/components/module/dashboard/DashboardAddWidgetPanel'
import { useLicensedPacks } from '../../src/context/packContextValue'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import {
  CHECKLIST_DASHBOARD_SCOPE_ID,
  // Side-effect import: registers the scope on module load.
} from './dashboards/checklistDashboardScope'
import './dashboards/checklistDashboardScope'
import { useDashboardLayout } from '../../src/lib/dashboards/useDashboardLayout'
import { useChecklistModule } from './useChecklistModule'
import type { ComplianceSeverity } from './types'
import type { ReportModule } from '../../src/types/reportBuilder'

export function ChecklistsAnalysePage() {
  const { supabase } = useOrgSetupContext()
  const cl = useChecklistModule({ supabase })
  const packs = useLicensedPacks()

  const { load } = cl
  useEffect(() => {
    void load()
  }, [load])

  const datasets = useMemo(() => {
    const now = new Date()
    const yearStart = new Date(now.getFullYear(), 0, 1)

    let total = 0
    let open = 0
    let signed = 0
    let ytd = 0
    const statusCounts: Record<string, number> = { Kladd: 0, Aktiv: 0, Signert: 0 }
    const packCounts: Record<string, number> = {}
    const templateCounts = new Map<string, number>()

    for (const e of cl.executions) {
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

      const packLabel =
        packs.find((p) => p.slug === e.pack)?.shortName ?? e.pack
      packCounts[packLabel] = (packCounts[packLabel] ?? 0) + 1

      const tpl = cl.templates.find((t) => t.id === e.template_id)
      const tplName = tpl?.name ?? 'Ukjent mal'
      templateCounts.set(tplName, (templateCounts.get(tplName) ?? 0) + 1)
    }

    const sev: Record<ComplianceSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }
    let findings = 0
    let critical = 0
    for (const list of Object.values(cl.responsesByExecutionId)) {
      for (const r of list) {
        if (r.is_finding) {
          findings += 1
          if (r.severity) sev[r.severity] = (sev[r.severity] ?? 0) + 1
          if (r.severity === 'critical') critical += 1
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
    } as Record<string, unknown>
  }, [cl.executions, cl.responsesByExecutionId, cl.templates, packs])

  // Layout: persisted dashboard_layouts row when one exists, otherwise
  // the registry default. Either way bar widgets with empty seriesKeys
  // get their keys filled from the live dataset so the bar renders.
  const dashboard = useDashboardLayout({ supabase, scopeId: CHECKLIST_DASHBOARD_SCOPE_ID })
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
          <Link
            to="/compliance/checklists"
            className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
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
    </>
  )
}
