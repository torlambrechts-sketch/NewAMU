// Changelog entries — public-facing "what's new and what changed in the law".
// Compliance buyers want to see that the system is actively maintained as
// laws and best practice evolve.

export type ChangeCategory = 'lovendring' | 'ny-funksjon' | 'mal-oppdatering' | 'sikkerhet'

export type ChangeEntry = {
  date: string // ISO YYYY-MM-DD
  category: ChangeCategory
  title: string
  summary: string
  modules?: string[]
  lawRef?: string
}

export const CATEGORY_META: Record<ChangeCategory, { label: string; tone: string }> = {
  lovendring: { label: 'Lovendring', tone: '#1a3d32' },
  'ny-funksjon': { label: 'Ny funksjon', tone: '#2dd4bf' },
  'mal-oppdatering': { label: 'Mal-oppdatering', tone: '#d4a84b' },
  sikkerhet: { label: 'Sikkerhet', tone: '#b3382a' },
}

export const CHANGELOG: ChangeEntry[] = [
  {
    date: '2026-05-17',
    category: 'ny-funksjon',
    title: 'Ny landingsside med per-modul-dybde',
    summary:
      'Komplett gjennomgang av offentlig nettside: seks dedikerte funksjonssider, en compliance-oversikt med alle ni rammeverk, integrasjons-roadmap og en endringslogg du leser akkurat nå. Per-rute meta og JSON-LD bakt inn ved bygg.',
    modules: ['Plattform'],
  },
  {
    date: '2026-04-08',
    category: 'mal-oppdatering',
    title: 'Risikomatrise innebygd i alle vernerunde-maler',
    summary:
      'Hvert funn får sannsynlighet × konsekvens-score (1–25). Kritiske og høye funn oppretter automatisk avvik med foreslåtte tiltak. Trender på risiko-type kan filtreres på tvers av lokasjoner.',
    modules: ['Sjekklister', 'Oppgaver'],
    lawRef: 'IK-f §5 nr. 2',
  },
  {
    date: '2026-03-19',
    category: 'ny-funksjon',
    title: 'Varsling og GDPR-brudd i samme pipeline',
    summary:
      'Et samlet system for AML kap. 2A-varsling, GDPR Art. 33-brudd, HMS-hendelser og etiske bekymringer. Anonymitet håndhevet på databasenivå via Row Level Security — koden tillater ikke ved et uhell å logge varsleren.',
    modules: ['Varslinger'],
    lawRef: 'AML §§2A-1 til 2A-7, GDPR Art. 33',
  },
  {
    date: '2026-02-26',
    category: 'ny-funksjon',
    title: 'Sertifikatutløp som førsteklasses filter i E-læring',
    summary:
      'Dashboardet i E-læring lar deg filtrere på "utløper innen 30 dager". Eksterne sertifikater (truckfører, varme arbeider) kan også registreres og spores. Ansatt-overføringer endrer ikke historisk org-kontekst på sertifikatet.',
    modules: ['E-læring'],
    lawRef: 'AML §3-5, §6-5',
  },
  {
    date: '2026-02-04',
    category: 'sikkerhet',
    title: 'Audit-spor for alle signaturer og statusendringer',
    summary:
      'Hver statusendring på sjekklister, oppgaver og varslingssaker loggføres med tidsstempel og bruker. Audit-loggen kan eksporteres ved tilsyn og kan ikke endres etter at den er skrevet.',
    modules: ['Plattform', 'Sjekklister', 'Oppgaver'],
  },
  {
    date: '2026-01-15',
    category: 'ny-funksjon',
    title: 'Brønnøysund-oppslag under signup',
    summary:
      'Klarert henter organisasjonsnavn, adresse, NACE-kode, daglig leder og styresammensetning direkte fra Enhetsregisteret under onboarding. Du fyller inn én ting (org.nr.), vi resten.',
    modules: ['Plattform'],
  },
  {
    date: '2025-12-12',
    category: 'lovendring',
    title: 'Oppdaterte AML §4-2-maler for psykososialt arbeidsmiljø',
    summary:
      'Arbeidstilsynet tydeliggjorde forventninger til systematisk kartlegging av psykososiale forhold gjennom året. Alle pulsundersøkelser i mal-pakken er nå justert til å speile dette — eldre malversjoner er beholdt for org-er som bygger på dem.',
    modules: ['Undersøkelser'],
    lawRef: 'AML §4-2',
  },
  {
    date: '2025-11-03',
    category: 'mal-oppdatering',
    title: 'Komplett dekning av Internkontrollforskriften §5',
    summary:
      'Alle åtte krav i §5 — fra målfastsetting til avviksbehandling og dokumentasjon — har nå et tilsvarende sted i systemet. Dekningsmatrisen på /compliance viser hver paragraf koblet til en modul.',
    modules: ['Sjekklister', 'Dokumenter', 'Undersøkelser'],
    lawRef: 'IK-f §5',
  },
]
