// /reports/:id — single report. Draft shows a live preview + Publish
// action; published shows the read-only frozen snapshot + share / export /
// unpublish actions.
//
// Layout editing (add / remove / resize widgets) is intentionally not
// wired in this PR — the report inherits its primary scope's defaultLayout
// at create time. Follow-up work hooks the existing
// DashboardEditLayoutPanel / DashboardAddWidgetPanel chrome in here.

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
  Upload,
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
import type { DashboardFilter } from '../../lib/dashboards/dashboardFilters'

// Zod's passthrough() gives a loose-typed ReportModule on the row; cast
// at the boundary into the strict discriminated union the renderer wants.
function asLayout(rows: DashboardLayoutRow['layout']): ReportModule[] {
  return rows as unknown as ReportModule[]
}
import { MultiScopeDatasetsHost } from '../../lib/reports/MultiScopeDatasetsHost'
import {
  snapshotForPublish,
  SnapshotTooLargeError,
} from '../../lib/reports/snapshotDatasets'
import { buildWidgetZip, downloadWidgetZip } from '../../lib/reports/zipExport'

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()

  // Load the report by querying for the primary scope first, then
  // selecting the row by id. The useDashboardLayout hook is scope-bound,
  // so we look up scope_id with a small probe query before mounting it.
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

  if (row.published_at) {
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

  return (
    <DraftReportBuilder
      reportRow={row}
      scopeAccent={scope?.accent}
      reload={dashboard.reload}
      onPublish={async (snapshot) => dashboard.publish({ snapshot })}
    />
  )
}

// ── Draft (live preview + publish) ─────────────────────────────────────

function DraftReportBuilder({
  reportRow,
  scopeAccent,
  reload,
  onPublish,
}: {
  reportRow: DashboardLayoutRow
  scopeAccent: string | undefined
  reload: () => Promise<void>
  onPublish: (snapshot: Record<string, unknown>) => Promise<{ ok: boolean; shareToken: string | null; error: string | null }>
}) {
  const { supabase, organization } = useOrgSetupContext()
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [liveDatasets, setLiveDatasets] = useState<Record<string, unknown>>({})

  const scopes = useMemo(
    () => [reportRow.scope_id, ...reportRow.report_scopes],
    [reportRow.scope_id, reportRow.report_scopes],
  )

  const handlePublish = useCallback(async () => {
    setError(null)
    setPublishing(true)
    try {
      const snap = snapshotForPublish(liveDatasets)
      const result = await onPublish(snap)
      if (!result.ok) {
        setError(result.error ?? 'Publisering feilet.')
      } else {
        await reload()
      }
    } catch (err) {
      if (err instanceof SnapshotTooLargeError) {
        setError(`Snapshotet er for stort (${(err.bytes / 1024 / 1024).toFixed(2)} MB). Reduser antall widgets eller scope.`)
      } else {
        setError((err as Error).message)
      }
    } finally {
      setPublishing(false)
    }
  }, [liveDatasets, onPublish, reload])

  return (
    <MultiScopeDatasetsHost
      supabase={supabase}
      organizationId={organization?.id ?? null}
      filters={(reportRow.filters as DashboardFilter[]) ?? []}
      scopes={scopes}
    >
      {(merged) => {
        // Capture the latest merged map for the publish action without
        // triggering re-renders inside the host.
        if (merged !== liveDatasets) {
          // Schedule async setState so we don't update during render.
          queueMicrotask(() => setLiveDatasets(merged))
        }
        return (
          <ModuleAnalyticsDashboard
            breadcrumb={[{ label: 'Rapporter', to: '/reports' }, { label: reportRow.name }]}
            title={reportRow.name}
            description={reportRow.description ?? 'Kladd — ikke publisert ennå. Forhåndsvisning av live data.'}
            accent={scopeAccent}
            layout={asLayout(reportRow.layout)}
            datasets={merged}
            headerActions={
              <div className="flex items-center gap-2">
                <Link
                  to="/reports"
                  className="inline-flex items-center gap-2 rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
                >
                  <ArrowLeft className="h-4 w-4" /> Tilbake
                </Link>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handlePublish}
                  disabled={publishing}
                  icon={<Upload className="h-4 w-4" />}
                >
                  {publishing ? 'Publiserer …' : 'Publiser snapshot'}
                </Button>
              </div>
            }
            error={error ?? null}
          />
        )
      }}
    </MultiScopeDatasetsHost>
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

  async function handleCopy() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      // ignore
    }
  }

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
              onClick={handleCopy}
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
