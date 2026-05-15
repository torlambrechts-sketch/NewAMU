// Flat list of all cases — searchable + status-filterable. Mirrors the
// "Alle X" pattern used across other modules.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ModulePageShell } from '../../../src/components/module/ModulePageShell'
import { Badge } from '../../../src/components/ui/Badge'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { useAlerts } from '../useAlerts'
import { ALERT_KIND_SHORT_LABEL, ALERT_STATUS_LABEL } from '../alertsLabels'
import type { AlertStatus } from '../types'

const STATUSES: Array<AlertStatus | 'open' | 'all'> = ['all', 'open', 'received', 'triage', 'investigation', 'internal_review', 'closed', 'dismissed']

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
      headerActions={<Link to="/alerts"><Button variant="ghost" icon={<ArrowLeft className="size-4" />}>Tilbake</Button></Link>}
      loading={alerts.loading}
    >
      <div className="flex flex-wrap items-center gap-2 rounded-none border border-neutral-200 bg-white p-3">
        <StandardInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk i tittel …" className="flex-1 min-w-[200px]" />
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-none border px-3 py-1.5 text-xs ${statusFilter === s ? 'border-[#b91c1c] bg-[#b91c1c] text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'}`}
            >
              {s === 'all' ? 'Alle' : s === 'open' ? 'Åpne' : ALERT_STATUS_LABEL[s as AlertStatus]}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-none border border-neutral-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-neutral-500">Ingen saker matcher filteret.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => navigate(`/alerts/${c.id}`)} className="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-neutral-50">
                  <div>
                    <p className="text-sm font-medium">{c.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {ALERT_KIND_SHORT_LABEL[c.kind]} · {new Date(c.received_at).toLocaleDateString('no-NO')}
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
    </ModulePageShell>
  )
}
