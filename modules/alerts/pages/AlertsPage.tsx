// /alerts router — switches between hub mode (no params) and per-template
// mode (?template=...). Mirrors meetings + compliance routing.

import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
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
          <Link to="/alerts"><Button variant="ghost" icon={<ArrowLeft className="size-4" />}>Tilbake</Button></Link>
          {alerts.canManage ? (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => alert('Manuell opprettelse: bruk det offentlige skjemaet i mellomtiden')}>
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
          <div className="rounded-none border border-neutral-200 bg-white p-4 text-xs text-neutral-600">
            <span>Type: <strong>{ALERT_KIND_SHORT_LABEL[template.templateKind]}</strong></span>
            <span className="mx-3">•</span>
            <span>Retention: <strong>{template.retentionYears} år</strong></span>
            <span className="mx-3">•</span>
            <span>Bekreftelsesfrist: <strong>{template.acknowledgementDueDays} virkedager</strong></span>
            {template.lawRefs.length > 0 ? (
              <>
                <span className="mx-3">•</span>
                <span>Lovgrunnlag: {template.lawRefs.join(', ')}</span>
              </>
            ) : null}
          </div>

          <section className="rounded-none border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 px-6 py-3"><h2 className="text-sm font-semibold">Saker for denne malen ({cases.length})</h2></div>
            {cases.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-neutral-500">Ingen saker registrert ennå.</div>
            ) : (
              <ul className="divide-y divide-neutral-100">
                {cases.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/alerts/${c.id}`)}
                      className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-neutral-50"
                    >
                      <div>
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          {new Date(c.received_at).toLocaleString('no-NO')} · {c.is_anonymous ? 'Anonym' : 'Identifisert'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
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
          </section>
        </>
      ) : null}
    </ModulePageShell>
  )
}
