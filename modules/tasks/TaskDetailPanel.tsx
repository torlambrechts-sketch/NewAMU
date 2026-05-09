// TaskDetailPanel — full task item view in a slide-over panel.
// Shows status stepper, participants, core fields, subtasks, and activity log.
// Evidence, consultations, and advanced CAPA fields come in Phase 2/5.

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Clock, User, Users, X } from 'lucide-react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { WORKPLACE_PAGE_SERIF } from '../../src/components/layout/WorkplacePageHeading1'
import { WORKPLACE_STANDARD_LIST_OVERLAY_Z_INDEX } from '../../src/components/layout/WorkplaceStandardListLayout'
import { Badge } from '../../src/components/ui/Badge'
import { TaskStatusBadge, TASK_STATUS_LABEL } from './components/TaskStatusBadge'
import { TaskPriorityBadge } from './components/TaskPriorityBadge'
import { TaskSubtaskList } from './components/TaskSubtaskList'
import type { TaskItemStatus, TaskItemPriority } from '../../src/types/task'
import type { TaskItemRow } from './useTaskItemsData'

type Props = {
  open: boolean
  onClose: () => void
  item: TaskItemRow | null
  onStatusChange?: (id: string, status: TaskItemStatus) => Promise<void>
}

const CAPA_FLOW: TaskItemStatus[] = [
  'open',
  'in_progress',
  'root_cause_identified',
  'action_defined',
  'action_implemented',
  'effectiveness_pending',
  'effectiveness_verified',
  'closed',
]

const SIMPLE_FLOW: TaskItemStatus[] = [
  'open',
  'in_progress',
  'closed',
]

function fmtDate(s: string | null) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('nb-NO', { dateStyle: 'medium' })
  } catch {
    return s
  }
}

function isCapaKind(kind: string | null) {
  return kind === 'avvik' || kind === 'nestenulykke' || kind === 'risiko'
}

type DetailRow = {
  id: string
  title: string
  description: string
  status: TaskItemStatus
  priority: TaskItemPriority
  ownerName: string | null
  assigneeName: string | null
  dueDate: string | null
  slaDueAt: string | null
  createdAt: string
  closedAt: string | null
  templateKind: string | null
}

