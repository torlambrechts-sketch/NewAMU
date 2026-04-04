/** PostgREST / Supabase client errors are plain objects, not always `instanceof Error`. */
export function getSupabaseErrorMessage(err: unknown): string {
  if (err == null) return 'Ukjent feil'

  let raw = ''
  if (err instanceof Error) {
    raw = err.message
  } else if (typeof err === 'object' && err !== null && 'message' in err) {
    const e = err as { message?: string; details?: string; hint?: string; code?: string }
    if (e.code === '23505') {
      return duplicateOrgMessage()
    }
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    raw = parts.join(' — ')
  } else {
    raw = String(err)
  }

  const mapped = mapKnownRpcMessage(raw)
  if (mapped) return mapped
  return raw || 'Ukjent feil'
}

function duplicateOrgMessage(): string {
  return (
    'Dette organisasjonsnummeret er allerede registrert i atics — ofte av en administrator i din virksomhet. ' +
    'Be om en invitasjon på e-post, eller logg inn med brukeren som opprettet virksomheten. ' +
    'Hvis du bare tester, bruk et annet org.nr. eller slett den eksisterende raden i Supabase (kun utvikling).'
  )
}

/** Maps Postgres / RPC exception text to user-facing Norwegian. */
function mapKnownRpcMessage(message: string): string | null {
  const m = message.toLowerCase()

  if (
    m.includes('profile already linked') ||
    m.includes('already linked to an organization') ||
    m.includes('profilen er allerede knyttet')
  ) {
    return profileAlreadyLinkedMessage()
  }

  if (m.includes('not authenticated') || m.includes('ikke innlogget')) {
    return 'Du er ikke innlogget. Logg inn på nytt og prøv igjen.'
  }

  if (m.includes('invalid organization number') || m.includes('ugyldig organisasjonsnummer')) {
    return 'Ugyldig organisasjonsnummer — det må være nøyaktig 9 siffer.'
  }

  return null
}

function profileAlreadyLinkedMessage(): string {
  return (
    'Kontoen din er allerede knyttet til en virksomhet — du trenger ikke å opprette organisasjonen på nytt. ' +
    'Gå til forsiden. Skal du inn i en annen bedrift, må du bruke en annen brukerkonto eller be en administrator om invitasjon. ' +
    'For å starte helt på nytt (kun test): fjern koblingen i databasen eller logg inn med en ny e-post.'
  )
}
