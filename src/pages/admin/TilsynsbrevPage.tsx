// /admin/tilsynsbrev — Tilsynsbrev-parser hub. Lister opplastede
// tilsynsbrev for organisasjonen og lar admin laste opp et nytt PDF-
// brev som så parses asynkront av edge-funksjonen tilsynsbrev-parser.
//
// Filen er v0-MVP for tilsynsbrev-parser-wedgen (top-2 wedge ifølge
// entrepreneur-review). Selve LLM-ekstraksjonen + regex-fallback
// kjøres på serveren — denne siden er kun upload-form + listevisning.
//
// Confidentiality gate (P2 add-on): hver rad viser et badge for
// confidentiality_level + en filter-chip på toppen. Når brukeren
// mangler tilsynsbrev.view_confidential, viser vi *antall* skjulte
// konfidensielle saker (RLS skjuler innholdet) så admin ser at det
// finnes saker uten å se selve dataene.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Plus, RefreshCw, Upload } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { Badge } from '../../components/ui/Badge'
import { SlidePanel } from '../../components/layout/SlidePanel'
import { StandardInput } from '../../components/ui/Input'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'

type SourceType = 'arbeidstilsynet' | 'datatilsynet' | 'helsetilsynet' | 'ukom' | 'ldo' | 'other'
type ParsedStatus = 'pending' | 'parsing' | 'parsed' | 'failed'
type ReviewStatus = 'not_reviewed' | 'accepted' | 'edited' | 'rejected'
type ConfidentialityLevel = 'standard' | 'restricted' | 'confidential'
type ConfidentialityFilter = 'standard' | 'include_restricted' | 'all'

type UploadRow = {
  id: string
  uploaded_at: string
  source_type: SourceType
  parsed_status: ParsedStatus
  manual_review_status: ReviewStatus
  parser_kind: string | null
  parsed_payload: { citedParagraphs?: unknown[]; summary?: string } | null
  notes: string | null
  confidentiality_level: ConfidentialityLevel
}

const SOURCE_LABELS: Record<SourceType, string> = {
  arbeidstilsynet: 'Arbeidstilsynet',
  datatilsynet: 'Datatilsynet',
  helsetilsynet: 'Statens helsetilsyn',
  ukom: 'UKOM',
  ldo: 'LDO',
  other: 'Annen',
}

const STATUS_LABELS: Record<ParsedStatus, string> = {
  pending: 'I kø',
  parsing: 'Behandler',
  parsed: 'Klar for gjennomgang',
  failed: 'Feilet',
}

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  not_reviewed: 'Ikke gjennomgått',
  accepted: 'Akseptert',
  edited: 'Redigert',
  rejected: 'Avvist',
}

const CONFIDENTIALITY_FILTER_LABELS: Record<ConfidentialityFilter, string> = {
  standard: 'Bare standard',
  include_restricted: 'Inkluder begrensede',
  all: 'Alle (inkl. konfidensielle)',
}

function badgeForStatus(status: ParsedStatus, review: ReviewStatus): {
  label: string
  variant: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
} {
  if (review === 'accepted') return { label: REVIEW_LABELS.accepted, variant: 'success' }
  if (review === 'rejected') return { label: REVIEW_LABELS.rejected, variant: 'danger' }
  if (status === 'failed') return { label: STATUS_LABELS.failed, variant: 'danger' }
  if (status === 'parsed') return { label: STATUS_LABELS.parsed, variant: 'info' }
  if (status === 'parsing') return { label: STATUS_LABELS.parsing, variant: 'warning' }
  return { label: STATUS_LABELS.pending, variant: 'neutral' }
}

