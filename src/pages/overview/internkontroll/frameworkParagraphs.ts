// Paragraph enumeration per compliance framework, keyed by the
// `public.regulations.id` slug. Used by the Internkontroll gap matrix
// to enumerate row labels per selected framework.
//
// Strings must match the format used in the template surfaces' law_refs
// columns ("AML § 4-3", "IK-f § 5 nr. 7", "GDPR Art. 35", …) — the
// `useRegelverkCoverage` hook normalises whitespace via `normalizeLawRef`,
// so leading/trailing spaces are forgiven, but the §/Art. prefix must
// match the seeded values exactly. AML list lifted verbatim from
// `specs/compliance-planner.md §3`. The four other frameworks list the
// paragraphs known to be referenced by today's seeded artefacts — empty
// rows show up as visible roadmap rather than bugs.

export type FrameworkId = 'aml' | 'ik-f' | 'gdpr' | 'apenhetsloven' | 'iso-45001'

export type FrameworkParagraph = {
  /** Display + lookup string, e.g. "AML § 4-3". Must match `law_refs[]` entries. */
  code: string
  /** Chapter label for grouped layouts, e.g. "Kap. 2A — Varsling". */
  chapter?: string
  /** Optional plain-language description (auditor view tooltips, etc.). */
  title?: string
}

export type FrameworkDef = {
  id: FrameworkId
  /** Short display label, e.g. "AML". */
  shortLabel: string
  /** Full name, e.g. "Arbeidsmiljøloven". */
  fullLabel: string
  paragraphs: FrameworkParagraph[]
}

/**
 * Compact chapter token used as a row-label prefix in the gap matrix
 * ("K2A · AML § 2A-1"). Extracted from `chapter` so we don't repeat
 * the full text on every row. Falls back to '—' when chapter is unset.
 */
export function chapterToken(chapter: string | undefined): string {
  if (!chapter) return '—'
  // "Kap. 14A — Konkurranseklausuler" → "K14A"
  // "Innhold i internkontrollen"      → first 4 chars uppercased: "INNH" (acceptable noise)
  // "Innledning"                       → "INNL"
  const kapMatch = chapter.match(/Kap\.\s*([0-9]+[A-Za-z]*)/)
  if (kapMatch) return `K${kapMatch[1]}`
  return chapter.slice(0, 4).toUpperCase()
}

/** Distinct chapter labels for a framework, preserving paragraph order. */
export function chaptersForFramework(framework: FrameworkId): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of FRAMEWORKS[framework].paragraphs) {
    if (p.chapter && !seen.has(p.chapter)) {
      seen.add(p.chapter)
      out.push(p.chapter)
    }
  }
  return out
}

