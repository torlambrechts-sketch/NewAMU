import { useCallback, useMemo, useState } from 'react'
import { Check, MessageSquare, Plus, Trash2, X } from 'lucide-react'
import { Badge } from '../../src/components/ui/Badge'
import { Button } from '../../src/components/ui/Button'
import { SearchableSelect } from '../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { SlidePanel } from '../../src/components/layout/SlidePanel'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../src/hooks/useOrgSetupContext'
import { useOrganisation } from '../../src/hooks/useOrganisation'
import type { Task } from '../../src/types/task'
import { MODULE_LABELS } from '../../src/lib/taskNavigation'
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  formatDueDate,
  isOverdue,
  priorityBadgeVariant,
  statusBadgeVariant,
} from './taskUiHelpers'
import { TASK_DEFAULT_LABEL_SUGGESTIONS, TASK_PRIORITY_OPTIONS, type TaskPriority } from './types'
import type { UseTaskExtensions } from './useTaskExtensions'

type Props = {
  open: boolean
  task: Task | null
  ext: UseTaskExtensions
  onClose: () => void
  onSetStatus: (taskId: string, status: Task['status']) => void
  onDelete: (taskId: string) => void
  onSignAsAssignee: (taskId: string) => void | Promise<unknown>
  onSignManagement: (taskId: string) => void | Promise<unknown>
}

/**
 * Right-aligned slide panel that lets users review and refine a single task.
 * The signed core fields (status / signature) flow through the parent's
 * `useTasks` callbacks; only the planning metadata (priority, labels,
 * comments, …) is mutated through `useTaskExtensions`.
 */
export function TaskDetailPanel(props: Props) {
  // Render an inner body keyed on the task id so all per-task draft state
  // resets cleanly when a different task is opened — no setState-in-effect.
  if (!props.task) {
    return (
      <SlidePanel
        open={false}
        onClose={props.onClose}
        titleId="task-detail-panel"
        title=""
        footer={<span aria-hidden />}
      >
        <span aria-hidden />
      </SlidePanel>
    )
  }
  return <TaskDetailPanelBody key={props.task.id} {...props} task={props.task} />
}

type BodyProps = Omit<Props, 'task'> & { task: Task }

