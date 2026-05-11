// Privacy operations for documents collaboration.
//
// Org admin / documents.manage / whistleblowing.committee can:
//   - Export every comment that mentions or was authored by a chosen
//     subject (GDPR Art. 15 — subject access right), including CSV
//     download.
//   - Pseudonymise the same set (GDPR Art. 17 — erasure right). Rows are
//     preserved for the legal-basis audit trail (IK-f § 5) but the
//     personal data is replaced with a marker.
//
// Both flows call the SECURITY DEFINER RPCs from migration
// 20260830120015. The RPCs verify the caller's permission server-side,
// so we don't strictly need to gate the page client-side — but we still
// do, to give a clear access denied if a user navigates to the URL
// without rights.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Eraser, FileSearch } from 'lucide-react'
import { ModulePageShell, ModuleSectionCard, MODULE_TABLE_TH, MODULE_TABLE_TR_BODY } from '../../components/module'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect, type SelectOption } from '../../components/ui/SearchableSelect'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { DOCUMENTS_MODULE_TITLE } from '../../data/documentsNav'

type ExportRow = {
  id: string
  page_id: string
  page_title: string
  block_index: number
  body: string
  kind: string
  severity: string | null
  is_anonymous: boolean
  is_confidential: boolean
  legal_basis: string[]
  authored_by_subject: boolean
  mentioned_subject: boolean
  created_at: string
  retention_max_years: number | null
  scheduled_deletion_at: string | null
}

type EraseResult = {
  affected_count: number
  performed_at: string
}

function csvEscape(value: string | number | null | boolean): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function rowsToCsv(rows: ExportRow[]): string {
  const headers = [
    'id',
    'page_id',
    'page_title',
    'block_index',
    'kind',
    'severity',
    'is_anonymous',
    'is_confidential',
    'authored_by_subject',
    'mentioned_subject',
    'legal_basis',
    'created_at',
    'retention_max_years',
    'scheduled_deletion_at',
    'body',
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.page_id,
        r.page_title,
        r.block_index,
        r.kind,
        r.severity,
        r.is_anonymous,
        r.is_confidential,
        r.authored_by_subject,
        r.mentioned_subject,
        (r.legal_basis ?? []).join('; '),
        r.created_at,
        r.retention_max_years,
        r.scheduled_deletion_at,
        r.body,
      ]
        .map(csvEscape)
        .join(','),
    )
  }
  return lines.join('\n')
}

