// /alerts router — switches between hub mode (no params) and per-template
// mode (?template=...). Mirrors compliance + meetings routing.

import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { useAlerts } from '../useAlerts'
import { ALERT_KIND_SHORT_LABEL, ALERT_STATUS_LABEL } from '../alertsLabels'
import { AlertsHubLanding } from './AlertsHubLanding'

export function AlertsPage() {
  const [searchParams] = useSearchParams()
  const alerts = useAlerts()
  const navigate = useNavigate()
  const templateId = searchParams.get('template')

  const template = useMemo(() => alerts.resolvedTemplates.find((t) => t.id === templateId) ?? null, [alerts.resolvedTemplates, templateId])

  if (!templateId) return <AlertsHubLanding />

  const cases = alerts.cases.filter((c) => c.system_template_id === templateId || c.org_template_id === templateId)

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: template?.name ?? 'Mal' }]}
      title={template?.name ?? 'Mal'}
      description={template?.description ?? null}
      headerActions={
        <div className="flex items-center gap-2">
          <Link to="/alerts"><Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />}>Tilbake</Button></Link>
          {alerts.canManage ? (
            <Button variant="primary" size="sm" icon={<Plus className="size-4" />} onClick={() => alert('Manuell opprettelse: bruk det offentlige skjemaet i mellomtiden')}>
              Ny sak
            </Button>
          ) : null}
        </div>
      }
      loading={alerts.loading}
      notFound={template ? undefined : { title: 'Fant ikke malen', backHref: '/alerts', backLabel: 'Tilbake til hub' }}
    >
      {template ? (
        <>
          <ModuleSectionCard className="p-4 text-xs text-neutral-600">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>Type: <strong className="text-neutral-900">{ALERT_KIND_SHORT_LABEL[template.templateKind]}</strong></span>
              <span className="text-neutral-300">•</span>
              <span>Oppbevaring: <strong className="text-neutral-900">{template.retentionYears} år</strong></span>
              <span className="text-neutral-300">•</span>
              <span>Bekreftelsesfrist: <strong className="text-neutral-900">{template.acknowledgementDueDays} virkedager</strong></span>
              {template.lawRefs.length > 0 ? (
                <>
                  <span className="text-neutral-300">•</span>
                  <span>Lovgrunnlag: <strong className="text-neutral-900">{template.lawRefs.join(', ')}</strong></span>
                </>
              ) : null}
            </div>
          </ModuleSectionCard>

          <ModuleSectionCard>
            <div className="border-b border-neutral-200/70 px-6 py-3">
              <h2 className="text-sm font-semibold text-neutral-900">Saker for denne malen ({cases.length})</h2>
            </div>
            {cases.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-neutral-500">Ingen saker registrert ennå.</div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {cases.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/alerts/${c.id}`)}
                      className="flex w-full items-center justify-between gap-3 px-6 py-3 text-left transition-colors hover:bg-neutral-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-900">{c.title}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {new Date(c.received_at).toLocaleString('no-NO')} · {c.is_anonymous ? 'Anonym' : 'Identifisert'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={c.status === 'closed' || c.status === 'dismissed' ? 'neutral' : c.status === 'received' || c.status === 'triage' ? 'warning' : 'info'}>
                          {ALERT_STATUS_LABEL[c.status]}
                        </Badge>
                        {c.confidentiality_level === 'confidential' ? <Badge variant="critical">Konfidensielt</Badge> : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ModuleSectionCard>
        </>
      ) : null}
    </ModulePageShell>
  )
}
