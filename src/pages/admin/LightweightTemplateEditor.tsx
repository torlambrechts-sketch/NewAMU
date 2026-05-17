// Lightweight (mal-detaljer) editor for the cross-module
// /admin/templates surface. Edits the template's core fields directly
// against Supabase — name, description, category, status flags. The
// rich content (questions tree, block tree, course modules,
// register-field schema) stays in each module's full template editor;
// a pinned "Åpne i full mal-redigerer" CTA links there.
//
// Both surfaces edit the same template row. This editor is the
// admin-cross-module path; the full editor is the module-specialist
// path. Last-writer-wins is gated by an optimistic concurrency check
// on `updated_at` — if the row changed between open and save, the
// admin sees a clear staleness error and is asked to reload.
//
// Compliance has its own full slide-over (TemplateEditorPanel) and
// doesn't need a lightweight surface — admins jump straight to the
// full editor. Compliance is intentionally NOT handled here.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Loader2, Lock, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StandardInput } from '../../components/ui/Input'
import { StandardTextarea } from '../../components/ui/Textarea'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { ToggleSwitch } from '../../components/ui/FormToggles'
import { useOrgSetupContext } from '../../hooks/useOrgSetupContext'
import type { AdminTemplateRow, AdminTemplateSource } from '../../hooks/useAdminTemplates'

type Props = {
  row: AdminTemplateRow
  onClose: () => void
  onSaved: () => void
}

const TABLE_BY_SOURCE: Record<AdminTemplateSource, string> = {
  compliance: 'compliance_checklist_templates',
  survey: 'survey_org_templates',
  documents: 'document_org_templates',
  learning: 'learning_courses',
  registers: 'register_types',
}

type FieldDef = {
  key: string
  label: string
  kind: 'text' | 'textarea' | 'select' | 'multi-text' | 'number' | 'toggle'
  required?: boolean
  options?: { value: string; label: string }[]
  help?: string
}

const SURVEY_REVIEW_STATUS_OPTIONS = [
  { value: 'draft', label: 'Utkast' },
  { value: 'reviewed', label: 'Gjennomgått' },
  { value: 'approved', label: 'Godkjent' },
]

const SURVEY_CADENCE_OPTIONS = [
  { value: '', label: '(Ingen)' },
  { value: 'arlig', label: 'Årlig' },
  { value: 'halvarlig', label: 'Halvårlig' },
  { value: 'kvartalsvis', label: 'Kvartalsvis' },
  { value: 'ad_hoc', label: 'Ad hoc' },
]

const DOCUMENT_CATEGORY_OPTIONS = [
  { value: 'hms_handbook', label: 'HMS-håndbok' },
  { value: 'policy', label: 'Policy' },
  { value: 'procedure', label: 'Prosedyre' },
  { value: 'guide', label: 'Veileder' },
  { value: 'template_library', label: 'Mal-bibliotek' },
]

const LEARNING_STATUS_OPTIONS = [
  { value: 'draft', label: 'Utkast' },
  { value: 'published', label: 'Publisert' },
  { value: 'archived', label: 'Arkivert' },
]