export function DocumentPrivacyPage() {
  const navigate = useNavigate()
  const { supabase, orgProfiles, isAdmin, permissionKeys } = useOrgSetupContext()
  const canRun =
    isAdmin || permissionKeys.has('documents.manage') || permissionKeys.has('whistleblowing.committee')

  const [subjectId, setSubjectId] = useState<string>('')
  const [rows, setRows] = useState<ExportRow[] | null>(null)
  const [eraseReason, setEraseReason] = useState<string>('')
  const [eraseConfirm, setEraseConfirm] = useState(false)
  const [busy, setBusy] = useState<'export' | 'erase' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [eraseResult, setEraseResult] = useState<EraseResult | null>(null)

  // Reset results when the subject changes.
  useEffect(() => {
    setRows(null)
    setEraseConfirm(false)
    setEraseResult(null)
  }, [subjectId])

  const subjectOptions = useMemo((): SelectOption[] => {
    return [
      { value: '', label: 'Velg en bruker…' },
      ...orgProfiles.map((p) => ({ value: p.id, label: `${p.display_name} (${p.email ?? '—'})` })),
    ]
  }, [orgProfiles])
  const subject = useMemo(() => orgProfiles.find((p) => p.id === subjectId), [orgProfiles, subjectId])

  const runExport = useCallback(async () => {
    if (!supabase || !subjectId) return
    setBusy('export')
    setError(null)
    try {
      const { data, error: e } = await supabase.rpc('wiki_page_comments_export_for_subject', {
        p_subject_user_id: subjectId,
      })
      if (e) {
        setError(e.message)
        setRows(null)
        return
      }
      setRows((data ?? []) as ExportRow[])
    } finally {
      setBusy(null)
    }
  }, [supabase, subjectId])

  const downloadCsv = useCallback(() => {
    if (!rows || !subject) return
    const csv = rowsToCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `gdpr-subject-access-${subject.display_name.replace(/\s+/g, '_')}-${ts}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [rows, subject])

  const runErase = useCallback(async () => {
    if (!supabase || !subjectId) return
    setBusy('erase')
    setError(null)
    try {
      const { data, error: e } = await supabase.rpc('wiki_page_comments_erase_for_subject', {
        p_subject_user_id: subjectId,
        p_reason: eraseReason.trim() || null,
      })
      if (e) {
        setError(e.message)
        return
      }
      const row = Array.isArray(data) ? (data[0] as EraseResult | undefined) : (data as EraseResult)
      setEraseResult(row ?? null)
      setEraseConfirm(false)
      setEraseReason('')
      // Refresh the export view so the user sees the pseudonymised rows.
      await runExport()
    } finally {
      setBusy(null)
    }
  }, [supabase, subjectId, eraseReason, runExport])

  if (!canRun) {
    return (
      <ModulePageShell
        breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }, { label: 'Personvern' }]}
        title="Personvern"
        description={<p className="max-w-3xl text-sm text-neutral-600">Du har ikke tilgang til denne siden.</p>}
      >
        <WarningBox>
          Personvernoperasjoner krever organisasjonsadmin, dokument-administrator eller varslingsutvalg.
        </WarningBox>
      </ModulePageShell>
    )
  }

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'HMS' }, { label: DOCUMENTS_MODULE_TITLE, to: '/documents' }, { label: 'Personvern' }]}
      title="Personvern (GDPR Art. 15 / Art. 17)"
      description={
        <p className="max-w-3xl text-sm text-neutral-600">
          Hent ut eller anonymiser kommentarer som angår en bestemt person. Sletting beholder rader for revisjon
          (IK-f § 5) men erstatter identifiserende tekst med en markør.
        </p>
      }
    >
      <ModuleSectionCard>
        <h2 className="text-sm font-semibold text-neutral-900">Velg subjekt</h2>
        <p className="mt-1 text-xs text-neutral-500">Brukeren operasjonen gjelder.</p>
        <div className="mt-3 max-w-md">
          <SearchableSelect value={subjectId} options={subjectOptions} onChange={setSubjectId} />
        </div>
      </ModuleSectionCard>

      {error ? (
        <div className="mt-4">
          <WarningBox>{error}</WarningBox>
        </div>
      ) : null}

      <ModuleSectionCard className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Innsynsbegjæring (Art. 15)</h2>
          <span className="text-xs text-neutral-500">
            Lister hver kommentar subjektet har skrevet eller blitt nevnt i.
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!subjectId || busy === 'export'}
            onClick={() => void runExport()}
            icon={<FileSearch className="size-3.5" aria-hidden />}
          >
            {busy === 'export' ? 'Henter…' : 'Hent kommentarer'}
          </Button>
          {rows && rows.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={downloadCsv}
              icon={<Download className="size-3.5" aria-hidden />}
            >
              Last ned CSV ({rows.length})
            </Button>
          ) : null}
        </div>

        {rows ? (
          rows.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Ingen kommentarer funnet for denne brukeren.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[840px] text-left text-sm">
                <thead>
                  <tr className={MODULE_TABLE_TH}>
                    <th className="px-3 py-2">Dokument</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Tekst</th>
                    <th className="px-3 py-2">Rolle</th>
                    <th className="px-3 py-2">Dato</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={MODULE_TABLE_TR_BODY}>
                      <td className="px-3 py-2 align-top text-neutral-700">{r.page_title}</td>
                      <td className="px-3 py-2 align-top">
                        <Badge variant="neutral">{r.kind}</Badge>
                        {r.is_confidential ? (
                          <Badge variant="danger" className="ml-1">
                            Konfidensiell
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-top text-neutral-800">
                        <p className="line-clamp-3 whitespace-pre-wrap">{r.body}</p>
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-neutral-600">
                        {r.authored_by_subject ? 'Forfatter' : ''}
                        {r.authored_by_subject && r.mentioned_subject ? ' + ' : ''}
                        {r.mentioned_subject ? 'Nevnt' : ''}
                      </td>
                      <td className="px-3 py-2 align-top text-[11px] text-neutral-500">
                        {new Date(r.created_at).toLocaleDateString('nb-NO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}
      </ModuleSectionCard>

      <ModuleSectionCard className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Sletting / anonymisering (Art. 17)</h2>
          <span className="text-xs text-neutral-500">
            Erstatter kropp + navn med en markør. Rader bevares for revisjon.
          </span>
        </div>
        <p className="mt-3 text-xs text-neutral-600">
          Norske myndigheter aksepterer pseudonymisering når dokumentasjonsplikten (IK-f § 5) krever at logger
          beholdes. Operasjonen kan ikke angres.
        </p>
        <div className="mt-3 max-w-xl space-y-2">
          <label className="block text-[11px] font-medium text-neutral-500">Begrunnelse (valgfri)</label>
          <StandardTextarea
            value={eraseReason}
            onChange={(e) => setEraseReason(e.target.value)}
            rows={2}
            placeholder="f.eks. «Slettebegjæring mottatt 2026-05-10»"
            className="text-xs"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!eraseConfirm ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!subjectId || busy !== null}
              onClick={() => setEraseConfirm(true)}
              icon={<Eraser className="size-3.5" aria-hidden />}
            >
              Forbered sletting…
            </Button>
          ) : (
            <>
              <span className="text-[11px] font-medium text-red-700">
                Bekreft: alle kommentarer fra {subject?.display_name ?? 'subjektet'} blir anonymisert.
              </span>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-red-600 hover:bg-red-700"
                disabled={busy === 'erase'}
                onClick={() => void runErase()}
              >
                {busy === 'erase' ? 'Sletter…' : 'Anonymiser nå'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEraseConfirm(false)}
              >
                Avbryt
              </Button>
            </>
          )}
        </div>
        {eraseResult ? (
          <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
            Anonymiserte {eraseResult.affected_count} kommentar
            {eraseResult.affected_count === 1 ? '' : 'er'} ·{' '}
            {new Date(eraseResult.performed_at).toLocaleString('nb-NO')}
          </p>
        ) : null}
      </ModuleSectionCard>

      <Button type="button" variant="secondary" className="mt-6" onClick={() => navigate('/documents')}>
        Tilbake til dokumenter
      </Button>
    </ModulePageShell>
  )
}
