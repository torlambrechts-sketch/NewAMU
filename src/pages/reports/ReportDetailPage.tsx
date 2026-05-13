// /reports/:id — view a published report snapshot. Since reports are
// now created directly from a dashboard's "Lag rapport" button via the
// publish_dashboard_as_report RPC, this page only ever sees published
// rows. If a row exists but is unpublished (someone clicked Avpubliser
// in the panel), we surface a thin "republish from source dashboard"
// hint instead of rendering an empty frame.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileDown,
  RotateCcw,
  Share2,
} from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import {
  useDashboardLayout,
  type DashboardLayoutRow,
} from '../../lib/dashboards/useDashboardLayout'
import type { ReportModule } from '../../types/reportBuilder'
import { buildWidgetZip, downloadWidgetZip } from '../../lib/reports/zipExport'

// Zod's passthrough() gives a loose-typed ReportModule on the row; cast
// at the boundary into the strict discriminated union the renderer wants.
function asLayout(rows: DashboardLayoutRow['layout']): ReportModule[] {
  return rows as unknown as ReportModule[]
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()

  // The hook is scope-bound, so probe scope_id first.
  const [probeScope, setProbeScope] = useState<string | null>(null)
  const [probeError, setProbeError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!supabase || !organization?.id || !id) return
    void supabase
      .from('dashboard_layouts')
      .select('scope_id')
      .eq('id', id)
      .eq('organization_id', organization.id)
      .eq('kind', 'report')
      .is('deleted_at', null)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setProbeError('Rapporten finnes ikke eller du har ikke tilgang.')
        else setProbeScope(data.scope_id)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, organization?.id, id])

  if (probeError) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'Rapporter', to: '/reports' }]}
        title="Rapport ikke funnet"
      >
        <WarningBox>{probeError}</WarningBox>
        <Link to="/reports" className="text-sm text-blue-600 hover:underline">
          ← Tilbake til rapportlista
        </Link>
      </ModulePageShell>
    )
  }
  if (!probeScope) {
    return (
      <ModulePageShell breadcrumb={[{ label: 'Rapporter', to: '/reports' }]} title="Laster rapport…">
        <p className="py-12 text-center text-sm text-neutral-500">Laster …</p>
      </ModulePageShell>
    )
  }

  return (
    <ReportDetailLoaded
      reportId={id!}
      scopeId={probeScope}
      onBack={() => navigate('/reports')}
    />
  )
}

function ReportDetailLoaded({
  reportId,
  scopeId,
}: {
  reportId: string
  scopeId: string
  onBack: () => void
}) {
  const { supabase } = useOrgSetupContext()
  const dashboard = useDashboardLayout({ supabase, scopeId, kindFilter: 'report' })
  const scope = useMemo(() => getDashboardScope(scopeId), [scopeId])

  // Select the requested report once it's in `available`.
  useEffect(() => {
    if (dashboard.row?.id === reportId) return
    const target = dashboard.available.find((r) => r.id === reportId)
    if (target) dashboard.selectLayout(reportId)
  }, [reportId, dashboard.available, dashboard.row?.id, dashboard])

  const row = dashboard.row
  if (!row || row.id !== reportId) {
    return (
      <ModulePageShell breadcrumb={[{ label: 'Rapporter', to: '/reports' }]} title="Laster rapport…">
        <p className="py-12 text-center text-sm text-neutral-500">Laster …</p>
      </ModulePageShell>
    )
  }

  if (!row.published_at) {
    return <UnpublishedReportPlaceholder reportRow={row} scopeId={scopeId} />
  }

  return (
    <PublishedReportView
      reportRow={row}
      scopeAccent={scope?.accent}
      onUnpublish={async () => {
        await dashboard.unpublish()
      }}
      onRegenerateToken={async () => {
        await dashboard.regenerateShareToken()
      }}
    />
  )
}

// ── Unpublished placeholder ────────────────────────────────────────────
//
// Reports start life as published rows (the publish_dashboard_as_report
// RPC mints them in one shot). They become unpublished only when an
// admin clicks Avpubliser, which clears share_token but keeps the
// snapshot. The placeholder points them back at the source dashboard.

