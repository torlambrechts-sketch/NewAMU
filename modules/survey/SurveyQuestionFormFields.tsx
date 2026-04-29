import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Lightbulb } from 'lucide-react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { InfoBox } from '../../src/components/ui/AlertBox'
import { Button } from '../../src/components/ui/Button'
import { QUESTION_TYPE_OPTIONS, questionTypeLabel } from './surveyLabels'
import type { SurveyQuestionType } from './types'
import { configForTypeSwitch } from './surveyQuestionConfigHelpers'
import { SurveyQuestionConditionEditor } from './SurveyQuestionConditionEditor'
import type { PurposeSuggestion } from './surveyPurposeSuggestions'

export type QuestionDraft = {
  questionText: string
  questionType: SurveyQuestionType
  orderIndex: number
  isRequired: boolean
  sectionId: string | null
  config: Record<string, unknown>
}

type SectionOpt = { value: string; label: string }

type ConditionOpt = { id: string; label: string }

type Props = {
  draft: QuestionDraft
  onChange: (patch: Partial<QuestionDraft>) => void
  sectionOptions: SectionOpt[]
  optionsLines: string
  onOptionsLinesChange: (v: string) => void
  configJson: string
  onConfigJsonChange: (v: string) => void
  /** Tom liste = ingen forslagsstripe */
  purposeSuggestions?: PurposeSuggestion[]
  onApplySuggestion?: (s: PurposeSuggestion) => void
  conditionQuestionOptions?: ConditionOpt[]
  currentQuestionId?: string | null
  /** Vis JSON og teknisk regex — typisk kun for administrator */
  showAdvancedJson?: boolean
}

const needsOptionsLines = (t: SurveyQuestionType) =>
  ['multiple_choice', 'single_select', 'multi_select', 'dropdown'].includes(t)

const TYPE_GROUPS: { title: string; types: SurveyQuestionType[] }[] = [
  {
    title: 'Tekst',
    types: ['short_text', 'long_text', 'text', 'email'],
  },
  {
    title: 'Valg',
    types: ['yes_no', 'multiple_choice', 'single_select', 'multi_select', 'dropdown', 'image_choice'],
  },
  {
    title: 'Skala og vurdering',
    types: ['rating_1_to_5', 'rating_1_to_10', 'rating_visual', 'slider', 'likert_scale', 'nps'],
  },
  {
    title: 'Øvrig',
    types: ['number', 'matrix', 'ranking', 'file_upload', 'datetime', 'signature'],
  },
]

function typeExplainer(t: SurveyQuestionType): string {
  switch (t) {
    case 'short_text':
      return 'Korte svar som navn eller ett ord — kan sette min./maks. tegn.'
    case 'long_text':
    case 'text':
      return 'Åpne svar — brukes når du vil ha utdyping. Fritekst vises ikke ordrett i analyse (personvern).'
    case 'email':
      return 'Sjekker automatisk at feltet ser ut som en e-postadresse.'
    case 'yes_no':
      return 'To tydelige valg — godt for ja/nei-spørsmål.'
    case 'multiple_choice':
    case 'single_select':
    case 'multi_select':
    case 'dropdown':
      return 'Bestem selv alternativer (én per linje). Enkeltvalg = ett svar; flervalg = flere.'
    case 'image_choice':
      return 'Velg mellom bilder — krever bilde-URL for hvert valg.'
    case 'rating_1_to_5':
    case 'rating_1_to_10':
      return 'Numerisk skala — analyse viser gjennomsnitt og fordeling.'
    case 'rating_visual':
      return 'Stjerner eller ikoner — respondenten trykker på en grad.'
    case 'slider':
      return 'Skyver på en skala — passer når du vil ha finfordeling.'
    case 'likert_scale':
      return 'Typisk «uenig–enig» med egne etiketter per trinn.'
    case 'nps':
      return 'Net Promoter Score 0–10 — standard for anbefaling.'
    case 'number':
      return 'Ren tallinntasting med valgfri min/maks.'
    case 'matrix':
      return 'Flere påstander med samme svarskala (tabell).'
    case 'ranking':
      return 'Respondenten sorterer elementer etter viktighet.'
    case 'file_upload':
      return 'Opplasting som base64 i databasen — vurder filstørrelse og typetillatelser.'
    case 'datetime':
      return 'Dato og/eller klokkeslett.'
    case 'signature':
      return 'Tekstsignatur i skjema — ikke juridisk avansert signatur.'
    default:
      return 'Velg typen som passer best til det du vil måle.'
  }
}

