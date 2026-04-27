# Step 8 — Respondent Form (Public)

**Replace** `src/pages/SurveyRespondPage.tsx` entirely.  
**Delete** `src/modules/survey/SurveyResponsesTab.tsx` after this step compiles cleanly.

Depends on: Step 3 (useSurvey).

---

## Context

`src/pages/SurveyRespondPage.tsx` currently just renders `<SurveyRespondForm>` from the legacy file. That form uses raw HTML and does not handle all question types correctly.

This step rewrites the respond page as a standalone page (no ModulePageShell — this page is public / minimal shell for respondents). It handles:
- `rating_1_to_5` — horizontal scale 1–5 with radio buttons
- `text` — `<StandardTextarea>`
- `multiple_choice` — multiple `<YesNoToggle>` or a list of options

Required: the URL is `/survey/respond/:surveyId` (check `src/App.tsx` for the actual route param name — it might be `campaignId` in the existing route; keep whatever the router expects).

---

## File: `src/pages/SurveyRespondPage.tsx`

### Layout — max-w-2xl centered card

```tsx
<div className="min-h-screen bg-[#F9F7F2] py-12 px-4">
  <div className="mx-auto max-w-2xl space-y-6">
    {/* Header */}
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Medarbeiderundersøkelse</p>
      <h1 className="mt-1 text-2xl font-bold text-[#1a3d32]">{survey.selectedSurvey?.title ?? 'Undersøkelse'}</h1>
      {survey.selectedSurvey?.description && (
        <p className="mt-2 text-sm text-neutral-500">{survey.selectedSurvey.description}</p>
      )}
    </div>

    <ComplianceBanner refs={['GDPR', 'AML § 4-3']}>
      {survey.selectedSurvey?.is_anonymous
        ? 'Dine svar er helt anonyme — ingen bruker-ID lagres i databasen.'
        : 'Dine svar er koblet til din bruker og er kun synlig for administrator.'}
    </ComplianceBanner>

    {survey.error && <WarningBox>{survey.error}</WarningBox>}

    {submitted ? (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
        <p className="font-semibold text-emerald-800">Takk for ditt svar!</p>
        <p className="mt-1 text-sm text-emerald-700">Besvarelsen er lagret.</p>
      </div>
    ) : (
      <form onSubmit={(e) => { e.preventDefault(); void handleSubmit() }} className="space-y-6">
        {survey.questions.map((q, idx) => (
          <QuestionCard key={q.id} question={q} idx={idx} answer={answers[q.id]} onChange={(val) => setAnswer(q.id, val)} />
        ))}
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || !allRequiredFilled}
        >
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sender…</> : 'Send inn svar'}
        </Button>
      </form>
    )}
  </div>
</div>
```

### `QuestionCard`

```tsx
function QuestionCard({
  question: q,
  idx,
  answer,
  onChange,
}: {
  question: OrgSurveyQuestionRow
  idx: number
  answer: { value: number | null; text: string | null }
  onChange: (val: { value: number | null; text: string | null }) => void
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-neutral-800">
        <span className="mr-2 text-neutral-400">{idx + 1}.</span>
        {q.question_text}
        {q.is_required && <span className="ml-1 text-red-500" title="Påkrevd">*</span>}
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
          {/* Multiple choice: Yes / No toggle or custom options */}
          <div className="flex gap-3">
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
```

### `RatingScale`

```tsx
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
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-10 w-10 rounded-full border-2 text-sm font-semibold transition-colors
              ${value === n
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
```

> **Note:** `RatingScale` uses raw `<button>` because this is the respondent-facing scale control and no design-system component covers the circular rating pill pattern. This is a named exception; document it with a comment: `{/* Scale control — no ui/Button equivalent for circular rating pips */}`.

### State management

```ts
type AnswerMap = Record<string, { value: number | null; text: string | null }>

const [answers, setAnswers] = useState<AnswerMap>({})
const [submitting, setSubmitting] = useState(false)
const [submitted, setSubmitted] = useState(false)

const setAnswer = useCallback((qId: string, val: { value: number | null; text: string | null }) => {
  setAnswers((prev) => ({ ...prev, [qId]: val }))
}, [])

const allRequiredFilled = survey.questions
  .filter((q) => q.is_required)
  .every((q) => {
    const a = answers[q.id]
    if (!a) return false
    if (q.question_type === 'rating_1_to_5') return a.value !== null
    if (q.question_type === 'text') return !!(a.text?.trim())
    return !!(a.text)
  })
```

### Submit handler

```ts
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
    userId: null,   // hook determines actual userId based on is_anonymous
    answers: answerRows,
  })
  setSubmitting(false)
  if (result) setSubmitted(true)
}
```

### Loading the survey

```ts
const { surveyId } = useParams<{ surveyId: string }>()  // or campaignId — match existing route

useEffect(() => {
  if (surveyId) void survey.loadSurveyDetail(surveyId)
}, [surveyId, survey.loadSurveyDetail])
```

If the survey is not `active`, show an `<InfoBox variant="warning">`:
```
<InfoBox variant="warning">Denne undersøkelsen er ikke åpen for svar.</InfoBox>
```

---

## Validation checklist

- [ ] Only one raw `<button>` exists: inside `RatingScale`, documented with exception comment
- [ ] All other interactive elements use design-system components
- [ ] `<ComplianceBanner>` shows correct anonymity message based on `is_anonymous`
- [ ] Required questions are validated before submit
- [ ] Submitted state shows confirmation message (not just nothing)
- [ ] Non-active survey shows warning banner instead of form
- [ ] `src/modules/survey/SurveyResponsesTab.tsx` deleted

## Commit

```
feat(survey): respondent form — full question type rendering
```
