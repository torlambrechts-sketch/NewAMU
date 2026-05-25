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
import { Loader2, Printer, ShieldCheck } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { Button } from '../../components/ui/Button'
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
    if (!supabase) {
      setState({ kind: 'error', message: 'Supabase-klient utilgjengelig.' })
      return
    }
    void supabase
      .rpc('compliance_auditor_token_verify', {
        p_token: token,
        // Server-side guard added in migration 20260926130000 — the RPC
        // now accepts an optional framework hint. We leave it NULL here
        // because the internkontroll page handles five frameworks
        // (aml/ik-f/gdpr/apenhetsloven/iso-45001) and the RPC overload
        // takes a single value; the client-side check below rejects the
        // controls sentinel so a wrong-surface token shows a clear
        // error instead of an empty dashboard.
        p_expected_framework_id: null,
      })
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
        const payload = row as TokenPayload
        // The controls auditor surface lives at /auditor/controls/:token
        // and ships its own snapshot shape. A controls token loaded here
        // would render an empty dashboard layout; surface a clearer
        // error so the recipient knows where to go.
        if (payload.framework_id === 'controls') {
          setState({
            kind: 'error',
            message:
              'Denne lenken er for "Internkontroller" — åpne den fra /auditor/controls/ i stedet.',
          })
          return
        }
        setState({ kind: 'ok', payload })
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
      {/* Print-only header — the live header below is hidden by
          data-print-hide (also `<header>` is hidden by the global print
          stylesheet) so the printed page leads with a clean banner. */}
      <div
        data-print-only
        className="hidden border-b border-neutral-300 pb-3 mb-3 print:block"
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-700">
          Revisor-visning · Internkontroll · Frosset snapshot
        </p>
        <p className="mt-1 text-xs text-neutral-700">
          Delt {createdAt} · Gyldig til {expiresAt}
        </p>
      </div>

      <header
        data-print-hide
        className="border-b border-neutral-200 bg-white"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
            <ShieldCheck className="size-4" style={{ color: accent }} aria-hidden />
            Revisor-visning · Internkontroll
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-neutral-500">
              Lest-modus · Delt {createdAt} · Gyldig til {expiresAt}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              aria-label="Skriv ut eller lagre som PDF"
              className="inline-flex items-center gap-1.5"
            >
              <Printer className="size-3.5" aria-hidden />
              Skriv ut / PDF
            </Button>
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