const AML_PARAGRAPHS: FrameworkParagraph[] = [
  { code: 'AML § 2-1', chapter: 'Kap. 2 — Arbeidsgivers og arbeidstakers plikter', title: 'Arbeidsgivers ansvar' },
  { code: 'AML § 2-3', chapter: 'Kap. 2 — Arbeidsgivers og arbeidstakers plikter', title: 'Arbeidstakers medvirkning' },
  { code: 'AML § 2A-1', chapter: 'Kap. 2A — Varsling', title: 'Rett til å varsle om kritikkverdige forhold' },
  { code: 'AML § 2A-2', chapter: 'Kap. 2A — Varsling', title: 'Vern mot gjengjeldelse' },
  { code: 'AML § 2A-3', chapter: 'Kap. 2A — Varsling', title: 'Ekstern varsling' },
  { code: 'AML § 2A-4', chapter: 'Kap. 2A — Varsling', title: 'Varslerens rett til informasjon' },
  { code: 'AML § 2A-5', chapter: 'Kap. 2A — Varsling', title: 'Arbeidsgivers aktivitetsplikt' },
  { code: 'AML § 2A-7', chapter: 'Kap. 2A — Varsling', title: 'Behandling av varslingsoversikt' },
  { code: 'AML § 3-1', chapter: 'Kap. 3 — Virkemidler', title: 'Systematisk HMS-arbeid' },
  { code: 'AML § 3-2', chapter: 'Kap. 3 — Virkemidler', title: 'Særskilte forholdsregler' },
  { code: 'AML § 3-3', chapter: 'Kap. 3 — Virkemidler', title: 'Bedriftshelsetjeneste' },
  { code: 'AML § 3-4', chapter: 'Kap. 3 — Virkemidler', title: 'Vurdering av tiltak for fysisk aktivitet' },
  { code: 'AML § 3-5', chapter: 'Kap. 3 — Virkemidler', title: 'Arbeidsgivers plikt til HMS-opplæring' },
  { code: 'AML § 4-1', chapter: 'Kap. 4 — Krav til arbeidsmiljøet', title: 'Generelle krav til arbeidsmiljøet' },
  { code: 'AML § 4-2', chapter: 'Kap. 4 — Krav til arbeidsmiljøet', title: 'Krav om tilrettelegging, medvirkning og utvikling' },
  { code: 'AML § 4-3', chapter: 'Kap. 4 — Krav til arbeidsmiljøet', title: 'Krav til det psykososiale arbeidsmiljøet' },
  { code: 'AML § 4-5', chapter: 'Kap. 4 — Krav til arbeidsmiljøet', title: 'Særlig om kjemisk og biologisk helsefare' },
  { code: 'AML § 4-6', chapter: 'Kap. 4 — Krav til arbeidsmiljøet', title: 'Tilrettelegging for arbeidstakere med redusert arbeidsevne' },
  { code: 'AML § 5-1', chapter: 'Kap. 5 — Registrerings- og meldeplikt', title: 'Registrering av skader og sykdommer' },
  { code: 'AML § 5-2', chapter: 'Kap. 5 — Registrerings- og meldeplikt', title: 'Arbeidsgivers varslingsplikt ved alvorlige hendelser' },
  { code: 'AML § 5-3', chapter: 'Kap. 5 — Registrerings- og meldeplikt', title: 'Arbeidstakers varslingsplikt' },
  { code: 'AML § 6-1', chapter: 'Kap. 6 — Verneombud', title: 'Plikt til å velge verneombud' },
  { code: 'AML § 6-2', chapter: 'Kap. 6 — Verneombud', title: 'Verneombudets oppgaver' },
  { code: 'AML § 6-3', chapter: 'Kap. 6 — Verneombud', title: 'Stansingsretten' },
  { code: 'AML § 6-5', chapter: 'Kap. 6 — Verneombud', title: 'Opplæring av verneombud' },
  { code: 'AML § 7-1', chapter: 'Kap. 7 — Arbeidsmiljøutvalg', title: 'Plikt til å opprette arbeidsmiljøutvalg' },
  { code: 'AML § 7-2', chapter: 'Kap. 7 — Arbeidsmiljøutvalg', title: 'Arbeidsmiljøutvalgets oppgaver' },
  { code: 'AML § 7-4', chapter: 'Kap. 7 — Arbeidsmiljøutvalg', title: 'Arbeidsmiljøutvalgets årsrapport' },
  { code: 'AML § 8-1', chapter: 'Kap. 8 — Informasjon og drøfting', title: 'Plikt til informasjon og drøfting' },
  { code: 'AML § 8-2', chapter: 'Kap. 8 — Informasjon og drøfting', title: 'Gjennomføring av plikten til informasjon og drøfting' },
  { code: 'AML § 8-3', chapter: 'Kap. 8 — Informasjon og drøfting', title: 'Fortrolige opplysninger' },
  { code: 'AML § 9-1', chapter: 'Kap. 9 — Kontrolltiltak', title: 'Vilkår for kontrolltiltak i virksomheten' },
  { code: 'AML § 9-2', chapter: 'Kap. 9 — Kontrolltiltak', title: 'Drøfting før innføring av kontrolltiltak' },
  { code: 'AML § 9-3', chapter: 'Kap. 9 — Kontrolltiltak', title: 'Innsyn i e-post og elektroniske dokumenter' },
  { code: 'AML § 10-4', chapter: 'Kap. 10 — Arbeidstid', title: 'Alminnelig arbeidstid' },
  { code: 'AML § 10-6', chapter: 'Kap. 10 — Arbeidstid', title: 'Overtidsarbeid' },
  { code: 'AML § 10-7', chapter: 'Kap. 10 — Arbeidstid', title: 'Oversikt over arbeidstiden' },
  { code: 'AML § 10-8', chapter: 'Kap. 10 — Arbeidstid', title: 'Daglig og ukentlig arbeidsfri' },
  { code: 'AML § 10-10', chapter: 'Kap. 10 — Arbeidstid', title: 'Søndagsarbeid' },
  { code: 'AML § 10-11', chapter: 'Kap. 10 — Arbeidstid', title: 'Nattarbeid' },
  { code: 'AML § 10-12', chapter: 'Kap. 10 — Arbeidstid', title: 'Unntak fra arbeidstidsregler' },
  { code: 'AML § 12-1', chapter: 'Kap. 12 — Permisjoner', title: 'Svangerskapskontroll' },
  { code: 'AML § 12-2', chapter: 'Kap. 12 — Permisjoner', title: 'Svangerskapspermisjon' },
  { code: 'AML § 12-3', chapter: 'Kap. 12 — Permisjoner', title: 'Omsorgspermisjon' },
  { code: 'AML § 12-4', chapter: 'Kap. 12 — Permisjoner', title: 'Fødselspermisjon' },
  { code: 'AML § 12-5', chapter: 'Kap. 12 — Permisjoner', title: 'Foreldrepermisjon' },
  { code: 'AML § 12-6', chapter: 'Kap. 12 — Permisjoner', title: 'Delvis permisjon' },
  { code: 'AML § 12-9', chapter: 'Kap. 12 — Permisjoner', title: 'Barns og barnepassers sykdom' },
  { code: 'AML § 12-10', chapter: 'Kap. 12 — Permisjoner', title: 'Pleie av nære pårørende' },
  { code: 'AML § 12-11', chapter: 'Kap. 12 — Permisjoner', title: 'Utdanningspermisjon' },
  { code: 'AML § 12-12', chapter: 'Kap. 12 — Permisjoner', title: 'Militærtjeneste' },
  { code: 'AML § 12-15', chapter: 'Kap. 12 — Permisjoner', title: 'Religiøse permisjoner' },
  { code: 'AML § 13-1', chapter: 'Kap. 13 — Vern mot diskriminering', title: 'Forbud mot diskriminering' },
  { code: 'AML § 13-2', chapter: 'Kap. 13 — Vern mot diskriminering', title: 'Diskrimineringsforbudets virkeområde' },
  { code: 'AML § 13-7', chapter: 'Kap. 13 — Vern mot diskriminering', title: 'Trakassering' },
  { code: 'AML § 14-2', chapter: 'Kap. 14 — Ansettelse mv.', title: 'Fortrinnsrett for deltidsansatte' },
  { code: 'AML § 14-5', chapter: 'Kap. 14 — Ansettelse mv.', title: 'Krav om skriftlig arbeidsavtale' },
  { code: 'AML § 14-6', chapter: 'Kap. 14 — Ansettelse mv.', title: 'Minimumskrav til den skriftlige arbeidsavtalen' },
  { code: 'AML § 14-9', chapter: 'Kap. 14 — Ansettelse mv.', title: 'Fast ansettelse' },
  { code: 'AML § 14-12', chapter: 'Kap. 14 — Ansettelse mv.', title: 'Innleie fra bemanningsforetak' },
  { code: 'AML § 14-12a', chapter: 'Kap. 14 — Ansettelse mv.', title: 'Likebehandling ved innleie' },
  { code: 'AML § 14-12c', chapter: 'Kap. 14 — Ansettelse mv.', title: 'Innleie fra produksjonsbedrift' },
  { code: 'AML § 14A-1', chapter: 'Kap. 14A — Konkurranseklausuler', title: 'Konkurranseklausuler' },
  { code: 'AML § 14A-2', chapter: 'Kap. 14A — Konkurranseklausuler', title: 'Kundeklausuler' },
  { code: 'AML § 14A-3', chapter: 'Kap. 14A — Konkurranseklausuler', title: 'Rekrutteringsklausuler' },
  { code: 'AML § 15-1', chapter: 'Kap. 15 — Opphør av arbeidsforhold', title: 'Drøfting før oppsigelse' },
  { code: 'AML § 15-3', chapter: 'Kap. 15 — Opphør av arbeidsforhold', title: 'Oppsigelsesfrister' },
  { code: 'AML § 15-4', chapter: 'Kap. 15 — Opphør av arbeidsforhold', title: 'Form og innhold ved oppsigelse' },
  { code: 'AML § 15-6', chapter: 'Kap. 15 — Opphør av arbeidsforhold', title: 'Oppsigelsesvern under svangerskap' },
  { code: 'AML § 15-7', chapter: 'Kap. 15 — Opphør av arbeidsforhold', title: 'Saklig grunn ved oppsigelse' },
  { code: 'AML § 15-15', chapter: 'Kap. 15 — Opphør av arbeidsforhold', title: 'Attest' },
  { code: 'AML § 16-1', chapter: 'Kap. 16 — Virksomhetsoverdragelse', title: 'Virkeområde for virksomhetsoverdragelse' },
  { code: 'AML § 16-2', chapter: 'Kap. 16 — Virksomhetsoverdragelse', title: 'Lønns- og arbeidsvilkår ved overdragelse' },
  { code: 'AML § 16-3', chapter: 'Kap. 16 — Virksomhetsoverdragelse', title: 'Reservasjonsrett' },
  { code: 'AML § 16-4', chapter: 'Kap. 16 — Virksomhetsoverdragelse', title: 'Vern mot oppsigelse ved overdragelse' },
  { code: 'AML § 16-5', chapter: 'Kap. 16 — Virksomhetsoverdragelse', title: 'Informasjon og drøfting ved overdragelse' },
  { code: 'AML § 18-1', chapter: 'Kap. 18 — Tilsynsmyndigheter og virkemidler', title: 'Arbeidstilsynets myndighet' },
  { code: 'AML § 18-6', chapter: 'Kap. 18 — Tilsynsmyndigheter og virkemidler', title: 'Pålegg fra Arbeidstilsynet' },
  { code: 'AML § 18-7', chapter: 'Kap. 18 — Tilsynsmyndigheter og virkemidler', title: 'Tvangsmulkt' },
  { code: 'AML § 18-8', chapter: 'Kap. 18 — Tilsynsmyndigheter og virkemidler', title: 'Stansing' },
  { code: 'AML § 18-10', chapter: 'Kap. 18 — Tilsynsmyndigheter og virkemidler', title: 'Overtredelsesgebyr' },
]

