// SurveyTemplateMetadataEditorPanel — admin slide panel for setting
// `category_id` and `metadata_schema` on a single org_template override.
// Mirrors the equivalent block in compliance's TemplateEditorPanel
// (the "Hoveddata-felt" section + the kind selector + slug
// canonicalisation), but as a standalone slide panel since the survey
// admin doesn't have a unified template editor surface.
//
// Persists via setCategoryId + setMetadataSchema on useSurveyOrgTemplates
// (both stamp the row and bump local state — no extra reload needed).

import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { SlidePanel } from '../../../src/components/layout/SlidePanel'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import type { ResolvedSurveyTemplate } from '../useSurveyOrgTemplates'
import type {
  SurveyCategoryRow,
  SurveyPackSlug,
  TemplateMetadataField,
  TemplateMetadataFieldKind,
} from '../types'

const KIND_OPTIONS: { value: TemplateMetadataFieldKind; label: string }[] = [
  { value: 'location', label: 'Lokasjon (org-FK)' },
  { value: 'department', label: 'Avdeling (org-FK)' },
  { value: 'team', label: 'Team (org-FK)' },
  { value: 'participants', label: 'Deltakere (medlemmer)' },
  { value: 'text', label: 'Fritekst' },
  { value: 'number', label: 'Tall' },
  { value: 'select', label: 'Valg fra liste' },
]

// Per spec OQ-5 (confirmed): recommended-preset map. Vendor and
// arbeidsmiljø packs get sensible field defaults; other packs start empty.
const RECOMMENDED_PRESETS: Record<SurveyPackSlug, TemplateMetadataField[]> = {
  vendor: [
    { key: 'location', kind: 'location', required: false },
    { key: 'department', kind: 'department', required: false },
  ],
  arbeidsmiljo: [
    { key: 'location', kind: 'location', required: true },
    { key: 'department', kind: 'department', required: true },
    { key: 'participants', kind: 'participants', required: false },
  ],
  compliance: [{ key: 'location', kind: 'location', required: true }],
  engagement: [],
  exit: [],
}

type Props = {
  open: boolean
  template: ResolvedSurveyTemplate | null
  /** All categories the admin can pick from for this template's pack. */
  categories: SurveyCategoryRow[]
  onClose: () => void
  onSaveCategory: (overrideId: string, categoryId: string | null) => Promise<void> | void
  onSaveMetadataSchema: (
    overrideId: string,
    fields: TemplateMetadataField[],
  ) => Promise<void> | void
}

export function SurveyTemplateMetadataEditorPanel({
  open,
  template,
  categories,
  onClose,
  onSaveCategory,
  onSaveMetadataSchema,
}: Props) {
  // Local copies so cancel actually cancels.
  const [categoryId, setCategoryId] = useState<string>(template?.categoryId ?? '')
  const [fields, setFields] = useState<TemplateMetadataField[]>(
    template?.metadataSchema?.fields ?? [],
  )
  const [submitting, setSubmitting] = useState(false)

  // Reset on template change (set-state-during-render to avoid the
  // lint-flagged useEffect pattern).
  const [lastId, setLastId] = useState(template?.overrideId ?? null)
  if (template && template.overrideId !== lastId) {
    setLastId(template.overrideId ?? null)
    setCategoryId(template.categoryId ?? '')
    setFields(template.metadataSchema?.fields ?? [])
  }

  if (!template) return null
  if (!template.overrideId) {
    // No override row exists yet — defensive guard. Surfaces inside the
    // useSurveyOrgTemplates flow which only returns templates with
    // overrideId set, but typing makes it nullable for catalog-only entries.
    return null
  }
  const overrideId = template.overrideId

  const categoryOptions = [
    { value: '', label: 'Uten kategori' },
    ...categories
      .filter((c) => c.pack === template.pack && c.is_active)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
      .map((c) => ({ value: c.id, label: c.name })),
  ]

  const handleSave = async () => {
    setSubmitting(true)
    try {
      const next = categoryId === '' ? null : categoryId
      const before = template.categoryId ?? null
      if (next !== before) {
        await onSaveCategory(overrideId, next)
      }
      await onSaveMetadataSchema(overrideId, fields)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= fields.length) return
    const copy = [...fields]
    const [picked] = copy.splice(idx, 1)
    if (!picked) return
    copy.splice(target, 0, picked)
    setFields(copy)
  }

  const useRecommended = () => {
    const preset = RECOMMENDED_PRESETS[template.pack] ?? []
    setFields(preset)
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="survey-template-metadata-editor"
      title={`Hoveddata — ${template.name}`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Avbryt
          </Button>
          <Button variant="primary" onClick={() => void handleSave()} disabled={submitting}>
            {submitting ? 'Lagrer …' : 'Lagre'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── Category ──────────────────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>
            Kategorien malen tilhører — bestemmer hvor den vises i sidemenyen og på
            forsiden av Undersøkelser.
          </p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Kategori</p>
            <div className="mt-1.5">
              <SearchableSelect
                value={categoryId}
                options={categoryOptions}
                onChange={setCategoryId}
                placeholder="Uten kategori"
              />
            </div>
          </div>
        </div>

        {/* ── Metadata fields ───────────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>
            Felt som vises i Hoveddata-panelet på undersøkelsen — for eksempel
            lokasjon for vernerunder eller deltakere for AMU-protokoll. Innebygde
            typer (lokasjon, avdeling, team, deltakere) kobles mot
            organisasjonsstrukturen og er filtrerbare i analyse.
          </p>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className={WPSTD_FORM_FIELD_LABEL}>Hoveddata-felt</p>
              {fields.length === 0 && RECOMMENDED_PRESETS[template.pack].length > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={useRecommended}>
                  Bruk anbefalt for {template.pack}
                </Button>
              ) : null}
            </div>
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
                      setFields((prev) => prev.map((x, i) => (i === idx ? next : x)))
                    }
                    onRemove={() => setFields((prev) => prev.filter((_, i) => i !== idx))}
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
                  setFields((prev) => [
                    ...prev,
                    {
                      key: `field_${prev.length + 1}`,
                      kind: 'text',
                      label: '',
                      required: false,
                    },
                  ])
                }
              >
                Legg til felt
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SlidePanel>
  )
}

// ── Field row ───────────────────────────────────────────────────────────────

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
                // Built-in kinds get canonical keys so analytics filter
                // matching stays clean.
                const canonical: Record<TemplateMetadataFieldKind, string | null> = {
                  location: 'location',
                  department: 'department',
                  team: 'team',
                  participants: 'participants',
                  text: null,
                  number: null,
                  select: null,
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
                placeholder="evalueringsperiode"
              />
            </div>
          ) : null}
          {field.kind === 'select' ? (
            <div className="sm:col-span-2">
              <p className={`${WPSTD_FORM_FIELD_LABEL} mb-1`}>
                Valg (id|label, ett per linje)
              </p>
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
                placeholder={'q1|Q1\nq2|Q2\nq3|Q3\nq4|Q4'}
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

