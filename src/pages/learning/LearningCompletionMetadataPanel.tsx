// LearningCompletionMetadataPanel — schema-driven completion metadata for a
// course. Mirrors the SurveyMetadataPanel / ExecutionMetadataPanel pattern but
// adapts to the learning domain:
//
//   - The org-context kinds (location, department, team) are *auto-snapshotted*
//     by the DB trigger when `completed_at` flips to non-null
//     (migration 20260828120030). The panel doesn't write them — it only
//     surfaces them as read-only context once they exist on the progress row.
//   - The 'participants' kind is NOT supported (a course is per-learner, no
//     attendees concept).
//   - Free-form kinds (text, number, select) persist into
//     `learning_course_progress.metadata` under their declared key, via
//     `setProgressMetadata` from useLearning.

import { useMemo, useState } from 'react'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Badge } from '../../components/ui/Badge'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import type {
  Course,
  CourseProgress,
  TemplateMetadataField,
  TemplateMetadataSchema,
} from '../../types/learning'
import type { DepartmentRow, LocationRow, TeamRow } from '../../types/organization'

const DEFAULT_LABELS: Record<TemplateMetadataField['kind'], string> = {
  location: 'Lokasjon',
  department: 'Avdeling',
  team: 'Team',
  participants: 'Deltakere',
  text: 'Tekst',
  number: 'Tall',
  select: 'Valg',
}

type Props = {
  course: Course
  progress: CourseProgress | undefined
  metadataSchema: TemplateMetadataSchema | null | undefined
  locations: LocationRow[]
  departments: DepartmentRow[]
  teams: TeamRow[]
  /** Async writer that persists `metadata` on the progress row. */
  onSaveMetadata: (
    courseId: string,
    metadata: Record<string, unknown>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  /** When true, free-form fields are still editable post-completion (re-issue scenarios). */
  allowEditAfterCompletion?: boolean
}

export function LearningCompletionMetadataPanel({
  course,
  progress,
  metadataSchema,
  locations,
  departments,
  teams,
  onSaveMetadata,
  allowEditAfterCompletion = true,
}: Props) {
  const fields = metadataSchema?.fields ?? []

  const [metadataValues, setMetadataValues] = useState<Record<string, unknown>>(
    progress?.metadata ?? {},
  )
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset on course or progress identity change.
  const [lastKey, setLastKey] = useState(`${course.id}:${progress?.userId ?? '_'}`)
  const nextKey = `${course.id}:${progress?.userId ?? '_'}`
  if (lastKey !== nextKey) {
    setLastKey(nextKey)
    setMetadataValues(progress?.metadata ?? {})
    setSaveError(null)
  }

  const isCompleted = !!progress?.completedAt

  const flush = (key: string, value: unknown) => {
    const next = { ...metadataValues, [key]: value }
    setMetadataValues(next)
    void (async () => {
      const r = await onSaveMetadata(course.id, next)
      if (!r.ok) setSaveError(r.error)
      else setSaveError(null)
    })()
  }

  const locationName = useMemo(() => {
    const id = progress?.locationIdAtCompletion
    if (!id) return null
    return locations.find((l) => l.id === id)?.name ?? '(slettet)'
  }, [locations, progress?.locationIdAtCompletion])
  const departmentName = useMemo(() => {
    const id = progress?.departmentIdAtCompletion
    if (!id) return null
    return departments.find((d) => d.id === id)?.name ?? '(slettet)'
  }, [departments, progress?.departmentIdAtCompletion])
  const teamName = useMemo(() => {
    const id = progress?.teamIdAtCompletion
    if (!id) return null
    return teams.find((t) => t.id === id)?.name ?? '(slettet)'
  }, [teams, progress?.teamIdAtCompletion])

  if (fields.length === 0) return null

  const fieldsCanEdit = !isCompleted || allowEditAfterCompletion
  const builtInFields = fields.filter((f) =>
    f.kind === 'location' || f.kind === 'department' || f.kind === 'team',
  )
  const freeformFields = fields.filter(
    (f) => f.kind === 'text' || f.kind === 'number' || f.kind === 'select',
  )

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-neutral-900">Hoveddata for kursbevis</h3>
        {isCompleted ? (
          <Badge variant="signed">Snapshot låst ved fullføring</Badge>
        ) : (
          <Badge variant="warning">Fyll inn før kursbevis</Badge>
        )}
      </div>
      <p className="mt-1.5 text-sm text-neutral-600">
        Tilleggsfelter på kurset — for eksempel ekstern leverandør, kursbevis-id eller
        testresultat. Avdeling, lokasjon og team låses automatisk ved fullføring.
      </p>

      {saveError ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {saveError}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {/* ── Org-context (read-only snapshot) ─────────────────────────── */}
        {builtInFields.map((f) => {
          const label = f.label ?? DEFAULT_LABELS[f.kind]
          const display =
            f.kind === 'location'
              ? locationName
              : f.kind === 'department'
                ? departmentName
                : teamName
          return (
            <div key={f.key}>
              <p className={WPSTD_FORM_FIELD_LABEL}>
                {label} {f.required ? <span className="text-red-500">*</span> : null}
              </p>
              <p className="mt-1.5 text-sm text-neutral-800">
                {display ?? (
                  <span className="italic text-neutral-500">
                    {isCompleted ? 'Ikke registrert' : 'Settes automatisk ved fullføring'}
                  </span>
                )}
              </p>
            </div>
          )
        })}

        {/* ── Free-form fields ─────────────────────────────────────────── */}
        {freeformFields.map((f) => {
          const label = f.label ?? DEFAULT_LABELS[f.kind]
          const id = `learning-md-${f.key}`
          const value = metadataValues[f.key]

          if (f.kind === 'text') {
            return (
              <div key={f.key} className="md:col-span-2">
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={id}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? <p className="mb-1 text-xs text-neutral-500">{f.help}</p> : null}
                <StandardInput
                  id={id}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) =>
                    setMetadataValues({ ...metadataValues, [f.key]: e.target.value })
                  }
                  onBlur={(e) => flush(f.key, e.target.value)}
                  disabled={!fieldsCanEdit}
                />
              </div>
            )
          }
          if (f.kind === 'number') {
            return (
              <div key={f.key}>
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={id}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? <p className="mb-1 text-xs text-neutral-500">{f.help}</p> : null}
                <StandardInput
                  id={id}
                  type="number"
                  value={typeof value === 'number' ? String(value) : ''}
                  onChange={(e) =>
                    setMetadataValues({
                      ...metadataValues,
                      [f.key]: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  onBlur={(e) => {
                    const v = e.target.value === '' ? null : Number(e.target.value)
                    flush(f.key, v)
                  }}
                  disabled={!fieldsCanEdit}
                />
              </div>
            )
          }
          if (f.kind === 'select') {
            const options = [
              { value: '', label: '—' },
              ...(f.options ?? []).map((o) => ({ value: o.id, label: o.label })),
            ]
            return (
              <div key={f.key}>
                <label className={WPSTD_FORM_FIELD_LABEL}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? <p className="mb-1 text-xs text-neutral-500">{f.help}</p> : null}
                <SearchableSelect
                  value={typeof value === 'string' ? value : ''}
                  options={options}
                  onChange={(v) => flush(f.key, v || null)}
                  disabled={!fieldsCanEdit}
                />
              </div>
            )
          }
          return null
        })}
      </div>
    </ModuleSectionCard>
  )
}
