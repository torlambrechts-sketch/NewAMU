import { useMemo } from 'react'
import {
  WPSTD_FORM_FIELD_LABEL,
  WPSTD_FORM_ROW_GRID,
} from '../../src/components/layout/WorkplaceStandardFormPanel'
import { YesNoToggle } from '../../src/components/ui/FormToggles'
import { StandardInput } from '../../src/components/ui/Input'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { QUESTION_TYPE_OPTIONS } from './surveyLabels'
import type { SurveyQuestionType } from './types'
import { configForTypeSwitch } from './surveyQuestionConfigHelpers'

export type QuestionDraft = {
  questionText: string
  questionType: SurveyQuestionType
  orderIndex: number
  isRequired: boolean
  sectionId: string | null
  config: Record<string, unknown>
}

type SectionOpt = { value: string; label: string }

type Props = {
  draft: QuestionDraft
  onChange: (patch: Partial<QuestionDraft>) => void
  sectionOptions: SectionOpt[]
  optionsLines: string
  onOptionsLinesChange: (v: string) => void
  configJson: string
  onConfigJsonChange: (v: string) => void
}

const needsOptionsLines = (t: SurveyQuestionType) =>
  ['multiple_choice', 'single_select', 'multi_select', 'dropdown'].includes(t)

export function SurveyQuestionFormFields({
  draft,
  onChange,
  sectionOptions,
  optionsLines,
  onOptionsLinesChange,
  configJson,
  onConfigJsonChange,
}: Props) {
  const qType = draft.questionType
  const cfg = draft.config

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

  return (
    <div className="space-y-5">
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-text">
          Spørsmålstekst
        </label>
        <StandardTextarea
          id="q-text"
          value={draft.questionText}
          onChange={(e) => onChange({ questionText: e.target.value })}
          rows={3}
        />
      </div>
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-type-sel">
          Spørsmålstype
        </label>
        <SearchableSelect
          value={qType}
          options={typeSelectOptions}
          onChange={(v) => {
            const next = v as SurveyQuestionType
            onChange({ questionType: next, config: configForTypeSwitch(next) })
            onOptionsLinesChange('')
          }}
        />
      </div>
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-sect">
          Seksjon
        </label>
        <SearchableSelect
          value={draft.sectionId ?? ''}
          options={sectionSelectOptions}
          onChange={(v) => onChange({ sectionId: v ? v : null })}
        />
      </div>
      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-ord">
          Sortering (indeks)
        </label>
        <StandardInput
          id="q-ord"
          type="number"
          value={String(draft.orderIndex)}
          onChange={(e) => onChange({ orderIndex: Number.parseInt(e.target.value, 10) || 0 })}
          min={0}
        />
      </div>
      <div>
        <span className={WPSTD_FORM_FIELD_LABEL}>Må fylles ut</span>
        <div className="mt-2 max-w-xs">
          <YesNoToggle value={draft.isRequired} onChange={(v) => onChange({ isRequired: v })} />
        </div>
      </div>

      {needsOptionsLines(qType) ? (
        <div>
          <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-opts">
            Alternativer (én per linje)
          </label>
          <StandardTextarea
            id="q-opts"
            value={optionsLines}
            onChange={(e) => onOptionsLinesChange(e.target.value)}
            rows={5}
            placeholder="Ja&#10;Nei&#10;Vet ikke"
          />
        </div>
      ) : null}

      {qType === 'short_text' ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Min. lengde</label>
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
            <label className={WPSTD_FORM_FIELD_LABEL}>Maks. lengde</label>
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
          <div className="md:col-span-2">
            <label className={WPSTD_FORM_FIELD_LABEL}>Regex (valgfritt)</label>
            <StandardInput
              value={typeof cfg.regexPattern === 'string' ? cfg.regexPattern : ''}
              onChange={(e) => setCfg({ regexPattern: e.target.value || null })}
              placeholder="^…$"
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
            <label className={WPSTD_FORM_FIELD_LABEL}>Ikon / form</label>
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
              <label className={WPSTD_FORM_FIELD_LABEL}>Label venstre</label>
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
              <label className={WPSTD_FORM_FIELD_LABEL}>Label høyre</label>
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
              Søkbar liste
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
            Bilder (label | URL per linje, f.eks. «A | https://…»)
          </label>
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
            <label className={WPSTD_FORM_FIELD_LABEL}>Etiketter (én per linje, lav→høy)</label>
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
            />
          </div>
        </div>
      ) : null}

      {qType === 'matrix' ? (
        <div className="space-y-3">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Rader (én per linje)</label>
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
            Fast rekkefølge (ikke tilfeldig)
          </label>
        </div>
      ) : null}

      {qType === 'nps' ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Label venstre (0)</label>
            <StandardInput
              value={typeof cfg.leftLabel === 'string' ? cfg.leftLabel : ''}
              onChange={(e) => setCfg({ leftLabel: e.target.value })}
            />
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Label høyre (10)</label>
            <StandardInput
              value={typeof cfg.rightLabel === 'string' ? cfg.rightLabel : ''}
              onChange={(e) => setCfg({ rightLabel: e.target.value })}
            />
          </div>
        </div>
      ) : null}

      {qType === 'file_upload' ? (
        <div className={WPSTD_FORM_ROW_GRID}>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL}>Maks MB</label>
            <StandardInput
              type="number"
              value={String(typeof cfg.maxFileSizeMb === 'number' ? cfg.maxFileSizeMb : 10)}
              onChange={(e) => setCfg({ maxFileSizeMb: Number(e.target.value) || 10 })}
            />
          </div>
          <div className="md:col-span-2">
            <label className={WPSTD_FORM_FIELD_LABEL}>Tillatte filtyper (kommaseparert)</label>
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
            <label className={WPSTD_FORM_FIELD_LABEL}>Modus</label>
            <SearchableSelect
              value={typeof cfg.mode === 'string' ? cfg.mode : 'datetime-local'}
              options={[
                { value: 'date', label: 'Dato' },
                { value: 'time', label: 'Klokkeslett' },
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

      <div>
        <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="q-config-json">
          Logikk og validering (JSON)
        </label>
        <p className="mb-1 text-xs text-neutral-500">
          Bruk <code className="rounded bg-neutral-100 px-1">logic_jump</code> og{' '}
          <code className="rounded bg-neutral-100 px-1">validation_rules</code> etter behov.
        </p>
        <StandardTextarea
          id="q-config-json"
          value={configJson}
          onChange={(e) => onConfigJsonChange(e.target.value)}
          rows={5}
          className="font-mono text-xs"
          placeholder='{"logic_jump":{},"validation_rules":{}}'
        />
      </div>
    </div>
  )
}