function TaskDetailPanelBody({
  open,
  task,
  ext,
  onClose,
  onSetStatus,
  onDelete,
  onSignAsAssignee,
  onSignManagement,
}: BodyProps) {
  const { profile, user } = useOrgSetupContext()
  const org = useOrganisation()

  const [commentDraft, setCommentDraft] = useState('')
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [labelDraft, setLabelDraft] = useState('')

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'Uten prosjekt' },
      ...ext.projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [ext.projects],
  )

  const milestoneOptions = useMemo(() => {
    const projectId = ext.taskExtensionMap.get(task.id)?.projectId
    if (!projectId) return [{ value: '', label: 'Ingen milepæl tilgjengelig — knytt til prosjekt først' }]
    const items = ext.milestones.filter((m) => m.projectId === projectId)
    return [{ value: '', label: 'Uten milepæl' }, ...items.map((m) => ({ value: m.id, label: `${m.name} (${formatDueDate(m.dueDate)})` }))]
  }, [task, ext.taskExtensionMap, ext.milestones])

  const watcherOptions = useMemo(
    () => org.displayEmployees.map((e) => ({ value: e.id, label: e.name })),
    [org.displayEmployees],
  )

  const taskExtension = ext.taskExtensionMap.get(task.id)

  const authorName = profile?.display_name?.trim() || profile?.email || user?.email || 'Bruker'
  const authorUserId = user?.id ?? undefined

  const submitComment = useCallback(() => {
    ext.addComment(task.id, commentDraft, authorName, authorUserId)
    setCommentDraft('')
  }, [task.id, ext, commentDraft, authorName, authorUserId])

  const submitSubtask = useCallback(() => {
    ext.addSubtask(task.id, subtaskDraft)
    setSubtaskDraft('')
  }, [task.id, ext, subtaskDraft])

  const submitLabel = useCallback(() => {
    const label = labelDraft.trim()
    if (!label || !taskExtension) return
    if (taskExtension.labels.includes(label)) {
      setLabelDraft('')
      return
    }
    ext.upsertExtension(task.id, { labels: [...taskExtension.labels, label] })
    setLabelDraft('')
  }, [task.id, ext, labelDraft, taskExtension])

  const removeLabel = useCallback(
    (label: string) => {
      if (!taskExtension) return
      ext.upsertExtension(task.id, { labels: taskExtension.labels.filter((l) => l !== label) })
    },
    [task.id, ext, taskExtension],
  )

  const toggleWatcher = useCallback(
    (employeeId: string) => {
      if (!taskExtension) return
      const next = taskExtension.watchers.includes(employeeId)
        ? taskExtension.watchers.filter((w) => w !== employeeId)
        : [...taskExtension.watchers, employeeId]
      ext.upsertExtension(task.id, { watchers: next })
    },
    [task.id, ext, taskExtension],
  )

  const overdue = isOverdue(task)

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="task-detail-panel"
      title={task.title}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="danger"
            size="sm"
            icon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              if (window.confirm('Slett oppgaven? Handlingen kan ikke angres.')) {
                onDelete(task.id)
                onClose()
              }
            }}
          >
            Slett
          </Button>
          <div className="flex flex-wrap gap-2">
            {!task.assigneeSignature ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Check className="h-4 w-4" />}
                onClick={() => void onSignAsAssignee(task.id)}
              >
                Signer som ansvarlig
              </Button>
            ) : null}
            {task.requiresManagementSignOff && task.assigneeSignature && !task.managementSignature ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={<Check className="h-4 w-4" />}
                onClick={() => void onSignManagement(task.id)}
              >
                Signer som leder
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusBadgeVariant(task.status)}>{TASK_STATUS_LABELS[task.status]}</Badge>
            {taskExtension ? (
              <Badge variant={priorityBadgeVariant(taskExtension.priority)}>
                {TASK_PRIORITY_LABELS[taskExtension.priority]}
              </Badge>
            ) : null}
            {overdue ? <Badge variant="critical">Forfalt</Badge> : null}
            {task.requiresManagementSignOff ? <Badge variant="info">Krever ledersignatur</Badge> : null}
          </div>
          <p className="mt-2 text-sm text-neutral-600">
            {task.description?.trim() ? task.description : 'Ingen beskrivelse oppgitt.'}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-neutral-600">
            <div>
              <dt className="font-semibold uppercase tracking-wider text-neutral-500">Ansvarlig</dt>
              <dd>{task.assignee}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wider text-neutral-500">Frist</dt>
              <dd className={overdue ? 'font-semibold text-red-600' : ''}>
                {formatDueDate(task.dueDate)}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wider text-neutral-500">Modul</dt>
              <dd>{MODULE_LABELS[task.module]}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wider text-neutral-500">Kilde</dt>
              <dd>{task.sourceLabel ?? task.sourceType}</dd>
            </div>
          </dl>
        </header>

        <section>
          <span className={WPSTD_FORM_FIELD_LABEL}>Status</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {TASK_STATUS_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => onSetStatus(task.id, status)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  task.status === status
                    ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                    : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {TASK_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Prioritet</span>
            <div className="mt-1.5">
              <SearchableSelect
                value={taskExtension?.priority ?? 'medium'}
                options={TASK_PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                onChange={(v) => ext.upsertExtension(task.id, { priority: v as TaskPriority })}
              />
            </div>
          </div>
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Prosjekt</span>
            <div className="mt-1.5">
              <SearchableSelect
                value={taskExtension?.projectId ?? ''}
                options={projectOptions}
                placeholder="Velg prosjekt"
                onChange={(v) =>
                  ext.upsertExtension(task.id, {
                    projectId: v || undefined,
                    milestoneId: undefined,
                  })
                }
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <span className={WPSTD_FORM_FIELD_LABEL}>Milepæl</span>
            <div className="mt-1.5">
              <SearchableSelect
                value={taskExtension?.milestoneId ?? ''}
                options={milestoneOptions}
                onChange={(v) => ext.upsertExtension(task.id, { milestoneId: v || undefined })}
                disabled={!taskExtension?.projectId}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>Estimat (timer)</label>
              <StandardInput
                type="number"
                min={0}
                step={0.25}
                value={taskExtension?.estimateHours ?? ''}
                onChange={(e) =>
                  ext.upsertExtension(task.id, {
                    estimateHours: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="—"
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>Brukt</label>
              <StandardInput
                type="number"
                min={0}
                step={0.25}
                value={taskExtension?.spentHours ?? ''}
                onChange={(e) =>
                  ext.upsertExtension(task.id, {
                    spentHours: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="—"
              />
            </div>
          </div>
        </section>

        <section>
          <span className={WPSTD_FORM_FIELD_LABEL}>Etiketter</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {taskExtension && taskExtension.labels.length > 0 ? (
              taskExtension.labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800"
                >
                  {label}
                  <button
                    type="button"
                    onClick={() => removeLabel(label)}
                    className="text-emerald-700 hover:text-emerald-900"
                    aria-label={`Fjern etikett ${label}`}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-neutral-500">Ingen etiketter — legg til en under.</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <StandardInput
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              placeholder="Ny etikett — f.eks. Risikovurdering"
              className="flex-1 min-w-[10rem]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitLabel()
                }
              }}
            />
            <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={submitLabel}>
              Legg til
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TASK_DEFAULT_LABEL_SUGGESTIONS.filter(
              (s) => !taskExtension?.labels.includes(s),
            ).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  if (!taskExtension) return
                  ext.upsertExtension(task.id, { labels: [...taskExtension.labels, s] })
                }}
                className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-600 hover:bg-neutral-50"
              >
                + {s}
              </button>
            ))}
          </div>
        </section>

        <section>
          <span className={WPSTD_FORM_FIELD_LABEL}>Watchers (følger oppgaven)</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {watcherOptions.length === 0 ? (
              <p className="text-xs text-neutral-500">Ingen ansatte registrert i organisasjonen.</p>
            ) : (
              watcherOptions.map((opt) => {
                const active = taskExtension?.watchers.includes(opt.value) ?? false
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleWatcher(opt.value)}
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                        : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })
            )}
          </div>
        </section>

        <section>
          <span className={WPSTD_FORM_FIELD_LABEL}>Sjekkliste / delaktiviteter</span>
          {taskExtension && taskExtension.subtasks.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {taskExtension.subtasks.map((sub) => (
                <li key={sub.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ext.toggleSubtask(task.id, sub.id)}
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      sub.done
                        ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                        : 'border-neutral-300 bg-white'
                    }`}
                    aria-pressed={sub.done}
                    aria-label={sub.done ? 'Marker som ikke ferdig' : 'Marker som ferdig'}
                  >
                    {sub.done ? <Check className="h-3 w-3" aria-hidden /> : null}
                  </button>
                  <span
                    className={`text-sm ${sub.done ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}
                  >
                    {sub.title}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-xs text-neutral-500">Ingen delaktiviteter enda.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <StandardInput
              value={subtaskDraft}
              onChange={(e) => setSubtaskDraft(e.target.value)}
              placeholder="Ny delaktivitet"
              className="flex-1 min-w-[12rem]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submitSubtask()
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={submitSubtask}
              disabled={!subtaskDraft.trim()}
            >
              Legg til
            </Button>
          </div>
        </section>

        <section>
          <span className={WPSTD_FORM_FIELD_LABEL}>Kommentarer</span>
          <div className="mt-1.5 space-y-2">
            {taskExtension && taskExtension.comments.length > 0 ? (
              taskExtension.comments.map((c) => (
                <div key={c.id} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                    <span className="font-medium text-neutral-800">{c.authorName}</span>
                    <span>{new Date(c.at).toLocaleString('nb-NO')}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{c.body}</p>
                </div>
              ))
            ) : (
              <p className="text-xs text-neutral-500">Ingen kommentarer enda.</p>
            )}
          </div>
          <div className="mt-2 space-y-2">
            <StandardTextarea
              rows={3}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Skriv en kommentar — synlig for alle med tilgang til oppgaven"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                onClick={submitComment}
                disabled={!commentDraft.trim()}
              >
                Legg til kommentar
              </Button>
            </div>
          </div>
        </section>
      </div>
    </SlidePanel>
  )
}
