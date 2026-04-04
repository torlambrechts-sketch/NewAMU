/** PostgREST / Supabase client errors are plain objects, not always `instanceof Error`. */
export function getSupabaseErrorMessage(err: unknown): string {
  if (err == null) return 'Ukjent feil'
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && 'message' in err) {
    const e = err as { message?: string; details?: string; hint?: string; code?: string }
    if (e.code === '23505') {
      return 'Denne organisasjonen er allerede registrert. Be om invitasjon eller bruk et annet org.nr. hvis dette er en test.'
    }
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    return parts.length ? parts.join(' — ') : 'Ukjent feil'
  }
  return String(err)
}
