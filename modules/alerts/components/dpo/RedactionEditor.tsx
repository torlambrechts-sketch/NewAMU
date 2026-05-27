// RedactionEditor — highlight-to-redact tool. Renders decrypted case
// content; clicking + dragging proposes a redaction region; saved to
// alert_redaction; the legal-review path approves or rejects.

import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Props = {
  supabase: SupabaseClient
  caseId: string
  orgId: string
  dsarRequestId: string
  decryptedTitle: string
  decryptedDescription: string
  lang: 'nb' | 'en'
}

type Region = {
  id: string
  region_kind: 'reporter_identity' | 'witness_identity' | 'third_party' | 'internal_deliberation' | 'other'
  source_field: string
  start_offset: number | null
  end_offset: number | null
  suggested_by: 'heuristic' | 'dpo' | 'counsel'
  accepted_at: string | null
  rejected_at: string | null
  reason: string | null
}

export function RedactionEditor({ supabase, caseId, orgId, dsarRequestId, decryptedTitle, decryptedDescription, lang }: Props) {
  const [regions, setRegions] = useState<Region[]>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('alert_redaction')
      .select('*')
      .eq('case_id', caseId)
      .eq('dsar_request_id', dsarRequestId)
    setRegions((data ?? []) as Region[])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, dsarRequestId])

  async function propose(
    sourceField: string,
    kind: Region['region_kind'],
    start: number | null,
    end: number | null,
    reason?: string,
  ) {
    setBusy(true)
    await supabase.from('alert_redaction').insert({
      case_id: caseId,
      organization_id: orgId,
      dsar_request_id: dsarRequestId,
      region_kind: kind,
      source_field: sourceField,
      start_offset: start,
      end_offset: end,
      suggested_by: 'dpo',
      reason: reason ?? null,
    })
    setBusy(false)
    await load()
  }

  async function accept(id: string) {
    setBusy(true)
    const { data: userRow } = await supabase.auth.getUser()
    await supabase
      .from('alert_redaction')
      .update({ accepted_by: userRow.user?.id ?? null, accepted_at: new Date().toISOString() })
      .eq('id', id)
    setBusy(false)
    await load()
  }

  async function reject(id: string, reason: string) {
    setBusy(true)
    const { data: userRow } = await supabase.auth.getUser()
    await supabase
      .from('alert_redaction')
      .update({ rejected_by: userRow.user?.id ?? null, rejected_at: new Date().toISOString(), reason })
      .eq('id', id)
    setBusy(false)
    await load()
  }

  function renderField(label: string, sourceField: string, text: string) {
    const fieldRegions = regions.filter((r) => r.source_field === sourceField && !r.rejected_at)
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">{label}</span>
          <button
            type="button"
            onClick={() => void propose(sourceField, 'reporter_identity', null, null)}
            disabled={busy}
            className="text-xs underline"
          >
            {lang === 'nb' ? 'Maskér hele feltet' : 'Mask entire field'}
          </button>
        </div>
        <div className="mt-1 rounded border border-neutral-300 bg-white p-2 text-sm">
          {applyMask(text, fieldRegions.filter((r) => r.accepted_at))}
        </div>
        {fieldRegions.length > 0 && (
          <div className="mt-2 space-y-1">
            {fieldRegions.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <span className="rounded bg-amber-100 px-1.5">{r.region_kind}</span>
                <span>{r.start_offset == null ? 'hele feltet' : `${r.start_offset}–${r.end_offset}`}</span>
                {r.accepted_at ? (
                  <span className="text-emerald-700">✓ akseptert</span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void accept(r.id)}
                      className="rounded border border-neutral-300 px-2 py-0.5"
                    >
                      Aksepter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const reason = prompt(lang === 'nb' ? 'Grunn?' : 'Reason?')
                        if (reason) void reject(r.id, reason)
                      }}
                      className="rounded border border-neutral-300 px-2 py-0.5"
                    >
                      Avvis
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded border border-neutral-200 bg-neutral-50 p-4">
      <h3 className="text-sm font-semibold">{lang === 'nb' ? 'Redigerings­verktøy' : 'Redaction tool'}</h3>
      {renderField(lang === 'nb' ? 'Tittel' : 'Title', 'case.title', decryptedTitle)}
      {renderField(lang === 'nb' ? 'Beskrivelse' : 'Description', 'case.description', decryptedDescription)}
    </div>
  )
}

function applyMask(text: string, accepted: Region[]): string {
  if (accepted.length === 0) return text
  // Full-field masks short-circuit.
  if (accepted.some((r) => r.start_offset == null)) return '[REDIGERT]'
  // Apply partial masks in reverse order so offsets stay stable.
  const sorted = [...accepted].sort((a, b) => (b.start_offset ?? 0) - (a.start_offset ?? 0))
  let out = text
  for (const r of sorted) {
    if (r.start_offset == null || r.end_offset == null) continue
    out = out.slice(0, r.start_offset) + '[…]' + out.slice(r.end_offset)
  }
  return out
}
