// ComplianceCompanyPage — selskaps-bred compliance-oversikt.
//
// Brukes både som dedikert side under HMS-oversikt og som admin-tab.

import { useMemo, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { DashboardEditLayoutPanel } from '../../components/module/dashboard/DashboardEditLayoutPanel'
import { DashboardAddWidgetPanel } from '../../components/module/dashboard/DashboardAddWidgetPanel'
import { DashboardEditWidgetPanel } from '../../components/module/dashboard/DashboardEditWidgetPanel'
import { useDashboardEditChrome } from '../../components/module/dashboard/useDashboardEditChrome'
import { DashboardWidgetMenu } from '../../components/module/dashboard/DashboardWidgetMenu'
import { DashboardChooser } from '../../components/module/dashboard/DashboardChooser'
import { downloadCsv, widgetToCsv } from '../../lib/reports/widgetCsv'
import { defaultCompatibleKinds } from '../../components/module/dashboard/dashboardWidgetKinds'
import { useDashboardLayout } from '../../lib/dashboards/useDashboardLayout'
import { freshId } from '../../lib/dashboards/freshId'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import { PublishReportButton } from '../../components/reports/PublishReportButton'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import {
  COMPLIANCE_COMPANY_SCOPE_ID,
} from './dashboards/complianceCompanyDashboardScope'
import './dashboards/complianceCompanyDashboardScope'
import { useComplianceCompanyDatasets } from './dashboards/useComplianceDatasets'
import type { ReportModule } from '../../types/reportBuilder'

function downloadAuditCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) {
    alert('Ingen data å eksportere ennå.')
    return
  }
  const keys = Object.keys(rows[0])
  const escape = (v: unknown) =>
    `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ComplianceCompanyPage() {
  const { supabase, organization } = useOrgSetupContext()
  const dashboard = useDashboardLayout({ supabase, scopeId: COMPLIANCE_COMPANY_SCOPE_ID })
  const datasets = useComplianceCompanyDatasets(dashboard.filters)
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  async function exportToTilsynet() {
    if (!supabase || !organization?.id) return
    setExporting(true)
    try {
      const { data, error } = await supabase.rpc('compliance_company_audit_export', {
        p_org_id: organization.id,
      })
      if (error) throw error
      const stamp = new Date().toISOString().split('T')[0]
      downloadAuditCsv(
        (data ?? []) as Record<string, unknown>[],
        `tilsyns-eksport-${stamp}.csv`,
      )
    } catch (e) {
      alert(`Eksport feilet: ${e instanceof Error ? e.message : 'ukjent'}`)
    } finally {
      setExporting(false)
    }
  }

  async function exportToPdf() {
    if (!supabase || !organization?.id) return
    setExportingPdf(true)
    try {
      const { data, error } = await supabase.functions.invoke('compliance-audit-pdf', {
        body: { org_id: organization.id },
      })
      if (error) throw error
      // Data fra invoke kommer som ArrayBuffer/Blob når Content-Type er application/pdf
      const blob = data instanceof Blob ? data : new Blob([data as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().split('T')[0]
      a.download = `tilsyns-eksport-${stamp}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(`PDF-eksport feilet: ${e instanceof Error ? e.message : 'ukjent'}`)
    } finally {
      setExportingPdf(false)
    }
  }

  const layout = useMemo(
    () =>
      dashboard.layout.map((m) => {
        if (m.kind === 'bar' && m.seriesKeys.length === 0) {
          const ds = datasets[m.datasetKey] as Record<string, unknown> | undefined
          return { ...m, seriesKeys: ds && typeof ds === 'object' ? Object.keys(ds) : [] }
        }
        return m
      }),
    [dashboard.layout, datasets],
  )

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editWidget, setEditWidget] = useState<ReportModule | null>(null)
  const editChrome = useDashboardEditChrome({
    scopeId: COMPLIANCE_COMPANY_SCOPE_ID,
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

  return (
    <>
      <ModuleAnalyticsDashboard
        accent={getDashboardScope(COMPLIANCE_COMPANY_SCOPE_ID)?.accent}
        breadcrumb={[{ label: 'Oversikt', to: '/overview/hms' }, { label: 'Compliance — selskap' }]}
        title="Compliance — selskap"
        description="Alle krav på tvers av moduler, hvem som er ansvarlig, og status. Inkluderer ærlig liste over IKKE-dekkede lovkrav."
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
            <button
              type="button"
              onClick={exportToTilsynet}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exporting ? 'Eksporterer…' : 'CSV'}
            </button>
            <button
              type="button"
              onClick={exportToPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-100 px-4 py-2 text-sm font-semibold text-red-900 transition-colors hover:bg-red-200 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              {exportingPdf ? 'Genererer PDF…' : 'Tilsyns-rapport (PDF)'}
            </button>
            <PublishReportButton
              sourceDashboardId={dashboard.row?.id ?? null}
              sourceDashboardName={dashboard.row?.name ?? null}
              scopeId={COMPLIANCE_COMPANY_SCOPE_ID}
              scopeLabel="Selskaps-compliance"
              datasets={datasets}
              ensureSavedRow={dashboard.ensureSavedRow}
            />
          </div>
        }
        layout={layout}
        datasets={datasets}
        loading={dashboard.loading}
        error={dashboard.error}
        onAddWidget={editChrome.editMode ? undefined : () => setAddOpen(true)}
        widgetControlSlot={widgetControlSlot}
        onResize={(w, next) =>
          void dashboard.saveLayout(
            dashboard.layout.map((x) => (x.id === w.id ? { ...x, colSpan: next } : x)),
          )
        }
        {...editChrome.moduleProps}
        filters={dashboard.filters}
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
        scopeId={COMPLIANCE_COMPANY_SCOPE_ID}
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
  )
}
