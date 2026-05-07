// TemplateEditorPanel — create or edit a checklist template.
//
// Slide panel form covering: name, slug (create only), description, the
// items list (prompt, type, required, severity_default, law/iso ref,
// help, requirement tags), and template-level requirement coverage.
//
// On save:
//   - create mode: insert template, then link requirements via junction.
//   - edit mode:   update name/description/definition, then diff and
//                  apply requirement junction changes.

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { FormModal } from '../../../src/template'
import { Button } from '../../../src/components/ui/Button'
import { StandardInput } from '../../../src/components/ui/Input'
import { StandardTextarea } from '../../../src/components/ui/Textarea'
import { SearchableSelect } from '../../../src/components/ui/SearchableSelect'
import { ToggleSwitch } from '../../../src/components/ui/FormToggles'
import { WarningBox } from '../../../src/components/ui/AlertBox'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_LEAD,
  WPSTD_FORM_ROW_GRID,
} from '../../../src/components/layout/WorkplaceStandardFormPanel'
import { useOrgSetupContext } from '../../../src/hooks/useOrgSetupContext'
import { useActivePack } from '../../../src/context/packContextValue'
import { useChecklistModule } from '../useChecklistModule'
import { useRequirements } from '../useRequirements'
import { parseChecklistDefinition } from '../schema'
import type {
  ChecklistItem,
  ChecklistItemType,
  ComplianceSeverity,
  ComplianceTemplateRow,
  TemplateMetadataField,
  TemplateMetadataFieldKind,
} from '../types'

const ITEM_TYPE_OPTIONS: { value: ChecklistItemType; label: string }[] = [
  { value: 'yes_no_na', label: 'Ja / Nei / Ikke aktuelt' },
  { value: 'text', label: 'Tekst' },
  { value: 'number', label: 'Tall' },
  { value: 'photo', label: 'Bilde' },
  { value: 'signature', label: 'Signatur' },
]

const SEVERITY_OPTIONS: { value: ComplianceSeverity | ''; label: string }[] = [
  { value: '', label: '(Ingen forhåndsvalgt)' },
  { value: 'low', label: 'Lav' },
  { value: 'medium', label: 'Middels' },
  { value: 'high', label: 'Høy' },
  { value: 'critical', label: 'Kritisk' },
]

type Props = {
  mode: 'create' | 'edit'
  template: ComplianceTemplateRow | null
  onClose: () => void
  onSaved: () => void
}

