import type { OrgSurveyQuestionRow } from './types'

function parseMatrixRankingJson(text: string | null | undefined): Record<string, string> | null {
  if (!text?.trim()) return null
  try {
    const o = JSON.parse(text) as unknown
    if (o && typeof o === 'object' && !Array.isArray(o)) return o as Record<string, string>
  } catch {
    /* ignore */
  }
  return null
}

export type ShowIfRule = {
  questionId: string
  /** Tekst (trimmet), tall fra answer_value, eller flervalg-token må være lik */
  equals?: string | number | boolean
  /** Minst én av verdiene må matche (tekst / pipe-delt flervalg / tall) */
  in?: (string | number)[]
  /** true = synlig bare når kilde-spørsmålet har et ikke-tomt svar */
  answered?: boolean
}

function normStr(s: string | null | undefined): string {
  return (s ?? '').trim()
}

function answerTokens(a: { value: number | null; text: string | null } | undefined): string[] {
  if (!a) return []
  const parts: string[] = []
  if (a.value != null && Number.isFinite(a.value)) parts.push(String(a.value))
  const t = normStr(a.text)
  if (t.includes('|')) {
    for (const p of t.split('|')) {
      const x = p.trim()
      if (x) parts.push(x)
    }
  } else if (t) parts.push(t)
  return parts.length > 0 ? parts : []
}

function hasAnyAnswer(a: { value: number | null; text: string | null } | undefined): boolean {
  if (!a) return false
  if (a.value != null && Number.isFinite(a.value)) return true
  return normStr(a.text).length > 0
}

/** Les showIf fra config (top-level eller under logic_jump). */
export function getShowIf(config: Record<string, unknown> | undefined): ShowIfRule | null {
  if (!config || typeof config !== 'object') return null
  const direct = config.showIf as ShowIfRule | undefined
  if (direct && typeof direct === 'object' && typeof direct.questionId === 'string') return direct
  const lj = config.logic_jump as { showIf?: ShowIfRule } | undefined
  const nested = lj?.showIf
  if (nested && typeof nested === 'object' && typeof nested.questionId === 'string') return nested
  return null
}

/** Om spørsmålet skal vises gitt svar på tidligere spørsmål. */
export function isQuestionVisible(
  q: OrgSurveyQuestionRow,
  answers: Record<string, { value: number | null; text: string | null } | undefined>,
): boolean {
  const cfg = q.config && typeof q.config === 'object' && !Array.isArray(q.config) ? (q.config as Record<string, unknown>) : {}
  const rule = getShowIf(cfg)
  if (!rule?.questionId) return true
  const prior = answers[rule.questionId]
  if (rule.answered === true) return hasAnyAnswer(prior)

  if (rule.in != null && Array.isArray(rule.in)) {
    const tokens = answerTokens(prior)
    const want = rule.in.map((x) => String(x))
    return tokens.some((t) => want.includes(t))
  }

  if (rule.equals !== undefined) {
    const eq = rule.equals
    if (prior?.value != null && Number.isFinite(prior.value)) {
      if (typeof eq === 'number') return prior.value === eq
      if (typeof eq === 'boolean') return false
      const n = Number(String(eq).trim())
      if (!Number.isNaN(n)) return prior.value === n
    }
    const tokens = answerTokens(prior)
    const target = typeof eq === 'boolean' ? (eq ? 'true' : 'false') : String(eq)
    return tokens.some((t) => t === target)
  }

  return true
}

type ValidationRules = {
  minLength?: number
  maxLength?: number
  pattern?: string
  min?: number
  max?: number
  minSelections?: number
  maxSelections?: number
  wordCountMax?: number
}

function getValidationRules(cfg: Record<string, unknown>): ValidationRules {
  const raw = cfg.validation_rules
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as ValidationRules
  return {}
}

function wordCount(s: string): number {
  return normStr(s).split(/\s+/).filter(Boolean).length
}

