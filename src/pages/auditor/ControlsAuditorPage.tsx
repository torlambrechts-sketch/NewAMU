// Unauthenticated auditor view for the Compliance Layer (controls).
//
// Renders a frozen snapshot of the org's internal controls + their
// regulation-clause coverage + live status at share-time. Reads via the
// security-definer `compliance_auditor_token_verify` RPC (anon-callable)
// so no Supabase auth context is required. Expired/revoked tokens
// render a friendly 410 page.
//
// Token mechanism is shared with the internkontroll auditor view
// (sentinel `framework_id='controls'`). The token-create button lives at
// `modules/compliance-layer/admin/ShareControlsWithAuditorButton.tsx`.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'

type SnapshotControl = {
  id: string
  slug: string
  name: string
  purpose: string
  control_family: 'preventive' | 'detective' | 'corrective' | 'directive'
  frequency_hint: string | null
  owner_role: string | null
  status: 'draft' | 'active' | 'retired'
  is_system: boolean
}

type SnapshotStatus = {
  control_id: string
  status_label: 'on_track' | 'due_soon' | 'overdue' | 'never_executed' | 'retired'
  last_occurred_at: string | null
  next_due_at: string | null
  total_executions: number
  last12m_executions: number
}

type SnapshotJunction = {
  control_id: string
  clause_id: string
  coverage_level: 'primary' | 'supporting' | 'partial'
  clause_code: string
  clause_title: string
  regulation_id: string
}

type ControlsSnapshot = {
  controls: SnapshotControl[]
  status: SnapshotStatus[]
  junctions: SnapshotJunction[]
}

type TokenPayload = {
  framework_id: string
  scope_label: string
  snapshot: ControlsSnapshot
  layout: unknown
  created_at: string
  expires_at: string
}

const STATUS_PILL: Record<
  SnapshotStatus['status_label'],
  { label: string; ring: string }
> = {
  on_track: { label: 'På sporet', ring: 'bg-emerald-50 text-emerald-900 ring-emerald-200' },
  due_soon: { label: 'Forfaller snart', ring: 'bg-amber-50 text-amber-900 ring-amber-200' },
  overdue: { label: 'Forfalt', ring: 'bg-red-50 text-red-900 ring-red-200' },
  never_executed: {
    label: 'Aldri utført',
    ring: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  },
  retired: { label: 'Pensjonert', ring: 'bg-neutral-200 text-neutral-800 ring-neutral-300' },
}

const FAMILY_LABEL: Record<SnapshotControl['control_family'], string> = {
  preventive: 'Forebyggende',
  detective: 'Avdekkende',
  corrective: 'Korrigerende',
  directive: 'Styrende',
}

const ACCENT = '#b45309' // amber-700, matches the compliance-layer dashboard scope

type FetchState =
  | { kind: 'loading' }
  | { kind: 'expired' }
  | { kind: 'error'; message: string }
  | { kind: 'ok'; payload: TokenPayload }

