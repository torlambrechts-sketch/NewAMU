// RegisterTypeEditorPanel — SlidePanel for authoring a per-org custom
// register type. Lets the admin define name + regulations + fields
// (each field: kind, key, label, required, options). v1 supports the
// six common kinds (text/number/date/boolean/select/select_multi);
// doc_ref + location_ref are exposed in the kind picker but render as
// text inputs at the record level (placeholders) until the picker
// primitives ship.
//
// System-shipped types are read-only here — edit happens in the
// catalogue migration. The panel only opens for org-authored types.

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { SlidePanel } from '../layout/SlidePanel'
import { StandardInput } from '../ui/Input'
import { StandardTextarea } from '../ui/Textarea'
import { SearchableSelect } from '../ui/SearchableSelect'
import { ToggleSwitch } from '../ui/FormToggles'
import { WPSTD_FORM_FIELD_LABEL } from '../layout/WorkplaceStandardFormPanel'
import { WarningBox } from '../ui/AlertBox'
import {
  REGISTER_FIELD_KIND_LABELS,
  type RegisterField,
  type RegisterFieldKind,
  type RegisterMetadataSchema,
} from '../../types/registers'

const FIELD_KIND_OPTIONS: { value: RegisterFieldKind; label: string }[] = (
  Object.keys(REGISTER_FIELD_KIND_LABELS) as RegisterFieldKind[]
).map((k) => ({ value: k, label: REGISTER_FIELD_KIND_LABELS[k] }))

type Payload = {
  slug: string
  name: string
  description: string | null
  metadataSchema: RegisterMetadataSchema
  regulationIds: string[]
  defaultReviewCadenceMonths: number | null
}

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: Payload) => Promise<boolean | void>
}

