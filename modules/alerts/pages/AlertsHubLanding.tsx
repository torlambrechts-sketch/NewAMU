// Hub landing for /alerts — lists template tiles grouped by category,
// plus the open-cases pile. Mirrors ChecklistsHubLanding layout.

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ChevronRight } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
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
    <div className="mt-2 flex gap-3 text-xs text-neutral-600">
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
          <Link to="/alerts/analyse"><Button variant="ghost" size="sm">Analyse</Button></Link>
          {alerts.canManage ? <Link to="/alerts/admin"><Button variant="secondary" size="sm">Innstillinger</Button></Link> : null}
        </div>
      }
      loading={alerts.loading}
      loadingLabel="Laster varslinger…"
    >
      {alerts.error ? (
        <ModuleSectionCard className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{alerts.error}</ModuleSectionCard>
      ) : null}

      <ModuleSectionCard className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Åpne saker</p>
            <p className="mt-1 text-3xl font-semibold" style={{ color: ALERTS_ACCENT }}>{openCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Forsinket kvittering</p>
            <p className={`mt-1 text-3xl font-semibold ${overdueCount > 0 ? 'text-red-700' : 'text-neutral-400'}`}>{overdueCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Totalt</p>
            <p className="mt-1 text-3xl font-semibold text-neutral-900">{alerts.cases.length}</p>
          </div>
        </div>
      </ModuleSectionCard>

      {grouped.length === 0 ? (
        <ModuleSectionCard className="p-6">
          <p className="text-sm text-neutral-700">Ingen aktive maler. Aktiver maler under Innstillinger.</p>
        </ModuleSectionCard>
      ) : (
        <div className="space-y-6">
          {grouped.map(([catId, group]) => (
            <ModuleSectionCard key={catId} className="p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-neutral-900">{group.name}</h2>
                    <Badge variant="info">{group.templates.length} maler</Badge>
                  </div>
                </div>
              </div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.templates.map((t) => (
                  <li key={`${t.kind}:${t.id}`}>
                    <button
                      type="button"
                      onClick={() => navigate(`/alerts?template=${encodeURIComponent(t.id)}`)}
                      className="group flex h-full w-full flex-col gap-2 rounded-lg border border-neutral-200/80 bg-white p-4 text-left transition-colors hover:border-[#b91c1c]/40 hover:bg-neutral-50"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ALERTS_ACCENT }} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-neutral-900 group-hover:text-[#b91c1c]">{t.name}</span>
                          <span className="mt-0.5 block text-xs text-neutral-500">{ALERT_KIND_SHORT_LABEL[t.templateKind]}</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </div>
                      {t.description ? <p className="line-clamp-2 text-xs text-neutral-600">{t.description}</p> : null}
                      <CountsForTemplate templateId={t.id} cases={alerts.cases} />
                    </button>
                  </li>
                ))}
              </ul>
            </ModuleSectionCard>
          ))}
        </div>
      )}

      {recentCases.length > 0 ? (
        <ModuleSectionCard>
          <div className="border-b border-neutral-200/70 px-6 py-3">
            <h2 className="text-sm font-semibold text-neutral-900">Siste saker</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {recentCases.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/alerts/${c.id}`)}
                  className="flex w-full items-center justify-between gap-3 px-6 py-3 text-left transition-colors hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">{c.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{new Date(c.received_at).toLocaleString('no-NO')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
          <div className="border-t border-neutral-200/70 px-6 py-3 text-right">
            <Link
              to="/alerts/alle"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#b91c1c] hover:underline"
            >
              Vis alle <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </ModuleSectionCard>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-neutral-500">
        <AlertTriangle className="size-3" /> Anonymitet og taushetsplikt er førsteprioritet. AML § 2A-7 (5).
      </p>
    </ModulePageShell>
  )
}