function UnpublishedReportPlaceholder({
  reportRow,
  scopeId,
}: {
  reportRow: DashboardLayoutRow
  scopeId: string
}) {
  const sourceDashboardId =
    (reportRow.cover_meta as Record<string, unknown> | null)?.source_dashboard_id ?? null
  const sourceDashboardName =
    (reportRow.cover_meta as Record<string, unknown> | null)?.source_dashboard_name ?? null
  const scope = useMemo(() => getDashboardScope(scopeId), [scopeId])
  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Rapporter', to: '/reports' }, { label: reportRow.name }]}
      title={reportRow.name}
      description="Denne rapporten er avpublisert. Snapshotet beholdes som kladd, men dele-lenken er deaktivert."
    >
      <div className="rounded-md border border-neutral-200 bg-neutral-50 p-6 text-sm">
        <p>
          Avpublisert {reportRow.updated_at ? new Date(reportRow.updated_at).toLocaleString('nb-NO') : ''}.
        </p>
        {typeof sourceDashboardId === 'string' && typeof sourceDashboardName === 'string' ? (
          <p className="mt-2 text-neutral-600">
            Gå tilbake til kildedashbordet{' '}
            <span className="font-medium">{sourceDashboardName}</span> og publiser et nytt
            snapshot derfra om du vil dele en oppdatert versjon.
          </p>
        ) : (
          <p className="mt-2 text-neutral-600">
            Gå tilbake til kildedashbordet og publiser et nytt snapshot derfra om du vil dele en
            oppdatert versjon.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" /> Til rapportarkivet
          </Link>
          {scope ? (
            <span className="text-xs text-neutral-500">
              Scope: {scope.label}
            </span>
          ) : null}
        </div>
      </div>
    </ModulePageShell>
  )
}

// ── Published (snapshot view + actions) ────────────────────────────────

function PublishedReportView({
  reportRow,
  scopeAccent,
  onUnpublish,
  onRegenerateToken,
}: {
  reportRow: DashboardLayoutRow
  scopeAccent: string | undefined
  onUnpublish: () => Promise<void>
  onRegenerateToken: () => Promise<void>
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shareUrl =
    reportRow.share_token && typeof window !== 'undefined'
      ? `${window.location.origin}/r/${reportRow.share_token}`
      : null

  const snapshotDatasets = (reportRow.snapshot_data as Record<string, unknown>) ?? {}

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      // ignore
    }
  }, [shareUrl])

  function handleCsvZip() {
    const payload = buildWidgetZip(reportRow.name, asLayout(reportRow.layout), snapshotDatasets)
    downloadWidgetZip(payload)
  }

  async function handleUnpublish() {
    setBusy(true)
    setError(null)
    try {
      await onUnpublish()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate() {
    setBusy(true)
    setError(null)
    try {
      await onRegenerateToken()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModuleAnalyticsDashboard
      breadcrumb={[{ label: 'Rapporter', to: '/reports' }, { label: reportRow.name }]}
      title={reportRow.name}
      description={reportRow.description ?? undefined}
      accent={scopeAccent}
      layout={asLayout(reportRow.layout)}
      datasets={snapshotDatasets}
      readOnly
      snapshotMode
      snapshotAt={reportRow.snapshot_at ?? undefined}
      snapshotWatermark="Frosset snapshot — endringer i kildedata påvirker ikke denne rapporten."
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            <ArrowLeft className="h-4 w-4" /> Tilbake
          </Link>
          <Button
            type="button"
            variant="secondary"
            onClick={handleCsvZip}
            icon={<Download className="h-4 w-4" />}
          >
            CSV (.zip)
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled
            title="Tilgjengelig når PDF-render edge-funksjonen er deployet."
            icon={<FileDown className="h-4 w-4" />}
          >
            PDF
          </Button>
          {shareUrl ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCopy()}
              icon={copyState === 'copied' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            >
              {copyState === 'copied' ? 'Kopiert!' : 'Kopier delelink'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={handleRegenerate}
            disabled={busy}
            icon={<Share2 className="h-4 w-4" />}
          >
            Ny delelink
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleUnpublish}
            disabled={busy}
            icon={<RotateCcw className="h-4 w-4" />}
          >
            Avpubliser
          </Button>
        </div>
      }
      error={error ?? null}
    />
  )
}
