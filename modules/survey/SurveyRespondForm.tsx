import { useState, useCallback, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CheckCircle } from 'lucide-react'
import type { SurveyQuestionRow } from '../../src/data/survey'

type RespondProps = { supabase: SupabaseClient | null; campaignId: string }

type Answer = {
  questionId: string
  answerNumeric: number | null
  answerText: string | null
  answerBool: boolean | null
}

/** Midlertidig skjema mot eldre survey_responses / survey_questions. Erstattes i steg 8. */
export function SurveyRespondForm({ supabase, campaignId }: RespondProps) {
  const [questions, setQuestions] = useState<SurveyQuestionRow[]>([])
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [department, setDepartment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setError('Kunne ikke koble til tjenesten.')
      setLoading(false)
      return
    }
    let cancelled = false
    void supabase
      .from('survey_questions')
      .select('*')
      .eq('campaign_id', campaignId)
      .is('deleted_at', null)
      .order('sort_order')
      .then(({ data, error: e }) => {
        if (cancelled) return
        if (e) {
          setError('Kunne ikke laste skjema.')
          setLoading(false)
          return
        }
        setQuestions((data ?? []) as SurveyQuestionRow[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [supabase, campaignId])

  const setAnswer = useCallback((questionId: string, partial: Partial<Answer>) => {
    setAnswers((prev) => {
      const prevRow = prev[questionId]
      return {
        ...prev,
        [questionId]: {
          questionId,
          answerNumeric: prevRow?.answerNumeric ?? null,
          answerText: prevRow?.answerText ?? null,
          answerBool: prevRow?.answerBool ?? null,
          ...partial,
        },
      }
    })
  }, [])

  const generateToken = (): string => {
    const salt = Math.random().toString(36).slice(2)
    const raw = `${campaignId}:${salt}:${Date.now()}`
    let hash = 0
    for (let i = 0; i < raw.length; i++) hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0
    return `anon_${Math.abs(hash).toString(36)}_${salt}`
  }

  const handleSubmit = async () => {
    if (!supabase) return
    const token = generateToken()
    setSubmitting(true)
    try {
      const rows = questions.map((q) => ({
        campaign_id: campaignId,
        question_id: q.id,
        respondent_token: token,
        department: department || null,
        answer_numeric: answers[q.id]?.answerNumeric ?? null,
        answer_text: answers[q.id]?.answerText ?? null,
        answer_bool: answers[q.id]?.answerBool ?? null,
      }))
      const { error: e } = await supabase.from('survey_responses').insert(rows)
      if (e) throw e
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Innsending feilet. Prøv igjen.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="py-16 text-center text-sm text-neutral-400">Laster skjema…</div>
  if (submitted)
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
        <h2 className="text-xl font-bold text-[#1a3d32]">Takk for besvarelsen!</h2>
        <p className="text-sm text-neutral-500">
          Dine svar er registrert anonymt. Resultatene brukes til å forbedre arbeidsmiljøet.
        </p>
      </div>
    )

  const mandatory = questions.filter((q) => q.is_mandatory)
  const unansweredMandatory = mandatory.filter((q) => {
    const a = answers[q.id]
    if (!a) return true
    if (q.question_type === 'text') return !(a.answerText && a.answerText.trim())
    if (q.question_type === 'yesno') return a.answerBool === null
    return a.answerNumeric === null
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="rounded-lg border border-[#1a3d32]/20 bg-[#f4f1ea] px-4 py-3 text-sm text-[#1a3d32]">
        Alle svar er anonyme. Vi kan ikke koble svarene dine til din identitet. Avdeling er valgfritt — du trenger ikke
        oppgi den.
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-600">Avdeling (valgfritt)</label>
        <input
          className="mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Din avdeling (valgfritt)"
        />
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <QuestionInput key={q.id} question={q} answer={answers[q.id]} onChange={(partial) => setAnswer(q.id, partial)} />
        ))}
      </div>

      {unansweredMandatory.length > 0 && (
        <p className="text-xs text-amber-600">{unansweredMandatory.length} obligatoriske spørsmål er ikke besvart.</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || unansweredMandatory.length > 0}
        className="w-full rounded-lg bg-[#1a3d32] py-3 text-sm font-semibold text-white hover:bg-[#14312a] disabled:opacity-40"
      >
        {submitting ? 'Sender inn…' : 'Send inn besvarelse'}
      </button>
    </div>
  )
}

function QuestionInput({
  question: q,
  answer,
  onChange,
}: {
  question: SurveyQuestionRow
  answer: Answer | undefined
  onChange: (partial: Partial<Answer>) => void
}) {
  const LIKERT_LABELS_5 = ['Aldri', 'Sjelden', 'Av og til', 'Ofte', 'Alltid']
  const base = `rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors`

  return (
    <div
      className={`rounded-xl border border-neutral-200 bg-white p-4 shadow-sm ${q.is_mandatory ? 'border-l-4 border-l-emerald-400' : ''}`}
    >
      <div className="mb-3 flex items-start gap-2">
        <p className="flex-1 text-sm font-medium text-neutral-800">{q.question_text}</p>
        {q.is_mandatory && (
          <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
            Obligatorisk
          </span>
        )}
      </div>

      {q.question_type === 'likert5' && (
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ answerNumeric: v })}
              className={`${base} flex flex-col items-center py-2 ${answer?.answerNumeric === v ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 hover:border-[#1a3d32]/40'}`}
            >
              <span className="font-bold">{v}</span>
              <span className="mt-0.5 text-[9px] leading-tight">{LIKERT_LABELS_5[v - 1]}</span>
            </button>
          ))}
        </div>
      )}

      {q.question_type === 'likert7' && (
        <div className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange({ answerNumeric: v })}
              className={`${base} py-2 text-center ${answer?.answerNumeric === v ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 hover:border-[#1a3d32]/40'}`}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {q.question_type === 'yesno' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Ja', val: true },
            { label: 'Nei', val: false },
          ].map(({ label, val }) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange({ answerBool: val })}
              className={`${base} py-2.5 font-semibold ${answer?.answerBool === val ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 hover:border-[#1a3d32]/40'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {q.question_type === 'nps' && (
        <div className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange({ answerNumeric: i })}
              className={`${base} py-1.5 text-center ${answer?.answerNumeric === i ? 'border-[#1a3d32] bg-[#1a3d32] text-white' : 'border-neutral-200 hover:border-[#1a3d32]/40'}`}
            >
              {i}
            </button>
          ))}
        </div>
      )}

      {q.question_type === 'text' && (
        <textarea
          rows={3}
          className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm focus:border-[#1a3d32] focus:outline-none focus:ring-2 focus:ring-[#1a3d32]/30"
          value={answer?.answerText ?? ''}
          onChange={(e) => onChange({ answerText: e.target.value })}
          placeholder="Skriv din kommentar her…"
        />
      )}
    </div>
  )
}
