import { useCallback, useEffect, useState } from 'react'
import { SearchableSelect, type SelectOption } from '../../src/components/ui/SearchableSelect'
import { StandardInput } from '../../src/components/ui/Input'
import { StandardTextarea } from '../../src/components/ui/Textarea'
import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { InfoBox } from '../../src/components/ui/AlertBox'
import type { ShowIfRule } from './surveyRespondValidation'

export type ConditionQuestionOpt = { id: string; label: string }

type Mode = 'answered' | 'equals' | 'in'

function parseShowIfFromJson(json: string): {
  enabled: boolean
  questionId: string
  mode: Mode
  equalsValue: string
  inLines: string
} {
  try {
    const o = JSON.parse(json || '{}') as Record<string, unknown>
    const lj = o.logic_jump as { showIf?: ShowIfRule } | undefined
    const rule = (o.showIf as ShowIfRule | undefined) ?? lj?.showIf
    if (!rule || typeof rule.questionId !== 'string') {
      return {
        enabled: false,
        questionId: '',
        mode: 'answered',
        equalsValue: '',
        inLines: '',
      }
    }
    if (rule.answered === true) {
      return { enabled: true, questionId: rule.questionId, mode: 'answered', equalsValue: '', inLines: '' }
    }
    if (rule.in != null && Array.isArray(rule.in)) {
      return {
        enabled: true,
        questionId: rule.questionId,
        mode: 'in',
        equalsValue: '',
        inLines: rule.in.map((x) => String(x)).join('\n'),
      }
    }
    if (rule.equals !== undefined) {
      return {
        enabled: true,
        questionId: rule.questionId,
        mode: 'equals',
        equalsValue: String(rule.equals),
        inLines: '',
      }
    }
    return {
      enabled: true,
      questionId: rule.questionId,
      mode: 'answered',
      equalsValue: '',
      inLines: '',
    }
  } catch {
    return {
      enabled: false,
      questionId: '',
      mode: 'answered',
      equalsValue: '',
      inLines: '',
    }
  }
}

function stripShowIfFromParsed(parsed: Record<string, unknown>): Record<string, unknown> {
  const next = { ...parsed }
  delete next.showIf
  if (next.logic_jump && typeof next.logic_jump === 'object' && next.logic_jump !== null) {
    const lj = { ...(next.logic_jump as object) } as { showIf?: unknown }
    delete lj.showIf
    if (Object.keys(lj).length === 0) delete next.logic_jump
    else next.logic_jump = lj
  }
  return next
}

function buildShowIfRule(
  enabled: boolean,
  questionId: string,
  mode: Mode,
  equalsValue: string,
  inLines: string,
): ShowIfRule | null {
  if (!enabled || !questionId.trim()) return null
  if (mode === 'answered') return { questionId: questionId.trim(), answered: true }
  if (mode === 'equals') {
    const v = equalsValue.trim()
    if (v === 'Ja' || v === 'Nei') return { questionId: questionId.trim(), equals: v }
    const n = Number(v)
    if (!Number.isNaN(n) && v !== '') return { questionId: questionId.trim(), equals: n }
    return { questionId: questionId.trim(), equals: v }
  }
  const parts = inLines
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return { questionId: questionId.trim(), answered: true }
  return { questionId: questionId.trim(), in: parts }
}

export type SurveyQuestionConditionEditorProps = {
  configJson: string
  onConfigJsonChange: (next: string) => void
  questions: ConditionQuestionOpt[]
  currentQuestionId: string | null
}

/**
 * Betinget visning uten JSON — bygger `showIf` som merges inn i lagret config.
 */