export function RegisterTypeEditorPanel({ open, onClose, onSubmit }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')
  const [regulationsRaw, setRegulationsRaw] = useState('')
  const [reviewCadence, setReviewCadence] = useState('')
  const [fields, setFields] = useState<RegisterField[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const slugFromName = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

  const addField = () => {
    setFields((s) => [
      ...s,
      {
        key: `field_${s.length + 1}`,
        label: `Felt ${s.length + 1}`,
        kind: 'text',
      },
    ])
  }
  const removeField = (idx: number) => setFields((s) => s.filter((_, i) => i !== idx))
  const updateField = (idx: number, patch: Partial<RegisterField>) => {
    setFields((s) => s.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  }

  const canSubmit = name.trim().length > 0 && slug.length > 0 && fields.length > 0

  const handleSubmit = async () => {
    setError(null)
    if (!canSubmit) {
      setError('Navn, slug og minst ett felt er påkrevd.')
      return
    }
    // De-dup field keys to avoid breaking record values silently.
    const seen = new Set<string>()
    for (const f of fields) {
      if (seen.has(f.key)) {
        setError(`Duplisert feltnøkkel: ${f.key}.`)
        return
      }
      seen.add(f.key)
      if (!f.key.match(/^[a-z][a-z0-9_]*$/)) {
        setError(`Ugyldig feltnøkkel «${f.key}» — bruk små bokstaver, tall og _.`)
        return
      }
    }
    setSubmitting(true)
    try {
      const ok = await onSubmit({
        slug,
        name: name.trim(),
        description: description.trim() || null,
        metadataSchema: { fields },
        regulationIds: regulationsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        defaultReviewCadenceMonths: reviewCadence ? Number(reviewCadence) || null : null,
      })
      if (ok !== false) {
        onClose()
        // Reset for next open
        setName('')
        setSlug('')
        setDescription('')
        setRegulationsRaw('')
        setReviewCadence('')
        setFields([])
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      titleId="register-type-editor"
      title="Ny registertype"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Oppretter …' : 'Opprett registertype'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error ? <WarningBox>{error}</WarningBox> : null}

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="rt-name">
            Navn <span className="text-red-600">*</span>
          </label>
          <StandardInput
            id="rt-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (slug === '') setSlug(slugFromName(e.target.value))
            }}
            placeholder="F.eks. Måleutstyr"
            className="mt-1.5"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="rt-slug">
            Identifikator (slug) <span className="text-red-600">*</span>
          </label>
          <p className="mt-0.5 text-xs text-neutral-500">
            Stabil intern identifikator; brukes i URL og kan ikke endres etter opprettelse.
          </p>
          <StandardInput
            id="rt-slug"
            value={slug}
            onChange={(e) => setSlug(slugFromName(e.target.value))}
            placeholder="maleutstyr"
            className="mt-1.5 font-mono"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="rt-desc">
            Beskrivelse
          </label>
          <StandardTextarea
            id="rt-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1.5"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="rt-regs">
            Regelverk
          </label>
          <p className="mt-0.5 text-xs text-neutral-500">
            Komma-separert liste av regelverk-id (f.eks. <code>iso-9001, aml</code>).
            Drives av samme regelverk-filter som de andre modulene.
          </p>
          <StandardInput
            id="rt-regs"
            value={regulationsRaw}
            onChange={(e) => setRegulationsRaw(e.target.value)}
            placeholder="iso-9001, aml"
            className="mt-1.5 font-mono"
          />
        </div>

        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="rt-cadence">
            Standard gjennomgangs-syklus (måneder)
          </label>
          <StandardInput
            id="rt-cadence"
            type="number"
            min={1}
            max={120}
            value={reviewCadence}
            onChange={(e) => setReviewCadence(e.target.value)}
            placeholder="12"
            className="mt-1.5 w-32"
          />
        </div>

        <div className="border-t border-neutral-200 pt-5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
              Felter <span className="text-red-600">*</span>
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={addField}
            >
              Nytt felt
            </Button>
          </div>
          {fields.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-neutral-300 bg-neutral-50/50 p-4 text-center text-xs text-neutral-500">
              Ingen felter ennå. Klikk «Nytt felt» for å starte.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {fields.map((f, i) => (
                <li key={i} className="rounded-md border border-neutral-200 bg-white p-3">
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 gap-2 md:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                          Etikett
                        </label>
                        <StandardInput
                          value={f.label}
                          onChange={(e) => updateField(i, { label: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                          Nøkkel
                        </label>
                        <StandardInput
                          value={f.key}
                          onChange={(e) => updateField(i, { key: slugFromName(e.target.value) })}
                          className="mt-1 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                          Type
                        </label>
                        <div className="mt-1">
                          <SearchableSelect
                            value={f.kind}
                            options={FIELD_KIND_OPTIONS}
                            onChange={(v) =>
                              updateField(i, { kind: v as RegisterFieldKind })
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                          Tips
                        </label>
                        <StandardInput
                          value={f.hint ?? ''}
                          onChange={(e) => updateField(i, { hint: e.target.value || undefined })}
                          className="mt-1"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center gap-2">
                        <ToggleSwitch
                          checked={!!f.required}
                          onChange={(v) => updateField(i, { required: v })}
                          label={`Påkrevd ${f.label}`}
                        />
                        <span className="text-xs text-neutral-700">Påkrevd</span>
                      </div>
                      {(f.kind === 'select' || f.kind === 'select_multi') ? (
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                            Valg (én per linje, format: verdi|etikett)
                          </label>
                          <StandardTextarea
                            rows={3}
                            value={(f.options ?? []).map((o) => `${o.value}|${o.label}`).join('\n')}
                            onChange={(e) => {
                              const next = e.target.value
                                .split('\n')
                                .map((line) => {
                                  const [v, l] = line.split('|').map((s) => s.trim())
                                  if (!v) return null
                                  return { value: v, label: l || v }
                                })
                                .filter(Boolean) as { value: string; label: string }[]
                              updateField(i, { options: next })
                            }}
                            className="mt-1 font-mono"
                            placeholder={'high|Høy\nmedium|Middels\nlow|Lav'}
                          />
                        </div>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeField(i)}
                      aria-label="Fjern felt"
                      className="h-auto w-auto rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SlidePanel>
  )
}
