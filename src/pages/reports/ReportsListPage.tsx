// /reports — list of every kind='report' row in the org.
//
// Replaces the legacy ReportingEnginePage. Built directly on
// dashboard_layouts now that the engine columns from the
// 20260905120000_reports_promote_dashboard_layouts migration are live.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, FileText, ExternalLink } from 'lucide-react'
import { ModulePageShell } from '../../components/module/ModulePageShell'
import { Button } from '../../components/ui/Button'
import { WarningBox } from '../../components/ui/AlertBox'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import { getDashboardScope, listDashboardScopes } from '../../lib/dashboards/dashboardRegistry'
import { getSupabaseErrorMessage } from '../../lib/supabaseError'

type ReportRow = {
  id: string
  name: string
  description: string | null
  scope_id: string
  report_scopes: string[]
  published_at: string | null
  updated_at: string
  share_token: string | null
}

export function ReportsListPage() {
  const navigate = useNavigate()
  const orgSetup = useOrgSetupContext()
  const { supabase, organization } = orgSetup
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterScope, setFilterScope] = useState<string | 'all'>('all')

  useEffect(() => {
    let cancelled = false
    if (!supabase || !organization?.id) return
    queueMicrotask(() => {
      if (cancelled) return
      setLoading(true)
      setError(null)
    })
    void supabase
      .from('dashboard_layouts')
      .select('id,name,description,scope_id,report_scopes,published_at,updated_at,share_token')
      .eq('organization_id', organization.id)
      .eq('kind', 'report')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) setError(getSupabaseErrorMessage(e))
        else setRows((data ?? []) as ReportRow[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, organization?.id])

  const scopes = useMemo(() => listDashboardScopes(), [])

  const filtered = useMemo(() => {
    if (filterScope === 'all') return rows
    return rows.filter((r) => r.scope_id === filterScope)
  }, [rows, filterScope])

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Rapporter' }]}
      title="Rapporter"
      description="Frosne, signaturklare snapshot av oversiktssidene dine. Del eksternt eller eksporter til PDF/CSV."
      headerActions={
        <Button
          type="button"
          variant="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => navigate('/reports/new')}
        >
          Ny rapport
        </Button>
      }
    >
      <div className="space-y-4">
        {error ? <WarningBox>{error}</WarningBox> : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Filtrer på scope:</span>
          <button
            type="button"
            className={
              filterScope === 'all'
                ? 'rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs text-white'
                : 'rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:border-neutral-500'
            }
            onClick={() => setFilterScope('all')}
          >
            Alle
          </button>
          {scopes.map((s) => (
            <button
              key={s.scopeId}
              type="button"
              className={
                filterScope === s.scopeId
                  ? 'rounded-full border border-neutral-900 bg-neutral-900 px-3 py-1 text-xs text-white'
                  : 'rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:border-neutral-500'
              }
              onClick={() => setFilterScope(s.scopeId)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-12 text-center text-sm text-neutral-500">Laster …</p>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={() => navigate('/reports/new')} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2 text-left">Navn</th>
                  <th className="px-4 py-2 text-left">Hovedscope</th>
                  <th className="px-4 py-2 text-left">Kombinerer</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Sist endret</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const primary = getDashboardScope(r.scope_id)
                  const combinedCount = r.report_scopes.length
                  return (
                    <tr key={r.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <Link to={`/reports/${r.id}`} className="font-medium text-neutral-900 hover:underline">
                          {r.name}
                        </Link>
                        {r.description ? (
                          <div className="text-xs text-neutral-500">{r.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{primary?.label ?? r.scope_id}</td>
                      <td className="px-4 py-3 text-neutral-700">
                        {combinedCount > 0 ? `${combinedCount} scope${combinedCount === 1 ? '' : ''}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {r.published_at ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            Publisert {new Date(r.published_at).toLocaleDateString('nb-NO')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                            Kladd
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-500">
                        {new Date(r.updated_at).toLocaleString('nb-NO')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/reports/${r.id}`}
                          className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
                        >
                          Åpne <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModulePageShell>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center">
      <FileText className="mx-auto h-10 w-10 text-neutral-400" />
      <h3 className="mt-4 text-base font-semibold text-neutral-900">Ingen rapporter ennå</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
        En rapport fryser en oversikt på et gitt tidspunkt og kan deles utad via lenke, PDF eller e-post.
      </p>
      <Button type="button" variant="primary" className="mt-4" onClick={onCreate} icon={<Plus className="h-4 w-4" />}>
        Lag din første rapport
      </Button>
    </div>
  )
}