export function TaskDetailPanel({ open, onClose, item, onStatusChange }: Props) {
  const { supabase } = useOrgSetupContext()
  const [detail, setDetail] = useState<DetailRow | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)

  const loadDetail = useCallback(async (id: string) => {
    if (!supabase) return
    const { data } = await supabase
      .from('task_items')
      .select(
        'id, title, description, status, priority, owner_name, assignee_name, due_date, sla_due_at, created_at, closed_at, template_kind',
      )
      .eq('id', id)
      .single()
    if (data) {
      setDetail({
        id: String(data.id),
        title: String(data.title ?? ''),
        description: String(data.description ?? ''),
        status: (data.status ?? 'open') as TaskItemStatus,
        priority: (data.priority ?? 'medium') as TaskItemPriority,
        ownerName: data.owner_name ? String(data.owner_name) : null,
        assigneeName: data.assignee_name ? String(data.assignee_name) : null,
        dueDate: data.due_date ? String(data.due_date) : null,
        slaDueAt: data.sla_due_at ? String(data.sla_due_at) : null,
        createdAt: String(data.created_at),
        closedAt: data.closed_at ? String(data.closed_at) : null,
        templateKind: data.template_kind ? String(data.template_kind) : null,
      })
    }
  }, [supabase])

  useEffect(() => {
    if (open && item) void loadDetail(item.id)
    if (!open) setDetail(null)
  }, [open, item, loadDetail])

  const handleStatusChange = async (newStatus: TaskItemStatus) => {
    if (!detail || !onStatusChange) return
    setChangingStatus(true)
    await onStatusChange(detail.id, newStatus)
    setDetail((prev) => (prev ? { ...prev, status: newStatus } : prev))
    setChangingStatus(false)
  }

  if (!open) return null

  const row = detail ?? item
  if (!row) return null

  const flow = isCapaKind(row.templateKind) ? CAPA_FLOW : SIMPLE_FLOW
  const currentIdx = flow.indexOf(row.status as TaskItemStatus)

  return (
    <div
      className="fixed inset-0 flex justify-end bg-black/45 backdrop-blur-[2px]"
      style={{ zIndex: WORKPLACE_STANDARD_LIST_OVERLAY_Z_INDEX }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex h-full w-full max-w-[min(100vw,760px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
        role="dialog"
        aria-modal="true"
        aria-label={row.title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200/90 bg-[#f7f6f2] px-6 py-5">
          <div className="min-w-0 flex-1">
            <h2
              className="text-xl font-semibold tracking-tight text-neutral-900 sm:text-2xl"
              style={{ fontFamily: WORKPLACE_PAGE_SERIF }}
            >
              {row.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TaskStatusBadge status={row.status as TaskItemStatus} />
              <TaskPriorityBadge priority={row.priority as TaskItemPriority} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-2 text-neutral-500 transition hover:bg-neutral-200/60 hover:text-neutral-800"
            aria-label="Lukk"
          >
            <X className="size-5" />
          </button>
        </header>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-6 px-6 py-6">

            {/* Status stepper */}
            {onStatusChange && (
              <section>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Status
                </p>
                <div className="flex flex-wrap gap-2">
                  {flow.map((s, idx) => {
                    const isActive = s === row.status
                    const isDone = currentIdx > idx
                    const isNext = currentIdx >= 0 && idx === currentIdx + 1
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={changingStatus || isActive}
                        onClick={() => void handleStatusChange(s)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          isActive
                            ? 'border-[#c2410c] bg-[#c2410c] text-white'
                            : isDone
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : isNext
                            ? 'border-[#c2410c]/30 bg-orange-50 text-[#c2410c] hover:border-[#c2410c] hover:bg-[#c2410c] hover:text-white'
                            : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                        } disabled:cursor-not-allowed`}
                      >
                        {TASK_STATUS_LABEL[s]}
                      </button>
                    )
                  })}
                  {/* Always allow cancellation */}
                  {row.status !== 'cancelled' && row.status !== 'closed' && (
                    <button
                      type="button"
                      disabled={changingStatus}
                      onClick={() => void handleStatusChange('cancelled')}
                      className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      Kanseller
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Description */}
            {row.description && (
              <section>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  Beskrivelse
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {row.description}
                </p>
              </section>
            )}

            {/* Meta grid */}
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {row.ownerName && (
                <div className="flex items-start gap-2">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Ansvarlig
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-800">{row.ownerName}</p>
                  </div>
                </div>
              )}
              {row.assigneeName && (
                <div className="flex items-start gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Tildelt
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-800">{row.assigneeName}</p>
                  </div>
                </div>
              )}
              {row.dueDate && (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Frist
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-800">{fmtDate(row.dueDate)}</p>
                  </div>
                </div>
              )}
              {row.slaDueAt && (
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      SLA-frist
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-800">{fmtDate(row.slaDueAt)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    Opprettet
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-800">{fmtDate(row.createdAt)}</p>
                </div>
              </div>
              {row.closedAt && (
                <div className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                      Lukket
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-800">{fmtDate(row.closedAt)}</p>
                  </div>
                </div>
              )}
            </section>

            {/* Subtasks */}
            <section className="rounded-lg border border-neutral-200/80 bg-white p-4">
              <TaskSubtaskList taskItemId={row.id} />
            </section>

            {/* Phase 2 placeholder sections */}
            <section className="rounded-lg border border-dashed border-neutral-200 p-4 text-center">
              <p className="text-xs text-neutral-400">
                Kommentarer, bevis og konsultasjonslogg implementeres i fase 2.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
