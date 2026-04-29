import type { OrgSurveyQuestionRow, SurveySectionRow } from './types'

/** Full survey question order: root (no section) first, then each section by section order_index. */
export function globalQuestionIdOrder(
  questions: OrgSurveyQuestionRow[],
  surveyId: string,
  sections: SurveySectionRow[],
): string[] {
  const rootIds = questions
    .filter((q) => q.survey_id === surveyId && q.section_id == null)
    .sort((a, b) => a.order_index - b.order_index)
    .map((q) => q.id)

  const out: string[] = [...rootIds]
  for (const s of [...sections].sort((a, b) => a.order_index - b.order_index)) {
    const sq = questions
      .filter((q) => q.survey_id === surveyId && q.section_id === s.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map((q) => q.id)
    out.push(...sq)
  }
  return out
}

/** Rebuild full ordered id list after reordering questions within one section (or root). */
export function fullOrderAfterSectionReorder(
  questions: OrgSurveyQuestionRow[],
  surveyId: string,
  sections: SurveySectionRow[],
  sectionId: string | null,
  newOrderInSection: string[],
): string[] {
  const rootIds =
    sectionId === null
      ? newOrderInSection
      : questions
          .filter((q) => q.survey_id === surveyId && q.section_id == null)
          .sort((a, b) => a.order_index - b.order_index)
          .map((q) => q.id)

  const out: string[] = [...rootIds]
  for (const s of [...sections].sort((a, b) => a.order_index - b.order_index)) {
    const block =
      sectionId !== null && s.id === sectionId
        ? newOrderInSection
        : questions
            .filter((q) => q.survey_id === surveyId && q.section_id === s.id)
            .sort((a, b) => a.order_index - b.order_index)
            .map((q) => q.id)
    out.push(...block)
  }
  return out
}