const IK_F_PARAGRAPHS: FrameworkParagraph[] = [
  { code: 'IK-f § 1', chapter: 'Innledning', title: 'Formål' },
  { code: 'IK-f § 2', chapter: 'Virkeområde', title: 'Virkeområde' },
  { code: 'IK-f § 3', chapter: 'Internkontroll', title: 'Internkontroll — definisjon' },
  { code: 'IK-f § 4', chapter: 'Plikt til internkontroll', title: 'Plikt til internkontroll' },
  { code: 'IK-f § 5', chapter: 'Innhold i internkontrollen', title: 'Innhold i internkontrollen' },
  { code: 'IK-f § 5 nr. 1', chapter: 'Innhold i internkontrollen', title: 'HMS-mål' },
  { code: 'IK-f § 5 nr. 2', chapter: 'Innhold i internkontrollen', title: 'Kartlegging av farer' },
  { code: 'IK-f § 5 nr. 3', chapter: 'Innhold i internkontrollen', title: 'Risikovurdering' },
  { code: 'IK-f § 5 nr. 4', chapter: 'Innhold i internkontrollen', title: 'Avviksrutine' },
  { code: 'IK-f § 5 nr. 5', chapter: 'Innhold i internkontrollen', title: 'Systematisk overvåking' },
  { code: 'IK-f § 5 nr. 6', chapter: 'Innhold i internkontrollen', title: 'Tiltak basert på risiko' },
  { code: 'IK-f § 5 nr. 7', chapter: 'Innhold i internkontrollen', title: 'Tilsyn med systemet' },
  { code: 'IK-f § 5 nr. 8', chapter: 'Innhold i internkontrollen', title: 'Årlig gjennomgang' },
  { code: 'IK-f § 6', chapter: 'Samordning', title: 'Samordning' },
  { code: 'IK-f § 7', chapter: 'Tilsyn og sanksjoner', title: 'Tilsyn og sanksjoner' },
  { code: 'IK-f § 8', chapter: 'Klage', title: 'Klage' },
]

