// /alerts router — switches between hub mode (no params) and per-template
// mode (?template=...). Per-template view mirrors ChecklistsPage exactly:
// LayoutScoreStatRow KPI strip + LayoutTable1PostingsShell table + slide-
// panel create flow.

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { LayoutScoreStatRow } from '../../../src/components/layout/LayoutScoreStatRow'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../../src/components/layout/layoutTable1PostingsKit'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import { useAlerts } from '../useAlerts'
import { ALERT_STATUS_LABEL } from '../alertsLabels'
import { AlertsHubLanding } from './AlertsHubLanding'
import { AlertsCreateForm } from '../components/AlertsCreateForm'
import { AlertAcknowledgementBadge, AlertGdprDeadlineBadge } from '../components/AlertDeadlineBadges'
import type { AlertStatus } from '../types'

function statusBadgeVariant(s: AlertStatus): 'neutral' | 'warning' | 'info' | 'success' {
  if (s === 'closed') return 'success'
  if (s === 'dismissed') return 'neutral'
  if (s === 'received' || s === 'triage') return 'warning'
  return 'info'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AlertsPage() {
  const [searchParams] = useSearchParams()
  const alerts = useAlerts()
  const navigate = useNavigate()
  const templateId = searchParams.get('template')
  const [createOpen, setCreateOpen] = useState(false)

  // All hooks must run on every render — no early returns above this line.
  // React's "Rendered more hooks than during the previous render" error
  // fires the moment you navigate between /alerts and /alerts?template=…
  // if any hook lives below a conditional return.
  const template = useMemo(
    () => alerts.resolvedTemplates.find((t) => t.id === templateId) ?? null,
    [alerts.resolvedTemplates, templateId],
  )

  const cases = useMemo(
    () => (templateId
      ? alerts.cases
          .filter((c) => c.system_template_id === templateId || c.org_template_id === templateId)
          .sort((a, b) => b.received_at.localeCompare(a.received_at))
      : []),
    [alerts.cases, templateId],
  )

  if (!templateId) return <AlertsHubLanding />

  const openCount = cases.filter((c) => !['closed', 'dismissed'].includes(c.status)).length
  const criticalCount = cases.filter((c) => c.severity === 'critical').length
  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString()
  const closedYtd = cases.filter((c) => c.closed_at && c.closed_at >= yearStart).length

  const pageTitle = template?.name ?? 'Mal'
  const pageDescription = template?.description ?? null
  const ctaLabel = template ? `Ny ${template.name.toLowerCase()}` : 'Ny sak'

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: pageTitle }]}
      title={pageTitle}
      description={pageDescription}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
            disabled={!template || !alerts.canManage}
          >
            {ctaLabel}
          </Button>
        </div>
      }
      loading={alerts.loading}
      notFound={template ? undefined : { title: 'Fant ikke malen', backHref: '/alerts', backLabel: 'Tilbake til hub' }}
    >
      {template ? (
        <div className="space-y-6">
          {alerts.error ? <WarningBox>{alerts.error}</WarningBox> : null}

          <LayoutScoreStatRow
            items={[
              {
                big: String(openCount),
                title: 'Åpne saker',
                sub: template.name,
              },
              {
                big: String(criticalCount),
                title: 'Kritisk alvorlighet',
                sub: 'Krever oppfølging',
              },
              {
                big: String(closedYtd),
                title: 'Lukket i år',
                sub: template.name,
              },
            ]}
          />

          <LayoutTable1PostingsShell
            wrap
            title={pageTitle}
            description={`Alle ${pageTitle.toLowerCase()} — sortert etter siste aktivitet.`}
            toolbar={null}
            footer={<span className="text-neutral-500">{cases.length} poster</span>}
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                    <th className={LAYOUT_TABLE1_POSTINGS_TH}>Mottatt</th>
                    <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
                  </tr>
                </thead>
                <tbody>
                  {cases.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="py-12 text-center">
                          <p className="text-sm text-neutral-500">Ingen saker registrert ennå.</p>
                          {alerts.canManage ? (
                            <div className="mt-3 inline-flex">
                              <Button
                                variant="primary"
                                icon={<Plus className="h-4 w-4" />}
                                onClick={() => setCreateOpen(true)}
                              >
                                {ctaLabel}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cases.map((row) => (
                      <tr
                        key={row.id}
                        className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                        onClick={() => navigate(`/alerts/${row.id}`)}
                      >
                        <td className="px-5 py-3 font-medium text-neutral-900">{row.title}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant={statusBadgeVariant(row.status)}>
                              {ALERT_STATUS_LABEL[row.status]}
                            </Badge>
                            {row.confidentiality_level === 'confidential' ? (
                              <Badge variant="critical">Konfidensielt</Badge>
                            ) : null}
                            {!row.closed_at ? <AlertAcknowledgementBadge case_={row} /> : null}
                            {!row.closed_at ? <AlertGdprDeadlineBadge case_={row} /> : null}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-neutral-600">{formatDate(row.received_at)}</td>
                        <td className="w-8 px-3 py-3 text-neutral-300">
                          <ChevronRight className="h-4 w-4" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </LayoutTable1PostingsShell>
        </div>
      ) : null}

      <AlertsCreateForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        templates={alerts.resolvedTemplates}
        defaultTemplateId={templateId}
        onCreate={async (payload) => {
          const result = await alerts.createCase({
            templateId: payload.templateId,
            templateKind: payload.templateKind,
            kind: payload.kind,
            title: payload.title,
            description: payload.description,
            isAnonymous: payload.isAnonymous,
            reporterContact: payload.reporterContact ?? null,
            occurredAtText: payload.occurredAtText ?? null,
          })
          if (result) {
            setCreateOpen(false)
            navigate(`/alerts/${result.id}`)
          }
        }}
      />
    </ModulePageShell>
  )
}
