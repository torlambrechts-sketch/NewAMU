/** Curated Norwegian legal references for wiki LawRef autocomplete */

export type WikiLegalRefSuggestion = {
  ref: string
  description: string
}

export const WIKI_LEGAL_REF_SUGGESTIONS: WikiLegalRefSuggestion[] = [
  { ref: 'AML § 2-1', description: 'Arbeidsgivers plikt til systematisk HMS' },
  { ref: 'AML § 2-3', description: 'Krav til arbeidsmiljøet' },
  { ref: 'AML § 3-1', description: 'Internkontroll — generelle krav' },
  { ref: 'AML § 3-2', description: 'Opplæring' },
  { ref: 'AML § 4-1', description: 'Beredskap' },
  { ref: 'AML § 4-3', description: 'Medvirkning' },
  { ref: 'AML § 4-6', description: 'Tilrettelegging' },
  { ref: 'AML § 6-1', description: 'Verneombud — valg' },
  { ref: 'AML § 6-2', description: 'Verneombudets oppgaver' },
  { ref: 'AML § 6-3', description: 'Verneombudets rettigheter' },
  { ref: 'AML § 6-5', description: 'Verneombudets vern' },
  { ref: 'AML § 7-2', description: 'AMU — årlig rapport' },
  { ref: 'AML § 7-4', description: 'AMU — sammensetning' },
  { ref: 'AML § 8', description: 'Rusmiddelpolicy' },
  { ref: 'IK-f § 5 nr. 1a', description: 'HMS-mål' },
  { ref: 'IK-f § 5 nr. 1b', description: 'Organisasjon og ansvar' },
  { ref: 'IK-f § 5 nr. 1c', description: 'Opplæring i HMS' },
  { ref: 'IK-f § 5 nr. 2', description: 'Kartlegging av farer' },
  { ref: 'IK-f § 5 nr. 3', description: 'Risikovurdering' },
  { ref: 'IK-f § 5 nr. 4', description: 'Avvikshåndtering' },
  { ref: 'IK-f § 5 nr. 5', description: 'Årlig gjennomgang' },
  { ref: 'Arbeidsmiljøforskriften § 2-1', description: 'Arbeidsplassens utforming' },
  { ref: 'Arbeidsmiljøforskriften § 2-2', description: 'Ergonomi' },
  { ref: 'Arbeidsmiljøforskriften § 3-1', description: 'Maskiner og verktøy' },
  { ref: 'Forskrift om organisering § 3-2', description: 'AMU' },
  { ref: 'Forskrift om organisering § 3-18', description: 'Verneombud' },
  { ref: 'AML kap. 2A', description: 'Varsling (intern)' },
]

export function filterLegalRefSuggestions(query: string, limit = 12): WikiLegalRefSuggestion[] {
  const q = query.trim().toLowerCase()
  if (!q) return WIKI_LEGAL_REF_SUGGESTIONS.slice(0, limit)
  const scored = WIKI_LEGAL_REF_SUGGESTIONS.map((s) => {
    const r = s.ref.toLowerCase()
    const d = s.description.toLowerCase()
    let score = 0
    if (r.startsWith(q)) score += 100
    else if (r.includes(q)) score += 50
    if (d.includes(q)) score += 20
    return { s, score }
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((x) => x.s)
}
