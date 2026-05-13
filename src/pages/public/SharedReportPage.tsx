// /r/:token — anonymous read-only view of a published report. Calls
// redeem_share_token via the standard browser supabase client (the RPC
// is granted to anon). The RPC enforces expiry, password, and per-IP
// rate-limit; this page only renders states.
//
// Side-effect imports every scope file so accent + label resolution
// works without the auth shell having loaded them.

import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Lock, ShieldAlert } from 'lucide-react'
import { ModuleAnalyticsDashboard } from '../../components/module/ModuleAnalyticsDashboard'
import { getSupabaseBrowserClient } from '../../lib/supabaseClient'
import { getDashboardScope } from '../../lib/dashboards/dashboardRegistry'
import type { ReportModule } from '../../types/reportBuilder'

// Side-effect: ensure every scope file has registered so getDashboardScope
// can resolve accents + labels. Public route doesn't go through the auth
// shell where these would normally be imported.
import '../admin/dashboards/complianceCompanyDashboardScope'
import '../admin/dashboards/compliancePersonalDashboardScope'
import '../admin/dashboards/roleComplianceDashboardScope'
import '../documents/dashboards/documentsDashboardScope'
import '../learning/dashboards/learningDashboardScope'
import '../registers/dashboards/registersDashboardScope'

type RpcOk = {
  ok: true
  report: {
    id: string
    name: string
    description: string | null
    scope_id: string
    report_scopes: string[]
    layout: ReportModule[]
    filters: unknown
    snapshot_data: Record<string, unknown> | null
    cover_meta: Record<string, unknown>
    published_at: string
    snapshot_at: string | null
    share_expires_at: string | null
  }
}
type RpcErr = { ok: false; err: 'expired' | 'password_required' | 'password_incorrect' | 'not_found' | 'rate_limited' }
type RpcResult = RpcOk | RpcErr

export function SharedReportPage() {
  const { token } = useParams<{ token: string }>()
  const supabase = getSupabaseBrowserClient()
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'password'; tried: boolean }
    | { kind: 'expired' }
    | { kind: 'notfound' }
    | { kind: 'rate_limited' }
    | { kind: 'error'; message: string }
    | { kind: 'ok'; report: RpcOk['report'] }
  >({ kind: 'loading' })
  const [password, setPassword] = useState('')

  async function call(pwd: string | null) {
    if (!supabase || !token) return
    const { data, error } = await supabase.rpc('redeem_share_token', {
      p_token: token,
      p_password: pwd,
    })
    if (error) {
      setState({ kind: 'error', message: error.message })
      return
    }
    const result = data as RpcResult
    if (!result.ok) {
      switch (result.err) {
        case 'password_required':
          setState({ kind: 'password', tried: pwd != null })
          return
        case 'password_incorrect':
          setState({ kind: 'password', tried: true })
          return
        case 'expired':
          setState({ kind: 'expired' })
          return
        case 'not_found':
          setState({ kind: 'notfound' })
          return
        case 'rate_limited':
          setState({ kind: 'rate_limited' })
          return
      }
    }
    setState({ kind: 'ok', report: result.report })
  }

  useEffect(() => {
    void call(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function onSubmitPassword(e: FormEvent) {
    e.preventDefault()
    void call(password)
  }

  if (state.kind === 'loading') {
    return <CenteredMessage label="Laster delt rapport…" />
  }
  if (state.kind === 'expired') {
    return (
      <CenteredCard
        icon={<ShieldAlert className="h-6 w-6 text-amber-600" />}
        title="Lenken er utløpt"
        body="Be om en ny delelenke fra avsenderen."
      />
    )
  }
  if (state.kind === 'notfound') {
    return (
      <CenteredCard
        icon={<ShieldAlert className="h-6 w-6 text-red-600" />}
        title="Ugyldig lenke"
        body="Lenken er ukjent eller har blitt avpublisert."
      />
    )
  }
  if (state.kind === 'rate_limited') {
    return (
      <CenteredCard
        icon={<ShieldAlert className="h-6 w-6 text-red-600" />}
        title="For mange forsøk"
        body="Vent et minutt og prøv igjen."
      />
    )
  }
  if (state.kind === 'error') {
    return (
      <CenteredCard
        icon={<ShieldAlert className="h-6 w-6 text-red-600" />}
        title="Feil ved lasting"
        body={state.message}
      />
    )
  }
  if (state.kind === 'password') {
    return (
      <CenteredCard
        icon={<Lock className="h-6 w-6 text-neutral-700" />}
        title="Passord kreves"
        body="Avsenderen har beskyttet denne rapporten med passord."
      >
        <form className="mt-4 flex flex-col gap-2" onSubmit={onSubmitPassword}>
          <input
            type="password"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Passord"
            autoFocus
          />
          {state.tried ? (
            <p className="text-xs text-red-600">Feil passord. Prøv igjen.</p>
          ) : null}
          <button
            type="submit"
            className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Åpne rapport
          </button>
        </form>
      </CenteredCard>
    )
  }

  const r = state.report
  const scope = getDashboardScope(r.scope_id)
  return (
    <ModuleAnalyticsDashboard
      breadcrumb={[{ label: 'Delt rapport' }]}
      title={r.name}
      description={r.description ?? undefined}
      accent={scope?.accent}
      layout={r.layout}
      datasets={r.snapshot_data ?? {}}
      readOnly
      snapshotMode
      snapshotAt={r.snapshot_at ?? r.published_at}
      snapshotWatermark="Delt rapport — frosset utdrag. Avsenderen kan trekke lenken tilbake når som helst."
    />
  )
}

function CenteredMessage({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-sm text-neutral-600">
      {label}
    </div>
  )
}

function CenteredCard({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode
  title: string
  body: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {icon}
          <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
        </div>
        <p className="mt-2 text-sm text-neutral-700">{body}</p>
        {children}
      </div>
    </div>
  )
}
