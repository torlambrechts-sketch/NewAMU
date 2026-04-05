import { Award, Search } from 'lucide-react'
import { useState } from 'react'
import { useLearning } from '../../hooks/useLearning'

export function LearningCertifications() {
  const { certificates } = useLearning()
  const [q, setQ] = useState('')

  const filtered = certificates.filter(
    (c) =>
      c.courseTitle.toLowerCase().includes(q.toLowerCase()) ||
      c.learnerName.toLowerCase().includes(q.toLowerCase()) ||
      c.verifyCode.toLowerCase().includes(q.toLowerCase()),
  )

  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const issuedThisYear = certificates.filter((c) => new Date(c.issuedAt) >= yearStart).length
  const inProgress = 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-[#2D403A]">Certifications</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Demo certificates stored locally. Not a legally binding credential.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Issued (total)" value={certificates.length} accent="emerald" />
        <Kpi label="Issued this year" value={issuedThisYear} accent="amber" />
        <Kpi label="In progress (tracked)" value={inProgress} accent="neutral" />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, course, or code…"
          className="w-full rounded-full border border-neutral-200 bg-white py-2 pl-10 pr-4 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50/80 text-neutral-600">
              <th className="px-4 py-3 font-medium">Course</th>
              <th className="px-4 py-3 font-medium">Learner</th>
              <th className="px-4 py-3 font-medium">Issued</th>
              <th className="px-4 py-3 font-medium">Versjon</th>
              <th className="px-4 py-3 font-medium">Verify</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((c) => (
              <tr key={c.id} className="hover:bg-neutral-50/50">
                <td className="px-4 py-3 font-medium text-[#2D403A]">{c.courseTitle}</td>
                <td className="px-4 py-3">{c.learnerName}</td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {new Date(c.issuedAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-600">{c.courseVersion ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.verifyCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-neutral-500">
            No certificates yet. Complete a published course in the learner view to issue one.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: 'emerald' | 'amber' | 'neutral'
}) {
  const border =
    accent === 'emerald'
      ? 'border-emerald-200'
      : accent === 'amber'
        ? 'border-amber-200'
        : 'border-neutral-200'
  return (
    <div className={`rounded-xl border ${border} bg-white p-5 shadow-sm`}>
      <div className="text-3xl font-semibold tabular-nums text-[#2D403A]">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-sm text-neutral-600">
        <Award className="size-4 text-emerald-700/70" />
        {label}
      </div>
    </div>
  )
}