export function TemplateEditorPanel({ mode, template, onClose, onSaved }: Props) {
  const { supabase } = useOrgSetupContext()
  const pack = useActivePack()
  const cl = useChecklistModule({ supabase })
  const reqs = useRequirements({ supabase })

  const initialItems = useMemo<ChecklistItem[]>(
    () => parseChecklistDefinition(template?.definition).items,
    [template?.definition],
  )

  const [name, setName] = useState(template?.name ?? '')
  const [slug, setSlug] = useState(template?.slug ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [requirementIds, setRequirementIds] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState<string>(template?.category_id ?? '')
  const [metadataFields, setMetadataFields] = useState<TemplateMetadataField[]>(
    template?.metadata_schema?.fields ?? [],
  )
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Pull categories on mount so the dropdown has options. Filtering by
  // pack happens locally (the hook holds every licensed pack's categories).
  const { loadCategories } = cl
  useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  const categoryOptions = useMemo(() => {
    const forPack = cl.categories
      .filter((c) => c.pack === pack.slug && c.is_active)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'nb'))
    return [
      { value: '', label: 'Uten kategori' },
      ...forPack.map((c) => ({ value: c.id, label: c.name })),
    ]
  }, [cl.categories, pack.slug])

  // Load existing requirement junction for edit mode.
  useEffect(() => {
    if (mode === 'edit' && template) {
      void cl.loadTemplateRequirements(template.id)
    }
  }, [mode, template, cl])

  // Sync requirementIds from cache once junction loads.
  useEffect(() => {
    if (mode !== 'edit' || !template) return
    const cached = cl.requirementIdsByTemplateId[template.id]
    if (cached) setRequirementIds(cached)
  }, [mode, template, cl.requirementIdsByTemplateId])

  const packRequirements = useMemo(
    () => reqs.forPack(pack.slug),
    [reqs, pack.slug],
  )

  const isSystem = Boolean(template?.is_system)
  const slugFromName = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    (mode === 'edit' || slug.trim().length > 0)

  const handleSave = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setLocalError(null)
    try {
      if (mode === 'create') {
        const id = await cl.createTemplate({
          pack: pack.slug,
          slug: slug.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          definition: { items },
        })
        if (!id) {
          setLocalError(cl.error ?? 'Kunne ikke opprette malen.')
          setSubmitting(false)
          return
        }
        if (categoryId || metadataFields.length > 0) {
          await cl.updateTemplate({
            templateId: id,
            category_id: categoryId || null,
            metadata_schema: { fields: metadataFields },
          })
        }
        if (requirementIds.length > 0) {
          await cl.setTemplateRequirements(id, requirementIds)
        }
      } else if (template) {
        await cl.updateTemplate({
          templateId: template.id,
          name: name.trim(),
          description: description.trim() || null,
          definition: { items },
          category_id: categoryId === '' ? null : categoryId,
          metadata_schema: { fields: metadataFields },
        })
        await cl.setTemplateRequirements(template.id, requirementIds)
      }
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormModal
      open
      onClose={onClose}
      titleId="form-edit-template"
      title={mode === 'create' ? 'Ny mal' : `Rediger ${template?.name ?? 'mal'}`}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-neutral-500">
            {isSystem ? 'Systemmal — slug og pakke kan ikke endres.' : ''}
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Avbryt
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={!canSubmit}
            >
              {mode === 'create' ? 'Opprett' : 'Lagre'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="-mx-6 -mt-8 sm:-mx-8">
        {(localError ?? cl.error) ? (
          <div className="px-4 pt-4 md:px-5">
            <WarningBox>{localError ?? cl.error}</WarningBox>
          </div>
        ) : null}

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Hva heter malen?</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Navn</p>
            <StandardInput
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (mode === 'create' && slug === slugFromName(name)) {
                  setSlug(slugFromName(e.target.value))
                }
              }}
              className="mt-1.5"
              placeholder="F.eks. Vernerunde — kontorer"
            />
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Stabil identifikator (kort, brukes i URL og DB).</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Slug</p>
            <StandardInput
              value={slug}
              onChange={(e) => setSlug(slugFromName(e.target.value))}
              className="mt-1.5 font-mono text-sm"
              disabled={mode === 'edit'}
              placeholder="vernerunde-kontorer"
            />
            <p className="mt-1 text-xs text-neutral-500">
              {mode === 'edit'
                ? 'Slug er låst etter opprettelse — endring ville bryte deep-links.'
                : 'Auto-utledes fra navnet, kan overstyres før du lagrer.'}
            </p>
          </div>
        </div>

        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>Beskrivelse (valgfritt) — vises i listen.</p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Beskrivelse</p>
            <StandardTextarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1.5"
            />
          </div>
        </div>

        {/* ── Category ──────────────────────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>
            Velg kategori — bestemmer hvor malen vises i sidemenyen og på forsiden.
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

        {/* ── Metadata schema (per-template fields) ──────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>
            Felt som vises i hoveddata-panelet på utførelsen — for eksempel
            lokasjon for vernerunder, eller deltakere for AMU-protokoll.
            Innebygde typer (lokasjon, avdeling, team, deltakere) kobles
            mot organisasjonsstrukturen og er filtrerbare i analyse.
          </p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Hoveddata-felt</p>
            <ul className="mt-1.5 space-y-2">
              {metadataFields.length === 0 ? (
                <li className="rounded-md border border-dashed border-neutral-300 bg-neutral-50/50 p-4 text-center text-xs text-neutral-500">
                  Ingen ekstra felt definert. Trykk «Legg til felt» for å begynne.
                </li>
              ) : (
                metadataFields.map((f, idx) => (
                  <MetadataFieldRow
                    key={`${f.key}-${idx}`}
                    field={f}
                    onChange={(next) =>
                      setMetadataFields((prev) =>
                        prev.map((x, i) => (i === idx ? next : x)),
                      )
                    }
                    onRemove={() =>
                      setMetadataFields((prev) => prev.filter((_, i) => i !== idx))
                    }
                    onMove={(dir) =>
                      setMetadataFields((prev) => {
                        const target = idx + dir
                        if (target < 0 || target >= prev.length) return prev
                        const copy = [...prev]
                        const [picked] = copy.splice(idx, 1)
                        if (!picked) return prev
                        copy.splice(target, 0, picked)
                        return copy
                      })
                    }
                    disableUp={idx === 0}
                    disableDown={idx === metadataFields.length - 1}
                  />
                ))
              )}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() =>
                  setMetadataFields((prev) => [
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
              {metadataFields.length === 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setMetadataFields([
                      { key: 'location', kind: 'location', required: true },
                      { key: 'participants', kind: 'participants', required: true },
                    ])
                  }
                >
                  Bruk anbefalt for vernerunde
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Requirements ──────────────────────────────────────────────── */}
        <div className={WPSTD_FORM_ROW_GRID}>
          <p className={WPSTD_FORM_LEAD}>
            Hvilke krav i {pack.shortName} dekker malen? Markér alle som passer.
          </p>
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Kravkobling</p>
            <ul className="mt-1.5 max-h-56 space-y-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-3">
              {packRequirements.length === 0 ? (
                <li className="text-xs text-neutral-500">
                  Ingen krav definert for denne pakken ennå.
                </li>
              ) : (
                packRequirements.map((r) => {
                  const checked = requirementIds.includes(r.id)
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-neutral-50"
                    >
                      <span className="min-w-0 flex-1 text-sm text-neutral-800">
                        <span className="font-medium">{r.code}</span>
                        <span className="ml-1.5 text-neutral-500">{r.title}</span>
                      </span>
                      <ToggleSwitch
                        checked={checked}
                        onChange={(v) =>
                          setRequirementIds((prev) =>
                            v
                              ? [...prev, r.id]
                              : prev.filter((id) => id !== r.id),
                          )
                        }
                        label={r.code}
                      />
                    </li>
                  )
                })
              )}
            </ul>
          </div>
        </div>

        {/* ── Items ─────────────────────────────────────────────────────── */}
        <div className="px-4 py-5 md:px-5">
          <h3 className="text-sm font-semibold text-neutral-900">
            Punkter ({items.length})
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Hvert punkt blir et spørsmål i sjekklisten. Endre rekkefølge med
            opp / ned.
          </p>

          <ul className="mt-3 space-y-3">
            {items.map((item, idx) => (
              <li
                key={`${item.key}-${idx}`}
                className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4"
              >
                <ItemEditor
                  item={item}
                  onChange={(next) =>
                    setItems((prev) => prev.map((it, i) => (i === idx ? next : it)))
                  }
                  onMoveUp={
                    idx > 0
                      ? () =>
                          setItems((prev) => {
                            const next = [...prev]
                            ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                            return next
                          })
                      : undefined
                  }
                  onMoveDown={
                    idx < items.length - 1
                      ? () =>
                          setItems((prev) => {
                            const next = [...prev]
                            ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                            return next
                          })
                      : undefined
                  }
                  onDelete={() =>
                    setItems((prev) => prev.filter((_, i) => i !== idx))
                  }
                />
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-4 w-4" />}
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    key: `punkt-${prev.length + 1}`,
                    prompt: '',
                    type: 'yes_no_na',
                    required: false,
                  },
                ])
              }
            >
              Legg til punkt
            </Button>
          </div>
        </div>
      </div>
    </FormModal>
  )
}