export function SurveyQuestionConditionEditor({
  configJson,
  onConfigJsonChange,
  questions,
  currentQuestionId,
}: SurveyQuestionConditionEditorProps) {
  const [enabled, setEnabled] = useState(false)
  const [questionId, setQuestionId] = useState('')
  const [mode, setMode] = useState<Mode>('answered')
  const [equalsValue, setEqualsValue] = useState('')
  const [inLines, setInLines] = useState('')

  useEffect(() => {
    const p = parseShowIfFromJson(configJson)
    setEnabled(p.enabled)
    setQuestionId(p.questionId)
    setMode(p.mode)
    setEqualsValue(p.equalsValue)
    setInLines(p.inLines)
  }, [configJson])

  const apply = useCallback(
    (patch: Partial<{ enabled: boolean; questionId: string; mode: Mode; equalsValue: string; inLines: string }>) => {
      const en = patch.enabled ?? enabled
      const qid = patch.questionId ?? questionId
      const mo = patch.mode ?? mode
      const eq = patch.equalsValue ?? equalsValue
      const inn = patch.inLines ?? inLines

      let parsed: Record<string, unknown> = {}
      try {
        parsed = JSON.parse(configJson || '{}') as Record<string, unknown>
      } catch {
        parsed = {}
      }
      parsed = stripShowIfFromParsed(parsed)

      const rule = buildShowIfRule(en, qid, mo, eq, inn)
      if (rule) {
        parsed.showIf = rule
      } else {
        parsed = stripShowIfFromParsed(parsed)
      }

      onConfigJsonChange(JSON.stringify(parsed, null, 2))
    },
    [configJson, onConfigJsonChange, enabled, questionId, mode, equalsValue, inLines],
  )

  const qOpts: SelectOption[] = questions
    .filter((q) => q.id !== currentQuestionId)
    .map((q) => ({ value: q.id, label: q.label.length > 72 ? `${q.label.slice(0, 70)}…` : q.label }))

  const modeOpts: SelectOption[] = [
    { value: 'answered', label: 'Når det finnes svar' },
    { value: 'equals', label: 'Når svaret er nøyaktig …' },
    { value: 'in', label: 'Når svaret er ett av (liste)' },
  ]

  return (
    <div className="rounded-xl border border-neutral-200/90 bg-[#f9faf9] p-4">
      <p className="text-sm font-semibold text-neutral-900">Betinget visning</p>
      <p className="mt-1 text-xs text-neutral-600">
        Slå på hvis spørsmålet bare skal vises når et tidligere spørsmål er besvart på en bestemt måte. Du trenger ikke
        kode eller JSON.
      </p>

      <div className="mt-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            className="rounded border-neutral-300"
            checked={enabled}
            onChange={(e) => {
              const v = e.target.checked
              setEnabled(v)
              apply({ enabled: v })
            }}
          />
          Vis dette spørsmålet bare når betingelsen nedenfor er oppfylt
        </label>
      </div>

      {enabled ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cond-trigger-q">
              Ut fra spørsmål
            </label>
            <SearchableSelect
              value={questionId}
              options={qOpts}
              onChange={(v) => {
                setQuestionId(v)
                apply({ questionId: v })
              }}
            />
            {qOpts.length === 0 ? (
              <p className="mt-1 text-xs text-amber-700">
                Legg til minst ett spørsmål før dette i undersøkelsen, eller velg seksjon/rekkefølge slik at triggeren
                kommer først.
              </p>
            ) : null}
          </div>
          <div>
            <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cond-mode">
              Betingelse
            </label>
            <SearchableSelect
              value={mode}
              options={modeOpts}
              onChange={(v) => {
                const m = v as Mode
                setMode(m)
                apply({ mode: m })
              }}
            />
          </div>
          {mode === 'equals' ? (
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cond-eq">
                Verdi (tekst eller tall, f.eks. Ja eller 5)
              </label>
              <StandardInput
                id="cond-eq"
                value={equalsValue}
                onChange={(e) => {
                  const val = e.target.value
                  setEqualsValue(val)
                  apply({ equalsValue: val })
                }}
              />
            </div>
          ) : null}
          {mode === 'in' ? (
            <div>
              <label className={WPSTD_FORM_FIELD_LABEL} htmlFor="cond-in">
                Tillatte svar (én verdi per linje)
              </label>
              <StandardTextarea
                id="cond-in"
                rows={4}
                value={inLines}
                onChange={(e) => {
                  const val = e.target.value
                  setInLines(val)
                  apply({ inLines: val })
                }}
                placeholder="Ja&#10;Nei&#10;Vet ikke"
              />
            </div>
          ) : null}
          <InfoBox>
            Tips: For ja/nei-spørsmål bruk «nøyaktig» med «Ja» eller «Nei». For skala, skriv tallet som respondent ser
            (f.eks. 4).
          </InfoBox>
        </div>
      ) : null}
    </div>
  )
}
