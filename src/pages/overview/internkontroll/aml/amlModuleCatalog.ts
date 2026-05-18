// AML module definitions + Årshjul activities for the Internkontroll hub.
//
// The design (klarert-design-system/ui_kits/aml-compliance/amlSeed.js)
// curates the 13 AML areas and their year-cycle activities. We mirror
// the curated list here as a stable taxonomy, then derive *status*
// per module dynamically from the useRegelverkCoverage hook + task
// counts. This gives the AML hub a fixed-shape grid the design relies
// on, while the live numbers underneath come from the org.
//
// When a module's law_refs[] return zero artefacts, status falls to
// 'red'. When some-but-not-all return coverage, 'amber'. Full coverage
// = 'green'. This mirrors how Regelverk-dekning and Internkontroll-gap
// pages already score paragraphs.

export type AmlModuleStatus = 'green' | 'amber' | 'red'

export type AmlModuleDef = {
  id: string
  title: string
  /** lucide-react icon name. */
  icon: string
  /** Law-reference label shown under the title, e.g. "AML § 7-1". */
  law: string
  /** law_refs[] strings to check against coverage. */
  lawRefs: string[]
  desc: string
  /** Anchor route for the deep-link from the card. */
  to?: string
  /** Eyebrow + value for the headline metric. */
  metric: { label: string; valueFallback: string }
  /** Next-action label + lucide icon, used while v1 has no event source. */
  next: { label: string; icon: string }
  /** Default owner display string when none is computed. */
  owner: string
}

