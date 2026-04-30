import { WPSTD_FORM_FIELD_LABEL } from '../../src/components/layout/WorkplaceStandardFormPanel'
import { formatSurveyAnswerDisplay } from './surveyAnswerDisplay'
import { globalQuestionIdOrder } from './surveyQuestionGlobalOrder'
import type { OrgSurveyAnswerRow, OrgSurveyQuestionRow, OrgSurveyResponseRow, SurveySectionRow } from './types'

type Props = {
  response: OrgSurveyResponseRow
  questions: OrgSurveyQuestionRow[]
  sections: SurveySectionRow[]
  answers: OrgSurveyAnswerRow[]
  participantLabel: string
}

export function SurveyResponseReadPanel({
  response,
  questions,
  sections,
  answers,
  participantLabel,
}: Props) {
  const order = globalQuestionIdOrder(questions, response.survey_id, sections)
  const qMap = new Map(questions.map((q) => [q.id, q]))
  const ordered = order.map((id) => qMap.get(id)).filter((q): q is OrgSurveyQuestionRow => q != null)
  const ansByQ = new Map(answers.filter((a) => a.response_id === response.id).map((a) => [a.question_id, a]))
  const sectionTitle: Record<string, string> = {}
  for (const s of sections) sectionTitle[s.id] = s.title

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200/90 bg-[#f7faf8] p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Besvarelse</p>
        <p className="mt-1 text-sm font-medium text-neutral-900">{participantLabel}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Innsendt {new Date(response.submitted_at).toLocaleString('nb-NO')}
        </p>
      </div>

      <div className="space-y-5">
        {ordered.map((q, i) => {
          const prev = ordered[i - 1]
          const showSection =
            sections.length > 0 && (prev?.section_id ?? null) !== (q.section_id ?? null) && q.section_id != null
          const a = ansByQ.get(q.id)
          const display = formatSurveyAnswerDisplay(q, a)
          return (
            <div key={q.id}>
              {showSection && q.section_id ? (
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                  {sectionTitle[q.section_id] ?? 'Seksjon'}
                </p>
              ) : null}
              <div className="rounded-lg border border-neutral-200/90 bg-white p-4 shadow-sm">
                <label className={WPSTD_FORM_FIELD_LABEL}>{q.question_text}</label>
                <div className="mt-2 min-h-[2.5rem] whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 text-sm text-neutral-900">
                  {display}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
