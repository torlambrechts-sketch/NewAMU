// Hub landing for /alerts — lists template tiles grouped by category,
// plus the open-cases pile. Mirrors the meetings + compliance hub shape.

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { useAlerts } from '../useAlerts'
import { ALERT_KIND_SHORT_LABEL, ALERT_STATUS_LABEL, ALERTS_ACCENT } from '../alertsLabels'
import type { ResolvedAlertTemplate, AlertCaseRow } from '../types'

function CountsForTemplate(props: { templateId: string; cases: AlertCaseRow[] }) {
  const counts = useMemo(() => {
    const t = props.cases.filter((c) => c.system_template_id === props.templateId || c.org_template_id === props.templateId)
    return {
      total: t.length,
      open: t.filter((c) => !['closed', 'dismissed'].includes(c.status)).length,
      overdue: t.filter((c) => !c.acknowledged_at && c.acknowledgement_due_at < new Date().toISOString() && !['closed', 'dismissed'].includes(c.status)).length,
    }
  }, [props.cases, props.templateId])
  return (
    <div className="flex gap-3 text-xs text-neutral-600">
      <span>Totalt: <strong>{counts.total}</strong></span>
      <span>Åpne: <strong>{counts.open}</strong></span>
      {counts.overdue > 0 ? <span className="text-red-700">Forsinket: <strong>{counts.overdue}</strong></span> : null}
    </div>
  )
}

export function AlertsHubLanding() {
  const alerts = useAlerts()
  const navigate = useNavigate()

  const grouped = useMemo(() => {
    const out = new Map<string, { name: string; templates: ResolvedAlertTemplate[] }>()
    const catMap = new Map(alerts.categories.map((c) => [c.id, c]))
    for (const t of alerts.resolvedTemplates) {
      const catId = t.categoryId ?? 'uten-kategori'
      const cat = catId === 'uten-kategori' ? null : catMap.get(catId)
      const key = cat ? cat.id : 'uten-kategori'
      const name = cat?.name ?? 'Uten kategori'
      if (!out.has(key)) out.set(key, { name, templates: [] })
      out.get(key)!.templates.push(t)
    }
    return Array.from(out.entries()).sort(([a], [b]) => {
      const ca = alerts.categories.find((c) => c.id === a)?.position ?? 999
      const cb = alerts.categories.find((c) => c.id === b)?.position ?? 999
      return ca - cb
    })
  }, [alerts.resolvedTemplates, alerts.categories])

  const recentCases = useMemo(() => alerts.cases.slice(0, 8), [alerts.cases])
  const openCount = useMemo(() => alerts.cases.filter((c) => !['closed', 'dismissed'].includes(c.status)).length, [alerts.cases])
  const overdueCount = useMemo(() => alerts.cases.filter((c) => !c.acknowledged_at && c.acknowledgement_due_at < new Date().toISOString() && !['closed', 'dismissed'].includes(c.status)).length, [alerts.cases])

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Varslinger' }]}
      title="Varslinger"
      description="Varsler etter AML kap. 2A, GDPR-brudd (Art. 33), HMS-avvik, sikkerhetshendelser og etiske bekymringer."
      headerActions={
        <div className="flex items-center gap-2">
          <Link to="/alerts/analyse"><Button variant="ghost">Analyse</Button></Link>
          {alerts.canManage ? <Link to="/alerts/admin"><Button variant="secondary">Innstillinger</Button></Link> : null}
        </div>
      }
      loading={alerts.loading}
      loadingLabel="Laster varslinger…"
    >
      {alerts.error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{alerts.error}</div>
      ) : null}

      <section className="rounded-none border border-neutral-200 bg-white">
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-neutral-500">Åpne saker</p>
            <p className="mt-1 text-3xl font-semibold" style={{ color: ALERTS_ACCENT }}>{openCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-neutral-500">Forsinket kvittering</p>
            <p className={`mt-1 text-3xl font-semibold ${overdueCount > 0 ? 'text-red-700' : 'text-neutral-400'}`}>{overdueCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-neutral-500">Totalt i år</p>
            <p className="mt-1 text-3xl font-semibold text-neutral-900">{alerts.cases.length}</p>
          </div>
        </div>
      </section>

      {grouped.length === 0 ? (
        <div className="rounded-none border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          Ingen aktive maler. Aktiver maler under Innstillinger.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([catId, group]) => (
            <section key={catId}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">{group.name}</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {group.templates.map((t) => (
                  <Link
                    key={`${t.kind}:${t.id}`}
                    to={`/alerts?template=${encodeURIComponent(t.id)}`}
                    className="block rounded-none border border-neutral-200 bg-white p-4 hover:border-[#b91c1c] hover:bg-neutral-50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">{ALERT_KIND_SHORT_LABEL[t.templateKind]}</p>
                      </div>
                      <ChevronRight className="size-4 text-neutral-400" />
                    </div>
                    {t.description ? <p className="mt-2 line-clamp-2 text-xs text-neutral-600">{t.description}</p> : null}
                    <div className="mt-3"><CountsForTemplate templateId={t.id} cases={alerts.cases} /></div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {recentCases.length > 0 ? (
        <section className="rounded-none border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-6 py-3">
            <h2 className="text-sm font-semibold">Siste saker</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {recentCases.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/alerts/${c.id}`)}
                  className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-neutral-50"
                >
                  <div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{new Date(c.received_at).toLocaleString('no-NO')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.status === 'closed' || c.status === 'dismissed' ? 'neutral' : c.status === 'received' || c.status === 'triage' ? 'warning' : 'info'}>
                      {ALERT_STATUS_LABEL[c.status]}
                    </Badge>
                    {c.confidentiality_level === 'confidential' ? <Badge variant="critical">Konfidensielt</Badge> : null}
                    {c.severity ? <Badge variant={c.severity === 'critical' || c.severity === 'high' ? 'high' : 'info'}>{c.severity}</Badge> : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-neutral-100 px-6 py-3 text-right">
            <Link to="/alerts/alle" className="text-xs font-medium text-[#b91c1c] underline">Vis alle →</Link>
          </div>
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-neutral-500">
        <AlertTriangle className="size-3" /> Anonymitet og taushetsplikt er førsteprioritet. AML § 2A-7 (5).
      </p>
    </ModulePageShell>
  )
}
