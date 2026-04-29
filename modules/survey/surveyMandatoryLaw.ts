export type MandatoryLawCode = 'AML_4_3' | 'AML_4_4' | 'AML_6_2'

/** Minimum felter fra mal (JSON eller `TemplateQuestion`) for lovflagg. */
export type MandatoryTemplateFields = {
  mandatory_law?: MandatoryLawCode | null
  is_mandatory?: boolean
}

/**
 * Én sannhetskilde for lovpålagte spørsmål fra mal JSON (`mandatory_law` / `is_mandatory`).
 * Ingen nøkkelordsmatching av spørsmålstekst.
 */
export function mandatoryFromCatalogQuestion(q: MandatoryTemplateFields): {
  isMandatory: boolean
  mandatoryLaw: MandatoryLawCode | null
} {
  const law = q.mandatory_law ?? null
  if (law) return { isMandatory: true, mandatoryLaw: law }
  if (q.is_mandatory === true) return { isMandatory: true, mandatoryLaw: 'AML_4_3' }
  return { isMandatory: false, mandatoryLaw: null }
}
