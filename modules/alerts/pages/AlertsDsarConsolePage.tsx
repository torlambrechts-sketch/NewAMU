// AlertsDsarConsolePage — DPO workspace at /alerts/dsar. Lists DSAR
// requests, with a per-request detail surface for redaction + export.

import { useEffect, useMemo, useState } from 'react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import type { AlertDsarRequestRow, AlertDsarState } from '../types'
import { DsarRequestForm } from '../components/dpo/DsarRequestForm'

const STATE_LABEL_NB: Record<AlertDsarState, string> = {
  received: 'Mottatt',
  in_legal_review: 'Juridisk vurdering',
  redacting: 'Redigerer',
  fulfilled: 'Levert',
  rejected_rights: 'Avvist (rettighet)',
  rejected_excessive: 'Avvist (urimelig)',
}

export default function AlertsDsarConsolePage() {
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null
  const [requests, setRequests] = useState<AlertDsarRequestRow[]>([])
  const [showNew, setShowNew] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function load() {
    if (!supabase || !orgId) return
    const { data } = await supabase
      .from('alert_dsar_request')
      .select('*')
      .eq('organization_id', orgId)
      .order('received_at', { ascending: false })
    setRequests((data ?? []) as AlertDsarRequestRow[])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, orgId])

  const selected = useMemo(() => requests.find((r) => r.id === selectedId) ?? null, [requests, selectedId])

  if (!supabase || !orgId) return null

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      <div className="col-span-1 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">DSAR</h1>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="rounded bg-red-700 px-2.5 py-1 text-xs font-semibold text-white"
          >
            + Ny
          </button>
        </div>
        {requests.map((r) => {
          const daysToDue = Math.ceil((new Date(r.response_due_at).getTime() - Date.now()) / 86_400_000)
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className={`block w-full rounded border px-3 py-2 text-left text-sm ${selectedId === r.id ? 'border-red-700 bg-red-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
            >
              <div className="font-medium">{r.subject_type}</div>
              <div className="text-xs text-neutral-600">{STATE_LABEL_NB[r.state]}</div>
              <div className="text-[10px] text-neutral-500">Frist: {new Date(r.response_due_at).toLocaleDateString()} ({daysToDue}d)</div>
            </button>
          )
        })}
        {requests.length === 0 && (
          <p className="text-xs italic text-neutral-500">Ingen DSAR-saker enda.</p>
        )}
      </div>
      <div className="col-span-2">
        {showNew && (
          <DsarRequestForm
            supabase={supabase}
            orgId={orgId}
            lang="nb"
            onCreated={(id) => {
              setShowNew(false)
              setSelectedId(id)
              void load()
            }}
          />
        )}
        {selected && !showNew && (
          <DsarDetail dsar={selected} onChanged={() => void load()} />
        )}
        {!selected && !showNew && (
          <p className="text-xs italic text-neutral-500">Velg en DSAR-sak fra venstre.</p>
        )}
      </div>
    </div>
  )
}

function DsarDetail({ dsar, onChanged }: { dsar: AlertDsarRequestRow; onChanged: () => void }) {
  const { supabase } = useOrgSetupContext()
  const [busy, setBusy] = useState(false)

  async function transition(to: AlertDsarState) {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.rpc('alerts_dsar_transition', {
      p_dsar_id: dsar.id,
      p_to_state: to,
      p_notes_encrypted: null,
      p_notes_key_version: null,
      p_outcome: null,
    })
    setBusy(false)
    if (error) {
      alert(error.message)
      return
    }
    onChanged()
  }

  return (
    <div className="rounded border border-neutral-200 bg-white p-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{dsar.subject_type}-DSAR</h2>
        <div className="text-xs text-neutral-600">Status: {STATE_LABEL_NB[dsar.state]}</div>
        <div className="text-xs text-neutral-600">
          Mottatt: {new Date(dsar.received_at).toLocaleString()} · Frist: {new Date(dsar.response_due_at).toLocaleString()}
        </div>
        <div className="text-[10px] font-mono text-neutral-500 break-all">Hash: {dsar.subject_identifier_hash.slice(0, 30)}…</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {dsar.state === 'received' && (
          <>
            <button type="button" disabled={busy} onClick={() => void transition('in_legal_review')} className="rounded bg-neutral-900 px-3 py-1 text-xs text-white">
              → Juridisk vurdering
            </button>
            <button type="button" disabled={busy} onClick={() => void transition('rejected_excessive')} className="rounded border border-neutral-300 px-3 py-1 text-xs">
              Avvis (urimelig)
            </button>
          </>
        )}
        {dsar.state === 'in_legal_review' && (
          <>
            <button type="button" disabled={busy} onClick={() => void transition('redacting')} className="rounded bg-neutral-900 px-3 py-1 text-xs text-white">
              → Rediger
            </button>
            <button type="button" disabled={busy} onClick={() => void transition('rejected_rights')} className="rounded border border-neutral-300 px-3 py-1 text-xs">
              Avvis (Art. 15(4))
            </button>
          </>
        )}
        {dsar.state === 'redacting' && (
          <button type="button" disabled={busy} onClick={() => void transition('fulfilled')} className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white">
            Marker som levert
          </button>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold mt-2">Knyttede saker</h3>
        {dsar.case_ids.length === 0 ? (
          <p className="text-xs italic text-neutral-500">Ingen saker bundet enda.</p>
        ) : (
          <ul className="list-disc pl-5 text-xs">
            {dsar.case_ids.map((id) => (
              <li key={id} className="font-mono">{id.slice(0, 8)}…</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