function confidentialityBadge(level: ConfidentialityLevel): null | {
  label: string
  variant: 'warning' | 'danger'
  tooltip: string
} {
  if (level === 'restricted') {
    return {
      label: 'Begrenset',
      variant: 'warning',
      tooltip: 'Krever tilsynsbrev.view_confidential',
    }
  }
  if (level === 'confidential') {
    return {
      label: 'Konfidensielt',
      variant: 'danger',
      tooltip: 'Krever tilsynsbrev.view_confidential',
    }
  }
  return null
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function TilsynsbrevPage() {
  const { supabase, organization, can } = useOrgSetupContext()
  const [rows, setRows] = useState<UploadRow[]>([])
  const [hiddenConfidentialCount, setHiddenConfidentialCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [confidentialityFilter, setConfidentialityFilter] =
    useState<ConfidentialityFilter>('include_restricted')

  const canViewConfidential = can('tilsynsbrev.view_confidential')

  const orgId = organization?.id ?? null

  const refresh = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('tilsynsbrev_uploads')
      .select(
        'id, uploaded_at, source_type, parsed_status, manual_review_status, parser_kind, parsed_payload, notes, confidentiality_level',
      )
      .eq('organization_id', orgId)
      .order('uploaded_at', { ascending: false })
      .limit(100)
    if (e) {
      setError(e.message)
    } else {
      setRows((data ?? []) as UploadRow[])
    }

    // Even without the view-confidential permission, give the admin a
    // count of how many restricted/confidential rows exist. RLS would
    // collapse a head-count to 0 because the policy hides the rows
    // themselves — we use a SECURITY DEFINER RPC (_125600) instead,
    // which permission-checks the caller and only exposes a number.
    if (!canViewConfidential) {
      const { data: count, error: countErr } = await supabase.rpc(
        'tilsynsbrev_count_hidden_confidential',
        { p_org_id: orgId },
      )
      if (!countErr && typeof count === 'number') {
        setHiddenConfidentialCount(count)
      } else {
        setHiddenConfidentialCount(0)
      }
    } else {
      setHiddenConfidentialCount(0)
    }

    setLoading(false)
  }, [supabase, orgId, canViewConfidential])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredRows = useMemo(() => {
    if (confidentialityFilter === 'standard') {
      return rows.filter((r) => r.confidentiality_level === 'standard')
    }
    if (confidentialityFilter === 'include_restricted') {
      return rows.filter(
        (r) => r.confidentiality_level === 'standard' || r.confidentiality_level === 'restricted',
      )
    }
    return rows
  }, [rows, confidentialityFilter])

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Workspace', to: '/' },
        { label: 'Tilsynssaker', to: '/admin/tilsynsbrev' },
        { label: 'Tilsynsbrev' },
      ]}
      title="Tilsynsbrev"
      description="Last opp inspeksjons- eller kontrollbrev fra Arbeidstilsynet, Datatilsynet eller andre tilsynsmyndigheter. Plattformen ekstraherer paragrafer, frister og pålegg automatisk."
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void refresh()}>
            <RefreshCw className="size-4" /> Oppdater
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="size-4" /> Last opp brev
          </Button>
        </div>
      }
    >
      {error && <WarningBox>Kunne ikke hente tilsynsbrev: {error}</WarningBox>}

      <ModuleSectionCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
            Konfidensialitet
          </span>
          <div role="group" aria-label="Filter konfidensialitet" className="flex gap-1">
            {(Object.keys(CONFIDENTIALITY_FILTER_LABELS) as ConfidentialityFilter[]).map((key) => {
              const active = confidentialityFilter === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setConfidentialityFilter(key)}
                  aria-pressed={active}
                  className={
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-colors ' +
                    (active
                      ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                      : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50')
                  }
                >
                  {CONFIDENTIALITY_FILTER_LABELS[key]}
                </button>
              )
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Viser {filteredRows.length} {filteredRows.length === 1 ? 'sak' : 'saker'}
          {' '}av {rows.length} synlige.
          {!canViewConfidential && hiddenConfidentialCount > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-amber-700">
                {hiddenConfidentialCount} konfidensielle skjult (krever gjennomgang)
              </span>
            </>
          )}
        </p>
      </ModuleSectionCard>

      <ModuleSectionCard className="p-0 overflow-hidden">
        {loading ? (
          <p className="px-6 py-10 text-center text-sm text-neutral-500">Laster tilsynsbrev …</p>
        ) : filteredRows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto size-10 text-neutral-300" aria-hidden />
            <p className="mt-3 text-sm text-neutral-600">
              {rows.length === 0
                ? 'Ingen tilsynsbrev lastet opp ennå. Klikk «Last opp brev» øverst for å starte.'
                : 'Ingen tilsynsbrev matcher gjeldende konfidensialitetsfilter.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Mottatt</th>
                <th className="px-4 py-3 font-semibold">Tilsynsmyndighet</th>
                <th className="px-4 py-3 font-semibold">Pålegg/sitater</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Parser</th>
                <th className="px-4 py-3" aria-label="Åpne" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredRows.map((r) => {
                const badge = badgeForStatus(r.parsed_status, r.manual_review_status)
                const confBadge = confidentialityBadge(r.confidentiality_level)
                const cited =
                  Array.isArray(r.parsed_payload?.citedParagraphs)
                    ? (r.parsed_payload!.citedParagraphs!.length as number)
                    : 0
                return (
                  <tr key={r.id} className="hover:bg-neutral-50/60">
                    <td className="px-4 py-3 text-neutral-700">
                      {new Date(r.uploaded_at).toLocaleString('nb')}
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{SOURCE_LABELS[r.source_type] ?? r.source_type}</span>
                        {confBadge && (
                          <Badge variant={confBadge.variant} title={confBadge.tooltip}>
                            {confBadge.label}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-700">
                      {cited > 0 ? `${cited} sitat${cited === 1 ? '' : 'er'}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {r.parser_kind ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/tilsynsbrev/${r.id}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[#1a3d32] hover:underline"
                      >
                        Åpne
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </ModuleSectionCard>

      <UploadPanel
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={async () => {
          setUploadOpen(false)
          await refresh()
        }}
      />
    </ModulePageShell>
  )
}

// ─── Upload SlidePanel ─────────────────────────────────────────────────

function UploadPanel({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  onUploaded: () => Promise<void> | void
}) {
  const { supabase, organization } = useOrgSetupContext()
  const [sourceType, setSourceType] = useState<SourceType>('arbeidstilsynet')
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setSourceType('arbeidstilsynet')
      setFile(null)
      setNotes('')
      setErr(null)
      setSubmitting(false)
    }
  }, [open])

  const orgId = organization?.id ?? null

  const onSubmit = useCallback(async () => {
    setErr(null)
    if (!supabase || !orgId || !file) {
      setErr('Velg en PDF-fil før du laster opp.')
      return
    }
    if (file.type !== 'application/pdf') {
      setErr('Filen må være en PDF.')
      return
    }
    setSubmitting(true)
    try {
      const bytes = await file.arrayBuffer()
      const checksum = await sha256Hex(bytes)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'brev.pdf'
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      const storagePath = `${orgId}/${ts}-${safeName}`

      const { error: upErr } = await supabase.storage
        .from('tilsynsbrev')
        .upload(storagePath, file, { contentType: 'application/pdf', upsert: false })
      if (upErr) throw upErr

      const { data: row, error: insErr } = await supabase
        .from('tilsynsbrev_uploads')
        .insert({
          organization_id: orgId,
          source_type: sourceType,
          storage_path: storagePath,
          sha256_checksum: checksum,
          notes: notes.trim() || null,
        })
        .select('id')
        .single()
      if (insErr) throw insErr

      // Fire-and-forget parser invocation. The triage workflow rule
      // already fired via the insert trigger; the parser run updates
      // parsed_payload + per-paragraph rows asynchronously.
      if (row?.id) {
        try {
          await supabase.functions.invoke('tilsynsbrev-parser', {
            body: { upload_id: row.id },
          })
        } catch (e) {
          // Parser failure is non-fatal — row is still uploaded; admin
          // can re-run from the detail page.
          console.warn('tilsynsbrev-parser invoke failed', e)
        }
      }

      await onUploaded()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }, [supabase, orgId, file, sourceType, notes, onUploaded])

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="tilsynsbrev-upload-panel"
      title="Last opp tilsynsbrev"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Avbryt
          </Button>
          <Button onClick={() => void onSubmit()} disabled={submitting || !file}>
            <Upload className="size-4" /> {submitting ? 'Laster opp …' : 'Last opp og parse'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <p className="text-sm leading-relaxed text-neutral-600">
          Plattformen vil ekstrahere paragrafer, frister og pålegg fra PDF-en og opprette en
          triage-oppgave til HMS-leder. Tilsynsbrev er som standard markert som
          {' '}<em>konfidensielt</em>.
        </p>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>Tilsynsmyndighet</label>
          <select
            className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as SourceType)}
          >
            {Object.entries(SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>PDF-fil</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm"
          />
          {file && (
            <p className="mt-2 text-xs text-neutral-500">
              {file.name} ({Math.round(file.size / 1024)} KB)
            </p>
          )}
        </div>
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>Notater (valgfritt)</label>
          <StandardInput
            placeholder="F.eks. saksnummer eller henvisning til tilsynsbesøket"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2"
          />
        </div>
        {err && <WarningBox>{err}</WarningBox>}
      </div>
    </SlidePanel>
  )
}