export function ControlsAuditorPage() {
  const { token } = useParams<{ token: string }>()
  // Initial state is 'loading' so we don't have to setState synchronously
  // inside the effect to enter the fetching phase. Missing-token /
  // missing-client branches are derived at render time below.
  const [state, setState] = useState<FetchState>({ kind: 'loading' })

  // Auditor URLs are private share-tokens — never index. Overrides the
  // site-wide <meta name="robots" content="index, follow"> from index.html
  // while this page is mounted; restored on unmount.
  useEffect(() => {
    const prev = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const prevValue = prev?.getAttribute('content') ?? null
    if (prev) {
      prev.setAttribute('content', 'noindex,nofollow,noarchive')
    } else {
      const m = document.createElement('meta')
      m.setAttribute('name', 'robots')
      m.setAttribute('content', 'noindex,nofollow,noarchive')
      document.head.appendChild(m)
    }
    return () => {
      if (prev && prevValue !== null) prev.setAttribute('content', prevValue)
    }
  }, [])

  useEffect(() => {
    if (!token) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setState({
        kind: 'error',
        message: 'Supabase-klient utilgjengelig.',
      })
      return
    }
    let cancelled = false
    void supabase
      .rpc('compliance_auditor_token_verify', {
        p_token: token,
        // Sentinel mirrored from
        // `modules/compliance-layer/admin/ShareControlsWithAuditorButton.tsx`
        // (CONTROLS_FRAMEWORK_ID). Hard-coded here to keep this public
        // page self-contained — no dependency on the authenticated
        // module bundle that ships the constant.
        p_expected_framework_id: 'controls',
      })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ kind: 'error', message: error.message })
          return
        }
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null
        if (!row) {
          // Either expired/revoked, or a token belonging to a different
          // auditor surface (server-side framework guard now rejects
          // cross-surface attempts; we surface the same 'expired' page
          // so the URL doesn't leak that the token exists under a
          // different framework).
          setState({ kind: 'expired' })
          return
        }
        setState({ kind: 'ok', payload: row as TokenPayload })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  // Derived early-out states (no useEffect needed).
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50/70 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-900">Mangler token</h1>
          <p className="mt-2 text-sm text-red-900/85">
            URL-en mangler en gyldig revisor-token. Be virksomheten om en ny
            lenke.
          </p>
        </div>
      </div>
    )
  }
  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-600">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
        <span>Laster revisor-visning …</span>
      </div>
    )
  }

  if (state.kind === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-lg rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto size-10 text-neutral-300" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-neutral-900">
            Lenken er utløpt
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            Denne revisor-lenken er enten utløpt eller tilbakekalt. Be
            virksomheten om en ny lenke for å fortsette gjennomgangen.
          </p>
        </div>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50/70 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-900">
            Kunne ikke laste visningen
          </h1>
          <p className="mt-2 text-sm text-red-900/85">{state.message}</p>
        </div>
      </div>
    )
  }

  return <RenderSnapshot payload={state.payload} />
}

