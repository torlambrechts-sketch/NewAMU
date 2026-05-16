// Flat list of all cases — searchable + status-filterable. Mirrors the
// "Alle X" pattern: LayoutTable1PostingsShell + LayoutTable1Postings tokens.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { ModuleSectionCard } from '../../../src/components/module/ModuleSectionCard'
import { LayoutTable1PostingsShell } from '../../../src/components/layout/LayoutTable1PostingsShell'
import {
  LAYOUT_TABLE1_POSTINGS_BODY_ROW,
  LAYOUT_TABLE1_POSTINGS_HEADER_ROW,
  LAYOUT_TABLE1_POSTINGS_TH,
} from '../../../src/components/layout/layoutTable1PostingsKit'
import { Badge } from '../../../src/components/ui/Badge'
import { StandardInput } from '../../../src/components/ui/Input'
import { useAlerts } from '../useAlerts'
import { ALERT_KIND_SHORT_LABEL, ALERT_STATUS_LABEL } from '../alertsLabels'
import type { AlertStatus } from '../types'

const STATUSES: Array<AlertStatus | 'open' | 'all'> = ['all', 'open', 'received', 'triage', 'investigation', 'internal_review', 'closed', 'dismissed']

function statusBadgeVariant(s: AlertStatus): 'neutral' | 'warning' | 'info' | 'success' {
  if (s === 'closed') return 'success'
  if (s === 'dismissed') return 'neutral'
  if (s === 'received' || s === 'triage') return 'warning'
  return 'info'
}

export function AlertsAllePage() {
  const alerts = useAlerts()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'open' | 'all'>('open')

  const filtered = useMemo(() => {
    const qLower = q.trim().toLowerCase()
    return alerts.cases.filter((c) => {
      if (statusFilter === 'all') {
        // pass
      } else if (statusFilter === 'open') {
        if (['closed', 'dismissed'].includes(c.status)) return false
      } else if (c.status !== statusFilter) return false
      if (qLower && !c.title.toLowerCase().includes(qLower)) return false
      return true
    })
  }, [alerts.cases, q, statusFilter])

  return (
    <ModulePageShell
      breadcrumb={[{ label: 'Varslinger', to: '/alerts' }, { label: 'Alle' }]}
      title="Alle saker"
      description="Alle saker — sortert etter siste aktivitet."
      loading={alerts.loading}
    >
      <ModuleSectionCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <StandardInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk i tittel …"
            className="min-w-[200px] flex-1"
          />
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'border-[#b91c1c] bg-[#b91c1c] text-white'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {s === 'all' ? 'Alle' : s === 'open' ? 'Åpne' : ALERT_STATUS_LABEL[s as AlertStatus]}
              </button>
            ))}
          </div>
        </div>
      </ModuleSectionCard>

      <LayoutTable1PostingsShell
        wrap
        title="Alle saker"
        description="Sortert etter mottakstidspunkt."
        toolbar={null}
        footer={<span className="text-neutral-500">{filtered.length} poster</span>}
      >
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className={LAYOUT_TABLE1_POSTINGS_HEADER_ROW}>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Tittel</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Type</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Status</th>
                <th className={LAYOUT_TABLE1_POSTINGS_TH}>Mottatt</th>
                <th className={`w-8 ${LAYOUT_TABLE1_POSTINGS_TH}`} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="py-12 text-center text-sm text-neutral-500">
                      Ingen saker matcher filteret.
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    className={`${LAYOUT_TABLE1_POSTINGS_BODY_ROW} cursor-pointer hover:bg-neutral-50`}
                    onClick={() => navigate(`/alerts/${c.id}`)}
                  >
                    <td className="px-5 py-3 font-medium text-neutral-900">{c.title}</td>
                    <td className="px-5 py-3 text-neutral-600">{ALERT_KIND_SHORT_LABEL[c.kind]}</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusBadgeVariant(c.status)}>{ALERT_STATUS_LABEL[c.status]}</Badge>
                      {c.confidentiality_level === 'confidential' ? (
                        <Badge variant="critical" className="ml-1">Konfidensielt</Badge>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-neutral-600">{new Date(c.received_at).toLocaleDateString('no-NO')}</td>
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
    </ModulePageShell>
  )
}