export function SurveyQuestionFormFields({
  draft,
  onChange,
  sectionOptions,
  optionsLines,
  onOptionsLinesChange,
  configJson,
  onConfigJsonChange,
  purposeSuggestions = [],
  onApplySuggestion,
  conditionQuestionOptions = [],
  currentQuestionId = null,
  showAdvancedJson = false,
}: Props) {
  const qType = draft.questionType
  const cfg = draft.config
  const [pickerOpen, setPickerOpen] = useState(false)
  const [advOpen, setAdvOpen] = useState(false)
  const [jsonOpen, setJsonOpen] = useState(false)

  const typeSelectOptions: SelectOption[] = useMemo(
    () => QUESTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  )

  const sectionSelectOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'Uten seksjon (rot)' }, ...sectionOptions],
    [sectionOptions],
  )

  const setCfg = (patch: Record<string, unknown>) => {
    onChange({ config: { ...draft.config, ...patch } })
  }

  const pickType = (next: SurveyQuestionType) => {
    onChange({ questionType: next, config: configForTypeSwitch(next) })
    onOptionsLinesChange('')
  }

  return (
    <div className="space-y-5">
      {purposeSuggestions.length > 0 && onApplySuggestion ? (
        <div className="rounded-xl border border-[#1a3d32]/20 bg-gradient-to-br from-[#f7faf8] to-white p-4 shadow-sm">
          <div className="flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[#1a3d32]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">Forslag basert på formålet med undersøkelsen</p>
              <p className="mt-1 text-xs text-neutral-600">
                Klikk for å fylle inn tekst og type — du kan redigere alt etterpå.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {purposeSuggestions.map((s) => (
                  <Button
                    key={s.label + s.questionText}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="max-w-full text-left"
                    onClick={() => onApplySuggestion(s)}
                    title={s.hint}
                  >
                    <span className="block truncate font-medium">{s.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-text">
          Spørsmålstekst
        </label>
        <StandardTextarea
          id="q-text"
          value={draft.questionText}
          onChange={(e) => onChange({ questionText: e.target.value })}
          rows={3}
          placeholder="Formuler tydelig — én ting per spørsmål."
        />
      </div>

      <div className="rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
        >
          <div>
            <p className={WPSTD_FORM_FIELD_LABEL}>Spørsmålstype</p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-900">{questionTypeLabel(qType)}</p>
            <p className="mt-1 text-xs text-neutral-600">{typeExplainer(qType)}</p>
          </div>
          {pickerOpen ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-neutral-500" aria-hidden />
          )}
        </button>

        {pickerOpen ? (
          <div className="mt-4 space-y-5 border-t border-neutral-100 pt-4">
            <p className="text-xs text-neutral-500">
              Velg kategori og type. Usikker? Start med kort tekst, ja/nei eller vurdering 1–5.
            </p>
            {TYPE_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">{g.title}</p>
                <div className="flex flex-wrap gap-2">
                  {g.types.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        pickType(t)
                        setPickerOpen(false)
                      }}
                      className={[
                        'rounded-lg border px-3 py-2 text-left text-xs transition',
                        t === qType
                          ? 'border-[#1a3d32] bg-[#f7faf8] font-semibold text-neutral-900'
                          : 'border-neutral-200 bg-white hover:border-[#1a3d32]/35',
                      ].join(' ')}
                    >
                      {questionTypeLabel(t)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="mb-2 text-[11px] font-medium text-neutral-600">Eller søk i alle typer</p>
              <SearchableSelect
                value={qType}
                options={typeSelectOptions}
                onChange={(v) => {
                  pickType(v as SurveyQuestionType)
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-sect">
          Seksjon (mappe)
        </label>
        <p className="mb-1 text-xs text-neutral-500">Grupper spørsmål som i dokumentlisten — valgfritt.</p>
        <SearchableSelect
          value={draft.sectionId ?? ''}
          options={sectionSelectOptions}
          onChange={(v) => onChange({ sectionId: v ? v : null })}
        />
      </div>

      <div>
        <span className={WPSTD_FORM_FIELD_LABEL}>Må besvares</span>
        <p className="mb-2 text-xs text-neutral-500">Kreves bare når spørsmålet er synlig for deltakeren.</p>
        <div className="max-w-xs">
          <YesNoToggle value={draft.isRequired} onChange={(v) => onChange({ isRequired: v })} />
        </div>
      </div>

      {needsOptionsLines(qType) ? (
        <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/50 p-4">
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-opts">
            Svaralternativer (én per linje)
          </label>
          <p className="mb-2 text-xs text-neutral-600">
            Det øverste alternativet vises først. For flervalg kan respondenten krysse av flere.
          </p>
          <StandardTextarea
            id="q-opts"
            value={optionsLines}
            onChange={(e) => onOptionsLinesChange(e.target.value)}
            rows={5}
            placeholder={'Ja\nNei\nVet ikke'}
          />
        </div>
      ) : null}

      {qType === 'short_text' ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Min. antall tegn</label>
            <StandardInput
              type="number"
              value={cfg.minLength != null ? String(cfg.minLength) : ''}
              onChange={(e) =>
                setCfg({
                  minLength: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Maks. antall tegn</label>
            <StandardInput
              type="number"
              value={cfg.maxLength != null ? String(cfg.maxLength) : ''}
              onChange={(e) =>
                setCfg({
                  maxLength: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
      ) : null}

      {qType === 'long_text' ? (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>Maks. antall ord (valgfritt)</label>
          <StandardInput
            type="number"
            value={cfg.wordCountLimit != null ? String(cfg.wordCountLimit) : ''}
            onChange={(e) =>
              setCfg({
                wordCountLimit: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </div>
      ) : null}

      {qType === 'number' ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Min</label>
            <StandardInput
              type="number"
              value={cfg.minValue != null ? String(cfg.minValue) : ''}
              onChange={(e) =>
                setCfg({ minValue: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Maks</label>
            <StandardInput
              type="number"
              value={cfg.maxValue != null ? String(cfg.maxValue) : ''}
              onChange={(e) =>
                setCfg({ maxValue: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Steg</label>
            <StandardInput
              type="number"
              value={cfg.step != null ? String(cfg.step) : ''}
              onChange={(e) => setCfg({ step: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                className="rounded border-neutral-300"
                checked={cfg.integerOnly === true}
                onChange={(e) => setCfg({ integerOnly: e.target.checked })}
              />
              Kun heltall
            </label>
          </div>
        </div>
      ) : null}

      {qType === 'rating_visual' ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Maks på skala (f.eks. 5)</label>
            <StandardInput
              type="number"
              value={typeof cfg.scaleMax === 'number' ? String(cfg.scaleMax) : '5'}
              onChange={(e) => setCfg({ scaleMax: Number(e.target.value) || 5 })}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Utforming</label>
            <SearchableSelect
              value={typeof cfg.shapeType === 'string' ? cfg.shapeType : 'star'}
              options={[
                { value: 'star', label: 'Stjerner' },
                { value: 'circle', label: 'Sirkler' },
                { value: 'square', label: 'Knapper' },
              ]}
              onChange={(v) => setCfg({ shapeType: v })}
            />
          </div>
        </div>
      ) : null}

      {qType === 'slider' ? (
        <div className="space-y-3">
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>Start</label>
              <StandardInput
                type="number"
                value={String(typeof cfg.rangeStart === 'number' ? cfg.rangeStart : 0)}
                onChange={(e) => setCfg({ rangeStart: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>Slutt</label>
              <StandardInput
                type="number"
                value={String(typeof cfg.rangeEnd === 'number' ? cfg.rangeEnd : 100)}
                onChange={(e) => setCfg({ rangeEnd: Number(e.target.value) || 100 })}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>Steg</label>
              <StandardInput
                type="number"
                value={String(typeof cfg.stepIncrement === 'number' ? cfg.stepIncrement : 1)}
                onChange={(e) => setCfg({ stepIncrement: Number(e.target.value) || 1 })}
              />
            </div>
          </div>
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>Tekst venstre</label>
              <StandardInput
                value={String(
                  (cfg.labels as { low?: string } | undefined)?.low ??
                    (typeof cfg.rangeStart === 'number' ? String(cfg.rangeStart) : '0'),
                )}
                onChange={(e) =>
                  setCfg({
                    labels: {
                      ...((cfg.labels as object) || {}),
                      low: e.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>Tekst høyre</label>
              <StandardInput
                value={String(
                  (cfg.labels as { high?: string } | undefined)?.high ??
                    (typeof cfg.rangeEnd === 'number' ? String(cfg.rangeEnd) : '100'),
                )}
                onChange={(e) =>
                  setCfg({
                    labels: {
                      ...((cfg.labels as object) || {}),
                      high: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      ) : null}

      {qType === 'dropdown' ? (
        <div>
          <span className={WPSTD_FORM_FIELD_LABEL}>Innstillinger</span>
          <div className="mt-2 space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                className="rounded border-neutral-300"
                checked={cfg.searchable === true}
                onChange={(e) => setCfg({ searchable: e.target.checked })}
              />
              Søkbar liste (mange alternativer)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                className="rounded border-neutral-300"
                checked={cfg.allowOther === true}
                onChange={(e) => setCfg({ allowOther: e.target.checked })}
              />
              Tillat «Annet»
            </label>
          </div>
        </div>
      ) : null}

      {qType === 'image_choice' ? (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL}>
            Bilder (tekst | nettadresse per linje)
          </label>
          <p className="mb-2 text-xs text-neutral-500">Eksempel: «Alternativ A | https://…»</p>
          <StandardTextarea
            rows={4}
            value={
              Array.isArray(cfg.choices)
                ? (cfg.choices as { label?: string; image_url?: string }[])
                    .map((c) => `${c.label ?? ''} | ${c.image_url ?? ''}`)
                    .join('\n')
                : ''
            }
            onChange={(e) => {
              const choices = e.target.value
                .split('\n')
                .map((line) => {
                  const [a, b] = line.split('|').map((s) => s.trim())
                  return { label: a || 'Valg', image_url: b || '' }
                })
                .filter((c) => c.label || c.image_url)
              setCfg({ choices: choices.length ? choices : [{ label: 'A', image_url: '' }] })
            }}
            placeholder="Design A | https://…"
          />
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              className="rounded border-neutral-300"
              checked={cfg.allowOther === true}
              onChange={(e) => setCfg({ allowOther: e.target.checked })}
            />
            Tillat «Annet»
          </label>
        </div>
      ) : null}

      {qType === 'likert_scale' ? (
        <div className="space-y-2">
          <div className={WPSTD_FORM_ROW_GRID}>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>Min</label>
              <StandardInput
                type="number"
                value={String(typeof cfg.scaleMin === 'number' ? cfg.scaleMin : 1)}
                onChange={(e) => setCfg({ scaleMin: Number(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL}>Maks</label>
              <StandardInput
                type="number"
                value={String(typeof cfg.scaleMax === 'number' ? cfg.scaleMax : 5)}
                onChange={(e) => setCfg({ scaleMax: Number(e.target.value) || 5 })}
              />
            </div>
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Etiketter (én per linje, fra lav til høy)</label>
            <StandardTextarea
              rows={4}
              value={
                Array.isArray(cfg.labels)
                  ? (cfg.labels as string[]).join('\n')
                  : ''
              }
              onChange={(e) =>
                setCfg({
                  labels: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder={'Helt uenig\nUenig\nNøytral\nEnig\nHelt enig'}
            />
          </div>
        </div>
      ) : null}

      {qType === 'matrix' ? (
        <div className="space-y-3">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Rader / påstander (én per linje)</label>
            <StandardTextarea
              rows={4}
              value={
                Array.isArray(cfg.rows)
                  ? (cfg.rows as string[]).join('\n')
                  : ''
              }
              onChange={(e) =>
                setCfg({
                  rows: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Kolonner / skala (én per linje)</label>
            <StandardTextarea
              rows={3}
              value={
                Array.isArray(cfg.columns)
                  ? (cfg.columns as string[]).join('\n')
                  : ''
              }
              onChange={(e) =>
                setCfg({
                  columns: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      ) : null}

      {qType === 'ranking' ? (
        <div className="space-y-2">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Elementer (én per linje)</label>
            <StandardTextarea
              rows={4}
              value={
                Array.isArray(cfg.items)
                  ? (cfg.items as string[]).join('\n')
                  : ''
              }
              onChange={(e) =>
                setCfg({
                  items: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
            <input
              type="checkbox"
              className="rounded border-neutral-300"
              checked={cfg.fixedOrder === true}
              onChange={(e) => setCfg({ fixedOrder: e.target.checked })}
            />
            Fast rekkefølge (ikke tilfeldig rekkefølge på elementene)
          </label>
        </div>
      ) : null}

      {qType === 'nps' ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Tekst ved 0</label>
            <StandardInput
              value={typeof cfg.leftLabel === 'string' ? cfg.leftLabel : ''}
              onChange={(e) => setCfg({ leftLabel: e.target.value })}
              placeholder="Ikke sannsynlig"
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Tekst ved 10</label>
            <StandardInput
              value={typeof cfg.rightLabel === 'string' ? cfg.rightLabel : ''}
              onChange={(e) => setCfg({ rightLabel: e.target.value })}
              placeholder="Svært sannsynlig"
            />
          </div>
        </div>
      ) : null}

      {qType === 'file_upload' ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Maks filstørrelse (MB)</label>
            <StandardInput
              type="number"
              value={String(typeof cfg.maxFileSizeMb === 'number' ? cfg.maxFileSizeMb : 10)}
              onChange={(e) => setCfg({ maxFileSizeMb: Number(e.target.value) || 10 })}
            />
          </div>
          <div className="md:col-span-2">
            <label className={WPSTD_FORM_FIELD_LABEL}>Tillatte filtyper (komma mellom)</label>
            <StandardInput
              value={
                Array.isArray(cfg.allowedExtensions)
                  ? (cfg.allowedExtensions as string[]).join(', ')
                  : ''
              }
              onChange={(e) =>
                setCfg({
                  allowedExtensions: e.target.value
                    .split(',')
                    .map((s) => s.trim().toLowerCase())
                    .filter(Boolean),
                })
              }
              placeholder="pdf, jpg, png"
            />
          </div>
        </div>
      ) : null}

      {qType === 'datetime' ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Visning</label>
            <SearchableSelect
              value={typeof cfg.mode === 'string' ? cfg.mode : 'datetime-local'}
              options={[
                { value: 'date', label: 'Bare dato' },
                { value: 'time', label: 'Bare klokkeslett' },
                { value: 'datetime-local', label: 'Dato og tid' },
              ]}
              onChange={(v) => setCfg({ mode: v })}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Tidssone (valgfritt)</label>
            <StandardInput
              value={typeof cfg.timezone === 'string' ? cfg.timezone : ''}
              onChange={(e) => setCfg({ timezone: e.target.value || null })}
              placeholder="Europe/Oslo"
            />
          </div>
        </div>
      ) : null}

      <SurveyQuestionConditionEditor
        configJson={configJson}
        onConfigJsonChange={onConfigJsonChange}
        questions={conditionQuestionOptions}
        currentQuestionId={currentQuestionId}
      />

      <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50/80">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-neutral-800"
          onClick={() => setAdvOpen((v) => !v)}
        >
          Avansert: rekkefølgenummer
          {advOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {advOpen ? (
          <div className="border-t border-neutral-200 px-4 pb-4 pt-2">
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-ord">
              Intern sorteringsindeks
            </label>
            <p className="mb-2 text-xs text-neutral-500">
              Vanligvis trenger du ikke endre dette — bruk dra-og-slipp i tabellen. Lavere tall kommer først innen samme
              seksjon.
            </p>
            <StandardInput
              id="q-ord"
              type="number"
              value={String(draft.orderIndex)}
              onChange={(e) => onChange({ orderIndex: Number.parseInt(e.target.value, 10) || 0 })}
              min={0}
            />
          </div>
        ) : null}
      </div>

      {showAdvancedJson ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/40">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-amber-950"
            onClick={() => setJsonOpen((v) => !v)}
          >
            Teknisk JSON (kun avanserte integrasjoner)
            {jsonOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {jsonOpen ? (
            <div className="border-t border-amber-200/60 px-4 pb-4 pt-2">
              <InfoBox>
                Rediger bare om du vet hva du gjør. Betinget visning styres over med skjema — ikke her.
              </InfoBox>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-config-json">
                Ekstra konfigurasjon (JSON)
              </label>
              <StandardTextarea
                id="q-config-json"
                value={configJson}
                onChange={(e) => onConfigJsonChange(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
