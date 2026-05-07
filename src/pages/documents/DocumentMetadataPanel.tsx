// DocumentMetadataPanel — schema-driven metadata above a wiki page's body
// (documents-parity §T9). Mirrors LearningCompletionMetadataPanel and
// SurveyMetadataPanel: reads the source template's metadata_schema,
// renders the matching field controls, persists free-form values into
// `wiki_pages.metadata` on field blur via the supplied saver.
//
// Documents have no org-context FK columns (location/department/team)
// — those kinds render as read-only "ikke valgt" because there's no
// place on the page to write them. Free-form kinds (text/number/select)
// drive the bulk of the value. Built-in kinds stay rendered for
// consistency with the other modules even though they're informational
// only.

import { useMemo, useState } from 'react'
import { ModuleSectionCard } from '../../components/module/ModuleSectionCard'
import { Badge } from '../../components/ui/Badge'
import { StandardInput } from '../../components/ui/Input'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { WPSTD_FORM_FIELD_LABEL } from '../../components/layout/WorkplaceStandardFormPanel'
import type {
  TemplateMetadataField,
  TemplateMetadataSchema,
  WikiPage,
} from '../../types/documents'

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
  page: WikiPage
  metadataSchema: TemplateMetadataSchema | null | undefined
  /** Async writer that persists `metadata` on the page row. */
  onSaveMetadata: (pageId: string, metadata: Record<string, unknown>) => Promise<void>
  disabled?: boolean
}

export function DocumentMetadataPanel({
  page,
  metadataSchema,
  onSaveMetadata,
  disabled = false,
}: Props) {
  const fields = useMemo(() => metadataSchema?.fields ?? [], [metadataSchema])

  const [metadataValues, setMetadataValues] = useState<Record<string, unknown>>(
    page.metadata ?? {},
  )
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset on page identity change.
  const [lastId, setLastId] = useState(page.id)
  if (lastId !== page.id) {
    setLastId(page.id)
    setMetadataValues(page.metadata ?? {})
    setSaveError(null)
  }

  const flush = (key: string, value: unknown) => {
    const next = { ...metadataValues, [key]: value }
    setMetadataValues(next)
    void (async () => {
      try {
        await onSaveMetadata(page.id, next)
        setSaveError(null)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Kunne ikke lagre.')
      }
    })()
  }

  const builtInFields = useMemo(
    () =>
      fields.filter(
        (f) =>
          f.kind === 'location' ||
          f.kind === 'department' ||
          f.kind === 'team' ||
          f.kind === 'participants',
      ),
    [fields],
  )
  const freeformFields = useMemo(
    () =>
      fields.filter(
        (f) => f.kind === 'text' || f.kind === 'number' || f.kind === 'select',
      ),
    [fields],
  )

  if (fields.length === 0) return null

  return (
    <ModuleSectionCard className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-neutral-900">
          Hoveddata for dokumentet
        </h3>
        <Badge variant="warning">Definert av mal</Badge>
      </div>
      <p className="mt-1.5 text-sm text-neutral-600">
        Tilleggsfelter denne malen krever — for eksempel lovgrunnlag, neste revisjon
        eller eier-avdeling. Endringer lagres automatisk.
      </p>

      {saveError ? (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {saveError}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {/* ── Built-in kinds: read-only stub on documents ─────────────── */}
        {builtInFields.map((f) => {
          const label = f.label ?? DEFAULT_LABELS[f.kind]
          // Documents store these in `metadata` like everything else,
          // since there's no FK column on wiki_pages.
          const raw = metadataValues[f.key]
          const display = typeof raw === 'string' && raw ? raw : null
          return (
            <div key={f.key}>
              <p className={WPSTD_FORM_FIELD_LABEL}>
                {label} {f.required ? <span className="text-red-500">*</span> : null}
              </p>
              <p className="mt-1.5 text-sm text-neutral-800">
                {display ?? <span className="italic text-neutral-500">Ikke valgt</span>}
              </p>
            </div>
          )
        })}

        {/* ── Free-form kinds ─────────────────────────────────────────── */}
        {freeformFields.map((f) => {
          const label = f.label ?? DEFAULT_LABELS[f.kind]
          const id = `doc-md-${f.key}`
          const value = metadataValues[f.key]

          if (f.kind === 'text') {
            return (
              <div key={f.key} className="md:col-span-2">
                <label className={WPSTD_FORM_FIELD_LABEL} htmlFor={id}>
                  {label} {f.required ? <span className="text-red-500">*</span> : null}
                </label>
                {f.help ? (
                  <p className="mb-1 text-xs text-neutral-500">{f.help}</p>
                ) : null}
                <StandardInput
                  id={id}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(e) =>
                    setMetadataValues({ ...metadataValues, [f.key]: e.target.value })
                  }
                  onBlur={(e) => flush(f.key, e.target.value)}
                  disabled={disabled}
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
                {f.help ? (
                  <p className="mb-1 text-xs text-neutral-500">{f.help}</p>
                ) : null}
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
                  disabled={disabled}
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
                {f.help ? (
                  <p className="mb-1 text-xs text-neutral-500">{f.help}</p>
                ) : null}
                <SearchableSelect
                  value={typeof value === 'string' ? value : ''}
                  options={options}
                  onChange={(v) => flush(f.key, v || null)}
                  disabled={disabled}
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