export const AML_MODULES: AmlModuleDef[] = [
  {
    id: 'amu',
    title: 'AMU',
    icon: 'Users',
    law: 'AML § 7-1',
    lawRefs: ['AML § 7-1', 'AML § 7-2', 'AML § 7-2 (2)', 'AML § 7-2 (6)', 'AML § 7-4'],
    desc: 'Arbeidsmiljøutvalg — møter, saksliste, protokoll og årsrapport.',
    to: '/meetings?type=amu',
    metric: { label: 'Møter i år', valueFallback: '— / 4' },
    next: { label: 'Neste AMU-møte', icon: 'Calendar' },
    owner: 'AMU-leder',
  },
  {
    id: 'verneombud',
    title: 'Verneombud',
    icon: 'ShieldCheck',
    law: 'AML § 6-1 / § 6-2',
    lawRefs: ['AML § 6-1', 'AML § 6-2', 'AML § 6-3', 'AML § 6-5'],
    desc: 'Valg, opplæring og virksomhetsområder for verneombud.',
    to: '/learning/analyse?law_ref=AML%20%C2%A7%206-5',
    metric: { label: 'Gyldig 40-t kurs', valueFallback: '—' },
    next: { label: 'Nyvalg', icon: 'Vote' },
    owner: 'Personalavd.',
  },
  {
    id: 'ros',
    title: 'ROS-analyser',
    icon: 'ShieldAlert',
    law: 'AML § 3-1 · IK § 5 nr. 6',
    lawRefs: ['AML § 3-1', 'IK-f § 5 nr. 5', 'IK-f § 5 nr. 6'],
    desc: 'Risikovurderinger for områder, prosesser og roller.',
    to: '/risk/register',
    metric: { label: 'Aktive analyser', valueFallback: '—' },
    next: { label: 'Neste revisjon', icon: 'CalendarClock' },
    owner: 'HMS-koord.',
  },
  {
    id: 'vernerunder',
    title: 'Vernerunder',
    icon: 'Hammer',
    law: 'AML § 3-1 (2) c',
    lawRefs: ['AML § 3-1', 'IK-f § 5 nr. 5'],
    desc: 'Planlagte runder med sjekkliste, funn og signaturer.',
    to: '/compliance/checklists?law_ref=AML%20%C2%A7%203-1',
    metric: { label: 'Gjennomført i år', valueFallback: '— / 4' },
    next: { label: 'Neste runde', icon: 'CalendarClock' },
    owner: 'HMS-leder',
  },
  {
    id: 'avvik',
    title: 'Avvik & forbedring',
    icon: 'Megaphone',
    law: 'AML § 3-1 (2) e',
    lawRefs: ['AML § 3-1', 'AML § 5-2'],
    desc: 'Innmelding, tiltak og lukking av avvik og hendelser.',
    to: '/tasks/management/alle?source_category=avvik',
    metric: { label: 'Åpne over 30 dg', valueFallback: '—' },
    next: { label: 'Eldste avvik', icon: 'AlertTriangle' },
    owner: 'Linjeleder',
  },
  {
    id: 'sykefravar',
    title: 'Sykefravær & IA',
    icon: 'HeartPulse',
    law: 'AML § 4-6 · Folketrygdloven',
    lawRefs: ['AML § 4-6'],
    desc: 'Oppfølgingsplaner, dialogmøter og tilrettelegging.',
    to: '/compliance/checklists?law_ref=AML%20%C2%A7%204-6',
    metric: { label: 'Plan innen 4 uker', valueFallback: '—' },
    next: { label: 'Neste dialogmøte', icon: 'CalendarClock' },
    owner: 'Personalavd.',
  },
  {
    id: 'opplaering',
    title: 'HMS-opplæring',
    icon: 'GraduationCap',
    law: 'AML § 3-5 / § 6-5',
    lawRefs: ['AML § 3-5', 'AML § 6-5'],
    desc: 'Lovpålagt opplæring for ledere, verneombud og AMU-medlemmer.',
    to: '/learning/analyse',
    metric: { label: 'Fullført', valueFallback: '—' },
    next: { label: 'Neste påmelding', icon: 'BookOpen' },
    owner: 'HR',
  },
  {
    id: 'bht',
    title: 'Bedriftshelsetjeneste',
    icon: 'Stethoscope',
    law: 'AML § 3-3 · Forskrift om BHT',
    lawRefs: ['AML § 3-3'],
    desc: 'Plan, samarbeidsavtale og periodiske helseundersøkelser.',
    to: '/documents/analyse?law_ref=AML%20%C2%A7%203-3',
    metric: { label: 'Gyldig avtale', valueFallback: '—' },
    next: { label: 'Periodisk us.', icon: 'Calendar' },
    owner: 'Personalavd.',
  },
  {
    id: 'arbeidstid',
    title: 'Arbeidstid',
    icon: 'Clock',
    law: 'AML kap. 10',
    lawRefs: ['AML § 10-4', 'AML § 10-6', 'AML § 10-7', 'AML § 10-8'],
    desc: 'Arbeidsplan, gjennomsnittsberegning og overtidsoversikt.',
    to: '/documents/analyse?law_ref=AML%20%C2%A7%2010-6',
    metric: { label: 'Snitt overtid / mnd', valueFallback: '—' },
    next: { label: 'Avtale', icon: 'FileSignature' },
    owner: 'Drift',
  },
  {
    id: 'sja',
    title: 'Sikker jobbanalyse',
    icon: 'ClipboardList',
    law: 'IK § 5 nr. 6',
    lawRefs: ['IK-f § 5 nr. 6'],
    desc: 'SJA før kritiske enkeltoppdrag (varmt arbeid, høyder).',
    to: '/compliance/checklists',
    metric: { label: 'SJA siste 30 dg', valueFallback: '—' },
    next: { label: 'Neste oppdrag', icon: 'CalendarClock' },
    owner: 'Linjeleder',
  },
  {
    id: 'arbeidsmiljo',
    title: 'Arbeidsmiljøkartlegging',
    icon: 'BarChart2',
    law: 'AML § 3-1 (2) c',
    lawRefs: ['AML § 3-1', 'AML § 4-1', 'AML § 4-3'],
    desc: 'Periodisk undersøkelse av psykososialt og fysisk arbeidsmiljø.',
    to: '/survey/analyse?law_ref=AML%20%C2%A7%204-3',
    metric: { label: 'Svarprosent siste', valueFallback: '—' },
    next: { label: 'Ny måling', icon: 'BarChart2' },
    owner: 'AMU',
  },
  {
    id: 'beredskap',
    title: 'Beredskap & brann',
    icon: 'Flame',
    law: 'AML § 3-1 · Brann- og eksplosjonsv.',
    lawRefs: ['AML § 3-1'],
    desc: 'Beredskapsplan, evakueringsøvelse og brannvernleder.',
    to: '/documents/analyse?law_ref=AML%20%C2%A7%203-1',
    metric: { label: 'Sist øvet', valueFallback: '—' },
    next: { label: 'Neste øvelse', icon: 'AlertTriangle' },
    owner: 'Drift',
  },
  {
    id: 'varsling',
    title: 'Varsling',
    icon: 'Megaphone',
    law: 'AML § 2A-7',
    lawRefs: ['AML § 2A-1', 'AML § 2A-3', 'AML § 2A-4', 'AML § 2A-7'],
    desc: 'Varslingsrutiner, mottak og oppfølging av varsler.',
    to: '/alerts',
    metric: { label: 'Rutine sist revidert', valueFallback: '—' },
    next: { label: 'Årsgjennomgang', icon: 'Calendar' },
    owner: 'HMS-leder',
  },
]

