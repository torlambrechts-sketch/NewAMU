/**
 * "Min historikk" — per-learner completion log surfaced from
 * learning_course_completion_audit. Renders one row per completion with
 * compliance status derived against the current published locale version:
 * compliant / needs_update / expired.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLearning } from '../../hooks/useLearning'
import { ModulePageShell, ModuleSectionCard } from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import type { MyCompletionRow } from '../../types/learning'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function LearningMinHistorikkPage() {
  const { courses, fetchMyCompletionHistory } = useLearning()
  const [rows, setRows] = useState<MyCompletionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      const r = await fetchMyCompletionHistory()
      if (r.ok) {
        setRows(r.rows)
      } else {
        setError(r.error)
      }
      setLoading(false)
    })()
  }, [fetchMyCompletionHistory])

  // Resolve compliance status: did a major locale bump land after the
  // version on the audit row? If yes → needs_update.
  const resolved = useMemo(() => {
    const courseById = new Map(courses.map((c) => [c.id, c]))
    return rows.map((row) => {
      const c = courseById.get(row.courseId)
      const currentMajor = c?.localeVersionMajor ?? c?.courseVersion ?? row.courseVersion
      const status: MyCompletionRow['status'] =
        currentMajor > row.courseVersion ? 'needs_update' : 'compliant'
      return { ...row, status, currentMajor }
    })
  }, [rows, courses])

  return (
    <ModulePageShell
      breadcrumb={[
        { label: 'Læring', to: '/learning' },
        { label: 'Min historikk' },
      ]}
      title="Min historikk"
      description="Kurs du har fullført, med versjon og status mot gjeldende publisering."
    >
      <ModuleSectionCard className="p-5 md:p-6">
        {loading ? (
          <p className="text-sm text-neutral-500">Laster…</p>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        ) : resolved.length === 0 ? (
          <p className="text-sm text-neutral-500">Du har ingen fullførte kurs ennå.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-600">
                <th className="py-2 pr-3">Kurs</th>
                <th className="py-2 pr-3">Fullført versjon</th>
                <th className="py-2 pr-3">Fullført dato</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Handling</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((row) => (
                <tr key={`${row.courseId}-${row.courseVersion}-${row.completedAt}`} className="border-b border-neutral-100">
                  <td className="py-2 pr-3 font-medium text-neutral-900">{row.courseTitleSnapshot}</td>
                  <td className="py-2 pr-3 tabular-nums text-neutral-700">
                    v{row.courseVersion}
                    {row.currentMajor > row.courseVersion ? (
                      <span className="ml-1 text-xs text-neutral-500">(nå v{row.currentMajor})</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">{fmtDate(row.completedAt)}</td>
                  <td className="py-2 pr-3">
                    {row.status === 'compliant' ? (
                      <Badge variant="success">Compliant</Badge>
                    ) : row.status === 'needs_update' ? (
                      <Badge variant="warning">Trenger oppdatering</Badge>
                    ) : (
                      <Badge variant="critical">Utløpt</Badge>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {row.status === 'needs_update' ? (
                      <Link
                        to={`/learning/play/${row.courseId}?delta=1`}
                        className="text-xs font-semibold text-[#1a3d32] underline"
                      >
                        Ta oppdateringskurset
                      </Link>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ModuleSectionCard>
    </ModulePageShell>
  )
}
