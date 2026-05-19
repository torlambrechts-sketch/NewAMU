// TaskDetailPanel — full task item detail in a right slide-over.
// Tabbed layout: Oppgave (status + fields), Aktivitet (comments + log),
// Bevis (evidence), Konsultasjoner (ISO 45001 § 5.4 participation).

import { useCallback, useEffect, useState } from 'react'
import { Calendar, Clock, User, Users, X } from 'lucide-react'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { WORKPLACE_PAGE_SERIF } from '../../src/components/layout/WorkplacePageHeading1'
import { WORKPLACE_STANDARD_LIST_OVERLAY_Z_INDEX } from '../../src/components/layout/WorkplaceStandardListLayout'
import { Tabs } from '../../src/components/ui/Tabs'
import { Button } from '../../src/components/ui/Button'
import { StandardInput } from '../../src/components/ui/Input'
import { TaskStatusBadge, TASK_STATUS_LABEL } from './components/TaskStatusBadge'
import { TaskPriorityBadge } from './components/TaskPriorityBadge'
import { TaskSubtaskList } from './components/TaskSubtaskList'
import { TaskCommentThread } from './components/TaskCommentThread'
import { TaskEvidenceSection } from './components/TaskEvidenceSection'
import { TaskConsultationLog } from './components/TaskConsultationLog'
import { TaskActivityFeed } from './components/TaskActivityFeed'
import { EntityTimeline } from '../../src/components/audit/EntityTimeline'
// Side-effect — registers tasks audit scope. See spec §5.
import './audit/tasksAuditScope'
import type { TaskItemStatus, TaskItemPriority } from '../../src/types/task'
import type { TaskItemRow } from './useTaskItemsData'

