import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useLearning } from '../../hooks/useLearning'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { CourseStatus } from '../../types/learning'
import { PIN_GREEN } from '../../components/learning/LearningLayout'
import { AddTaskLink } from '../../components/tasks/AddTaskLink'

export function LearningCoursesList() {
  const navigate = useNavigate()
  const { can } = useOrgSetupContext()
  const canManage = can('learning.manage')
  const { courses, createCourse, updateCourse, learningLoading, learningError, isCourseUnlocked } = useLearning()
  const [q, setQ] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(q.toLowerCase()) ||
      c.description.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Courses</h1>
          <p className="mt-1 text-sm text-neutral-600">Build modules: flashcards, quiz, media, checklists, on-the-job.</p>
        </div>
      </div>

      {learningError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{learningError}</p>
      ) : null}
      {learningLoading ? <p className="text-sm text-neutral-500">Laster kurs…</p> : null}

      {canManage ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            const c = createCourse(title, desc)
            setTitle('')
            setDesc('')
            navigate(`/learning/courses/${c.id}`)
          }}
          className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-[#2D403A]">New course</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Course title"
              className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              required
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Short description"
              className="min-w-[200px] flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PIN_GREEN }}
            >
              <Plus className="size-4" />
              Create
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 shadow-sm">
          Du har ikke tilgang til å opprette kurs. Be en administrator om rettigheten «E-learning — opprette og redigere
          kurs» (<code className="rounded bg-neutral-100 px-1">learning.manage</code>).
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses…"
            className="w-full rounded-full border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm"
          />
        </div>
        <button
          type="button"
          className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700"
        >
          Filters
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-600">
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Modules</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((c) => {
              const unlocked = isCourseUnlocked(c.id)
              return (
              <tr key={c.id} className={`hover:bg-neutral-50/50 ${!unlocked ? 'bg-neutral-50/40' : ''}`}>
                <td className="px-4 py-3">
                  {unlocked ? (
                    <Link to={`/learning/courses/${c.id}`} className="font-medium text-[#2D403A] hover:underline">
                      {c.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-neutral-500">{c.title}</span>
                  )}
                  <div className="text-xs text-neutral-500 line-clamp-1">{c.description}</div>
                  {!unlocked ? (
                    <div className="mt-1 text-[11px] font-medium text-amber-800">Låst — fullfør forutsetninger</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-neutral-700">{c.modules.length}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <select
                      value={c.status}
                      onChange={(e) =>
                        updateCourse(c.id, { status: e.target.value as CourseStatus })
                      }
                      className="rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  ) : (
                    <span className="text-xs capitalize text-neutral-700">{c.status}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {new Date(c.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <AddTaskLink
                    title={`Oppfølging: ${c.title}`}
                    module="learning"
                    sourceType="learning_course"
                    sourceId={c.id}
                    sourceLabel={c.title}
                    className="mr-2 inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 text-xs font-medium text-[#2D403A] shadow-sm hover:bg-neutral-50"
                  >
                    Task
                  </AddTaskLink>
                  {unlocked ? (
                    <Link
                      to={`/learning/play/${c.id}`}
                      className="mr-2 text-xs font-medium text-emerald-800 hover:underline"
                    >
                      Preview
                    </Link>
                  ) : (
                    <span className="mr-2 text-xs text-neutral-400">Preview</span>
                  )}
                  {canManage ? (
                    <Link
                      to={`/learning/courses/${c.id}`}
                      className="text-xs font-medium text-[#2D403A] hover:underline"
                    >
                      Builder
                    </Link>
                  ) : null}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