const FIELDS_BY_SOURCE: Record<Exclude<AdminTemplateSource, 'compliance'>, FieldDef[]> = {
  survey: [
    { key: 'name_override', label: 'Navn (overstyring)', kind: 'text', help: 'Tomt = bruk katalog-navnet.' },
    { key: 'description_override', label: 'Beskrivelse (overstyring)', kind: 'textarea' },
    { key: 'is_active', label: 'Aktiv', kind: 'toggle' },
    { key: 'nav_pinned', label: 'Festet i sidemeny', kind: 'toggle' },
    { key: 'cadence_hint', label: 'Anbefalt kadens', kind: 'select', options: SURVEY_CADENCE_OPTIONS },
    { key: 'review_status', label: 'Godkjenningsstatus', kind: 'select', options: SURVEY_REVIEW_STATUS_OPTIONS },
  ],
  documents: [
    { key: 'label', label: 'Navn', kind: 'text', required: true },
    { key: 'description', label: 'Beskrivelse', kind: 'textarea' },
    { key: 'category', label: 'Kategori', kind: 'select', required: true, options: DOCUMENT_CATEGORY_OPTIONS },
    { key: 'legal_basis', label: 'Lovgrunnlag (tagger)', kind: 'multi-text', help: 'Komma-separert. Eks: AML § 4-1, IK-f § 5.' },
  ],
  learning: [
    { key: 'title', label: 'Tittel', kind: 'text', required: true },
    { key: 'description', label: 'Beskrivelse', kind: 'textarea' },
    { key: 'status', label: 'Status', kind: 'select', required: true, options: LEARNING_STATUS_OPTIONS },
  ],
  registers: [
    { key: 'name', label: 'Navn', kind: 'text', required: true },
    { key: 'description', label: 'Beskrivelse', kind: 'textarea' },
    { key: 'regulation_ids', label: 'Regelverk (tagger)', kind: 'multi-text', help: 'Eks: aml, ik-f, gdpr.' },
    { key: 'pack_slugs', label: 'Pakker (tagger)', kind: 'multi-text' },
    { key: 'default_review_cadence_months', label: 'Standard gjennomgangsfrekvens (mnd)', kind: 'number' },
    { key: 'position', label: 'Sortering', kind: 'number' },
    { key: 'is_active', label: 'Aktiv', kind: 'toggle' },
  ],
}