type Props = {
  open: boolean
  onClose: () => void
  item: TaskItemRow | null
  onStatusChange?: (id: string, status: TaskItemStatus) => Promise<void>
  onUpdate?: (id: string, dueDate: string | null) => void
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

const SIMPLE_FLOW: TaskItemStatus[] = ['open', 'in_progress', 'closed']

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

const TABS = [
  { id: 'oppgave', label: 'Oppgave' },
  { id: 'aktivitet', label: 'Aktivitet' },
  { id: 'endringslogg', label: 'Endringslogg' },
  { id: 'bevis', label: 'Bevis' },
  { id: 'konsultasjoner', label: 'Konsultasjoner' },
]

export function TaskDetailPanel({ open, onClose, item, onStatusChange, onUpdate }: Props) {
  const { supabase } = useOrgSetupContext()
  const [detail, setDetail] = useState<DetailRow | null>(null)
  const [tab, setTab] = useState('oppgave')
  const [changingStatus, setChangingStatus] = useState(false)
  const [editDueDate, setEditDueDate] = useState('')

  const loadDetail = useCallback(
    async (id: string) => {
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
    },
    [supabase],
  )

  useEffect(() => {
    if (open && item) {
      setTab('oppgave')
      void loadDetail(item.id)
    }
    if (!open) setDetail(null)
  }, [open, item, loadDetail])

  useEffect(() => {
    setEditDueDate(detail?.dueDate ?? item?.dueDate ?? '')
  }, [detail?.dueDate, item?.dueDate])

  const saveDueDate = async (val: string) => {
    const id = detail?.id ?? item?.id
    if (!supabase || !id) return
    const dateVal = val || null
    await supabase.from('task_items').update({ due_date: dateVal }).eq('id', id)
    setDetail((prev) => (prev ? { ...prev, dueDate: dateVal } : prev))
    onUpdate?.(id, dateVal)
  }

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
        className="flex h-full w-full max-w-[min(100vw,800px)] flex-col bg-[#f7f6f2] shadow-[-12px_0_40px_rgba(0,0,0,0.12)]"
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
              {row.dueDate && new Date(row.dueDate) < new Date() && row.status !== 'closed' && row.status !== 'cancelled' && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  Forfalt
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 shrink-0 text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800"
            aria-label="Lukk"
          >
            <X className="size-5" />
          </Button>
        </header>

        {/* Tab strip */}
        <div className="shrink-0 border-b border-neutral-200/90 bg-[#f7f6f2] px-5">
          <Tabs items={TABS} activeId={tab} onChange={setTab} overflow="scroll" />
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-6">

            {/* ── Oppgave tab ── */}
            {tab === 'oppgave' && (
              <>
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
                        // Gate: avvik/nestenulykke cannot skip directly to closed
                        const isCapaClose =
                          s === 'closed' && isCapaKind(row.templateKind) && row.status !== 'effectiveness_verified'
                        return (
                          <Button
                            key={s}
                            size="sm"
                            variant={isActive ? 'primary' : 'secondary'}
                            disabled={changingStatus || isActive || isCapaClose}
                            title={
                              isCapaClose
                                ? 'Fullfør CAPA-flyten (til «Verifisert effektiv») for å lukke'
                                : undefined
                            }
                            onClick={() => void handleStatusChange(s)}
                            className={`rounded-full ${
                              isActive
                                ? 'bg-[#c2410c] hover:bg-[#c2410c]'
                                : isDone
                                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                                : isCapaClose
                                ? 'cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-300'
                                : isNext
                                ? 'border-[#c2410c]/30 bg-orange-50 text-[#c2410c] hover:border-[#c2410c] hover:bg-[#c2410c] hover:text-white'
                                : 'text-neutral-400 hover:border-neutral-300 hover:text-neutral-600'
                            }`}
                          >
                            {TASK_STATUS_LABEL[s]}
                          </Button>
                        )
                      })}
                      {row.status !== 'cancelled' && row.status !== 'closed' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={changingStatus}
                          onClick={() => void handleStatusChange('cancelled')}
                          className="rounded-full text-neutral-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          Kanseller
                        </Button>
                      )}
                    </div>
                    {/* Soft gate hint for avvik not yet at effectiveness_verified */}
                    {isCapaKind(row.templateKind) &&
                      row.status !== 'closed' &&
                      row.status !== 'cancelled' &&
                      row.status !== 'effectiveness_verified' && (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-700">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Lukking krever fullstendig CAPA-flyt (AML § 5-2 / ISO 45001 § 10.2)
                        </p>
                      )}
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
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                        Frist
                      </p>
                      <StandardInput
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        onBlur={(e) => { void saveDueDate(e.target.value) }}
                        className={`mt-0.5 px-2 py-1 text-sm focus:border-[#c2410c] ${
                          editDueDate && new Date(editDueDate) < new Date() && row.status !== 'closed'
                            ? 'border-red-300 text-red-600'
                            : 'text-neutral-800'
                        }`}
                      />
                    </div>
                  </div>
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
              </>
            )}

            {/* ── Aktivitet tab ── */}
            {tab === 'aktivitet' && (
              <>
                <section className="rounded-lg border border-neutral-200/80 bg-white p-4">
                  <TaskCommentThread taskItemId={row.id} />
                </section>
                <section className="rounded-lg border border-neutral-200/80 bg-white p-4">
                  <TaskActivityFeed taskItemId={row.id} />
                </section>
              </>
            )}

            {/* ── Endringslogg tab ── */}
            {tab === 'endringslogg' && (
              <section className="h-[60vh]">
                <EntityTimeline
                  supabase={supabase}
                  entityKind="task_item"
                  entityId={row.id}
                />
              </section>
            )}

            {/* ── Bevis tab ── */}
            {tab === 'bevis' && (
              <section className="rounded-lg border border-neutral-200/80 bg-white p-4">
                <TaskEvidenceSection taskItemId={row.id} />
              </section>
            )}

            {/* ── Konsultasjoner tab ── */}
            {tab === 'konsultasjoner' && (
              <section className="rounded-lg border border-neutral-200/80 bg-white p-4">
                <TaskConsultationLog taskItemId={row.id} />
              </section>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