const GDPR_PARAGRAPHS: FrameworkParagraph[] = [
  { code: 'GDPR Art. 5', chapter: 'Prinsipper', title: 'Behandlingsprinsipper' },
  { code: 'GDPR Art. 6', chapter: 'Rettsgrunnlag', title: 'Lovlighet av behandling' },
  { code: 'GDPR Art. 7', chapter: 'Samtykke', title: 'Samtykke' },
  { code: 'GDPR Art. 9', chapter: 'Særlige kategorier', title: 'Særlige kategorier' },
  { code: 'GDPR Art. 12', chapter: 'Rettigheter for den registrerte', title: 'Åpenhet og rettigheter' },
  { code: 'GDPR Art. 13', chapter: 'Informasjonsplikt', title: 'Informasjon ved direkte innhenting' },
  { code: 'GDPR Art. 15', chapter: 'Rettigheter for den registrerte', title: 'Innsynsrett' },
  { code: 'GDPR Art. 17', chapter: 'Sletting', title: 'Rett til sletting' },
  { code: 'GDPR Art. 25', chapter: 'Innebygd personvern', title: 'Innebygd personvern' },
  { code: 'GDPR Art. 28', chapter: 'Databehandler', title: 'Databehandler' },
  { code: 'GDPR Art. 30', chapter: 'Protokoll', title: 'Behandlingsprotokoll' },
  { code: 'GDPR Art. 32', chapter: 'Sikkerhet', title: 'Sikkerhet ved behandling' },
  { code: 'GDPR Art. 33', chapter: 'Brudd', title: 'Brudd-varsling til tilsyn' },
  { code: 'GDPR Art. 34', chapter: 'Varsling til registrerte', title: 'Brudd-varsling til registrerte' },
  { code: 'GDPR Art. 35', chapter: 'DPIA', title: 'DPIA' },
  { code: 'GDPR Art. 37', chapter: 'Personvernombud', title: 'DPO' },
]

