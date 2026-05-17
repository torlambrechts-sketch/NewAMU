// Norwegian organisasjonsnummer (orgnr) validation.
//
// Brønnøysundregistrene assigns a 9-digit identifier to every legal
// entity. The last digit is a mod-11 check computed against weights
// [3, 2, 7, 6, 5, 4, 3, 2] over the first 8 digits. If the remainder
// is 0 the check digit is 0; if it is 1 the orgnr is invalid by
// definition (no representable check digit); otherwise the digit is
// 11 minus the remainder.
//
// This util is used by the Partner Branding editor (invoice_sender_orgnr)
// and is safe to reuse from any other place that needs to gate on a
// well-formed orgnr without round-tripping to Brreg.

/** Strips all non-digit characters and keeps at most 9 characters. */
export function normalizeOrgnr(input: string | null | undefined): string {
  if (!input) return ''
  return String(input).replace(/\D+/g, '').slice(0, 9)
}

/**
 * Returns true if `s` is a 9-digit string with a valid mod-11 check
 * digit. Accepts inputs with spaces / dashes — the value is normalised
 * before checking.
 */
export function validateOrgnr(s: string | null | undefined): boolean {
  const digits = normalizeOrgnr(s)
  if (digits.length !== 9) return false

  const weights = [3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 8; i++) {
    sum += Number(digits[i]) * weights[i]
  }
  const remainder = sum % 11
  if (remainder === 1) return false
  const expectedCheck = remainder === 0 ? 0 : 11 - remainder
  return expectedCheck === Number(digits[8])
}

/**
 * Convenience: returns a Norwegian error string when the orgnr is
 * invalid, or null when it passes. Inputs like '' / null return null
 * so callers can treat empty-fields as a separate "missing" state.
 */
export function orgnrError(s: string | null | undefined): string | null {
  if (!s || s.trim() === '') return null
  const digits = normalizeOrgnr(s)
  if (digits.length !== 9) return 'Orgnr må være 9 siffer.'
  if (!validateOrgnr(digits)) return 'Ugyldig orgnr (mod-11 sjekksum feilet).'
  return null
}
