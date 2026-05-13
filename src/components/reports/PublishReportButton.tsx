// "Lag rapport" — in-dashboard publish action. Snapshots the current
// dataset map + layout into a kind='report' row via the
// publish_dashboard_as_report RPC, mints a share token, and surfaces
// the share URL inline. Below the form it lists existing published
// reports for this scope so users can manage older snapshots without
// hopping to /reports.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileBarChart,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { SlidePanel } from '../layout/SlidePanel'
import { Button } from '../ui/Button'
import { WarningBox } from '../ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import {
  snapshotForPublish,
  SnapshotTooLargeError,
} from '../../lib/reports/snapshotDatasets'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'

type Props = {
  /** The currently-loaded dashboard row id, or null if no row exists yet
   *  (fresh dashboard rendering the registry default). When null the
   *  button auto-materializes a row via `ensureSavedRow` on first publish. */
  sourceDashboardId: string | null
  /** The active dashboard's name — used as the default report name. */
  sourceDashboardName: string | null
  /** Scope id for filtering the per-scope report list. */
  scopeId: string
  /** Scope label, used as a fallback when sourceDashboardName is null. */
  scopeLabel?: string
  /** Live dataset map — frozen into snapshot_data at publish time. */
  datasets: Record<string, unknown>
  /**
   * Callback that materializes a dashboard_layouts row for this scope if
   * none exists yet, returning the row id. Wired from
   * `useDashboardLayout().ensureSavedRow`.
   */
  ensureSavedRow?: () => Promise<string | null>
}

type ReportListRow = {
  id: string
  name: string
  description: string | null
  published_at: string | null
  share_token: string | null
  share_expires_at: string | null
  updated_at: string
  version: number
  cover_meta: Record<string, unknown>
}

type PublishResult = {
  ok: boolean
  report_id: string | null
  share_token: string | null
  err: string | null
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultReportName(dashboardName: string | null, scopeLabel: string | undefined): string {
  const base = dashboardName?.trim() || scopeLabel?.trim() || 'Rapport'
  return `${base} – ${new Date().toLocaleDateString('nb-NO')}`
}

function errorMessage(code: string | null): string {
  switch (code) {
    case 'not_authenticated':
      return 'Du er ikke logget inn.'
    case 'forbidden':
      return 'Du mangler tilgang til å publisere rapporter (reports.manage).'
    case 'not_found':
      return 'Kunne ikke finne dashbordet å publisere fra.'
    case 'source_must_be_dashboard':
      return 'Bare lagrede dashboards kan publiseres som rapport.'
    case 'snapshot_required':
      return 'Snapshotet manglet eller er ugyldig.'
    case 'snapshot_too_large':
      return 'Snapshotet er for stort (over 4 MB). Reduser antall widgets eller filter.'
    case 'name_required':
      return 'Rapporten må ha et navn.'
    default:
      return code ?? 'Ukjent feil ved publisering.'
  }
}

export function PublishReportButton({
  sourceDashboardId,
  sourceDashboardName,
  scopeId,
  scopeLabel,
  datasets,
  ensureSavedRow,
}: Props) {
  const { supabase, organization } = useOrgSetupContext()
  const [open, setOpen] = useState(false)
  const canPublish = Boolean(sourceDashboardId || ensureSavedRow)

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        icon={<FileBarChart className="h-4 w-4" />}
        onClick={() => setOpen(true)}
        disabled={!canPublish}
        title={
          canPublish
            ? undefined
            : 'Dashbordet kan ikke publiseres ennå.'
        }
      >
        Lag rapport
      </Button>
      {open ? (
        <PublishReportPanel
          open={open}
          onClose={() => setOpen(false)}
          supabase={supabase}
          organizationId={organization?.id ?? null}
          sourceDashboardId={sourceDashboardId}
          sourceDashboardName={sourceDashboardName}
          scopeId={scopeId}
          scopeLabel={scopeLabel}
          datasets={datasets}
          ensureSavedRow={ensureSavedRow}
        />
      ) : null}
    </>
  )
}

