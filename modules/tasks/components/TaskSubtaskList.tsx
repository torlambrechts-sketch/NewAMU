// TaskSubtaskList — sub-task checklist for a task_item.
// Reads from task_subtasks with the enriched schema (owner_name, priority,
// start_date, due_date). Supports add/toggle/delete; position-ordered.
// Clicking the metadata row for a subtask toggles an inline edit form.

import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

type SubtaskPriority = 'low' | 'medium' | 'high' | 'critical'

type Subtask = {
  id: string
  title: string
  isDone: boolean
  position: number
  ownerName: string | null
  priority: SubtaskPriority | null
  startDate: string | null
  dueDate: string | null
}

const PRIORITY_STYLE: Record<SubtaskPriority, string> = {
  low: 'bg-blue-50 text-blue-700 border-blue-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  high: 'bg-orange-50 text-orange-700 border-orange-100',
  critical: 'bg-red-50 text-red-700 border-red-100',
}
const PRIORITY_LABEL: Record<SubtaskPriority, string> = {
  low: 'Lav',
  medium: 'Medium',
  high: 'Høy',
  critical: 'Kritisk',
}

function fmtDate(s: string | null) {
  if (!s) return null
  try {
    return new Date(s).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })
  } catch {
    return s
  }
}

function InitialsAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/)
  const initials = (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2))
    .toUpperCase()
  const colors = ['#c2410c', '#7c3aed', '#0e7490', '#1a3d32', '#a21caf', '#0f766e', '#b45309']
  const bg = colors[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length]
  return (
    <span
      title={name}
      style={{ backgroundColor: bg }}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
    >
      {initials}
    </span>
  )
}

// ── Add/edit form ─────────────────────────────────────────────────────────────

type SubtaskFormValues = {
  title: string
  ownerName: string
  priority: SubtaskPriority | ''
  startDate: string
  dueDate: string
}

const EMPTY_FORM: SubtaskFormValues = {
  title: '', ownerName: '', priority: '', startDate: '', dueDate: '',
}

