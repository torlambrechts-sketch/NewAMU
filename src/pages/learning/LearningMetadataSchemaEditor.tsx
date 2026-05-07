// LearningMetadataSchemaEditor — admin-side editor for a course's
// `metadata_schema`. Mirrors SurveyTemplateMetadataEditorPanel but inline (no
// slide panel) since the course builder is a full-page surface that already
// has tabbed sections.
//
// Built-in kinds:
//   - location / department / team — surface as read-only org-context on the
//     completion panel; auto-snapshotted by the DB trigger at completion time.
// Free-form kinds:
//   - text / number / select — persist into learning_course_progress.metadata.
//
// 'participants' is intentionally omitted — courses are per-learner, no
// attendees concept (unlike surveys / checklist executions).

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import type {
  TemplateMetadataField,
  TemplateMetadataFieldKind,
  TemplateMetadataSchema,
} from '../../types/learning'

const KIND_OPTIONS: { value: TemplateMetadataFieldKind; label: string }[] = [
  { value: 'location', label: 'Lokasjon (snapshot ved fullføring)' },
  { value: 'department', label: 'Avdeling (snapshot ved fullføring)' },
  { value: 'team', label: 'Team (snapshot ved fullføring)' },
  { value: 'text', label: 'Fritekst' },
  { value: 'number', label: 'Tall' },
  { value: 'select', label: 'Valg fra liste' },
]

// Per spec OQ-L6 — recommended starter set for new courses.
const RECOMMENDED_FIELDS: TemplateMetadataField[] = [
  { key: 'external_cert_id', kind: 'text', label: 'Ekstern kursbevis-id', required: false },
  { key: 'external_hours', kind: 'number', label: 'Antall timer', required: false },
  { key: 'practical_test_score', kind: 'number', label: 'Praktisk testresultat', required: false },
  {
    key: 'provider',
    kind: 'select',
    label: 'Leverandør',
    required: false,
    options: [
      { id: 'internal', label: 'Internt' },
      { id: 'external', label: 'Ekstern' },
    ],
  },
]

type Props = {
  schema: TemplateMetadataSchema | null | undefined
  onChange: (next: TemplateMetadataSchema) => void
}

export function LearningMetadataSchemaEditor({ schema, onChange }: Props) {
  const fields = schema?.fields ?? []

  const setFields = (next: TemplateMetadataField[]) => onChange({ fields: next })

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= fields.length) return
    const copy = [...fields]
    const [picked] = copy.splice(idx, 1)
    if (!picked) return
    copy.splice(target, 0, picked)
    setFields(copy)
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className={WPSTD_FORM_FIELD_LABEL}>Hoveddata-felt på kursbevis</p>
        {fields.length === 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFields(RECOMMENDED_FIELDS)}
          >
            Bruk anbefalt sett
          </Button>
        ) : null}
      </div>
      <p className="mb-2 text-xs text-neutral-500">
        Felt som vises på fullføringsskjermen og lagres på fremdriften — typisk for
        kursbevis-id, antall timer eller leverandør. Innebygde typer (lokasjon,
        avdeling, team) snapshottes automatisk fra brukerens organisasjonsmedlemskap
        ved fullføring og blir filtrerbare i analyse.
      </p>

      <ul className="mt-1.5 space-y-2">
        {fields.length === 0 ? (
          <li className="rounded-md border border-dashed border-neutral-300 bg-neutral-50/50 p-4 text-center text-xs text-neutral-500">
            Ingen ekstra felt definert. Trykk «Legg til felt» for å begynne.
          </li>
        ) : (
          fields.map((f, idx) => (
            <FieldRow
              key={`${f.key}-${idx}`}
              field={f}
              onChange={(next) =>
                setFields(fields.map((x, i) => (i === idx ? next : x)))
              }
              onRemove={() => setFields(fields.filter((_, i) => i !== idx))}
              onMove={(dir) => move(idx, dir)}
              disableUp={idx === 0}
              disableDown={idx === fields.length - 1}
            />
          ))
        )}
      </ul>
      <div className="mt-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() =>
            setFields([
              ...fields,
              { key: `field_${fields.length + 1}`, kind: 'text', label: '', required: false },
            ])
          }
        >
          Legg til felt
        </Button>
      </div>
    </div>
  )
}

function FieldRow({
  field,
  onChange,
  onRemove,
  onMove,
  disableUp,
  disableDown,
}: {
  field: TemplateMetadataField
  onChange: (next: TemplateMetadataField) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  disableUp: boolean
  disableDown: boolean
}) {
  return (
    <li className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>Type</p>
            <SearchableSelect
              value={field.kind}
              options={KIND_OPTIONS}
              onChange={(v) => {
                const kind = v as TemplateMetadataFieldKind
                const canonical: Partial<Record<TemplateMetadataFieldKind, string>> = {
                  location: 'location',
                  department: 'department',
                  team: 'team',
                }
                const nextKey = canonical[kind] ?? field.key
                onChange({ ...field, kind, key: nextKey })
              }}
            />
          </div>
          <div>
            <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>Synlig label</p>
            <StandardInput
              value={field.label ?? ''}
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              placeholder="(bruker standard)"
            />
          </div>
          {field.kind === 'text' || field.kind === 'number' || field.kind === 'select' ? (
            <div>
              <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>Nøkkel</p>
              <StandardInput
                value={field.key}
                onChange={(e) =>
                  onChange({
                    ...field,
                    key: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]+/g, '_')
                      .replace(/^_|_$/g, ''),
                  })
                }
                placeholder="external_cert_id"
              />
            </div>
          ) : null}
          {field.kind === 'select' ? (
            <div className="sm:col-span-2">
              <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>Valg (id|label, ett per linje)</p>
              <StandardTextarea
                value={(field.options ?? []).map((o) => `${o.id}|${o.label}`).join('\n')}
                onChange={(e) =>
                  onChange({
                    ...field,
                    options: e.target.value
                      .split('\n')
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line) => {
                        const [id, ...rest] = line.split('|')
                        return {
                          id: (id ?? '').trim(),
                          label: rest.join('|').trim() || (id ?? '').trim(),
                        }
                      })
                      .filter((o) => o.id),
                  })
                }
                rows={3}
                placeholder={'internal|Internt\nexternal|Ekstern'}
              />
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <ToggleSwitch
                checked={field.required ?? false}
                onChange={(v) => onChange({ ...field, required: v })}
                label="Påkrevd"
              />
              <span>Påkrevd</span>
            </label>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<ChevronUp className="h-3.5 w-3.5" />}
            onClick={() => onMove(-1)}
            disabled={disableUp}
            aria-label="Flytt opp"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<ChevronDown className="h-3.5 w-3.5" />}
            onClick={() => onMove(1)}
            disabled={disableDown}
            aria-label="Flytt ned"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            onClick={onRemove}
            aria-label="Fjern felt"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          />
        </div>
      </div>
    </li>
  )
}
