// /admin/tilsynsbrev/:id — Detail-side per opplastet tilsynsbrev.
//
// Viser:
//   * upload-metadata (regulator, opplasting, parser-kjøretid)
//   * sticky konfidensialitets-banner når confidentiality_level != standard
//   * sammendrag (parsed_payload.summary)
//   * tabell over ekstraherte paragrafer m/ severity, frist, status,
//     lenke til opprettet task hvis noen
//   * per-paragraf «Opprett oppgave for dette pålegget» (kaller RPC
//     tilsynsbrev_create_task_for_paragraph) — med ekstra bekreft-
//     dialog som arver konfidensialitet til den nye oppgaven
//   * «Marker som gjennomgått» (manual_review_status='accepted')
//   * «Kjør på nytt» (re-invoke parser edge function)
//   * «Last ned PDF» (signed URL) — disabled på confidential når
//     brukeren mangler tilsynsbrev.view_confidential
//   * Tilgangslogg (tilsynsbrev_access_log) — append-only forensisk
//     spor som loggføres via RPC tilsynsbrev_log_access().

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  History,
  ListChecks,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { WarningBox } from '../../components/ui/AlertBox'
import { StandardInput } from '../../components/ui/Input'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type SourceType = 'arbeidstilsynet' | 'datatilsynet' | 'helsetilsynet' | 'ukom' | 'ldo' | 'other'
type ParsedStatus = 'pending' | 'parsing' | 'parsed' | 'failed'
type Severity = 'info' | 'observasjon' | 'pålegg' | 'tvangsmulkt'
type ParagraphStatus = 'open' | 'addressed' | 'contested' | 'closed'
type ConfidentialityLevel = 'standard' | 'restricted' | 'confidential'
type AccessAction = 'view' | 'create_task' | 'mark_reviewed' | 're_parse' | 'download'

type UploadRow = {
  id: string
  organization_id: string
  uploaded_at: string
  uploaded_by: string | null
  source_type: SourceType
  storage_path: string
  parsed_status: ParsedStatus
  parsed_at: string | null
  parsed_payload: {
    summary?: string
    regulator?: string
    letterDate?: string | null
    findings?: { description: string; severity?: string; suggestedActions?: string[] }[]
    citedParagraphs?: unknown[]
    error?: string
    message?: string
  } | null
  parser_kind: string | null
  parser_version: string | null
  parser_mode?: 'auto' | 'llm_only' | 'regex_only' | null
  manual_review_status: 'not_reviewed' | 'accepted' | 'edited' | 'rejected'
  confidentiality_level: ConfidentialityLevel
  notes: string | null
}

// Color-code the parser kind so reviewers see at a glance whether the
// extraction is high-fidelity (LLM) or a degraded fallback. The chip
// sits below the title in the metadata card.
function parserKindBadge(kind: string | null): {
  variant: 'success' | 'warning' | 'danger' | 'neutral'
  label: string
  tooltip: string
} {
  if (!kind) return { variant: 'neutral', label: 'Ikke kjørt', tooltip: 'Parser har ikke kjørt enda' }
  if (kind === 'llm:claude') {
    return {
      variant: 'success',
      label: 'LLM (Claude)',
      tooltip: 'Strukturert ekstraksjon via Claude — høyest presisjon',
    }
  }
  if (kind === 'regex:fallback') {
    return {
      variant: 'warning',
      label: 'Regex',
      tooltip: 'Regex-fallback brukt — ingen ANTHROPIC_API_KEY konfigurert',
    }
  }
  if (kind === 'regex:llm_fallback') {
    return {
      variant: 'danger',
      label: 'Regex (LLM feilet)',
      tooltip:
        'LLM-kallet feilet eller returnerte tomt resultat — falt tilbake til regex. Vurder å kjøre på nytt.',
    }
  }
  if (kind === 'regex:rate_limited') {
    return {
      variant: 'warning',
      label: 'Regex (kvote)',
      tooltip:
        'Månedlig LLM-kvote er nådd for organisasjonen — falt tilbake til regex. Kontakt admin for å heve grensen.',
    }
  }
  return { variant: 'neutral', label: kind, tooltip: kind }
}

