// TasksManagementReviewPage — ISO 45001 § 9.3 Management Review export.
//
// Generates a structured summary of the task module's compliance state:
// open avvik, overdue items, CAPA funnel, SLA compliance, YTD closed.
// Print-optimised layout — the browser print dialog produces a clean PDF.
// No dashboard engine; data is fetched directly from task_items.

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { ModulePageShell } from '../../src/components/module/ModulePageShell'
import { Button } from '../../src/components/ui/Button'
import { WarningBox } from '../../src/components/ui/AlertBox'
import { ModuleSectionCard } from '../../src/components/module/ModuleSectionCard'
import { TaskStatusBadge } from './components/TaskStatusBadge'
import { TaskPriorityBadge } from './components/TaskPriorityBadge'
import type { TaskItemStatus, TaskItemPriority } from '../../src/types/task'

type ReviewItem = {
  id: string
  title: string
  status: TaskItemStatus
  priority: TaskItemPriority
  templateKind: string | null
  templateName: string | null
  ownerName: string | null
  dueDate: string | null
  closedAt: string | null
  createdAt: string
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('nb-NO', { dateStyle: 'medium' })
  } catch {
    return s
  }
}

function isOverdue(dueDate: string | null, status: string) {
  if (!dueDate || status === 'closed' || status === 'cancelled') return false
  return new Date(dueDate) < new Date()
}

type KpiCardProps = { label: string; value: number | string; sub?: string; accent?: boolean }
function KpiCard({ label, value, sub, accent }: KpiCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent ? 'border-red-200 bg-red-50' : 'border-neutral-200 bg-white'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-3xl font-bold tabular-nums ${
          accent ? 'text-red-700' : 'text-neutral-900'
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  )
}

