/**
 * Versjonshistorikk tab body — renders the published-version timeline for a
 * course. System-backed courses pull from learning_system_course_locale_versions
 * (resolved locale only); pure org courses pull from learning_org_course_versions.
 */
import { useEffect, useState } from 'react'
import { ModuleSectionCard } from '../../components/module'
import { Badge } from '../../components/ui/Badge'
import type { Course, LocaleVersionHistoryRow } from '../../types/learning'

export type LearningVersionHistoryTabProps = {
  course: Course
  fetchLocaleVersionHistory: (
    systemCourseId: string,
    locale: string,
  ) => Promise<{ ok: true; rows: LocaleVersionHistoryRow[] } | { ok: false; error: string }>
  fetchOrgCourseVersionHistory: (
    courseId: string,
  ) => Promise<{ ok: true; rows: LocaleVersionHistoryRow[] } | { ok: false; error: string }>
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function LearningVersionHistoryTab({
  course,
  fetchLocaleVersionHistory,
  fetchOrgCourseVersionHistory,
}: LearningVersionHistoryTabProps) {
  const [rows, setRows] = useState<LocaleVersionHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      const r = course.sourceSystemCourseId
        ? await fetchLocaleVersionHistory(
            course.sourceSystemCourseId,
            course.catalogLocale === 'en' ? 'en' : 'nb',
          )
        : await fetchOrgCourseVersionHistory(course.id)
      if (cancelled) return
      if (r.ok) setRows(r.rows)
      else setError(r.error)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [
    course.id,
    course.sourceSystemCourseId,
    course.catalogLocale,
    fetchLocaleVersionHistory,
    fetchOrgCourseVersionHistory,
  ])

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <header className="mb-4">
        <h3 className="text-base font-semibold text-neutral-900">Versjonshistorikk</h3>
        <p className="mt-0.5 text-xs text-neutral-500">
          Hver publisering legger en uforanderlig rad her — major-bump varsler completere, minor
          er stille. Endringsnotater er synlig for læreren i diff-modalen.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-neutral-500">Laster historikk…</p>
      ) : error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-neutral-500">Ingen versjonshistorikk ennå.</p>
      ) : (
        <ol className="space-y-4">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-4 py-3"
            >
              <div className="flex items-baseline gap-3">
                <strong className="tabular-nums text-neutral-900">
                  v{r.versionMajor}.{r.versionMinor}
                </strong>
                {r.isMajor ? (
                  <Badge variant="warning">Major</Badge>
                ) : (
                  <Badge variant="neutral">Minor</Badge>
                )}
                <span className="text-xs text-neutral-500">
                  publisert {fmtDate(r.publishedAt)}
                  {r.publishedBy ? ` · av ${r.publishedBy.slice(0, 8)}` : ''}
                </span>
              </div>
              {r.changeNotesMd ? (
                <pre className="mt-2 whitespace-pre-wrap rounded-md bg-white px-3 py-2 font-sans text-sm leading-relaxed text-neutral-800">
                  {r.changeNotesMd}
                </pre>
              ) : null}
              <p className="mt-2 text-[11px] text-neutral-500">
                {r.moduleIdsSnapshot.length} moduler i denne versjonen
              </p>
            </li>
          ))}
        </ol>
      )}
    </ModuleSectionCard>
  )
}
