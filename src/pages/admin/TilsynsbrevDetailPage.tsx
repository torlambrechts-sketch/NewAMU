// /admin/tilsynsbrev/:id — Detail-side per opplastet tilsynsbrev.
//
// Viser:
//   * upload-metadata (regulator, opplasting, parser-kjøretid)
//   * sammendrag (parsed_payload.summary)
//   * tabell over ekstraherte paragrafer m/ severity, frist, status,
//     lenke til opprettet task hvis noen
//   * per-paragraf «Opprett oppgave for dette pålegget» (kaller RPC
//     tilsynsbrev_create_task_for_paragraph)
//   * «Marker som gjennomgått» (manual_review_status='accepted')
//   * «Kjør på nytt» (re-invoke parser edge function)

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, ListChecks, Plus, RefreshCw } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type SourceType = 'arbeidstilsynet' | 'datatilsynet' | 'helsetilsynet' | 'ukom' | 'ldo' | 'other'
type ParsedStatus = 'pending' | 'parsing' | 'parsed' | 'failed'
type Severity = 'info' | 'observasjon' | 'pålegg' | 'tvangsmulkt'
type ParagraphStatus = 'open' | 'addressed' | 'contested' | 'closed'

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
  } | null
  parser_kind: string | null
  parser_version: string | null
  manual_review_status: 'not_reviewed' | 'accepted' | 'edited' | 'rejected'
  confidentiality_level: string
  notes: string | null
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

const SOURCE_LABELS: Record<SourceType, string> = {
  arbeidstilsynet: 'Arbeidstilsynet',
  datatilsynet: 'Datatilsynet',
  helsetilsynet: 'Statens helsetilsyn',
  ukom: 'UKOM',
  ldo: 'LDO',
  other: 'Annen',
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

export function TilsynsbrevDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { supabase, organization } = useOrgSetupContext()
  const [upload, setUpload] = useState<UploadRow | null>(null)
  const [paragraphs, setParagraphs] = useState<ParagraphRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reparsing, setReparsing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)

  const orgId = organization?.id ?? null

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

  const summary = useMemo(() => upload?.parsed_payload?.summary ?? '', [upload])
  const findings = useMemo(() => upload?.parsed_payload?.findings ?? [], [upload])

  const onReparse = useCallback(async () => {
    if (!supabase || !upload) return
    setReparsing(true)
    try {
      await supabase.functions.invoke('tilsynsbrev-parser', { body: { upload_id: upload.id } })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setReparsing(false)
    }
  }, [supabase, upload, refresh])

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
    if (e) setError(e.message)
    else await refresh()
    setReviewing(false)
  }, [supabase, upload, refresh])

  const onCreateTask = useCallback(
    async (paragraphId: string) => {
      if (!supabase) return
      setCreatingFor(paragraphId)
      try {
        const { error: e } = await supabase.rpc('tilsynsbrev_create_task_for_paragraph', {
          p_paragraph_id: paragraphId,
          p_assignee_user_id: null,
          p_due_at: null,
        })
        if (e) setError(e.message)
        else await refresh()
      } finally {
        setCreatingFor(null)
      }
    },
    [supabase, refresh],
  )

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
          <Field label="Konfidensialitet" value={upload.confidentiality_level} />
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
                          onClick={() => void onCreateTask(p.id)}
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
