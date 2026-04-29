import type { OrgSurveyQuestionRow } from './types'

export type BranchHideRule = {
  /** When this question's answer equals (trimmed text or numeric string), hide the listed questions */
  ifAnswerEquals: string
  hideQuestionIds: string[]
}

function getBranchHide(cfg: Record<string, unknown> | undefined): BranchHideRule | null {
  if (!cfg || typeof cfg !== 'object') return null
  const lj = cfg.logic_jump as Record<string, unknown> | undefined
  const bh = lj?.branchHide as Record<string, unknown> | undefined
  if (!bh || typeof bh.ifAnswerEquals !== 'string') return null
  const raw = bh.hideQuestionIds
  const ids = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === 'string')
    : typeof raw === 'string'
      ? raw
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  if (ids.length === 0) return null
  return { ifAnswerEquals: bh.ifAnswerEquals.trim(), hideQuestionIds: ids }
}

function answerMatchesEquals(
  a: { value: number | null; text: string | null } | undefined,
  equals: string,
): boolean {
  const want = equals.trim()
  if (!a) return false
  if (a.value != null && Number.isFinite(a.value) && String(a.value) === want) return true
  const t = (a.text ?? '').trim()
  if (t === want) return true
  if (t.includes('|')) {
    return t.split('|').some((p) => p.trim() === want)
  }
  return false
}

/**
 * Soft branching: questions listed under another question's `logic_jump.branchHide`
 * are hidden when that trigger answer matches `ifAnswerEquals`.
 */
export function hiddenQuestionIdsFromBranching(
  questionsInOrder: OrgSurveyQuestionRow[],
  answers: Record<string, { value: number | null; text: string | null } | undefined>,
): Set<string> {
  const hidden = new Set<string>()
  for (const q of questionsInOrder) {
    const cfg = q.config && typeof q.config === 'object' && !Array.isArray(q.config) ? (q.config as Record<string, unknown>) : {}
    const rule = getBranchHide(cfg)
    if (!rule) continue
    const ans = answers[q.id]
    if (!answerMatchesEquals(ans, rule.ifAnswerEquals)) continue
    for (const id of rule.hideQuestionIds) hidden.add(id)
  }
  return hidden
}
