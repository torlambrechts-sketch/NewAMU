import type { BrregEnhet } from '../types/brreg'

/** Same origin in dev (Vite proxy) and prod (Vercel rewrite) — avoids browser CORS to Brreg. */
export function brregApiBase(): string {
  if (typeof window === 'undefined') return '/brreg-api'
  return `${window.location.origin}/brreg-api`
}

export function normalizeOrgNumber(input: string): string {
  return input.replace(/\D/g, '').slice(0, 9)
}

export async function fetchEnhetByOrgnr(orgnr: string): Promise<BrregEnhet> {
  const n = normalizeOrgNumber(orgnr)
  if (n.length !== 9) {
    throw new Error('Organisasjonsnummer må være 9 siffer.')
  }
  const url = `${brregApiBase()}/enheter/${encodeURIComponent(n)}`
  const res = await fetch(url)
  if (res.status === 404) {
    throw new Error('Fant ikke virksomhet i Enhetsregisteret.')
  }
  if (!res.ok) {
    throw new Error(`Brreg: HTTP ${res.status}`)
  }
  return res.json() as Promise<BrregEnhet>
}

export function formatBrregAddress(e: BrregEnhet): string {
  const a = e.forretningsadresse ?? e.postadresse
  if (!a) return ''
  const line = (a.adresse ?? []).join(', ')
  const rest = [a.postnummer, a.poststed].filter(Boolean).join(' ')
  return [line, rest].filter(Boolean).join(' — ')
}