function RenderSnapshot({ payload }: { payload: TokenPayload }) {
  const createdAt = new Date(payload.created_at).toLocaleString('nb-NO')
  const expiresAt = new Date(payload.expires_at).toLocaleString('nb-NO')
  const snapshot = payload.snapshot

  const statusByControl = useMemo(() => {
    const map = new Map<string, SnapshotStatus>()
    for (const s of snapshot.status) map.set(s.control_id, s)
    return map
  }, [snapshot.status])

  const junctionsByControl = useMemo(() => {
    const map = new Map<string, SnapshotJunction[]>()
    for (const j of snapshot.junctions) {
      const list = map.get(j.control_id) ?? []
      list.push(j)
      map.set(j.control_id, list)
    }
    return map
  }, [snapshot.junctions])

  // KPI summary computed from the snapshot so the auditor sees the
  // same totals as the org admin.
  const kpi = useMemo(() => {
    const out = {
      total: snapshot.controls.length,
      overdue: 0,
      due_soon: 0,
      on_track: 0,
      never_executed: 0,
    }
    for (const s of snapshot.status) {
      if (s.status_label === 'overdue') out.overdue += 1
      else if (s.status_label === 'due_soon') out.due_soon += 1
      else if (s.status_label === 'on_track') out.on_track += 1
      else if (s.status_label === 'never_executed') out.never_executed += 1
    }
    return out
  }, [snapshot])

  const sortedControls = useMemo(() => {
    const rank: Record<SnapshotStatus['status_label'], number> = {
      overdue: 0,
      due_soon: 1,
      never_executed: 2,
      on_track: 3,
      retired: 4,
    }
    return [...snapshot.controls].sort((a, b) => {
      const sa = statusByControl.get(a.id)?.status_label ?? 'never_executed'
      const sb = statusByControl.get(b.id)?.status_label ?? 'never_executed'
      const d = rank[sa] - rank[sb]
      if (d !== 0) return d
      return a.name.localeCompare(b.name, 'nb')
    })
  }, [snapshot.controls, statusByControl])

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <ShieldCheck className="size-4" style={{ color: ACCENT }} aria-hidden />
            Revisor-visning · Internkontroller
          </div>
          <div className="text-[11px] text-neutral-500">
            Lest-modus · Delt {createdAt} · Gyldig til {expiresAt}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        <section>
          <h1
            className="text-2xl font-semibold text-neutral-900"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            {payload.scope_label}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Frosset øyeblikksbilde — virksomheten kan fortsette å arbeide,
            men endringer vises ikke før en ny lenke deles.
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Totalt" value={kpi.total} accent={ACCENT} />
          <KpiCard
            label="Forfalt"
            value={kpi.overdue}
            tone={kpi.overdue > 0 ? 'danger' : 'neutral'}
          />
          <KpiCard
            label="Forfaller snart"
            value={kpi.due_soon}
            tone={kpi.due_soon > 0 ? 'warning' : 'neutral'}
          />
          <KpiCard
            label="På sporet"
            value={kpi.on_track}
            tone={kpi.on_track > 0 ? 'success' : 'neutral'}
          />
          <KpiCard label="Aldri utført" value={kpi.never_executed} tone="neutral" />
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-700">
            Kontroller ({sortedControls.length})
          </h2>
          {sortedControls.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-600">
              Ingen kontroller var registrert da snapshotet ble delt.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <caption className="sr-only">
                  Internkontroller med status og lovkravdekning på
                  tidspunktet for deling.
                </caption>
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium text-neutral-700">Navn</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium text-neutral-700">Familie</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium text-neutral-700">Frekvens</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium text-neutral-700">Eier</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium text-neutral-700">Status</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium text-neutral-700">Sist utført</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium text-neutral-700">Lovkrav dekket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {sortedControls.map((c) => {
                    const sv = statusByControl.get(c.id)
                    const pill =
                      sv?.status_label ? STATUS_PILL[sv.status_label] : STATUS_PILL.never_executed
                    const clauses = junctionsByControl.get(c.id) ?? []
                    return (
                      <tr key={c.id} className="align-top">
                        <td className="px-3 py-2 text-neutral-900">
                          <div className="font-medium">{c.name}</div>
                          {c.purpose ? (
                            <div className="mt-0.5 text-xs text-neutral-600">{c.purpose}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-neutral-800">
                          {FAMILY_LABEL[c.control_family]}
                        </td>
                        <td className="px-3 py-2 text-neutral-800">
                          {c.frequency_hint ?? 'Ad hoc'}
                        </td>
                        <td className="px-3 py-2 text-neutral-800">{c.owner_role ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${pill.ring}`}
                          >
                            {pill.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-neutral-800">
                          {sv?.last_occurred_at
                            ? new Date(sv.last_occurred_at).toLocaleDateString('nb-NO')
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-neutral-800">
                          {clauses.length === 0 ? (
                            <span className="text-neutral-500">Ingen</span>
                          ) : (
                            <ul className="space-y-0.5">
                              {clauses.map((j) => (
                                <li
                                  key={`${j.control_id}:${j.clause_id}`}
                                  className="text-xs"
                                >
                                  <span className="font-mono text-neutral-700">
                                    {j.clause_code}
                                  </span>
                                  {j.coverage_level !== 'primary' ? (
                                    <span className="ml-1 text-neutral-500">
                                      ({j.coverage_level})
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          <p>
            Lenken kan tilbakekalles når som helst av virksomheten. Ved
            spørsmål: kontakt virksomhetens HMS-leder.
          </p>
        </footer>
      </main>
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone = 'neutral',
  accent,
}: {
  label: string
  value: number
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  accent?: string
}) {
  const toneClass: Record<typeof tone, string> = {
    neutral: 'text-neutral-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-red-700',
  }
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold ${toneClass[tone]}`}
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
    </div>
  )
}
