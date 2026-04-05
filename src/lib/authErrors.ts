/** Brukervennlig norsk tekst for vanlige Supabase Auth-feil. */
export function mapAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const raw = err as { message?: string; status?: number }
    const msg = String(raw.message ?? '').toLowerCase()
    const code = raw.status

    if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
      return 'Feil e-post eller passord. Sjekk at du har skrevet riktig, eller bruk «Glemt passord» i Supabase hvis det er aktivert.'
    }
    if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
      return 'E-posten er ikke bekreftet ennå. Åpne lenken i bekreftelsesmailen fra Supabase, deretter prøv å logge inn igjen.'
    }
    if (msg.includes('user already registered') || msg.includes('already been registered')) {
      return 'Denne e-postadressen er allerede registrert. Prøv å logge inn i stedet.'
    }
    if (msg.includes('password') && (msg.includes('weak') || msg.includes('short'))) {
      return 'Passordet er for svakt eller for kort. Velg et sterkere passord (minst 6 tegn, gjerne flere).'
    }
    if (msg.includes('signup') && msg.includes('disabled')) {
      return 'Nyregistrering er slått av i Supabase. Kontakt administrator.'
    }
    if (msg.includes('rate limit') || code === 429) {
      return 'For mange forsøk. Vent litt og prøv igjen.'
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Nettverksfeil. Sjekk internettforbindelsen og prøv igjen.'
    }

    return raw.message || 'Innlogging feilet. Prøv igjen.'
  }
  if (err instanceof Error) return err.message
  return 'Noe gikk galt. Prøv igjen.'
}