type ParagraphRow = {
  id: string
  paragraph_ref: string
  excerpt: string | null
  severity: Severity | null
  deadline_at: string | null
  status: ParagraphStatus
  linked_task_id: string | null
}

type AccessLogRow = {
  id: string
  accessed_at: string
  accessed_by: string
  action: AccessAction
  user_label?: string | null
}

const SOURCE_LABELS: Record<SourceType, string> = {
  arbeidstilsynet: 'Arbeidstilsynet',
  datatilsynet: 'Datatilsynet',
  helsetilsynet: 'Statens helsetilsyn',
  ukom: 'UKOM',
  ldo: 'LDO',
  other: 'Annen',
}

const ACTION_LABELS: Record<AccessAction, string> = {
  view: 'Visning',
  create_task: 'Opprettet oppgave',
  mark_reviewed: 'Markert som gjennomgått',
  re_parse: 'Re-parser kjørt',
  download: 'Lastet ned PDF',
}

function severityBadge(s: Severity | null): {
  variant: 'neutral' | 'info' | 'warning' | 'high' | 'critical'
  label: string
} {
  switch (s) {
    case 'tvangsmulkt': return { variant: 'critical', label: 'Tvangsmulkt' }
    case 'pålegg': return { variant: 'high', label: 'Pålegg' }
    case 'observasjon': return { variant: 'warning', label: 'Observasjon' }
    case 'info': return { variant: 'info', label: 'Info' }
    default: return { variant: 'neutral', label: '—' }
  }
}

function paragraphStatusBadge(s: ParagraphStatus): {
  variant: 'neutral' | 'info' | 'warning' | 'success'
  label: string
} {
  switch (s) {
    case 'open': return { variant: 'warning', label: 'Åpen' }
    case 'addressed': return { variant: 'info', label: 'Under arbeid' }
    case 'contested': return { variant: 'warning', label: 'Bestridt' }
    case 'closed': return { variant: 'success', label: 'Lukket' }
  }
}

function confidentialityBadge(level: ConfidentialityLevel): null | {
  label: string
  variant: 'warning' | 'danger'
} {
  if (level === 'restricted') return { label: 'Begrenset', variant: 'warning' }
  if (level === 'confidential') return { label: 'Konfidensielt', variant: 'danger' }
  return null
}

