// TaskSubtaskList — relational subtask checklist for a task item.
// Reads from task_subtasks; supports add/toggle. Position-ordered.

import { useCallback, useEffect, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'

type Subtask = {
  id: string
  title: string
  isDone: boolean
  position: number
}

type Props = {
  taskItemId: string
}

export function TaskSubtaskList({ taskItemId }: Props) {
  const { supabase } = useOrgSetupContext()
  const [items, setItems] = useState<Subtask[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('task_subtasks')
      .select('id, title, is_done, position')
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
        })),
      )
    }
  }, [supabase, taskItemId])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (id: string, current: boolean) => {
    if (!supabase) return
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, isDone: !current } : s)))
    await supabase
      .from('task_subtasks')
      .update({ is_done: !current, done_at: !current ? new Date().toISOString() : null })
      .eq('id', id)
  }

  const addSubtask = async () => {
    if (!supabase || !newTitle.trim()) return
    setAdding(true)
    const maxPos = items.length > 0 ? Math.max(...items.map((s) => s.position)) + 10 : 10
    const { data } = await supabase
      .from('task_subtasks')
      .insert({ task_item_id: taskItemId, title: newTitle.trim(), position: maxPos })
      .select('id, title, is_done, position')
      .single()
    if (data) {
      setItems((prev) => [
        ...prev,
        {
          id: String(data.id),
          title: String(data.title),
          isDone: false,
          position: Number(data.position),
        },
      ])
    }
    setNewTitle('')
    setAdding(false)
  }

  const removeSubtask = async (id: string) => {
    if (!supabase) return
    setItems((prev) => prev.filter((s) => s.id !== id))
    await supabase.from('task_subtasks').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  }

  const done = items.filter((s) => s.isDone).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Deloppgaver {items.length > 0 ? `· ${done}/${items.length}` : ''}
        </span>
      </div>

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((sub) => (
            <li key={sub.id} className="group flex items-center gap-2">
              <button
                type="button"
                onClick={() => void toggle(sub.id, sub.isDone)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                  sub.isDone
                    ? 'border-[#c2410c] bg-[#c2410c] text-white'
                    : 'border-neutral-300 bg-white hover:border-[#c2410c]'
                }`}
                aria-label={sub.isDone ? 'Merk som ikke ferdig' : 'Merk som ferdig'}
              >
                {sub.isDone && <Check className="h-3 w-3" />}
              </button>
              <span
                className={`flex-1 text-sm ${
                  sub.isDone ? 'text-neutral-400 line-through' : 'text-neutral-800'
                }`}
              >
                {sub.title}
              </span>
              <button
                type="button"
                onClick={() => void removeSubtask(sub.id)}
                className="hidden text-neutral-400 transition hover:text-red-500 group-hover:block"
                aria-label="Slett deloppgave"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addSubtask()
          }}
          placeholder="Legg til deloppgave…"
          className="flex-1 rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-[#c2410c] focus:outline-none focus:ring-1 focus:ring-[#c2410c]/20"
        />
        <button
          type="button"
          onClick={() => void addSubtask()}
          disabled={adding || !newTitle.trim()}
          className="flex items-center gap-1 rounded border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
