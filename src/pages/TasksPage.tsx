import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import type { TaskStatus } from '../types/task'

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

function statusStyle(s: TaskStatus) {
  switch (s) {
    case 'done':
      return 'bg-emerald-100 text-emerald-800'
    case 'in_progress':
      return 'bg-sky-100 text-sky-800'
    default:
      return 'bg-neutral-100 text-neutral-700'
  }
}

export function TasksPage() {
  const { tasks, addTask, updateTask, deleteTask, setStatus } = useTasks()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const todo = tasks.filter((t) => t.status === 'todo').length
    const prog = tasks.filter((t) => t.status === 'in_progress').length
    const done = tasks.filter((t) => t.status === 'done').length
    return { total: tasks.length, todo, prog, done }
  }, [tasks])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    if (editingId) {
      updateTask(editingId, {
        title: title.trim(),
        description: description.trim(),
        assignee: assignee.trim() || 'Unassigned',
        dueDate: dueDate || '—',
      })
      setEditingId(null)
    } else {
      addTask({
        title: title.trim(),
        description: description.trim(),
        status: 'todo',
        assignee: assignee.trim() || 'Unassigned',
        dueDate: dueDate || '—',
      })
    }
    setTitle('')
    setDescription('')
    setAssignee('')
    setDueDate('')
  }

  function startEdit(id: string) {
    const t = tasks.find((x) => x.id === id)
    if (!t) return
    setEditingId(id)
    setTitle(t.title)
    setDescription(t.description)
    setAssignee(t.assignee)
    setDueDate(t.dueDate === '—' ? '' : t.dueDate)
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
      <nav className="mb-4 text-sm text-neutral-600">
        <Link to="/" className="text-[#1a3d32] hover:underline">
          Projects
        </Link>
        <span className="mx-2 text-neutral-400">→</span>
        <span className="font-medium text-neutral-800">Tasks</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <h1
            className="text-2xl font-semibold text-neutral-900 md:text-3xl"
            style={{ fontFamily: "'Libre Baskerville', Georgia, serif" }}
          >
            Task management
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Create, assign, and track work across your project. Data is saved in this browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-neutral-200/80">
            Total <strong className="text-neutral-900">{stats.total}</strong>
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-neutral-200/80">
            To do <strong>{stats.todo}</strong>
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-neutral-200/80">
            Active <strong>{stats.prog}</strong>
          </span>
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm ring-1 ring-neutral-200/80">
            Done <strong>{stats.done}</strong>
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form
          onSubmit={handleSubmit}
          className="h-fit rounded-2xl border border-neutral-200/90 bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-neutral-900">
            {editingId ? 'Edit task' : 'New task'}
          </h2>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="task-title" className="text-xs font-medium text-neutral-500">
                Title
              </label>
              <input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                placeholder="e.g. Review hiring pipeline"
                required
              />
            </div>
            <div>
              <label htmlFor="task-desc" className="text-xs font-medium text-neutral-500">
                Description
              </label>
              <textarea
                id="task-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                placeholder="Optional details"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="task-assignee" className="text-xs font-medium text-neutral-500">
                  Assignee
                </label>
                <input
                  id="task-assignee"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                  placeholder="Name"
                />
              </div>
              <div>
                <label htmlFor="task-due" className="text-xs font-medium text-neutral-500">
                  Due date
                </label>
                <div className="relative mt-1">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    id="task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 py-2 pl-9 pr-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-1 focus:ring-[#1a3d32]"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#1a3d32] px-4 py-2 text-sm font-medium text-white hover:bg-[#142e26]"
            >
              <Plus className="size-4" />
              {editingId ? 'Save changes' : 'Add task'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setTitle('')
                  setDescription('')
                  setAssignee('')
                  setDueDate('')
                }}
                className="rounded-full px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-600">
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Assignee</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-neutral-500">
                      No tasks yet. Add one using the form.
                    </td>
                  </tr>
                ) : (
                  tasks.map((t) => (
                    <tr key={t.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-neutral-900">{t.title}</div>
                        {t.description ? (
                          <div className="mt-0.5 text-xs text-neutral-500 line-clamp-2">{t.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-neutral-800">{t.assignee}</td>
                      <td className="px-4 py-3 align-top text-neutral-600">{t.dueDate}</td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={t.status}
                          onChange={(e) => setStatus(t.id, e.target.value as TaskStatus)}
                          className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${statusStyle(t.status)}`}
                        >
                          {(Object.keys(statusLabels) as TaskStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {statusLabels[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <button
                          type="button"
                          onClick={() => startEdit(t.id)}
                          className="inline-flex rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100"
                          aria-label="Edit"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTask(t.id)}
                          className="inline-flex rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                          aria-label="Delete"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