const APENHETSLOVEN_PARAGRAPHS: FrameworkParagraph[] = [
  { code: 'Åpenhetsloven § 1', chapter: 'Formål', title: 'Formål' },
  { code: 'Åpenhetsloven § 3', chapter: 'Definisjoner', title: 'Definisjoner' },
  { code: 'Åpenhetsloven § 4', chapter: 'Aktsomhetsvurderinger', title: 'Aktsomhetsvurdering' },
  { code: 'Åpenhetsloven § 5', chapter: 'Redegjørelse', title: 'Redegjørelse' },
  { code: 'Åpenhetsloven § 6', chapter: 'Informasjonskrav', title: 'Informasjonskrav' },
  { code: 'Åpenhetsloven § 7', chapter: 'Informasjonskrav', title: 'Behandling av informasjonskrav' },
  { code: 'Åpenhetsloven § 8', chapter: 'Tilsyn og sanksjoner', title: 'Tilsyn og sanksjoner' },
]

// ISO 45001 paragraphs are consistently seeded as "ISO 45001:2018 § N"
// in the meetings module (RUN_MEETINGS_MODULE.sql) and elsewhere — keep
// this format to match seeded law_refs[] entries via exact string equality.
const ISO_45001_PARAGRAPHS: FrameworkParagraph[] = [
  { code: 'ISO 45001:2018 § 4', chapter: 'Konteksten til virksomheten', title: 'Kontekst' },
  { code: 'ISO 45001:2018 § 5', chapter: 'Lederskap og medvirkning', title: 'Lederskap' },
  { code: 'ISO 45001:2018 § 5.4', chapter: 'Lederskap og medvirkning', title: 'Konsultasjon og medvirkning' },
  { code: 'ISO 45001:2018 § 6', chapter: 'Planlegging', title: 'Planlegging' },
  { code: 'ISO 45001:2018 § 6.1.2', chapter: 'Planlegging', title: 'Identifikasjon av farer' },
  { code: 'ISO 45001:2018 § 7', chapter: 'Støtte', title: 'Støtte' },
  { code: 'ISO 45001:2018 § 7.2', chapter: 'Støtte', title: 'Kompetanse' },
  { code: 'ISO 45001:2018 § 7.4', chapter: 'Støtte', title: 'Kommunikasjon' },
  { code: 'ISO 45001:2018 § 8', chapter: 'Drift', title: 'Drift' },
  { code: 'ISO 45001:2018 § 9', chapter: 'Vurdering av prestasjon', title: 'Vurdering av prestasjon' },
  { code: 'ISO 45001:2018 § 9.2', chapter: 'Vurdering av prestasjon', title: 'Internrevisjon' },
  { code: 'ISO 45001:2018 § 9.3', chapter: 'Vurdering av prestasjon', title: 'Ledelsens gjennomgang' },
  { code: 'ISO 45001:2018 § 10', chapter: 'Forbedring', title: 'Forbedring' },
]