export function LightweightTemplateEditor({ row, onClose, onSaved }: Props) {
  const { supabase } = useOrgSetupContext()
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const source = row.source
  const isCompliance = source === 'compliance'
  const fields = useMemo<FieldDef[]>(
    () => (isCompliance ? [] : FIELDS_BY_SOURCE[source]),
    [isCompliance, source],
  )
  const table = TABLE_BY_SOURCE[source]
  const isSystemLocked = row.isSystem // Registers + survey-catalog rows

  // Load fresh row + record updated_at for concurrency check on save.
  // Skipped for compliance (handled by the dedicated bridge).
  useEffect(() => {
    if (isCompliance || !supabase) return
    let cancelled = false
    void (async () => {
      try {
        const cols = fields.map((f) => f.key).concat(['updated_at']).join(', ')
        const { data, error: err } = await supabase
          .from(table)
          .select(cols)
          .eq('id', row.id)
          .maybeSingle()
        if (cancelled) return
        if (err) throw err
        if (!data) throw new Error('Fant ikke malen.')
        const obj = data as unknown as Record<string, unknown>
        const v: Record<string, unknown> = {}
        for (const f of fields) v[f.key] = obj[f.key]
        setValues(v)
        setOriginalUpdatedAt((obj.updated_at as string | null) ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Kunne ikke laste mal-detaljer.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isCompliance, supabase, table, row.id, fields])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Compliance falls through to the bridge — render an explainer here
  // so misuse of this component doesn't crash.
  if (isCompliance) {
    return (
      <Wrapper title={row.name} subtitle="Sjekkliste-mal" onClose={onClose}>
        <p className="text-sm text-neutral-600">
          Sjekkliste-maler bruker den fulle redigereren — åpne den fra «Rediger» i listen.
        </p>
      </Wrapper>
    )
  }

  const handleSave = async () => {
    if (!supabase || isSystemLocked) return
    // Validate required fields locally before sending.
    for (const f of fields) {
      if (f.required) {
        const v = values[f.key]
        if (v == null || (typeof v === 'string' && v.trim() === '')) {
          setError(`«${f.label}» er påkrevd.`)
          return
        }
      }
    }
    setSaving(true)
    setError(null)
    try {
      let query = supabase.from(table).update(values).eq('id', row.id)
      if (originalUpdatedAt) {
        query = query.eq('updated_at', originalUpdatedAt)
      }
      const { data, error: err } = await query.select('id, updated_at')
      if (err) throw err
      if (!data || data.length === 0) {
        throw new Error(
          'Malen ble endret av en annen mens du redigerte. Lukk og åpne på nytt for å se siste versjon.',
        )
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke lagre.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Wrapper title={row.name} subtitle="Mal-detaljer" onClose={onClose}>
      {isSystemLocked ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Systemmal — kun visning</p>
            <p className="text-xs">
              Felter på systemmaler endres i plattform-admin. Du kan fortsatt åpne den fulle
              redigereren for å se innholdet.
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="size-4 animate-spin" /> Laster …
        </div>
      ) : (
        <div className="space-y-4">
          {error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
              {error}
            </div>
          ) : null}
          {fields.map((f) => (
            <FieldRow
              key={f.key}
              field={f}
              value={values[f.key]}
              disabled={isSystemLocked || saving}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
            />
          ))}
        </div>
      )}

      <div className="mt-6 border-t border-neutral-100 pt-4">
        <Link
          to={row.editUrl}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#1a3d32] hover:underline"
        >
          <ExternalLink className="size-4" />
          Åpne i full mal-redigerer (innhold)
        </Link>
        <p className="mt-1 text-[11px] text-neutral-500">
          Rik innholdsredigering (spørsmål, blokker, kurs-moduler, felt-skjema) skjer i modulens
          egen mal-redigerer.
        </p>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-neutral-100 pt-4">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Avbryt
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSave()}
          disabled={loading || saving || isSystemLocked}
          icon={saving ? <Loader2 className="size-4 animate-spin" /> : undefined}
        >
          {saving ? 'Lagrer …' : 'Lagre'}
        </Button>
      </div>
    </Wrapper>
  )
}

function Wrapper({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-40">
      <Button
        variant="ghost"
        aria-label="Lukk panel"
        onClick={onClose}
        className="absolute inset-0 rounded-none bg-neutral-900/40 backdrop-blur-[1px] hover:bg-neutral-900/40"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              {subtitle}
            </p>
            <h2 className="truncate text-lg font-semibold text-neutral-900">{title}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Lukk"
            className="h-7 w-7 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="size-5" />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  )
}

function FieldRow({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldDef
  value: unknown
  disabled: boolean
  onChange: (next: unknown) => void
}) {
  const labelEl = (
    <label className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
      {field.label}
      {field.required ? <span className="ml-0.5 text-rose-600">*</span> : null}
    </label>
  )

  if (field.kind === 'text') {
    return (
      <div>
        {labelEl}
        <StandardInput
          value={(value as string) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1"
        />
        {field.help ? <p className="mt-1 text-[11px] text-neutral-500">{field.help}</p> : null}
      </div>
    )
  }

  if (field.kind === 'textarea') {
    return (
      <div>
        {labelEl}
        <StandardTextarea
          value={(value as string) ?? ''}
          disabled={disabled}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1"
        />
        {field.help ? <p className="mt-1 text-[11px] text-neutral-500">{field.help}</p> : null}
      </div>
    )
  }

  if (field.kind === 'select') {
    return (
      <div>
        {labelEl}
        <div className="mt-1">
          <SearchableSelect
            value={(value as string) ?? ''}
            disabled={disabled}
            options={field.options ?? []}
            onChange={(v) => onChange(v || null)}
          />
        </div>
        {field.help ? <p className="mt-1 text-[11px] text-neutral-500">{field.help}</p> : null}
      </div>
    )
  }

  if (field.kind === 'multi-text') {
    const arr = Array.isArray(value) ? (value as string[]) : []
    const display = arr.join(', ')
    return (
      <div>
        {labelEl}
        <StandardInput
          value={display}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
          className="mt-1"
        />
        {field.help ? <p className="mt-1 text-[11px] text-neutral-500">{field.help}</p> : null}
      </div>
    )
  }

  if (field.kind === 'number') {
    return (
      <div>
        {labelEl}
        <StandardInput
          type="number"
          value={(value as number | null) ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className="mt-1"
        />
        {field.help ? <p className="mt-1 text-[11px] text-neutral-500">{field.help}</p> : null}
      </div>
    )
  }

  // toggle
  return (
    <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
      <div>
        <p className="text-sm font-medium text-neutral-900">{field.label}</p>
        {field.help ? <p className="text-[11px] text-neutral-500">{field.help}</p> : null}
      </div>
      <ToggleSwitch
        checked={Boolean(value)}
        onChange={(checked) => {
          if (disabled) return
          onChange(checked)
        }}
        label={field.label}
      />
    </div>
  )
}
