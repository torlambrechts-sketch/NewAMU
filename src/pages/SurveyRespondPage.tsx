import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
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

type AnswerMap = Record<string, { value: number | null; text: string | null }>

function RatingScale({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <span className="text-xs text-neutral-400">1 – Svært uenig</span>
      <div className="flex gap-2">
        {/* Scale control — no ui/Button equivalent for circular rating pips */}
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-10 w-10 rounded-full border-2 text-sm font-semibold transition-colors
              ${
                value === n
                  ? 'border-[#1a3d32] bg-[#1a3d32] text-white'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:border-[#1a3d32]/50'
              }`}
            aria-label={`Vurdering ${n}`}
            aria-pressed={value === n}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="text-xs text-neutral-400">5 – Svært enig</span>
    </div>
  )
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

      {q.question_type === 'rating_1_to_5' && (
        <RatingScale value={answer?.value ?? null} onChange={(v) => onChange({ value: v, text: null })} />
      )}

      {q.question_type === 'text' && (
        <div className="mt-3">
          <StandardTextarea
            value={answer?.text ?? ''}
            onChange={(e) => onChange({ value: null, text: e.target.value })}
            rows={4}
            placeholder="Skriv ditt svar her…"
          />
        </div>
      )}

      {q.question_type === 'multiple_choice' && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {['Ja', 'Nei', 'Vet ikke'].map((opt) => (
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
        </div>
      )}
    </div>
  )
}

export function SurveyRespondPage() {
  const { campaignId: surveyId } = useParams<{ campaignId: string }>()
  const { user } = useOrgSetupContext()
  const supabase = getSupabaseBrowserClient()
  const survey = useSurvey({ supabase })

  const [answers, setAnswers] = useState<AnswerMap>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { loadActiveSurveyForRespondent } = survey
  useEffect(() => {
    if (surveyId) void loadActiveSurveyForRespondent(surveyId)
  }, [surveyId, loadActiveSurveyForRespondent])

  const setAnswer = useCallback(
    (qId: string, val: { value: number | null; text: string | null }) => {
      setAnswers((prev) => ({ ...prev, [qId]: val }))
    },
    [],
  )

  const allRequiredFilled = survey.questions
    .filter((q) => q.is_required)
    .every((q) => {
      const a = answers[q.id]
      if (!a) return false
      if (q.question_type === 'rating_1_to_5') return a.value !== null
      if (q.question_type === 'text') return Boolean(a.text?.trim())
      return Boolean(a.text)
    })

  const handleSubmit = async () => {
    if (!surveyId) return
    setSubmitting(true)
    const answerRows = survey.questions.map((q) => ({
      questionId: q.id,
      answerValue: answers[q.id]?.value ?? null,
      answerText: answers[q.id]?.text ?? null,
    }))
    const result = await survey.submitResponse({
      surveyId,
      userId: user?.id ?? null,
      answers: answerRows,
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

  if (!user && survey.selectedSurvey && !survey.selectedSurvey.is_anonymous) {
    return (
      <div className="min-h-screen bg-[#F9F7F2] py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <InfoBox>Du må være innlogget for å svare på denne undersøkelsen. Anonyme undersøkelser kan besvares uten innlogging.</InfoBox>
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
            {survey.questions.map((q, idx) => (
              <QuestionCard
                key={q.id}
                question={q}
                idx={idx}
                answer={answers[q.id]}
                onChange={(val) => setAnswer(q.id, val)}
              />
            ))}
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