export const FRAMEWORKS: Record<FrameworkId, FrameworkDef> = {
  aml: { id: 'aml', shortLabel: 'AML', fullLabel: 'Arbeidsmiljøloven', paragraphs: AML_PARAGRAPHS },
  'ik-f': {
    id: 'ik-f',
    shortLabel: 'IK-f',
    fullLabel: 'Internkontrollforskriften',
    paragraphs: IK_F_PARAGRAPHS,
  },
  gdpr: {
    id: 'gdpr',
    shortLabel: 'GDPR',
    fullLabel: 'Personopplysningsloven (GDPR)',
    paragraphs: GDPR_PARAGRAPHS,
  },
  apenhetsloven: {
    id: 'apenhetsloven',
    shortLabel: 'Åpenhetsloven',
    fullLabel: 'Åpenhetsloven',
    paragraphs: APENHETSLOVEN_PARAGRAPHS,
  },
  'iso-45001': {
    id: 'iso-45001',
    shortLabel: 'ISO 45001',
    fullLabel: 'NS-EN ISO 45001:2018',
    paragraphs: ISO_45001_PARAGRAPHS,
  },
}

export const FRAMEWORK_IDS: FrameworkId[] = [
  'aml',
  'ik-f',
  'gdpr',
  'apenhetsloven',
  'iso-45001',
]

/** Module column definitions for the gap matrix — left-to-right order. */
export type GapModuleColumn = {
  id: 'checklists' | 'surveys' | 'documents' | 'registers' | 'learning' | 'controls'
  label: string
  /** Coverage-entry kinds (from useRegelverkCoverage) that count toward this column. */
  kinds: string[]
}

export const GAP_MODULE_COLUMNS: GapModuleColumn[] = [
  { id: 'controls', label: 'Kontroller', kinds: [] },
  { id: 'checklists', label: 'Sjekklister', kinds: ['checklist_template', 'checklist_item'] },
  { id: 'surveys', label: 'Undersøkelser', kinds: ['survey'] },
  { id: 'documents', label: 'Dokumenter', kinds: ['document', 'document_template'] },
  { id: 'registers', label: 'Register', kinds: ['register_type'] },
  { id: 'learning', label: 'Læring', kinds: ['course_system', 'course_org'] },
]

/** Module slug → /-route map used by the gap-matrix drill-down. */
export const GAP_MODULE_ROUTES: Record<GapModuleColumn['id'], string> = {
  controls: '/controls/list',
  checklists: '/compliance/checklists',
  surveys: '/survey/analyse',
  documents: '/documents/analyse',
  registers: '/registers/analyse',
  learning: '/learning/analyse',
}
