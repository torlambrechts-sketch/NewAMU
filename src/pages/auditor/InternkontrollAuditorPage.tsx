// Unauthenticated auditor view for Internkontroll.
//
// Renders a frozen snapshot of the gap matrix + dashboard layout the
// org admin chose to share. Reads the snapshot via the security-definer
// `compliance_auditor_token_verify` RPC; no Supabase auth context
// required. Expired / revoked tokens render a friendly 410 page.
//
// Layout chrome is intentionally bare — no org navigation, no sidebar,
// no edit affordances. The watermark band makes the share-time and
// origin explicit so an auditor screenshot is self-explanatory.

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, ShieldCheck } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import type { ReportModule } from '../../types/reportBuilder'
import '../overview/internkontroll/internkontrollDashboardScope'

type TokenPayload = {
  framework_id: string
  scope_label: string
  snapshot: Record<string, unknown>
  layout: ReportModule[]
  created_at: string
  expires_at: string
}

export function InternkontrollAuditorPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'expired' }
    | { kind: 'error'; message: string }
    | { kind: 'ok'; payload: TokenPayload }
  >({ kind: 'loading' })

  useEffect(() => {
    if (!token) {
      setState({ kind: 'error', message: 'Mangler token i URL.' })
      return
    }
    let cancelled = false
    const supabase = getSupabaseBrowserClient()
    void supabase
      .rpc('compliance_auditor_token_verify', { p_token: token })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ kind: 'error', message: error.message })
          return
        }
        const row = Array.isArray(data) && data.length > 0 ? data[0] : null
        if (!row) {
          setState({ kind: 'expired' })
          return
        }
        setState({
          kind: 'ok',
          payload: row as TokenPayload,
        })
      })
    return () => {
      cancelled = true
    }
  }, [token])

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
          <h1 className="mt-4 text-xl font-semibold text-neutral-900">Lenken er utløpt</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Denne revisor-lenken er enten utløpt eller tilbakekalt. Be virksomheten
            om en ny lenke for å fortsette gjennomgangen.
          </p>
        </div>
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50/70 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-900">Kunne ikke laste visningen</h1>
          <p className="mt-2 text-sm text-red-900/85">{state.message}</p>
        </div>
      </div>
    )
  }

  const { payload } = state
  const accent = getDashboardScope('internkontroll')?.accent
  const createdAt = new Date(payload.created_at).toLocaleString('nb-NO')
  const expiresAt = new Date(payload.expires_at).toLocaleString('nb-NO')

  return (
    <div className="min-h-screen bg-[#F9F7F2]">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <ShieldCheck className="size-4" style={{ color: accent }} aria-hidden />
            Revisor-visning · Internkontroll
          </div>
          <div className="text-[11px] text-neutral-500">
            Lest-modus · Delt {createdAt} · Gyldig til {expiresAt}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <ModuleAnalyticsDashboard
          accent={accent}
          title={payload.scope_label}
          description={`Frosset øyeblikksbilde delt med revisor. Layouten er låst og data oppdateres ikke.`}
          layout={payload.layout}
          datasets={payload.snapshot}
          readOnly
          snapshotMode
          snapshotAt={payload.created_at}
          snapshotWatermark="Revisor-visning · frosset"
        />
      </main>
    </div>
  )
}