// ── Årshjul ─────────────────────────────────────────────────────────────
//
// 6 rings, 12 month wedges. ring 0 = outermost (AMU), 5 = innermost
// (Beredskap & annet). state is computed at render-time from today's
// date — past = done if ring activity is recurring; current month = now;
// overdue = surfaced via the live task list. The data here is the
// *baseline* annual calendar — what an AMU-styrt virksomhet should do.

export type ArshjulItemState = 'done' | 'now' | 'upcoming' | 'overdue'

export type ArshjulItem = {
  /** 0..11 (Jan..Dec) */
  month: number
  /** 0..5 — see AML_RING_LEGEND */
  ring: number
  label: string
  law: string
  /** Optional override; otherwise computed from today */
  state?: ArshjulItemState
}

export const AML_RING_LEGEND: Array<{ id: number; label: string; color: string }> = [
  { id: 0, label: 'AMU & verneombud', color: '#1a3d32' },
  { id: 1, label: 'Vernerunder & SJA', color: '#2f7757' },
  { id: 2, label: 'ROS & avvik', color: '#c98a2b' },
  { id: 3, label: 'Opplæring', color: '#1d4ed8' },
  { id: 4, label: 'Sykefravær & BHT', color: '#7c3aed' },
  { id: 5, label: 'Beredskap & annet', color: '#525252' },
]

export const AML_WHEEL: ArshjulItem[] = [
  // JANUAR
  { month: 0, ring: 0, label: 'AMU årsplan vedtas', law: '§ 7-2' },
  { month: 0, ring: 2, label: 'HMS-mål for året', law: 'IK § 5 nr. 4' },
  { month: 0, ring: 5, label: 'Internkontroll: årsrevisjon', law: 'IK § 5' },
  // FEBRUAR
  { month: 1, ring: 0, label: 'AMU-møte 1', law: '§ 7-2' },
  { month: 1, ring: 4, label: 'Sykefraværsstatistikk Q4', law: '§ 4-6' },
  { month: 1, ring: 3, label: 'Opplæringsplan signert', law: '§ 3-5' },
  // MARS
  { month: 2, ring: 1, label: 'Vernerunder Q1', law: '§ 3-1 c' },
  { month: 2, ring: 2, label: 'ROS — sveiseverksted', law: '§ 3-1' },
  { month: 2, ring: 4, label: 'BHT-plan godkjennes', law: '§ 3-3' },
  // APRIL
  { month: 3, ring: 0, label: 'Protokoll AMU 1 signert', law: '§ 7-2' },
  { month: 3, ring: 5, label: 'Beredskapsplan revideres', law: '§ 3-1' },
  // MAI
  { month: 4, ring: 0, label: 'AMU-møte 2', law: '§ 7-2' },
  { month: 4, ring: 1, label: 'Vernerunder Q2', law: '§ 3-1 c' },
  { month: 4, ring: 4, label: 'Dialogmøte 1 — pågående saker', law: '§ 4-6' },
  { month: 4, ring: 2, label: 'ROS-revisjon — lager', law: '§ 3-1' },
  // JUNI
  { month: 5, ring: 5, label: 'Evakueringsøvelse', law: 'Brann- og eksplosjonsv.' },
  { month: 5, ring: 1, label: 'SJA — varmt arbeid sommer', law: 'IK § 5 nr. 6' },
  { month: 5, ring: 3, label: '40-t kurs påmelding', law: '§ 6-5' },
  // JULI
  { month: 6, ring: 4, label: 'Sommer — BHT på vakt', law: '§ 3-3' },
  { month: 6, ring: 0, label: 'Ferieavvikling AMU pause', law: '—' },
  // AUGUST
  { month: 7, ring: 0, label: 'AMU-møte 3', law: '§ 7-2' },
  { month: 7, ring: 3, label: 'Ny ansatt-opplæring', law: '§ 3-5' },
  // SEPTEMBER
  { month: 8, ring: 1, label: 'Vernerunder Q3', law: '§ 3-1 c' },
  { month: 8, ring: 4, label: 'Periodisk helseunders.', law: '§ 3-3' },
  { month: 8, ring: 2, label: 'IK-revisjon halvår', law: 'IK § 5' },
  // OKTOBER
  { month: 9, ring: 2, label: 'Arbeidsmiljøundersøkelse', law: '§ 3-1 c' },
  { month: 9, ring: 5, label: 'Beredskapsøvelse — vinter', law: '§ 3-1' },
  // NOVEMBER
  { month: 10, ring: 0, label: 'AMU-møte 4', law: '§ 7-2' },
  { month: 10, ring: 0, label: 'Årsrapport AMU', law: '§ 7-2 (6)' },
  { month: 10, ring: 4, label: 'Sykefraværsanalyse Q3', law: '§ 4-6' },
  // DESEMBER
  { month: 11, ring: 1, label: 'Vernerunder Q4', law: '§ 3-1 c' },
  { month: 11, ring: 3, label: 'Kompetansegap neste år', law: '§ 3-5' },
  { month: 11, ring: 5, label: 'Plan neste år — IK', law: 'IK § 5' },
]