export function TilsynsbrevDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { supabase, organization, can } = useOrgSetupContext()
  const [upload, setUpload] = useState<UploadRow | null>(null)
  const [paragraphs, setParagraphs] = useState<ParagraphRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reparsing, setReparsing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [accessLog, setAccessLog] = useState<AccessLogRow[]>([])
  const [accessLogAvailable, setAccessLogAvailable] = useState<boolean | null>(null)
  const [pendingCreateParagraph, setPendingCreateParagraph] = useState<ParagraphRow | null>(null)

  const canViewConfidential = can('tilsynsbrev.view_confidential')
  const loggedViewRef = useRef<string | null>(null)

  const orgId = organization?.id ?? null

  const logAccess = useCallback(
    async (action: AccessAction) => {
      if (!supabase || !id) return
      try {
        await supabase.rpc('tilsynsbrev_log_access', {
          p_upload_id: id,
          p_action: action,
          p_ip: null,
          p_user_agent:
            typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 250) : null,
        })
      } catch (e) {
        // Logging is best-effort. The application must not block the
        // user action when the RPC is missing (e.g. migration not yet
        // applied) or temporarily fails.
        console.warn('tilsynsbrev_log_access failed', e)
      }
    },
    [supabase, id],
  )

  const loadAccessLog = useCallback(async () => {
    if (!supabase || !id) return
    const { data, error: e } = await supabase
      .from('tilsynsbrev_access_log')
      .select('id, accessed_at, accessed_by, action')
      .eq('upload_id', id)
      .order('accessed_at', { ascending: false })
      .limit(50)
    if (e) {
      // 42P01 = undefined_table → migration not applied yet. Render the
      // placeholder card instead of an error.
      // TODO remove after _125300 propagates — the table is guaranteed
      // to exist on every environment that ran _20260907125300_
      // tilsynsbrev_access_log.sql; this branch will be dead code.
      if (/relation .* does not exist/i.test(e.message) || (e as { code?: string }).code === '42P01') {
        setAccessLogAvailable(false)
        return
      }
      // Any other error is shown; not a crash.
      console.warn('access log load failed', e.message)
      setAccessLogAvailable(false)
      return
    }
    setAccessLogAvailable(true)
    const rows = (data ?? []) as AccessLogRow[]

    // Resolve display names for accessed_by → profile.display_name.
    const uniqueIds = Array.from(new Set(rows.map((r) => r.accessed_by))).filter(Boolean)
    if (uniqueIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', uniqueIds)
      const labelMap = new Map<string, string>(
        (profs ?? []).map((p) => [p.id as string, (p as { display_name?: string }).display_name ?? '']),
      )
      setAccessLog(rows.map((r) => ({ ...r, user_label: labelMap.get(r.accessed_by) ?? null })))
    } else {
      setAccessLog(rows)
    }
  }, [supabase, id])

  const refresh = useCallback(async () => {
    if (!supabase || !id || !orgId) return
    setLoading(true)
    setError(null)
    const [u, p] = await Promise.all([
      supabase
        .from('tilsynsbrev_uploads')
        .select('*')
        .eq('id', id)
        .eq('organization_id', orgId)
        .maybeSingle(),
      supabase
        .from('tilsynsbrev_extracted_paragraphs')
        .select('id, paragraph_ref, excerpt, severity, deadline_at, status, linked_task_id')
        .eq('upload_id', id)
        .order('paragraph_ref', { ascending: true }),
    ])
    if (u.error) setError(u.error.message)
    else setUpload((u.data ?? null) as UploadRow | null)
    if (p.error) setError((prev) => prev ?? p.error.message)
    else setParagraphs((p.data ?? []) as ParagraphRow[])
    setLoading(false)
  }, [supabase, id, orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Log page-load exactly once per upload-id. Strict-mode double-mount
  // is guarded via the ref.
  useEffect(() => {
    if (!upload || !id) return
    if (loggedViewRef.current === id) return
    loggedViewRef.current = id
    void logAccess('view')
    void loadAccessLog()
  }, [upload, id, logAccess, loadAccessLog])

  const summary = useMemo(() => upload?.parsed_payload?.summary ?? '', [upload])
  const findings = useMemo(() => upload?.parsed_payload?.findings ?? [], [upload])
  const confBadge = upload ? confidentialityBadge(upload.confidentiality_level) : null
  const isConfidential = upload?.confidentiality_level === 'confidential'
  const downloadBlocked = isConfidential && !canViewConfidential
  const parserBadge = useMemo(
    () => parserKindBadge(upload?.parser_kind ?? null),
    [upload?.parser_kind],
  )
  const llmRequiredButMissing =
    upload?.parsed_status === 'failed' &&
    upload?.parsed_payload?.error === 'llm_required_but_no_api_key'

  const onReparse = useCallback(async () => {
    if (!supabase || !upload) return
    setReparsing(true)
    try {
      await supabase.functions.invoke('tilsynsbrev-parser', { body: { upload_id: upload.id } })
      await logAccess('re_parse')
      await refresh()
      await loadAccessLog()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setReparsing(false)
    }
  }, [supabase, upload, refresh, logAccess, loadAccessLog])

  const onAccept = useCallback(async () => {
    if (!supabase || !upload) return
    setReviewing(true)
    const { error: e } = await supabase
      .from('tilsynsbrev_uploads')
      .update({
        manual_review_status: 'accepted',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', upload.id)
    if (e) {
      setError(e.message)
    } else {
      await logAccess('mark_reviewed')
      await refresh()
      await loadAccessLog()
    }
    setReviewing(false)
  }, [supabase, upload, refresh, logAccess, loadAccessLog])

  const onCreateTaskConfirmed = useCallback(
    async (paragraphId: string) => {
      if (!supabase) return
      setCreatingFor(paragraphId)
      try {
        const { error: e } = await supabase.rpc('tilsynsbrev_create_task_for_paragraph', {
          p_paragraph_id: paragraphId,
          p_assignee_user_id: null,
          p_due_at: null,
        })
        if (e) {
          setError(e.message)
        } else {
          await logAccess('create_task')
          await refresh()
          await loadAccessLog()
        }
      } finally {
        setCreatingFor(null)
        setPendingCreateParagraph(null)
      }
    },
    [supabase, refresh, logAccess, loadAccessLog],
  )

  const onCreateTaskClick = useCallback(
    (paragraph: ParagraphRow) => {
      if (!upload) return
      if (upload.confidentiality_level !== 'standard') {
        setPendingCreateParagraph(paragraph)
      } else {
        void onCreateTaskConfirmed(paragraph.id)
      }
    },
    [upload, onCreateTaskConfirmed],
  )

  const onDownload = useCallback(async () => {
    if (!supabase || !upload || downloadBlocked) return
    setDownloading(true)
    try {
      const { data, error: e } = await supabase.storage
        .from('tilsynsbrev')
        .createSignedUrl(upload.storage_path, 60)
      if (e) {
        setError(e.message)
        return
      }
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
        await logAccess('download')
        await loadAccessLog()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setDownloading(false)
    }
  }, [supabase, upload, downloadBlocked, logAccess, loadAccessLog])

  if (loading && !upload) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Tilsynssaker', to: '/admin/tilsynsbrev' },
        ]}
        title="Laster tilsynsbrev …"
      >
        <p className="text-sm text-neutral-500">Henter detaljer …</p>
      </ModulePageShell>
    )
  }

  if (!upload) {
    return (
      <ModulePageShell
        breadcrumb={[
          { label: 'Workspace', to: '/' },
          { label: 'Tilsynssaker', to: '/admin/tilsynsbrev' },
        ]}
        title="Tilsynsbrev ikke funnet"
        headerActions={
          <Link
            to="/admin/tilsynsbrev"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" /> Tilbake
          </Link>
        }
      >
        <ModuleSectionCard className="p-6">
          <WarningBox>Fant ikke tilsynsbrevet «{id}».</WarningBox>
        </ModuleSectionCard>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Tilsynssaker', to: '/admin/tilsynsbrev' },
        { label: SOURCE_LABELS[upload.source_type] ?? upload.source_type },
      ]}
      title={`Tilsynsbrev — ${SOURCE_LABELS[upload.source_type] ?? upload.source_type}`}
      description={
        upload.parsed_payload?.regulator
          ? `Fra ${upload.parsed_payload.regulator}${
              upload.parsed_payload.letterDate ? ` · datert ${upload.parsed_payload.letterDate}` : ''
            }`
          : undefined
      }
      headerActions={
        <div className="flex items-center gap-2">
          <Link
            to="/admin/tilsynsbrev"
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            <ArrowLeft className="size-4" /> Tilbake
          </Link>
          <Button
            variant="ghost"
            onClick={() => void onDownload()}
            disabled={downloading || downloadBlocked}
            title={
              downloadBlocked
                ? 'Krever tilsynsbrev.view_confidential — kontakt HMS-leder'
                : undefined
            }
          >
            <Download className="size-4" /> {downloading ? 'Henter …' : 'Last ned PDF'}
          </Button>
          <Button variant="ghost" onClick={() => void onReparse()} disabled={reparsing}>
            <RefreshCw className="size-4" /> {reparsing ? 'Kjører …' : 'Kjør på nytt'}
          </Button>
          <Button
            onClick={() => void onAccept()}
            disabled={reviewing || upload.manual_review_status === 'accepted'}
          >
            <CheckCircle2 className="size-4" />
            {upload.manual_review_status === 'accepted' ? 'Gjennomgått' : 'Marker som gjennomgått'}
          </Button>
        </div>
      }
    >
      {/* Sticky confidentiality banner — sits above the error/content
          so reviewers always see the gate first. */}
      {upload.confidentiality_level !== 'standard' && (
        <div className="sticky top-2 z-20">
          <ConfidentialityBanner level={upload.confidentiality_level} />
        </div>
      )}

      {/* Parser chip — colour-coded fidelity signal. */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500">
          Parser:
        </span>
        <Badge variant={parserBadge.variant} title={parserBadge.tooltip}>
          {parserBadge.label}
        </Badge>
        {upload.parser_version && (
          <span className="font-mono text-[10px] text-neutral-500">{upload.parser_version}</span>
        )}
      </div>

      {/* Prominent failure box when org requires LLM but the platform
          key is missing — admin must either set the key or relax the
          org-setting to 'auto'. */}
      {llmRequiredButMissing && (
        <WarningBox>
          Org-innstilling krever LLM-modus, men ANTHROPIC_API_KEY er ikke satt. Kontakt admin
          eller endre org-innstilling til {'«'}auto{'»'}.
        </WarningBox>
      )}

      {error && <WarningBox>{error}</WarningBox>}

      <ModuleSectionCard className="p-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <FileText className="size-5 text-[#1a3d32]" aria-hidden /> Metadata
        </h2>
        <dl className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
          <Field label="Tilsynsmyndighet" value={SOURCE_LABELS[upload.source_type] ?? upload.source_type} />
          <Field label="Mottatt" value={new Date(upload.uploaded_at).toLocaleString('nb')} />
          <Field
            label="Parser"
            value={upload.parser_kind ? `${upload.parser_kind} (${upload.parser_version ?? '?'})` : '—'}
          />
          <Field
            label="Parser-tidspunkt"
            value={upload.parsed_at ? new Date(upload.parsed_at).toLocaleString('nb') : '—'}
          />
          <Field label="Status" value={upload.parsed_status} />
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Konfidensialitet
            </dt>
            <dd className="mt-1 flex items-center gap-2 text-sm text-neutral-800">
              {confBadge ? (
                <Badge variant={confBadge.variant}>{confBadge.label}</Badge>
              ) : (
                <span>Standard</span>
              )}
            </dd>
          </div>
          {upload.notes && <Field label="Notater" value={upload.notes} />}
        </dl>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-6">
        <h2 className="mb-3 text-lg font-semibold text-neutral-900">Sammendrag</h2>
        {summary ? (
          <p className="text-sm leading-relaxed text-neutral-700">{summary}</p>
        ) : (
          <p className="text-sm text-neutral-500">Ingen sammendrag enda — parser har ikke kjørt ferdig.</p>
        )}
      </ModuleSectionCard>

      <ModuleSectionCard className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
            <ListChecks className="size-5 text-[#1a3d32]" aria-hidden />
            Siterte paragrafer ({paragraphs.length})
          </h2>
        </div>
        {paragraphs.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-neutral-500">
            Ingen paragrafer ekstrahert ennå. {upload.parsed_status !== 'parsed' && 'Parser kjører fortsatt.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Paragraf</th>
                <th className="px-4 py-3 font-semibold">Sitat</th>
                <th className="px-4 py-3 font-semibold">Alvorlighet</th>
                <th className="px-4 py-3 font-semibold">Frist</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Oppgave</th>
                <th className="px-4 py-3" aria-label="Handling" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paragraphs.map((p) => {
                const sb = severityBadge(p.severity)
                const sb2 = paragraphStatusBadge(p.status)
                return (
                  <tr key={p.id} className="align-top hover:bg-neutral-50/60">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-neutral-900">
                      {p.paragraph_ref}
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      <span className="line-clamp-3">{p.excerpt ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={sb.variant}>{sb.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {p.deadline_at ? new Date(p.deadline_at).toLocaleDateString('nb') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={sb2.variant}>{sb2.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {p.linked_task_id ? (
                        <Link
                          to={`/tasks/management/alle?task=${encodeURIComponent(p.linked_task_id)}`}
                          className="text-[#1a3d32] underline-offset-2 hover:underline"
                        >
                          Åpne oppgave
                        </Link>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!p.linked_task_id && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onCreateTaskClick(p)}
                          disabled={creatingFor === p.id}
                        >
                          <Plus className="size-3.5" />
                          {creatingFor === p.id ? 'Oppretter …' : 'Opprett oppgave'}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </ModuleSectionCard>

      {findings.length > 0 && (
        <ModuleSectionCard className="p-6">
          <h2 className="mb-3 text-lg font-semibold text-neutral-900">Funn ({findings.length})</h2>
          <ul className="space-y-3 text-sm">
            {findings.map((f, i) => (
              <li key={i} className="rounded-md border border-neutral-200 bg-white p-3">
                <p className="font-medium text-neutral-900">{f.description}</p>
                {f.severity && (
                  <p className="mt-1 text-xs text-neutral-500">Alvorlighet: {f.severity}</p>
                )}
                {f.suggestedActions && f.suggestedActions.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-neutral-600">
                    {f.suggestedActions.map((sa, j) => (
                      <li key={j}>{sa}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </ModuleSectionCard>
      )}

      <AccessLogCard available={accessLogAvailable} rows={accessLog} />

      {pendingCreateParagraph && upload && upload.confidentiality_level !== 'standard' && (
        <ConfirmCreateTaskDialog
          paragraph={pendingCreateParagraph}
          level={upload.confidentiality_level}
          busy={creatingFor === pendingCreateParagraph.id}
          onCancel={() => setPendingCreateParagraph(null)}
          onConfirm={() => void onCreateTaskConfirmed(pendingCreateParagraph.id)}
        />
      )}
    </ModulePageShell>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm text-neutral-800">{value}</dd>
    </div>
  )
}

function ConfidentialityBanner({ level }: { level: Exclude<ConfidentialityLevel, 'standard'> }) {
  if (level === 'restricted') {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          <strong>Begrenset tilgang</strong> — denne tilsynssaken er klassifisert som begrenset.
          {' '}All visning og kopiering blir loggført iht. AML § 2A-7.
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      <span>
        <strong>KONFIDENSIELT</strong> — denne tilsynssaken er klassifisert som konfidensiell
        {' '}(varslingssak / personskade-følsom). All visning loggføres. Ikke videresend uten
        {' '}samtykke fra HMS-leder.
      </span>
    </div>
  )
}

function AccessLogCard({
  available,
  rows,
}: {
  available: boolean | null
  rows: AccessLogRow[]
}) {
  return (
    <ModuleSectionCard className="p-0 overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
          <History className="size-5 text-[#1a3d32]" aria-hidden />
          Tilgangslogg
        </h2>
        {available && rows.length > 0 && (
          <span className="text-xs text-neutral-500">Siste 50 hendelser</span>
        )}
      </div>
      {available === null ? (
        <p className="px-6 py-10 text-center text-sm text-neutral-500">Laster tilgangslogg …</p>
      ) : available === false ? (
        <p className="px-6 py-10 text-center text-sm text-neutral-500">
          Tilgangslogg kommer i neste sprint.
        </p>
      ) : rows.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-neutral-500">
          Ingen tilgangshendelser loggført ennå.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Tidspunkt</th>
              <th className="px-4 py-3 font-semibold">Bruker</th>
              <th className="px-4 py-3 font-semibold">Handling</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50/60">
                <td className="px-4 py-3 text-neutral-700">
                  {new Date(r.accessed_at).toLocaleString('nb')}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {r.user_label || <span className="font-mono text-xs">{r.accessed_by.slice(0, 8)}…</span>}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {ACTION_LABELS[r.action] ?? r.action}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ModuleSectionCard>
  )
}

function ConfirmCreateTaskDialog({
  paragraph,
  level,
  busy,
  onCancel,
  onConfirm,
}: {
  paragraph: ParagraphRow
  level: Exclude<ConfidentialityLevel, 'standard'>
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  const levelLabel = level === 'confidential' ? 'konfidensielt' : 'begrenset'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-create-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 id="confirm-create-task-title" className="text-base font-semibold text-neutral-900">
          Bekreft konfidensialitet
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-neutral-700">
          Den opprettede oppgaven for paragraf{' '}
          <span className="font-mono text-xs font-semibold">{paragraph.paragraph_ref}</span>{' '}
          arver konfidensialitetsnivå <strong>{levelLabel}</strong> og blir kun synlig for
          brukere med <code className="rounded bg-neutral-100 px-1">tasks.view_confidential</code>-tillatelse.
        </p>
        <label className="mt-4 flex items-start gap-2 text-sm text-neutral-800">
          <StandardInput
            type="checkbox"
            className="mt-0.5 size-4 rounded border-neutral-300"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>Jeg bekrefter dette er korrekt</span>
        </label>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Avbryt
          </Button>
          <Button onClick={onConfirm} disabled={!confirmed || busy}>
            {busy ? 'Oppretter …' : 'Opprett oppgave'}
          </Button>
        </div>
      </div>
    </div>
  )
}
