import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { ComplianceBanner } from '../components/ui/ComplianceBanner'
import { StandardTextarea } from '../components/ui/Textarea'
import { InfoBox, WarningBox } from '../components/ui/AlertBox'
import { Badge } from '../components/ui/Badge'
import { useOrgSetupContext } from '../hooks/useOrgSetupContext'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'
import { useSurvey } from '../../modules/survey'
import type { OrgSurveyQuestionRow } from '../../modules/survey/types'
import { globalQuestionIdOrder } from '../../modules/survey/surveyQuestionGlobalOrder'
import { StandardInput } from '../components/ui/Input'
import { SearchableSelect } from '../components/ui/SearchableSelect'

type AnswerMap = Record<string, { value: number | null; text: string | null }>

function scaleBounds(cfg: Record<string, unknown> | undefined): { min: number; max: number; low: string; high: string } {
  const c = cfg ?? {}
  const min = typeof c.scaleMin === 'number' ? c.scaleMin : 1
  const max = typeof c.scaleMax === 'number' ? c.scaleMax : 5
  const anchors = c.anchors as { low?: string; high?: string } | undefined
  return {
    min,
    max,
    low: anchors?.low ?? String(min),
    high: anchors?.high ?? String(max),
  }
}

function RatingScaleRange({
  min,
  max,
  lowLabel,
  highLabel,
  value,
  onChange,
}: {
  min: number
  max: number
  lowLabel: string
  highLabel: string
  value: number | null
  onChange: (v: number) => void
}) {
  const nums: number[] = []
  for (let i = min; i <= max; i += 1) nums.push(i)
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-neutral-400">{lowLabel}</span>
      <div className="flex flex-wrap gap-1.5">
        {nums.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`min-h-10 min-w-10 rounded-full border-2 text-sm font-semibold transition-colors
              ${
                value === n
                  ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-[#1a3d32]/50'
              }`}
            aria-label={`Verdi ${n}`}
            aria-pressed={value === n}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="text-xs text-neutral-400">{highLabel}</span>
    </div>
  )
}

function optionList(q: OrgSurveyQuestionRow): string[] {
  const raw = (q.config as { options?: unknown } | undefined)?.options
  if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) return raw as string[]
  return ['Ja', 'Nei', 'Vet ikke']
}

function parseAnswerJson(text: string | null | undefined): Record<string, string> | null {
  if (!text?.trim()) return null
  try {
    const o = JSON.parse(text) as unknown
    if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, string>
  } catch {
    /* ignore */
  }
  return null
}