/** Returner feilmelding på norsk, eller null hvis OK. Tomt svar valideres ikke her (bruk is_required). */
export function validateAnswerFormat(q: OrgSurveyQuestionRow, a: { value: number | null; text: string | null } | undefined): string | null {
  if (!hasAnyAnswer(a)) return null

  const cfg = q.config && typeof q.config === 'object' && !Array.isArray(q.config) ? (q.config as Record<string, unknown>) : {}
  const vr = getValidationRules(cfg)
  const t = q.question_type

  const text = normStr(a?.text)
  const numVal = a?.value != null && Number.isFinite(a.value) ? a.value : null
  const numFromText = text !== '' && !Number.isNaN(Number(text)) ? Number(text) : null

  const applyLength = (s: string, minL?: number, maxL?: number) => {
    if (minL != null && s.length < minL) return `Minst ${minL} tegn.`
    if (maxL != null && s.length > maxL) return `Maks ${maxL} tegn.`
    return null
  }

  if (t === 'short_text') {
    const minL = vr.minLength ?? (typeof cfg.minLength === 'number' ? cfg.minLength : undefined)
    const maxL = vr.maxLength ?? (typeof cfg.maxLength === 'number' ? cfg.maxLength : undefined)
    const err = applyLength(text, minL, maxL)
    if (err) return err
    if (vr.pattern && text) {
      try {
        const re = new RegExp(vr.pattern)
        if (!re.test(text)) return 'Formatet på svaret er ugyldig.'
      } catch {
        return 'Ugyldig valideringsmønster i skjemaet.'
      }
    }
    return null
  }

  if (t === 'long_text' || t === 'text') {
    const maxW = vr.wordCountMax ?? (typeof cfg.wordCountLimit === 'number' ? cfg.wordCountLimit : undefined)
    if (maxW != null && wordCount(text) > maxW) return `Maks ${maxW} ord.`
    const err = applyLength(text, vr.minLength, vr.maxLength)
    if (err) return err
    return null
  }

  if (t === 'email' && text) {
    const basic = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!basic.test(text)) return 'Oppgi en gyldig e-postadresse.'
    return null
  }

  if (t === 'number') {
    const n = numVal ?? numFromText
    if (n == null) return 'Oppgi et gyldig tall.'
    const min = vr.min ?? (typeof cfg.minValue === 'number' ? cfg.minValue : undefined)
    const max = vr.max ?? (typeof cfg.maxValue === 'number' ? cfg.maxValue : undefined)
    if (min != null && n < min) return `Verdien må være minst ${min}.`
    if (max != null && n > max) return `Verdien må være høyst ${max}.`
    return null
  }

  if (t === 'slider') {
    const n = numFromText
    if (n == null) return null
    const rs = typeof cfg.rangeStart === 'number' ? cfg.rangeStart : 0
    const re = typeof cfg.rangeEnd === 'number' ? cfg.rangeEnd : 100
    if (n < rs || n > re) return `Verdien må være mellom ${rs} og ${re}.`
    return null
  }

  if (t === 'multi_select') {
    const parts = text.split('|').map((s) => s.trim()).filter(Boolean)
    const minS = vr.minSelections ?? (typeof cfg.minSelections === 'number' ? cfg.minSelections : undefined)
    const maxS = vr.maxSelections ?? (typeof cfg.maxSelections === 'number' ? cfg.maxSelections : undefined)
    if (minS != null && parts.length < minS) return `Velg minst ${minS} alternativer.`
    if (maxS != null && parts.length > maxS) return `Velg maks ${maxS} alternativer.`
    return null
  }

  if (t === 'file_upload' && text) {
    const maxMb = typeof cfg.maxFileSizeMb === 'number' ? cfg.maxFileSizeMb : 10
    const approxBytes = (text.length * 3) / 4
    if (approxBytes > maxMb * 1024 * 1024) return `Filen er for stor (maks ca. ${maxMb} MB).`
    return null
  }

  return null
}

/** Kreves svar for innsending når synlig og merket påkrevd. */
export function isVisibleRequired(
  q: OrgSurveyQuestionRow,
  answers: Record<string, { value: number | null; text: string | null } | undefined>,
): boolean {
  return q.is_required && isQuestionVisible(q, answers)
}

export function allVisibleRequiredSatisfied(
  questions: OrgSurveyQuestionRow[],
  answers: Record<string, { value: number | null; text: string | null } | undefined>,
  satisfied: (q: OrgSurveyQuestionRow, a: { value: number | null; text: string | null } | undefined) => boolean,
): boolean {
  return questions.every((q) => {
    if (!isVisibleRequired(q, answers)) return true
    return satisfied(q, answers[q.id])
  })
}

/** Om påkrevd felt har innhold (uavhengig av showIf). */
export function answerMeetsRequiredContent(
  q: OrgSurveyQuestionRow,
  a: { value: number | null; text: string | null } | undefined,
): boolean {
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
    const o = parseMatrixRankingJson(a.text ?? null)
    if (!o) return false
    const cfg = q.config as { rows?: string[] }
    const rows = Array.isArray(cfg.rows) ? cfg.rows : []
    return rows.every((r) => typeof o[r] === 'string' && o[r]!.length > 0)
  }
  if (t === 'ranking') {
    const o = parseMatrixRankingJson(a.text ?? null)
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

export type SurveySubmitValidation =
  | { ok: true }
  | { ok: false; errors: string[]; fieldErrors: Record<string, string> }

/** Valider synlige påkrevde felt + format for alle synlige felt med svar. */
export function validateSurveyAnswersForSubmit(
  questions: OrgSurveyQuestionRow[],
  answers: Record<string, { value: number | null; text: string | null } | undefined>,
): SurveySubmitValidation {
  const errors: string[] = []
  const fieldErrors: Record<string, string> = {}
  for (const q of questions) {
    if (!isQuestionVisible(q, answers)) continue
    const a = answers[q.id]
    if (isVisibleRequired(q, answers) && !answerMeetsRequiredContent(q, a)) {
      const msg = `Dette feltet må besvares.`
      errors.push(`«${q.question_text.slice(0, 80)}${q.question_text.length > 80 ? '…' : ''}» må besvares.`)
      fieldErrors[q.id] = msg
      continue
    }
    const fmt = validateAnswerFormat(q, a)
    if (fmt) {
      const full = fmt
      errors.push(`${q.question_text.slice(0, 60)}${q.question_text.length > 60 ? '…' : ''}: ${fmt}`)
      fieldErrors[q.id] = full
    }
  }
  if (errors.length > 0) return { ok: false, errors, fieldErrors }
  return { ok: true }
}

/** Kun rader som skal lagres (synlige spørsmål). */
export function buildAnswersForPersistence(
  surveyId: string,
  questions: OrgSurveyQuestionRow[],
  answers: Record<string, { value: number | null; text: string | null } | undefined>,
): Array<{ questionId: string; answerValue: number | null; answerText: string | null }> {
  const rows: Array<{ questionId: string; answerValue: number | null; answerText: string | null }> = []
  for (const q of questions) {
    if (q.survey_id !== surveyId) continue
    if (!isQuestionVisible(q, answers)) continue
    const a = answers[q.id]
    rows.push({
      questionId: q.id,
      answerValue: a?.value ?? null,
      answerText: a?.text ?? null,
    })
  }
  return rows
}
