// GenericRowBuilder — abstract 3-column builder for any per-row scope.
//
// For scopes where the editor is "load one row, edit a couple of jsonb
// columns + a name, save back" — most of the remaining studio scopes
// fit this shape. Wraps StudioCanvas + handles load/save/dirty-state
// + JSON-textarea editors for jsonb columns.
//
// Scopes that fit:
//   - documents: edit document_org_templates row (label, description, page_payload jsonb)
//   - meetings:  edit meeting_org_templates row (name, description, definition jsonb)
//   - registers: edit register_types row (name, description, metadata_schema jsonb)
//   - learning:  edit learning_courses row (title, description)
//   - dashboards: edit dashboard_layouts row (name, layout jsonb)
//
// Scopes that DON'T fit (need their own builder):
//   - compliance: ChecklistItem array + dnd-kit reorder → ComplianceBuilder
//   - workflows:  trigger/condition/action 3-step → WorkflowsBuilder
//   - survey:     catalog overrides shape → SurveyBuilder

import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Button } from '../../ui/Button'
import { StandardInput } from '../../ui/Input'
import { StandardTextarea } from '../../ui/Textarea'
import { StudioCanvas, type StudioCanvasAdapter } from './StudioCanvas'
import { useOrgSetupContext } from '../../../hooks/useOrgSetupContext'

export type GenericRowField = {
  /** Column name in the DB row. */
  column: string
  /** Visible label. */
  label: string
  /** Editor kind. */
  kind: 'text' | 'textarea' | 'json' | 'boolean'
  /** Optional placeholder for text/textarea. */
  placeholder?: string
}

export type GenericRowBuilderProps = {
  /** The DB table to load + update. */
  rowTable: string
  /** The row's uuid. */
  rowId: string
  /** Scope id for the header chip. */
  scopeId: string
  /** Center-column title prefix (e.g. "Dokument · "). */
  titlePrefix: string
  /** Column that produces the title — usually 'name' or 'label' or 'title'. */
  titleColumn: string
  /** Fields shown in the left-column sections + center editor. */
  fields: GenericRowField[]
  /** Right-column properties (text + boolean fields are surfaced here). */
  propertyFields: GenericRowField[]
  /** Optional header subtitle hint. */
  subtitleHint?: string
}

type Row = Record<string, unknown>

export function GenericRowBuilder({
  rowTable,
  rowId,
  titlePrefix,
  titleColumn,
  fields,
  propertyFields,
  subtitleHint,
}: GenericRowBuilderProps) {
  const { supabase } = useOrgSetupContext()
  const [row, setRow] = useState<Row | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadedFromId, setLoadedFromId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedField, setSelectedField] = useState<string>(fields[0]?.column ?? '')
  const [jsonErrors, setJsonErrors] = useState<Record<string, string | null>>({})

  // One-shot load
  if (loadedFromId !== rowId) {
    setLoadedFromId(rowId)
    if (supabase) {
      setLoading(true)
      void (async () => {
        const cols = [
          'id',
          titleColumn,
          ...fields.map((f) => f.column),
          ...propertyFields.map((f) => f.column),
        ]
        const { data, error: e } = await supabase
          .from(rowTable)
          .select(Array.from(new Set(cols)).join(', '))
          .eq('id', rowId)
          .single()
        if (e) setError(e.message)
        else setRow(data as unknown as Row)
        setLoading(false)
      })()
    }
  }

  const update = useCallback((column: string, value: unknown) => {
    setRow((prev) => (prev ? { ...prev, [column]: value } : prev))
    setDirty(true)
  }, [])

  const save = useCallback(async () => {
    if (!supabase || !row) return
    // Validate all JSON fields parse
    for (const f of [...fields, ...propertyFields]) {
      if (f.kind === 'json' && jsonErrors[f.column]) {
        setError(`Ugyldig JSON i ${f.label}: ${jsonErrors[f.column]}`)
        return
      }
    }
    setSaving(true)
    setError(null)
    const patch: Row = {}
    for (const f of [...fields, ...propertyFields]) {
      patch[f.column] = row[f.column]
    }
    const { error: e } = await supabase.from(rowTable).update(patch).eq('id', row.id)
    if (e) setError(e.message)
    else setDirty(false)
    setSaving(false)
  }, [supabase, row, rowTable, fields, propertyFields, jsonErrors])

  const renderFieldEditor = useCallback(
    (f: GenericRowField): ReactNode => {
      if (!row) return null
      const value = row[f.column]
      if (f.kind === 'text') {
        return (
          <StandardInput
            value={value == null ? '' : String(value)}
            onChange={(e) => update(f.column, e.target.value || null)}
            placeholder={f.placeholder}
            className="mt-1"
          />
        )
      }
      if (f.kind === 'textarea') {
        return (
          <StandardTextarea
            value={value == null ? '' : String(value)}
            onChange={(e) => update(f.column, e.target.value || null)}
            placeholder={f.placeholder}
            className="mt-1 min-h-[80px]"
          />
        )
      }
      if (f.kind === 'boolean') {
        return (
          <div className="mt-1 flex items-center gap-2">
            <StandardInput
              type="checkbox"
              id={`field-${f.column}`}
              checked={!!value}
              onChange={(e) => update(f.column, e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor={`field-${f.column}`} className="text-xs">
              {f.label}
            </label>
          </div>
        )
      }
      // json
      const text = typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)
      return (
        <div className="mt-1 space-y-1">
          <StandardTextarea
            value={text}
            onChange={(e) => {
              const v = e.target.value
              try {
                const parsed = JSON.parse(v)
                update(f.column, parsed)
                setJsonErrors((prev) => ({ ...prev, [f.column]: null }))
              } catch (err) {
                setJsonErrors((prev) => ({
                  ...prev,
                  [f.column]: err instanceof Error ? err.message : String(err),
                }))
                // Keep raw text in state so user can fix it
                setRow((prev) => (prev ? { ...prev, [f.column]: v } : prev))
                setDirty(true)
              }
            }}
            className="h-[320px] w-full font-mono text-xs"
            spellCheck={false}
          />
          {jsonErrors[f.column] ? (
            <p className="text-xs text-red-700">JSON-feil: {jsonErrors[f.column]}</p>
          ) : null}
        </div>
      )
    },
    [row, update, jsonErrors],
  )

  const adapter: StudioCanvasAdapter<GenericRowField> = useMemo(
    () => ({
      items: fields,
      getItemId: (f) => f.column,
      selectedId: selectedField,
      onSelect: (id) => setSelectedField(id),
      renderItemLabel: (f) => f.label,
      renderEditor: (f) =>
        f ? (
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              {f.label}
            </label>
            {renderFieldEditor(f)}
          </div>
        ) : null,
      renderProperties: () =>
        row ? (
          <div className="space-y-4 text-xs">
            {propertyFields.map((f) => (
              <div key={f.column}>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                  {f.label}
                </label>
                {renderFieldEditor(f)}
              </div>
            ))}
          </div>
        ) : null,
    }),
    [fields, propertyFields, selectedField, renderFieldEditor, row],
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laster rad…
      </div>
    )
  }
  if (!row) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Fant ikke raden <code>{rowId}</code> i tabellen <code>{rowTable}</code>.
      </div>
    )
  }

  const title = String(row[titleColumn] ?? '(uten navn)')

  return (
    <>
      <StudioCanvas
        title={`${titlePrefix}${title}`}
        subtitle={subtitleHint}
        headerActions={
          <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {dirty ? 'Lagre' : 'Lagret'}
          </Button>
        }
        adapter={adapter}
      />
      {error ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      ) : null}
    </>
  )
}