function SubtaskForm({
  initial,
  onSave,
  onCancel,
  submitLabel,
}: {
  initial?: SubtaskFormValues
  onSave: (v: SubtaskFormValues) => Promise<void>
  onCancel: () => void
  submitLabel: string
}) {
  const [v, setV] = useState<SubtaskFormValues>(initial ?? EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof SubtaskFormValues, val: string) => setV((p) => ({ ...p, [k]: val }))

  const handleSave = async () => {
    if (!v.title.trim()) return
    setSaving(true)
    try {
      await onSave(v)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-[#c2410c]/20 bg-white p-3 shadow-sm">
      <input
        autoFocus
        type="text"
        value={v.title}
        onChange={(e) => set('title', e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSave() }
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Tittel på deloppgave…"
        className="w-full rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#c2410c] focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">Ansvarlig</p>
          <input
            type="text"
            value={v.ownerName}
            onChange={(e) => set('ownerName', e.target.value)}
            placeholder="Navn…"
            className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs focus:border-[#c2410c] focus:outline-none"
          />
        </div>
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">Prioritet</p>
          <select
            value={v.priority}
            onChange={(e) => set('priority', e.target.value)}
            className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs focus:border-[#c2410c] focus:outline-none"
          >
            <option value="">—</option>
            <option value="low">Lav</option>
            <option value="medium">Medium</option>
            <option value="high">Høy</option>
            <option value="critical">Kritisk</option>
          </select>
        </div>
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">Start</p>
          <input
            type="date"
            value={v.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs focus:border-[#c2410c] focus:outline-none"
          />
        </div>
        <div>
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">Frist</p>
          <input
            type="date"
            value={v.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
            className="w-full rounded border border-neutral-200 bg-white px-2 py-1.5 text-xs focus:border-[#c2410c] focus:outline-none"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving || !v.title.trim()}
          onClick={() => void handleSave()}
          className="rounded bg-[#c2410c] px-3 py-1 text-xs font-medium text-white transition hover:bg-[#a33609] disabled:opacity-40"
        >
          {saving ? 'Lagrer…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-neutral-400 transition hover:text-neutral-700"
        >
          Avbryt
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = { taskItemId: string }

export function TaskSubtaskList({ taskItemId }: Props) {
  const { supabase } = useOrgSetupContext()
  const [items, setItems] = useState<Subtask[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('task_subtasks')
      .select('id, title, is_done, position, owner_name, priority, start_date, due_date')
      .eq('task_item_id', taskItemId)
      .is('deleted_at', null)
      .order('position', { ascending: true })
    if (data) {
      setItems(
        data.map((r) => ({
          id: String(r.id),
          title: String(r.title ?? ''),
          isDone: Boolean(r.is_done),
          position: Number(r.position ?? 0),
          ownerName: r.owner_name ? String(r.owner_name) : null,
          priority: r.priority ? (r.priority as SubtaskPriority) : null,
          startDate: r.start_date ? String(r.start_date) : null,
          dueDate: r.due_date ? String(r.due_date) : null,
        })),
      )
    }
  }, [supabase, taskItemId])

  useEffect(() => { void load() }, [load])

  const toggle = async (id: string, current: boolean) => {
    if (!supabase) return
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, isDone: !current } : s)))
    await supabase
      .from('task_subtasks')
      .update({ is_done: !current, done_at: !current ? new Date().toISOString() : null })
      .eq('id', id)
  }

  const addSubtask = async (form: SubtaskFormValues) => {
    if (!supabase || !form.title.trim()) return
    const maxPos = items.length > 0 ? Math.max(...items.map((s) => s.position)) + 10 : 10
    const { data } = await supabase
      .from('task_subtasks')
      .insert({
        task_item_id: taskItemId,
        title: form.title.trim(),
        position: maxPos,
        owner_name: form.ownerName.trim() || null,
        priority: form.priority || null,
        start_date: form.startDate || null,
        due_date: form.dueDate || null,
      })
      .select('id, title, is_done, position, owner_name, priority, start_date, due_date')
      .single()
    if (data) {
      setItems((prev) => [
        ...prev,
        {
          id: String(data.id),
          title: String(data.title),
          isDone: false,
          position: Number(data.position),
          ownerName: data.owner_name ? String(data.owner_name) : null,
          priority: data.priority ? (data.priority as SubtaskPriority) : null,
          startDate: data.start_date ? String(data.start_date) : null,
          dueDate: data.due_date ? String(data.due_date) : null,
        },
      ])
    }
    setShowAdd(false)
  }

  const saveEdit = async (id: string, form: SubtaskFormValues) => {
    if (!supabase) return
    await supabase
      .from('task_subtasks')
      .update({
        title: form.title.trim(),
        owner_name: form.ownerName.trim() || null,
        priority: form.priority || null,
        start_date: form.startDate || null,
        due_date: form.dueDate || null,
      })
      .eq('id', id)
    setItems((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              title: form.title.trim(),
              ownerName: form.ownerName.trim() || null,
              priority: (form.priority as SubtaskPriority) || null,
              startDate: form.startDate || null,
              dueDate: form.dueDate || null,
            }
          : s,
      ),
    )
    setEditingId(null)
  }

  const removeSubtask = async (id: string) => {
    if (!supabase) return
    setItems((prev) => prev.filter((s) => s.id !== id))
    await supabase.from('task_subtasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  const done = items.filter((s) => s.isDone).length

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
          Deloppgaver{items.length > 0 ? ` · ${done}/${items.length}` : ''}
        </span>
        {items.length > 0 && (
          <div className="h-1 w-24 overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-[#c2410c] transition-all"
              style={{ width: items.length > 0 ? `${Math.round((done / items.length) * 100)}%` : '0%' }}
            />
          </div>
        )}
      </div>

      {/* Subtask rows */}
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((sub) => {
            const isEditing = editingId === sub.id
            return (
              <li key={sub.id}>
                {isEditing ? (
                  <SubtaskForm
                    initial={{
                      title: sub.title,
                      ownerName: sub.ownerName ?? '',
                      priority: sub.priority ?? '',
                      startDate: sub.startDate ?? '',
                      dueDate: sub.dueDate ?? '',
                    }}
                    onSave={(form) => saveEdit(sub.id, form)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Lagre"
                  />
                ) : (
                  <div className="group flex items-start gap-2">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => void toggle(sub.id, sub.isDone)}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        sub.isDone
                          ? 'border-[#c2410c] bg-[#c2410c] text-white'
                          : 'border-neutral-300 bg-white hover:border-[#c2410c]'
                      }`}
                      aria-label={sub.isDone ? 'Merk som ikke ferdig' : 'Merk som ferdig'}
                    >
                      {sub.isDone && <Check className="h-3 w-3" />}
                    </button>

                    {/* Content */}
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => setEditingId(sub.id)}
                    >
                      <span
                        className={`text-sm leading-snug ${
                          sub.isDone ? 'text-neutral-400 line-through' : 'text-neutral-800'
                        }`}
                      >
                        {sub.title}
                      </span>

                      {/* Metadata pills */}
                      {(sub.ownerName || sub.priority || sub.startDate || sub.dueDate) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {sub.ownerName && <InitialsAvatar name={sub.ownerName} />}
                          {sub.priority && (
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_STYLE[sub.priority]}`}
                            >
                              {PRIORITY_LABEL[sub.priority]}
                            </span>
                          )}
                          {(sub.startDate || sub.dueDate) && (
                            <span className="text-[10px] text-neutral-400">
                              {fmtDate(sub.startDate) ?? '…'}
                              {' – '}
                              {fmtDate(sub.dueDate) ?? '…'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expand / delete — visible on hover */}
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditingId(sub.id)}
                        className="rounded p-1 text-neutral-300 hover:text-neutral-500"
                        aria-label="Rediger deloppgave"
                      >
                        {isEditing ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeSubtask(sub.id)}
                        className="rounded p-1 text-neutral-300 hover:text-red-500"
                        aria-label="Slett deloppgave"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Add form / button */}
      {showAdd ? (
        <SubtaskForm
          onSave={addSubtask}
          onCancel={() => setShowAdd(false)}
          submitLabel="Legg til"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs text-neutral-400 transition hover:text-[#c2410c]"
        >
          <Plus className="h-3.5 w-3.5" />
          Legg til deloppgave
        </button>
      )}
    </div>
  )
}