function PublishReportPanel({
  open,
  onClose,
  supabase,
  organizationId,
  sourceDashboardId,
  sourceDashboardName,
  scopeId,
  scopeLabel,
  datasets,
  ensureSavedRow,
}: {
  open: boolean
  onClose: () => void
  supabase: ReturnType<typeof useOrgSetupContext>['supabase']
  organizationId: string | null
  sourceDashboardId: string | null
  sourceDashboardName: string | null
  scopeId: string
  scopeLabel?: string
  datasets: Record<string, unknown>
  ensureSavedRow?: () => Promise<string | null>
}) {
  const [name, setName] = useState(() => defaultReportName(sourceDashboardName, scopeLabel))
  const [description, setDescription] = useState('')
  const [password, setPassword] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ reportId: string; shareUrl: string } | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const [reports, setReports] = useState<ReportListRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  // Snapshot "now" at mount so the expired-badge stays deterministic across
  // re-renders (react-hooks/purity disallows raw Date.now() in the render
  // body). Refresh per panel open is sufficient — share_expires_at is a
  // calendar date, not a per-second clock.
  const [nowMs] = useState(() => Date.now())

  const fetchReports = useCallback(async () => {
    if (!supabase || !organizationId) return
    setListLoading(true)
    setListError(null)
    const { data, error: e } = await supabase
      .from('dashboard_layouts')
      .select(
        'id,name,description,published_at,share_token,share_expires_at,updated_at,version,cover_meta',
      )
      .eq('organization_id', organizationId)
      .eq('scope_id', scopeId)
      .eq('kind', 'report')
      .is('deleted_at', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
    if (e) {
      setListError(getSupabaseErrorMessage(e))
      setListLoading(false)
      return
    }
    setReports((data ?? []) as ReportListRow[])
    setListLoading(false)
  }, [supabase, organizationId, scopeId])

  useEffect(() => {
    if (open) void fetchReports()
  }, [open, fetchReports])

  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }, [])

  const handlePublish = useCallback(async () => {
    if (!supabase) return
    setPublishing(true)
    setError(null)
    setSuccess(null)
    try {
      // On a fresh dashboard the registry default renders without a
      // dashboard_layouts row. Materialize one so publish_dashboard_as_report
      // has a source to clone from.
      let sourceId = sourceDashboardId
      if (!sourceId) {
        if (!ensureSavedRow) {
          setError('Dashbordet kan ikke publiseres ennå.')
          return
        }
        sourceId = await ensureSavedRow()
        if (!sourceId) {
          setError('Kunne ikke lagre dashbordet før publisering.')
          return
        }
      }

      const snapshot = snapshotForPublish(datasets)
      const { data, error: e } = await supabase.rpc('publish_dashboard_as_report', {
        p_source_id: sourceId,
        p_name: name,
        p_description: description.trim() || null,
        p_snapshot: snapshot,
        p_share_password: password.trim() || null,
        p_share_expires_at: expiresOn ? `${expiresOn}T23:59:59Z` : null,
      })
      if (e) throw e
      const row = (Array.isArray(data) ? data[0] : data) as PublishResult | null
      if (!row?.ok || !row.report_id || !row.share_token) {
        setError(errorMessage(row?.err ?? null))
        return
      }
      const shareUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}/r/${row.share_token}`
          : `/r/${row.share_token}`
      setSuccess({ reportId: row.report_id, shareUrl })
      await fetchReports()
    } catch (err) {
      if (err instanceof SnapshotTooLargeError) {
        setError(`Snapshotet er ${(err.bytes / 1024 / 1024).toFixed(2)} MB — over 4 MB-grensen. Reduser antall widgets eller filter.`)
      } else {
        setError(getSupabaseErrorMessage(err))
      }
    } finally {
      setPublishing(false)
    }
  }, [supabase, sourceDashboardId, ensureSavedRow, name, description, password, expiresOn, datasets, fetchReports])

  const handleUnpublish = useCallback(
    async (report: ReportListRow) => {
      if (!supabase) return
      const ok = window.confirm(
        `Avpubliser «${report.name}»? Delingslenken slutter å virke umiddelbart, men snapshotet beholdes som kladd.`,
      )
      if (!ok) return
      const { data, error: e } = await supabase.rpc('unpublish_report', {
        p_id: report.id,
        p_expected_version: report.version,
      })
      if (e) {
        setListError(getSupabaseErrorMessage(e))
        return
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row?.ok) {
        setListError(errorMessage(row?.err ?? null))
        return
      }
      await fetchReports()
    },
    [supabase, fetchReports],
  )

  const formDisabled = publishing || (!sourceDashboardId && !ensureSavedRow)

  const headerLabel = useMemo(
    () => (success ? 'Rapport publisert' : 'Lag rapport fra dashbordet'),
    [success],
  )

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="publish-report-panel"
      title={headerLabel}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="secondary" onClick={onClose}>
            {success ? 'Lukk' : 'Avbryt'}
          </Button>
          {!success ? (
            <Button variant="primary" onClick={() => void handlePublish()} disabled={formDisabled}>
              {publishing ? 'Publiserer …' : 'Publiser rapport'}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6 px-5 py-5">
        {error ? <WarningBox>{error}</WarningBox> : null}

        {success ? (
          <PublishedSuccessCard
            shareUrl={success.shareUrl}
            reportId={success.reportId}
            copyState={copyState}
            onCopy={() => void handleCopy(success.shareUrl)}
          />
        ) : (
          <section className="space-y-4">
            <p className="text-sm text-neutral-600">
              Et frosset snapshot av denne visningen lagres som en rapport. Dele-lenken kan beskyttes
              med passord og utløpsdato. Snapshotet endres ikke når dataene i moduler endres senere.
            </p>

            <Field label="Navn" required>
              <input
                type="text"
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="F.eks. HMS-status mai 2026"
              />
            </Field>

            <Field label="Beskrivelse">
              <textarea
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Valgfri — vises i rapportarkivet og på forsiden."
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Passord" hint="Tomt = ingen passordbeskyttelse.">
                <input
                  type="text"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Valgfritt"
                  autoComplete="off"
                />
              </Field>
              <Field label="Utløpsdato" hint="Tomt = lenken utløper ikke.">
                <input
                  type="date"
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                  value={expiresOn}
                  onChange={(e) => setExpiresOn(e.target.value)}
                  min={todayIso()}
                />
              </Field>
            </div>
          </section>
        )}

        <hr className="border-neutral-200" />

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-900">
            Publiserte rapporter for dette dashbordet
          </h3>
          {listError ? <WarningBox>{listError}</WarningBox> : null}
          {listLoading ? (
            <p className="py-6 text-center text-sm text-neutral-500">Laster …</p>
          ) : reports.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-500">
              Ingen tidligere rapporter for dette scope ennå.
            </p>
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => (
                <ReportListItem
                  key={r.id}
                  report={r}
                  onCopy={(url) => void handleCopy(url)}
                  onUnpublish={() => void handleUnpublish(r)}
                  copyState={copyState}
                  nowMs={nowMs}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </SlidePanel>
  )
}

function PublishedSuccessCard({
  shareUrl,
  reportId,
  copyState,
  onCopy,
}: {
  shareUrl: string
  reportId: string
  copyState: 'idle' | 'copied'
  onCopy: () => void
}) {
  return (
    <section className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-700" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-emerald-900">Rapporten er publisert.</p>
          <p className="text-xs text-emerald-800">
            Dele-lenken under er gyldig umiddelbart. Du kan også åpne rapporten i arkivet.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2">
        <code className="flex-1 truncate text-xs text-neutral-700">{shareUrl}</code>
        <Button
          variant="secondary"
          size="sm"
          icon={copyState === 'copied' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          onClick={onCopy}
        >
          {copyState === 'copied' ? 'Kopiert' : 'Kopier'}
        </Button>
      </div>
      <Link
        to={`/reports/${reportId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-emerald-900 hover:underline"
      >
        Åpne i rapportarkiv <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </section>
  )
}

function ReportListItem({
  report,
  onCopy,
  onUnpublish,
  copyState,
  nowMs,
}: {
  report: ReportListRow
  onCopy: (url: string) => void
  onUnpublish: () => void
  copyState: 'idle' | 'copied'
  nowMs: number
}) {
  const shareUrl =
    report.share_token && typeof window !== 'undefined'
      ? `${window.location.origin}/r/${report.share_token}`
      : null
  const expired =
    !!report.share_expires_at &&
    new Date(report.share_expires_at).getTime() < nowMs
  return (
    <li className="rounded-md border border-neutral-200 bg-white px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            to={`/reports/${report.id}`}
            className="text-sm font-medium text-neutral-900 hover:underline"
          >
            {report.name}
          </Link>
          <p className="text-xs text-neutral-500">
            {report.published_at
              ? `Publisert ${new Date(report.published_at).toLocaleDateString('nb-NO')}`
              : 'Kladd'}
            {expired ? ' · utløpt' : ''}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {shareUrl ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCopy(shareUrl)}
              title="Kopier delelenke"
            >
              {copyState === 'copied' ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          ) : null}
          <Link
            to={`/reports/${report.id}`}
            className="inline-flex items-center rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
            title="Åpne rapport"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
          {report.share_token ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onUnpublish}
              title="Avpubliser (lenken slutter å virke)"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onUnpublish}
              title="Slett kladd"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-sm font-medium text-neutral-800">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </span>
      {hint ? <span className="block text-xs text-neutral-500">{hint}</span> : null}
      {children}
    </label>
  )
}
