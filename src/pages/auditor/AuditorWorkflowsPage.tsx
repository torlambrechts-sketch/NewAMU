// AuditorWorkflowsPage — read-only landing page for external auditors.
//
// Accessed via /auditor/workflows?token=<plaintext> (the token was minted
// via workflow_mint_auditor_token and shared by the org admin). The page
// makes ONE call to the workflow-auditor-view edge function which
// validates the token, applies its scope_filter, and returns a
// summarised view of runs + evidence + rule names.
//
// No tenant auth required — the token IS the auth. The page renders
// nothing sensitive: only checksums, counts, and rule names within the
// granted scope. Confidential runs are filtered out server-side.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, FileCheck, ShieldCheck } from 'lucide-react'
import { useStrictRefererPolicy } from '../../lib/security/useStrictRefererPolicy'

type AuditorPayload = {
  ok: boolean
  token: { id: string; label: string; expiresAt: string }
  scope: { dateFrom: string; dateTo: string; lawRefs: string[]; frameworks: string[] }
  runs: Array<{
    id: string
    rule_id: string | null
    source_module: string
    event: string
    status: string
    input_checksum: string | null
    dry_run: boolean | null
    created_at: string
  }>
  evidence: Array<{
    id: string
    run_id: string
    rule_id: string | null
    artefact_kind: string
    storage_path: string
    sha256_checksum: string
    chain_root_checksum: string | null
    law_refs: string[]
    frameworks: string[]
    created_at: string
  }>
  rules: Array<{ id: string; name: string; revisionCount: number }>
}

export function AuditorWorkflowsPage() {
  useStrictRefererPolicy()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [data, setData] = useState<AuditorPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setError('Token mangler — URL må inneholde ?token=…')
      setLoading(false)
      return
    }
    const supabaseUrl = (import.meta as unknown as { env: { VITE_SUPABASE_URL?: string } }).env
      ?.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      setError('VITE_SUPABASE_URL ikke konfigurert')
      setLoading(false)
      return
    }
    fetch(`${supabaseUrl}/functions/v1/workflow-auditor-view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then((r) => r.json())
      .then((d: AuditorPayload | { ok: false; error?: string }) => {
        if (d.ok === false) {
          const err = (d as { error?: string }).error ?? 'Ukjent feil'
          setError(err)
        } else {
          setData(d as AuditorPayload)
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Nettverksfeil'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return <PageShell><p className="text-sm text-neutral-500">Laster …</p></PageShell>
  }
  if (error || !data) {
    return (
      <PageShell>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <AlertTriangle className="mr-1 inline h-4 w-4" />
          {error ?? 'Ugyldig token.'}
        </div>
      </PageShell>
    )
  }

  const ruleById = Object.fromEntries(data.rules.map((r) => [r.id, r]))

  return (
    <PageShell>
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <ShieldCheck className="h-5 w-5 text-emerald-700" />
          Auditor-tilgang: {data.token.label}
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Lese-tilgang — utløper {new Date(data.token.expiresAt).toLocaleString('nb-NO')}.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <span className="text-neutral-500">Datoperiode</span>
          <span>
            {new Date(data.scope.dateFrom).toLocaleDateString('nb-NO')} —{' '}
            {new Date(data.scope.dateTo).toLocaleDateString('nb-NO')}
          </span>
          <span className="text-neutral-500">Law refs</span>
          <span>{data.scope.lawRefs.length > 0 ? data.scope.lawRefs.join(', ') : 'alle'}</span>
          <span className="text-neutral-500">Rammeverk</span>
          <span>{data.scope.frameworks.length > 0 ? data.scope.frameworks.join(', ') : 'alle'}</span>
        </div>
      </div>

      <Section title={`Kjøringer (${data.runs.length})`}>
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left">Tidspunkt</th>
              <th className="px-3 py-2 text-left">Regel</th>
              <th className="px-3 py-2 text-left">Modul · hendelse</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Sjekksum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.runs.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-xs">{new Date(r.created_at).toLocaleString('nb-NO')}</td>
                <td className="px-3 py-2 text-xs">
                  {r.rule_id ? ruleById[r.rule_id]?.name ?? r.rule_id.slice(0, 8) : '—'}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.source_module} · {r.event}
                </td>
                <td className="px-3 py-2 text-xs">{r.status}</td>
                <td className="px-3 py-2 text-[10px]">
                  <code>{r.input_checksum?.slice(0, 16) ?? '—'}…</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={`Evidence (${data.evidence.length})`}>
        <ul className="space-y-1">
          {data.evidence.map((e) => (
            <li key={e.id} className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-neutral-900">
                  <FileCheck className="mr-1 inline h-3 w-3" />
                  {e.artefact_kind}
                </span>
                <span className="text-neutral-500">{new Date(e.created_at).toLocaleString('nb-NO')}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-neutral-600">
                <span>storage_path: <code>{e.storage_path}</code></span>
                <span>sha256: <code>{e.sha256_checksum.slice(0, 16)}…</code></span>
                <span>chain_root: <code>{e.chain_root_checksum?.slice(0, 16) ?? '—'}…</code></span>
                {e.law_refs.length > 0 && <span>law_refs: {e.law_refs.join(', ')}</span>}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Regelendringer (${data.rules.length})`}>
        <ul className="space-y-1">
          {data.rules.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs">
              <span className="font-medium">{r.name}</span>
              <span className="text-neutral-500">{r.revisionCount} revisjoner</span>
            </li>
          ))}
        </ul>
      </Section>

      <p className="text-[11px] text-neutral-500">
        Alle rader er hentet via en signert auditor-token. Sjekksummer kan verifiseres mot
        workflow-evidence-bucket. Tabellen viser bare standard-fortrolige kjøringer.
      </p>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <h3 className="border-b border-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900">{title}</h3>
      <div className="p-4">{children}</div>
    </div>
  )
}

export default AuditorWorkflowsPage