function QuestionCard({
  question: q,
  idx,
  answer,
  onChange,
}: {
  question: OrgSurveyQuestionRow
  idx: number
  answer: { value: number | null; text: string | null } | undefined
  onChange: (val: { value: number | null; text: string | null }) => void
}) {
  const cfg = q.config && typeof q.config === 'object' && !Array.isArray(q.config) ? q.config : {}
  const sc = scaleBounds(cfg as Record<string, unknown>)
  const opts = optionList(q)

  const t = answer?.text ?? ''
  const multiSelected = new Set(t.split('|').map((s) => s.trim()).filter(Boolean))

  const cfgObj = cfg as Record<string, unknown>
  const matrixAnswer = q.question_type === 'matrix' ? parseAnswerJson(answer?.text ?? null) : null

  const rankingItems =
    q.question_type === 'ranking' && Array.isArray(cfgObj.items)
      ? (cfgObj.items as string[]).filter((x) => typeof x === 'string')
      : []

  const setMatrixCell = (row: string, col: string) => {
    const next = { ...(matrixAnswer ?? {}) }
    next[row] = col
    onChange({ value: null, text: JSON.stringify(next) })
  }

  const setRank = (item: string, rank: number) => {
    const next = parseAnswerJson(answer?.text ?? null) ?? {}
    next[item] = String(rank)
    onChange({ value: null, text: JSON.stringify(next) })
  }

  const toggleMulti = (opt: string) => {
    const next = new Set(multiSelected)
    if (next.has(opt)) next.delete(opt)
    else next.add(opt)
    const joined = [...next].join('|')
    onChange({ value: null, text: joined || null })
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-neutral-800">
        <span className="mr-2 text-neutral-400">{idx + 1}.</span>
        {q.question_text}
        {q.is_required && (
          <span className="ml-1 text-red-500" title="Påkrevd">
            *
          </span>
        )}
        {q.is_mandatory ? (
          <span className="ml-2 inline-flex align-middle">
            <Badge variant="danger">AML § 4-3</Badge>
          </span>
        ) : null}
      </p>

      {(q.question_type === 'rating_1_to_5' ||
        q.question_type === 'rating_1_to_10' ||
        q.question_type === 'likert_scale') && (
        <RatingScaleRange
          min={
            q.question_type === 'likert_scale' && typeof cfgObj.scaleMin === 'number'
              ? cfgObj.scaleMin
              : sc.min
          }
          max={
            q.question_type === 'likert_scale' && typeof cfgObj.scaleMax === 'number'
              ? cfgObj.scaleMax
              : sc.max
          }
          lowLabel={sc.low}
          highLabel={sc.high}
          value={answer?.value ?? null}
          onChange={(v) => onChange({ value: v, text: null })}
        />
      )}

      {q.question_type === 'nps' && (
        <RatingScaleRange
          min={0}
          max={10}
          lowLabel={typeof cfgObj.leftLabel === 'string' ? cfgObj.leftLabel : '0'}
          highLabel={typeof cfgObj.rightLabel === 'string' ? cfgObj.rightLabel : '10'}
          value={answer?.value ?? null}
          onChange={(v) => onChange({ value: v, text: null })}
        />
      )}

      {q.question_type === 'rating_visual' && (
        <RatingScaleRange
          min={1}
          max={typeof cfgObj.scaleMax === 'number' ? cfgObj.scaleMax : 5}
          lowLabel={
            typeof cfgObj.anchors === 'object' && cfgObj.anchors && 'low' in (cfgObj.anchors as object)
              ? String((cfgObj.anchors as { low?: string }).low ?? '1')
              : '1'
          }
          highLabel={
            typeof cfgObj.anchors === 'object' && cfgObj.anchors && 'high' in (cfgObj.anchors as object)
              ? String((cfgObj.anchors as { high?: string }).high ?? String(cfgObj.scaleMax ?? 5))
              : String(cfgObj.scaleMax ?? 5)
          }
          value={answer?.value ?? null}
          onChange={(v) => onChange({ value: v, text: null })}
        />
      )}

      {(q.question_type === 'short_text' || q.question_type === 'email') && (
        <div className="mt-3">
          <StandardInput
            type={q.question_type === 'email' ? 'email' : 'text'}
            value={answer?.text ?? ''}
            onChange={(e) => onChange({ value: null, text: e.target.value })}
            maxLength={
              q.question_type === 'short_text' && typeof cfgObj.maxLength === 'number'
                ? cfgObj.maxLength
                : q.question_type === 'short_text'
                  ? 255
                  : undefined
            }
            className="w-full max-w-lg"
          />
        </div>
      )}

      {(q.question_type === 'text' || q.question_type === 'long_text') && (
        <div className="mt-3">
          <StandardTextarea
            value={answer?.text ?? ''}
            onChange={(e) => onChange({ value: null, text: e.target.value })}
            rows={q.question_type === 'long_text' ? 8 : 4}
            placeholder="Skriv ditt svar her…"
          />
        </div>
      )}

      {q.question_type === 'number' && (
        <div className="mt-3">
          <StandardInput
            type="number"
            value={answer?.text ?? ''}
            onChange={(e) => onChange({ value: null, text: e.target.value })}
            min={typeof cfgObj.minValue === 'number' ? cfgObj.minValue : undefined}
            max={typeof cfgObj.maxValue === 'number' ? cfgObj.maxValue : undefined}
            step={
              cfgObj.integerOnly === true
                ? 1
                : typeof cfgObj.step === 'number'
                  ? cfgObj.step
                  : undefined
            }
            className="max-w-xs"
          />
        </div>
      )}

      {q.question_type === 'slider' && (
        <div className="mt-4 space-y-2">
          <input
            type="range"
            className="w-full accent-[#1a3d32]"
            min={typeof cfgObj.rangeStart === 'number' ? cfgObj.rangeStart : 0}
            max={typeof cfgObj.rangeEnd === 'number' ? cfgObj.rangeEnd : 100}
            step={typeof cfgObj.stepIncrement === 'number' ? cfgObj.stepIncrement : 1}
            value={
              answer?.text != null && answer.text !== ''
                ? Number(answer.text)
                : typeof cfgObj.rangeStart === 'number'
                  ? cfgObj.rangeStart
                  : 0
            }
            onChange={(e) => onChange({ value: null, text: e.target.value })}
          />
          <p className="text-center text-sm font-medium text-neutral-800">{answer?.text ?? '—'}</p>
        </div>
      )}

      {q.question_type === 'dropdown' && (
        <div className="mt-3 max-w-lg">
          <SearchableSelect
            value={answer?.text ?? ''}
            options={opts.map((o) => ({ value: o, label: o }))}
            onChange={(v) => onChange({ value: null, text: v || null })}
          />
        </div>
      )}

      {q.question_type === 'image_choice' && (
        <div className="mt-3 flex flex-wrap gap-3">
          {Array.isArray(cfgObj.choices)
            ? (cfgObj.choices as { label?: string; image_url?: string }[]).map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ value: null, text: c.label ?? String(i) })}
                  className={`flex max-w-[140px] flex-col gap-1 rounded-lg border-2 p-2 text-left text-xs transition ${
                    answer?.text === (c.label ?? String(i))
                      ? 'border-[#1a3d32] bg-[#f7faf8]'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-20 w-full rounded object-cover" />
                  ) : (
                    <div className="flex h-20 items-center justify-center bg-neutral-100 text-neutral-400">Bilde</div>
                  )}
                  <span className="font-medium">{c.label ?? `Valg ${i + 1}`}</span>
                </button>
              ))
            : null}
        </div>
      )}

      {q.question_type === 'matrix' && Array.isArray(cfgObj.rows) && Array.isArray(cfgObj.columns) ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-neutral-200 py-2 text-left" />
                {(cfgObj.columns as string[]).map((col) => (
                  <th key={col} className="border-b border-neutral-200 px-2 py-2 text-center font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(cfgObj.rows as string[]).map((row) => (
                <tr key={row}>
                  <td className="border-b border-neutral-100 py-2 pr-2 align-middle">{row}</td>
                  {(cfgObj.columns as string[]).map((col) => (
                    <td key={`${row}-${col}`} className="border-b border-neutral-100 px-2 py-2 text-center">
                      <input
                        type="radio"
                        name={`matrix-${q.id}-${row}`}
                        className="size-4 border-neutral-300 text-[#1a3d32]"
                        checked={matrixAnswer?.[row] === col}
                        onChange={() => setMatrixCell(row, col)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {q.question_type === 'ranking' && rankingItems.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-neutral-500">Angi rangering (1 = høyest).</p>
          {rankingItems.map((item) => (
            <div key={item} className="flex flex-wrap items-center gap-2">
              <span className="min-w-[120px] text-sm text-neutral-800">{item}</span>
              <StandardInput
                type="number"
                min={1}
                max={rankingItems.length}
                className="w-20"
                value={parseAnswerJson(answer?.text ?? null)?.[item] ?? ''}
                onChange={(e) => setRank(item, Number(e.target.value) || 0)}
              />
            </div>
          ))}
        </div>
      ) : null}

      {q.question_type === 'datetime' && (
        <div className="mt-3">
          <StandardInput
            type={
              cfgObj.mode === 'date'
                ? 'date'
                : cfgObj.mode === 'time'
                  ? 'time'
                  : 'datetime-local'
            }
            value={answer?.text ?? ''}
            onChange={(e) => onChange({ value: null, text: e.target.value })}
            className="max-w-md"
          />
        </div>
      )}

      {q.question_type === 'file_upload' && (
        <div className="mt-3">
          <input
            type="file"
            className="text-sm text-neutral-700"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) {
                onChange({ value: null, text: null })
                return
              }
              const reader = new FileReader()
              reader.onload = () => {
                const r = reader.result
                const s = typeof r === 'string' ? r : null
                onChange({ value: null, text: s })
              }
              reader.readAsDataURL(f)
            }}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Fil lagres som base64 i svaret (stor fil kan gi problemer — bruk små vedlegg).
          </p>
        </div>
      )}

      {q.question_type === 'signature' && (
        <div className="mt-3">
          <StandardTextarea
            value={answer?.text ?? ''}
            onChange={(e) => onChange({ value: null, text: e.target.value })}
            rows={2}
            placeholder="Skriv fullt navn som signatur"
          />
        </div>
      )}

      {q.question_type === 'yes_no' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {['Ja', 'Nei'].map((opt) => (
            <Button
              key={opt}
              type="button"
              variant={answer?.text === opt ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => onChange({ value: null, text: opt })}
            >
              {opt}
            </Button>
          ))}
        </div>
      )}

      {q.question_type === 'multiple_choice' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {opts.map((opt) => (
            <Button
              key={opt}
              type="button"
              variant={answer?.text === opt ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => onChange({ value: null, text: opt })}
            >
              {opt}
            </Button>
          ))}
        </div>
      )}

      {q.question_type === 'single_select' && (
        <div className="mt-3 flex flex-col gap-2">
          {opts.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
              <input
                type="radio"
                name={`q-${q.id}`}
                className="size-4 border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
                checked={answer?.text === opt}
                onChange={() => onChange({ value: null, text: opt })}
              />
              {opt}
            </label>
          ))}
        </div>
      )}

      {q.question_type === 'multi_select' && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-neutral-500">Kryss av alle som gjelder.</p>
          {opts.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                className="size-4 rounded border-neutral-300 text-[#1a3d32] focus:ring-[#1a3d32]"
                checked={multiSelected.has(opt)}
                onChange={() => toggleMulti(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function answerSatisfied(q: OrgSurveyQuestionRow, a: { value: number | null; text: string | null } | undefined): boolean {
  if (!q.is_required) return true
  if (!a) return false
  const t = q.question_type
  if (t === 'rating_1_to_5' || t === 'rating_1_to_10' || t === 'nps' || t === 'rating_visual') return a.value !== null
  if (t === 'likert_scale') return a.value !== null
  if (t === 'text' || t === 'long_text' || t === 'short_text' || t === 'email' || t === 'signature') {
    return Boolean(a.text?.trim())
  }
  if (t === 'number' || t === 'slider' || t === 'datetime') return Boolean(a.text?.trim())
  if (t === 'file_upload') return Boolean(a.text?.trim())
  if (t === 'matrix') {
    const o = parseAnswerJson(a.text ?? null)
    if (!o) return false
    const cfg = q.config as { rows?: string[] }
    const rows = Array.isArray(cfg.rows) ? cfg.rows : []
    return rows.every((r) => typeof o[r] === 'string' && o[r]!.length > 0)
  }
  if (t === 'ranking') {
    const o = parseAnswerJson(a.text ?? null)
    if (!o) return false
    const cfg = q.config as { items?: string[] }
    const items = Array.isArray(cfg.items) ? cfg.items : []
    return items.every((it) => o[it] != null && o[it] !== '')
  }
  if (t === 'multi_select') {
    const parts = (a.text ?? '').split('|').map((s) => s.trim()).filter(Boolean)
    return parts.length > 0
  }
  return Boolean(a.text)
}

export function SurveyRespondPage() {
  const { campaignId: surveyId } = useParams<{ campaignId: string }>()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')?.trim() ?? ''
  const { user } = useOrgSetupContext()
  const supabase = getSupabaseBrowserClient()
  const survey = useSurvey({ supabase })

  const [answers, setAnswers] = useState<AnswerMap>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { loadActiveSurveyForRespondent } = survey
  const orderedQuestions = useMemo(() => {
    if (!surveyId) return []
    const order = globalQuestionIdOrder(survey.questions, surveyId, survey.surveySections)
    const m = new Map(survey.questions.map((q) => [q.id, q]))
    return order.map((id) => m.get(id)).filter((q): q is OrgSurveyQuestionRow => q != null)
  }, [survey.questions, survey.surveySections, surveyId])

  const sectionTitleById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const s of survey.surveySections) m[s.id] = s.title
    return m
  }, [survey.surveySections])
  useEffect(() => {
    if (surveyId) void loadActiveSurveyForRespondent(surveyId)
  }, [surveyId, loadActiveSurveyForRespondent])

  const setAnswer = useCallback(
    (qId: string, val: { value: number | null; text: string | null }) => {
      setAnswers((prev) => ({ ...prev, [qId]: val }))
    },
    [],
  )

  const allRequiredFilled = orderedQuestions
    .filter((q) => q.is_required)
    .every((q) => answerSatisfied(q, answers[q.id]))

  const handleSubmit = async () => {
    if (!surveyId) return
    setSubmitting(true)
    const answerRows = orderedQuestions.map((q) => ({
      questionId: q.id,
      answerValue: answers[q.id]?.value ?? null,
      answerText: answers[q.id]?.text ?? null,
    }))
    const result = await survey.submitResponse({
      surveyId,
      userId: user?.id ?? null,
      answers: answerRows,
      invitationToken: inviteToken || undefined,
    })
    setSubmitting(false)
    if (result) setSubmitted(true)
  }

  if (!surveyId) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <p className="text-center text-sm text-red-600">Ugyldig lenke.</p>
        </div>
      </div>
    )
  }

  if (survey.loading && !survey.selectedSurvey) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-[#F9F7F2] text-sm text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Laster undersøkelse…
      </div>
    )
  }

  if (!user && survey.selectedSurvey && !survey.selectedSurvey.is_anonymous && !inviteToken) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <InfoBox>
            Du må være innlogget for å svare på denne undersøkelsen, eller åpne den personlige lenken du fikk tilsendt
            (invite). Anonyme undersøkelser kan besvares uten innlogging.
          </InfoBox>
        </div>
      </div>
    )
  }

  if (!survey.selectedSurvey) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <p className="text-center text-sm text-neutral-600">Fant ikke undersøkelsen eller den er ikke tilgjengelig.</p>
        </div>
      </div>
    )
  }

  if (!user && !survey.selectedSurvey.is_anonymous && inviteToken) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] py-12 px-4">
        <div className="mx-auto max-w-2xl space-y-4">
          <InfoBox>
            Denne undersøkelsen er ikke anonym. For å bruke den personlige lenken må du være innlogget med samme konto som
            profilen som ble invitert — logg inn og åpne lenken på nytt.
          </InfoBox>
          <p className="text-center text-sm text-neutral-600">
            <a href="/login" className="font-medium text-[#1a3d32] underline">
              Gå til innlogging
            </a>
          </p>
        </div>
      </div>
    )
  }

  if (survey.selectedSurvey.status !== 'active') {
    return (
      <div className="min-h-screen bg-[#F9F7F2] py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <WarningBox>Denne undersøkelsen er ikke åpen for svar.</WarningBox>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9F7F2] py-12 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Medarbeiderundersøkelse</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1a3d32]">{survey.selectedSurvey.title}</h1>
          {survey.selectedSurvey.description && (
            <p className="mt-2 text-sm text-neutral-500">{survey.selectedSurvey.description}</p>
          )}
        </div>

        <ComplianceBanner title="Personvern (GDPR) — AML § 4-3">
          {survey.selectedSurvey.is_anonymous
            ? 'Dine svar er helt anonyme — ingen bruker-ID lagres i databasen. Individuelle svar kan ikke knyttes til deg.'
            : 'Dine svar er koblet til din bruker og er kun synlig for administrator. Du kan trekke tilbake svaret ditt ved å kontakte administrator innen 30 dager.'}
        </ComplianceBanner>

        {survey.error && <WarningBox>{survey.error}</WarningBox>}

        {submitted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-semibold text-emerald-800">Takk for ditt svar!</p>
            <p className="mt-1 text-sm text-emerald-700">Besvarelsen er lagret.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void handleSubmit()
            }}
            className="space-y-6"
          >
            {orderedQuestions.map((q, idx) => {
              const prev = orderedQuestions[idx - 1]
              const showSection =
                survey.surveySections.length > 0 &&
                (prev?.section_id ?? null) !== (q.section_id ?? null) &&
                q.section_id != null
              return (
                <div key={q.id}>
                  {showSection ? (
                    <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-[#1a3d32]/90 first:mt-0">
                      {sectionTitleById[q.section_id!] ?? 'Seksjon'}
                    </h2>
                  ) : null}
                  <QuestionCard question={q} idx={idx} answer={answers[q.id]} onChange={(val) => setAnswer(q.id, val)} />
                </div>
              )
            })}
            <Button type="submit" variant="primary" disabled={submitting || !allRequiredFilled}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sender…
                </>
              ) : (
                'Send inn svar'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