export function TasksManagementReviewPage() {
  const navigate = useNavigate()
  const { supabase, organization } = useOrgSetupContext()
  const orgId = organization?.id ?? null

  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)

  const fetchItems = useCallback(async () => {
    if (!supabase || !orgId) return
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('task_items')
      .select(
        'id, title, status, priority, template_kind, template_slug, owner_name, due_date, closed_at, created_at',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    setItems(
      (data ?? []).map((r) => ({
        id: String(r.id),
        title: String(r.title ?? ''),
        status: (r.status ?? 'open') as TaskItemStatus,
        priority: (r.priority ?? 'medium') as TaskItemPriority,
        templateKind: r.template_kind ? String(r.template_kind) : null,
        templateName: r.template_slug ? String(r.template_slug) : null,
        ownerName: r.owner_name ? String(r.owner_name) : null,
        dueDate: r.due_date ? String(r.due_date) : null,
        closedAt: r.closed_at ? String(r.closed_at) : null,
        createdAt: String(r.created_at),
      })),
    )
    setGeneratedAt(new Date())
  }, [supabase, orgId])

  useEffect(() => { void fetchItems() }, [fetchItems])

  const now = new Date()
  const ytdStart = new Date(now.getFullYear(), 0, 1)

  const total = items.length
  const open = items.filter((i) => i.status !== 'closed' && i.status !== 'cancelled').length
  const overdue = items.filter((i) => isOverdue(i.dueDate, i.status)).length
  const closedYtd = items.filter((i) => i.closedAt && new Date(i.closedAt) >= ytdStart).length
  const avvikOpen = items.filter(
    (i) => i.templateKind === 'avvik' && i.status !== 'closed' && i.status !== 'cancelled',
  ).length
  const criticalOpen = items.filter(
    (i) => i.priority === 'critical' && i.status !== 'closed' && i.status !== 'cancelled',
  ).length

  const overdueItems = items.filter((i) => isOverdue(i.dueDate, i.status))
  const openAvvikItems = items.filter(
    (i) => i.templateKind === 'avvik' && i.status !== 'closed' && i.status !== 'cancelled',
  )
  const slaItems = items.filter((i) => i.closedAt !== null && i.dueDate !== null)
  const slaOnTime = slaItems.filter(
    (i) => new Date(i.closedAt!) <= new Date(i.dueDate!),
  ).length
  const slaRate = slaItems.length > 0 ? Math.round((slaOnTime / slaItems.length) * 100) : null

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Oppgaver', to: '/tasks/management' },
        { label: 'Ledelsesgjennomgang' },
      ]}
      title="Ledelsesgjennomgang"
      description={`ISO 45001 § 9.3 — generert ${generatedAt ? generatedAt.toLocaleString('nb-NO') : '…'}`}
      headerActions={
        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate('/tasks/management')}
          >
            Tilbake
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void fetchItems()}
            disabled={loading}
          >
            Oppdater
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Printer className="h-4 w-4" />}
            onClick={() => window.print()}
          >
            Skriv ut / PDF
          </Button>
        </div>
      }
    >
      {error && <WarningBox className="print:hidden">{error}</WarningBox>}

      {loading && items.length === 0 ? (
        <p className="py-16 text-center text-sm text-neutral-500">Laster data…</p>
      ) : (
        <div className="space-y-8 print:space-y-6">

          {/* KPI summary */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
              Nøkkeltall
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard label="Totalt" value={total} sub="Alle oppgaver" />
              <KpiCard label="Åpne" value={open} sub="Ikke lukket" />
              <KpiCard label="Forfalt" value={overdue} sub="Passert frist" accent={overdue > 0} />
              <KpiCard label="Lukket i år" value={closedYtd} sub="YTD" />
              <KpiCard label="Åpne avvik" value={avvikOpen} sub="Avvik / hendelser" accent={avvikOpen > 0} />
              <KpiCard label="Kritiske (åpne)" value={criticalOpen} sub="Kritisk prioritet" accent={criticalOpen > 0} />
            </div>
          </section>

          {/* SLA compliance */}
          {slaItems.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                SLA-etterlevelse
              </h2>
              <ModuleSectionCard className="p-5">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-3xl font-bold text-neutral-900">{slaRate ?? '—'}%</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      Lukket innen SLA-frist
                    </p>
                  </div>
                  <div className="h-12 w-px bg-neutral-200" />
                  <div className="text-sm text-neutral-600">
                    <p>{slaOnTime} av {slaItems.length} oppgaver med SLA lukket innen fristen.</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      Bare oppgaver med registrert frist og lukkedato er inkludert.
                    </p>
                  </div>
                </div>
              </ModuleSectionCard>
            </section>
          )}

          {/* Open avvik */}
          {openAvvikItems.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Åpne avvik og hendelser ({openAvvikItems.length})
              </h2>
              <ModuleSectionCard>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Tittel
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Status
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Prioritet
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Ansvarlig
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Opprettet
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {openAvvikItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}
                        >
                          <td className="px-4 py-2.5 font-medium text-neutral-900">
                            {item.title}
                          </td>
                          <td className="px-4 py-2.5">
                            <TaskStatusBadge status={item.status} />
                          </td>
                          <td className="px-4 py-2.5">
                            <TaskPriorityBadge priority={item.priority} />
                          </td>
                          <td className="px-4 py-2.5 text-neutral-600">
                            {item.ownerName ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-neutral-500">
                            {fmtDate(item.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ModuleSectionCard>
            </section>
          )}

          {/* Overdue items */}
          {overdueItems.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Forfalte oppgaver ({overdueItems.length})
              </h2>
              <ModuleSectionCard>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Tittel
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Type
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Prioritet
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Frist
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                          Ansvarlig
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueItems
                        .sort((a, b) => {
                          const pa = ['critical', 'high', 'medium', 'low'].indexOf(a.priority)
                          const pb = ['critical', 'high', 'medium', 'low'].indexOf(b.priority)
                          return pa - pb
                        })
                        .map((item, idx) => (
                          <tr
                            key={item.id}
                            className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}
                          >
                            <td className="px-4 py-2.5 font-medium text-neutral-900">
                              {item.title}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-500 capitalize">
                              {item.templateKind ?? '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <TaskPriorityBadge priority={item.priority} />
                            </td>
                            <td className="px-4 py-2.5 font-medium text-red-600">
                              {fmtDate(item.dueDate)}
                            </td>
                            <td className="px-4 py-2.5 text-neutral-600">
                              {item.ownerName ?? '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </ModuleSectionCard>
            </section>
          )}

          {/* Print footer */}
          <div className="hidden border-t border-neutral-200 pt-4 text-xs text-neutral-400 print:block">
            <p>
              {organization?.name} — Ledelsesgjennomgang ISO 45001 § 9.3 —{' '}
              {generatedAt?.toLocaleString('nb-NO')}
            </p>
          </div>
        </div>
      )}
    </ModulePageShell>
  )
}