// ── Single-item inline editor ──────────────────────────────────────────────

type ItemEditorProps = {
  item: ChecklistItem
  onChange: (next: ChecklistItem) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDelete: () => void
}

function ItemEditor({
  item,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: ItemEditorProps) {
  const refLabel = item.iso_clause !== undefined ? 'ISO-klausul' : 'Lovreferanse'
  const refValue = item.iso_clause ?? item.law_ref ?? ''

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className={WPSTD_FORM_FIELD_LABEL}>Spørsmål</p>
          <StandardInput
            value={item.prompt}
            onChange={(e) => onChange({ ...item, prompt: e.target.value })}
            className="mt-1.5"
            placeholder="F.eks. Er rømningsveier frie?"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onMoveUp ? (
            <Button type="button" variant="ghost" size="sm" onClick={onMoveUp} aria-label="Flytt opp">
              ↑
            </Button>
          ) : null}
          {onMoveDown ? (
            <Button type="button" variant="ghost" size="sm" onClick={onMoveDown} aria-label="Flytt ned">
              ↓
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={onDelete}
            aria-label="Slett punkt"
          >
            <span className="sr-only">Slett</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Nøkkel (slug)</p>
          <StandardInput
            value={item.key}
            onChange={(e) =>
              onChange({
                ...item,
                key: e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_]+/g, '_'),
              })
            }
            className="mt-1.5 font-mono text-sm"
          />
        </div>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Type</p>
          <SearchableSelect
            options={ITEM_TYPE_OPTIONS}
            value={item.type}
            onChange={(v) =>
              onChange({ ...item, type: v as ChecklistItemType })
            }
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>Forhåndsvalgt alvorlighet</p>
          <SearchableSelect
            options={SEVERITY_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={item.severity_default ?? ''}
            onChange={(v) =>
              onChange({
                ...item,
                severity_default: v ? (v as ComplianceSeverity) : undefined,
              })
            }
            className="mt-1.5"
          />
        </div>
        <div>
          <p className={WPSTD_FORM_FIELD_LABEL}>{refLabel}</p>
          <StandardInput
            value={refValue}
            onChange={(e) => {
              const v = e.target.value
              if (item.iso_clause !== undefined) {
                onChange({ ...item, iso_clause: v || undefined })
              } else {
                onChange({ ...item, law_ref: v || undefined })
              }
            }}
            className="mt-1.5"
            placeholder={item.iso_clause !== undefined ? '9.2' : 'AML §4-1'}
          />
        </div>
      </div>

      <div>
        <p className={WPSTD_FORM_FIELD_LABEL}>Hjelpetekst (valgfritt)</p>
        <StandardTextarea
          value={item.help ?? ''}
          onChange={(e) => onChange({ ...item, help: e.target.value || undefined })}
          rows={2}
          className="mt-1.5"
        />
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
        <ToggleSwitch
          checked={item.required ?? false}
          onChange={(v) => onChange({ ...item, required: v })}
          label="Påkrevd"
        />
        <span>Påkrevd for å kunne signere</span>
      </label>
    </div>
  )
}

// ── Metadata schema field row ──────────────────────────────────────────────

const METADATA_KIND_OPTIONS: { value: TemplateMetadataFieldKind; label: string }[] = [
  { value: 'location', label: 'Lokasjon (org-FK)' },
  { value: 'department', label: 'Avdeling (org-FK)' },
  { value: 'team', label: 'Team (org-FK)' },
  { value: 'participants', label: 'Deltakere (medlemmer)' },
  { value: 'text', label: 'Fritekst' },
  { value: 'number', label: 'Tall' },
  { value: 'select', label: 'Valg fra liste' },
]

function MetadataFieldRow({
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
              options={METADATA_KIND_OPTIONS}
              onChange={(v) => {
                const kind = v as TemplateMetadataFieldKind
                // For built-in kinds, force the key to a stable canonical
                // name so analytics filters match. Free-form kinds keep
                // whatever key the admin typed.
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
                placeholder="vaer"
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
                placeholder={'sol|Sol\nregn|Regn\nsno|Snø'}
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