export const MONTHS_NB = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]
export const MONTHS_NB_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun',
  'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des',
]

// Klarert feed copy — v1 hardcoded. Replace with a CMS-backed feed
// when the editorial workflow lands.
export type KlarertFeedKind = 'lov' | 'klarert' | 'tip'

export type KlarertFeedItem = {
  kind: KlarertFeedKind
  date: string
  title: string
  body: string
  cta: string
  pinned?: boolean
}

export const KLARERT_FEED: KlarertFeedItem[] = [
  {
    kind: 'lov',
    date: '02. mai 2026',
    title: 'Endring i AML § 4-6 — ny frist for oppfølgingsplan',
    body: 'Plan ved sykefravær skal nå være sendt arbeidstaker innen 4 uker (tidligere 7). Klarert har oppdatert maler og varslingsregler.',
    cta: 'Les sammendrag',
    pinned: true,
  },
  {
    kind: 'klarert',
    date: '28. apr 2026',
    title: 'Ny modul: Whistleblower-kanal (§ 2A-1)',
    body: 'Egen kanal for varsling om kritikkverdige forhold er nå tilgjengelig som tilleggsmodul. Aktiver fra Innstillinger › Moduler.',
    cta: 'Se modul',
  },
  {
    kind: 'tip',
    date: '24. apr 2026',
    title: 'Tips: Koble vernerunder direkte til ROS',
    body: 'Funn fra en runde kan nå konverteres til risiko i én klikk — sporbart tilbake til selve runden.',
    cta: 'Vis hvordan',
  },
  {
    kind: 'lov',
    date: '15. apr 2026',
    title: 'Arbeidstilsynet — ny veileder om hjemmekontor',
    body: 'Skriftlig avtale, kartlegging av arbeidsplass og rapportering av belastningsskader er presisert.',
    cta: 'Last ned veileder',
  },
]

export const AML_CHAPTERS = [
  { ch: 'Kap. 1', title: 'Innledende bestemmelser', modules: 0 },
  { ch: 'Kap. 2', title: 'Arbeidsgivers og arbeidstakers plikter', modules: 4 },
  { ch: 'Kap. 2A', title: 'Varsling', modules: 1 },
  { ch: 'Kap. 3', title: 'Krav til arbeidsmiljø', modules: 9 },
  { ch: 'Kap. 4', title: 'Krav til psykososialt og fysisk', modules: 6 },
  { ch: 'Kap. 5', title: 'Registrerings- og meldepl.', modules: 2 },
  { ch: 'Kap. 6', title: 'Verneombud', modules: 3 },
  { ch: 'Kap. 7', title: 'Arbeidsmiljøutvalg', modules: 4 },
  { ch: 'Kap. 10', title: 'Arbeidstid', modules: 3 },
]
